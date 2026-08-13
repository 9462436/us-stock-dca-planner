#!/usr/bin/env python3
"""
美股定投工具 — 本地代理服务器
GET  /index.html      — 前端页面
GET  /api/quotes      — 实时报价
GET  /api/fx          — USD/CNY 汇率
GET  /api/market      — 大盘指数 + 板块行情 + 市场情绪
POST /api/send-email  — 发送持仓日报到 163 邮箱
POST /api/holdings    — 同步持仓到服务器（供定时推送用）
GET  /api/email-log   — 邮件发送历史记录
GET  /api/schedule    — 定时配置 (查询)
POST /api/schedule    — 定时配置 (修改)
"""
import http.server
import json
import smtplib
import threading
import urllib.request
import os
import time
from datetime import datetime, timedelta

# 云端时区设置：Render 默认 UTC，强制用北京时间
os.environ['TZ'] = 'Asia/Shanghai'
if hasattr(time, 'tzset'):
    try:
        time.tzset()
    except Exception:
        pass
from email.mime.text import MIMEText
from email.header import Header

PORT = int(os.environ.get('PORT', 8080))  # Render 云部署：自动读取 PORT 环境变量
ALT_PORT = int(os.environ.get('PORT', 8081))
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
FINNHUB_KEY = 'd9ocb79r01qt6o9b6ib0d9ocb79r01qt6o9b6ibg'
CACHE_TTL = 120

# 邮箱配置
SMTP_HOST = 'smtp.163.com'
SMTP_PORT = 465
SMTP_USER = 'tung9462436@163.com'
SMTP_PASS = 'RMQTXBLEXRCUYKCV'  # 授权码
EMAIL_TO = 'tung9462436@163.com'

# Resend API（云端邮件发送，通过 HTTPS 443）
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')  # 云端邮件
print(f"[Config] RESEND_API_KEY: {'已配置 (' + RESEND_API_KEY[:8] + '...)' if RESEND_API_KEY else '未配置'}")


# GitHub Token（云端直接推送 holdings.json 到 GitHub，不等 GitHub Actions）
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
GITHUB_REPO = '9462436/us-stock-dca-planner'
GITHUB_FILE = 'holdings.json'
print(f"[Config] GITHUB_TOKEN: {'已配置 (' + GITHUB_TOKEN[:8] + '...)' if GITHUB_TOKEN else '未配置'}")

# 默认定时推送时间（24 小时制）
# 每半小时 00:00, 00:30, 01:00, ...
DEFAULT_SCHEDULED_TIMES = [f'{h:02d}:{m:02d}' for h in range(24) for m in (0, 30)]
SCHEDULE_FILE = os.path.join(STATIC_DIR, 'schedule.json')
EMAIL_LOG_FILE = os.path.join(STATIC_DIR, 'email_log.json')
SENT_LOG_FILE = os.path.join(STATIC_DIR, 'sent_log.json')

# 强制 stdout 不缓冲，Render 日志立即可见
import sys
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

_cache = {}
_email_lock = threading.Lock()
_market_cache = {}  # 大盘数据独立缓存 (3min TTL)
_sent_today = None       # 跨线程共享：当日已发送 HH:MM 集合
_last_send_time = None    # 最后一次发送时间 (datetime)  # 跨线程共享
_start_time = time.time() # 服务器启动时间

STOCKS = {
    'XQQI': {'secid': '105.XQQI', 'sina': 'gb_xqqi', 'name': 'NEOS Nasdaq-100 High Income ETF'},
    'NVDY': {'secid': '107.NVDY', 'sina': 'gb_nvdy', 'name': 'YieldMax NVDA Option Income ETF'},
    'AMZY': {'secid': '107.AMZY', 'sina': 'gb_amzy', 'name': 'YieldMax AMZN Option Income ETF'},
    'QDTE': {'secid': '107.QDTE', 'sina': 'gb_qdte', 'name': 'Roundhill 0DTE Covered Call ETF'},
    'SPYM': {'secid': '107.SPYM', 'sina': 'gb_spym', 'name': 'YieldMax S&P 500 Option Income ETF'},
}

# 月定投策略配置（复星账户执行）
# XQQI 固定 5 股 + SPYM 固定 2 股，剩余资金均分给 NVDY/AMZY/QDTE
DCA_MONTHLY_RMB = float(os.environ.get('MONTHLY_INVEST_RMB', '7000'))
DCA_FIXED_SHARES = [('XQQI', 5), ('SPYM', 2)]
DCA_REST_TICKERS = ['NVDY', 'AMZY', 'QDTE']

# 默认持仓（如果服务器端没有同步过，用这些）
DEFAULT_HOLDINGS = {'XQQI': 0, 'NVDY': 0, 'AMZY': 0, 'QDTE': 0, 'SPYM': 0}

# 派息信息（用于报表生成）
DIV_INFO = {
    'XQQI':  {'div': 0.75, 'freq': 'monthly'},
    'NVDY':  {'div': 0.08, 'freq': 'weekly'},
    'AMZY':  {'div': 0.07, 'freq': 'weekly'},
    'QDTE':  {'div': 0.60, 'freq': 'monthly'},
    'SPYM':  {'div': 0.35, 'freq': 'monthly'},
}

# 大盘指数配置
MARKET_INDICES = {
    'SPX':   {'secid': 'usINX',      'name': '标普500',   'cn': 'S&P 500'},
    'IXIC':  {'secid': 'usIXIC',     'name': '纳斯达克',   'cn': 'NASDAQ'},
    'DJI':   {'secid': 'usDJI',      'name': '道琼斯',     'cn': 'DJIA'},
    'RUT':   {'secid': 'usRUT',      'name': '罗素2000',   'cn': 'Russell 2000'},
}

# 热门板块 ETF（NYSE Arca: 106）
MARKET_SECTORS = {
    'XLK':   {'secid': 'usXLK',   'name': '科技',       'icon': 'tech',   'weight': 0.12},
    'XLF':   {'secid': 'usXLF',   'name': '金融',       'icon': 'fin',    'weight': 0.10},
    'XLE':   {'secid': 'usXLE',   'name': '能源',       'icon': 'energy', 'weight': 0.08},
    'XLV':   {'secid': 'usXLV',   'name': '医疗健康',   'icon': 'health', 'weight': 0.09},
    'XLY':   {'secid': 'usXLY',   'name': '可选消费',   'icon': 'cons',   'weight': 0.10},
    'XLI':   {'secid': 'usXLI',   'name': '工业',       'icon': 'ind',    'weight': 0.09},
    'XLU':   {'secid': 'usXLU',   'name': '公用事业',   'icon': 'util',   'weight': 0.07},
    'XLB':   {'secid': 'usXLB',   'name': '基础材料',   'icon': 'mat',    'weight': 0.06},
    'XLRE':  {'secid': 'usXLRE',  'name': '房地产',     'icon': 're',     'weight': 0.07},
    'XLC':   {'secid': 'usXLC',   'name': '通讯服务',   'icon': 'comm',   'weight': 0.08},
    'SMH':   {'secid': 'usSMH',   'name': '半导体',     'icon': 'semi',   'weight': 0.07},
    'IBB':   {'secid': 'usIBB',   'name': '生物科技',   'icon': 'bio',    'weight': 0.07},
}

# 情绪指标：VXX (恐慌指数代理) + SHY (避险短债)
MARKET_SENTIMENT = {
    'VXX':   {'secid': 'usVXX',   'name': '恐慌指数',   'cn': 'VIX Proxy'},
    'SHY':   {'secid': 'usSHY',   'name': '短债避险',   'cn': 'Treasury'},
}


# ============ 定时配置管理 ============
def load_schedule():
    if os.path.exists(SCHEDULE_FILE):
        try:
            with open(SCHEDULE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                times = data.get('times', DEFAULT_SCHEDULED_TIMES)
                # 验证格式
                valid = []
                for t in times:
                    try:
                        h, m = t.split(':')
                        h, m = int(h), int(m)
                        if 0 <= h < 24 and 0 <= m < 60:
                            valid.append(f"{h:02d}:{m:02d}")
                    except Exception:
                        pass
                return valid or DEFAULT_SCHEDULED_TIMES
        except Exception:
            pass
    return DEFAULT_SCHEDULED_TIMES

def save_schedule(times):
    with open(SCHEDULE_FILE, 'w', encoding='utf-8') as f:
        json.dump({'times': times, 'updated': time.strftime('%Y-%m-%d %H:%M:%S')}, f, ensure_ascii=False, indent=2)
    # 云端有 GitHub Token 时同步推送，避免本地与云端 schedule 不一致
    if GITHUB_TOKEN:
        threading.Thread(target=push_schedule_to_github, args=(times,), daemon=True).start()


def push_schedule_to_github(times):
    """把 schedule.json 同步推送到 GitHub，让 Render 重启后加载相同配置"""
    import base64
    url = f'https://api.github.com/repos/{GITHUB_REPO}/contents/schedule.json'
    headers = {
        'Authorization': f'Bearer {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CloudSync/1.0',
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            current = json.loads(resp.read().decode())
            sha = current.get('sha', '')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            sha = ''
        else:
            print(f"[GitHub] 获取 schedule SHA 失败: {e.code}")
            return
    content_b64 = base64.b64encode(
        json.dumps({'times': times, 'updated': time.strftime('%Y-%m-%d %H:%M:%S')}, ensure_ascii=False, indent=2).encode('utf-8')
    ).decode('ascii')
    body = json.dumps({
        'message': 'auto-sync: 更新邮件推送时间表',
        'content': content_b64,
        'sha': sha,
        'branch': 'main',
    }).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method='PUT')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            if 'content' in result:
                print(f"[GitHub] schedule.json 已同步 ✓")
    except Exception as e:
        print(f"[GitHub] schedule 推送失败: {e}")


# ============ 邮件发送日志 ============
def load_email_log():
    if os.path.exists(EMAIL_LOG_FILE):
        try:
            with open(EMAIL_LOG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {'records': []}

def append_email_log(record):
    """记录发送日志，最多保留 100 条"""
    log = load_email_log()
    log['records'].append(record)
    if len(log['records']) > 100:
        log['records'] = log['records'][-100:]
    with open(EMAIL_LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


# ============ 数据源 ============
def fetch_finnhub(ticker):
    url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={FINNHUB_KEY}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())


def fetch_eastmoney(secid):
    url = f"https://push2.eastmoney.com/api/qt/stock/get?secid={secid}&fields=f43,f44,f45,f46,f60,f169,f170"
    req = urllib.request.Request(url)
    req.add_header('User-Agent', 'Mozilla/5.0')
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = json.loads(resp.read().decode())
        data = raw.get('data', {})
        if not data or not data.get('f43'):
            return None
        price = data['f43'] / 1000
        return {
            'c': price,
            'd': (data.get('f169', 0) or 0) / 1000,
            'dp': (data.get('f170', 0) or 0) / 100,
            'h': (data.get('f44', 0) or price * 1000) / 1000,
            'l': (data.get('f45', 0) or price * 1000) / 1000,
            'o': (data.get('f46', 0) or price * 1000) / 1000,
            'pc': (data.get('f60', 0) or price * 1000) / 1000,
            't': int(time.time())
        }


def fetch_sina(sina_code):
    """新浪美股行情（稳定、无鉴权、纯文本）
    字段顺序: 名称,最新价,涨跌额,时间,涨跌幅,开盘价,最高价,最低价,成交量,昨日收盘价,...

    关键: 对于 NAV 持续复权调整的 ETF（如 NVDY/AMZY 等期权收益型），
    新浪 d 字段是「复权累计变动」（含分红除权），不是昨收差异。
    直接用新浪给的 dp（涨跌幅）反推昨收：pc = c / (1 + dp/100)
    """
    url = f"https://hq.sinajs.cn/list={sina_code}"
    req = urllib.request.Request(url)
    req.add_header('Referer', 'https://finance.sina.com.cn')
    with urllib.request.urlopen(req, timeout=8) as resp:
        raw = resp.read().decode('gbk')
    if '=""' in raw or '=' not in raw:
        return None
    fields = raw.split('"')[1].split(',')
    if len(fields) < 8:
        return None
    price = float(fields[1]) if fields[1] else 0
    change_pct = float(fields[4]) if fields[4] else 0
    open_price = float(fields[5]) if fields[5] else price
    high = float(fields[6]) if fields[6] else price
    low = float(fields[7]) if fields[7] else price
    # 用 dp 反推昨收，避免 d 字段对高频分红 ETF 不可靠的问题
    prev_close = price / (1 + change_pct / 100) if price > 0 else price
    change = round(price - prev_close, 4)
    if price <= 0:
        return None
    return {
        'c': price,
        'd': change,
        'dp': change_pct,
        'h': high,
        'l': low,
        'o': open_price,
        'pc': round(prev_close, 4),
        't': int(time.time())
    }


def fetch_fx():
    """从 Yahoo Finance 实时拉取汇率（每分钟更新）"""
    # 优先 Yahoo Finance（实时，1 分钟延迟）
    try:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/USDCNY=X?interval=1m&range=1d"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            result = data['chart']['result'][0]
            # 最新价格 = meta.regularMarketPrice
            price = result['meta'].get('regularMarketPrice')
            if price:
                return float(price)
    except Exception as e:
        print(f"[FX] Yahoo 失败: {e}")

    # 兜底：exchangerate-api.com（每日更新）
    try:
        url = "https://open.er-api.com/v6/latest/USD"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data['rates']['CNY']
    except Exception as e:
        print(f"[FX] 兜底也失败: {e}")
        return 6.75  # 最后兜底


def fetch_market_batch(secid_map):
    """批量拉取大盘行情（腾讯 qt.gtimg.cn，一次请求多个标的）

    返回格式（每行）: v_<secid>="200~name~code~current~prev_close~open~...~date~change~change_pct~..."
    字段位置:
        [0]status 200 / [1]cn_name / [2]code / [3]current / [4]prev_close / [5]open
        [6]volume / [30]date / [31]change / [32]change_pct / [33]high / [34]low / [41]full_name
    """
    if not secid_map:
        return {}
    secids = ','.join(v['secid'] for v in secid_map.values())
    url = f"https://qt.gtimg.cn/q={secids}"
    req = urllib.request.Request(url)
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    req.add_header('Referer', 'https://finance.qq.com/')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode('gbk', errors='ignore')
        result = {}
        for line in raw.split('\n'):
            line = line.strip()
            if not line.startswith('v_'):
                continue
            try:
                key, payload = line.split('=', 1)
                payload = payload.strip().strip(';').strip('"')
                if not payload or payload.startswith('v_pv_none_match'):
                    continue
                parts = payload.split('~')
                if len(parts) < 33 or parts[0] != '200':
                    continue
                # 反查 ticker
                secid_short = key[2:]  # e.g. "usINX" or "usXLK.AM" -> take usXXX
                # 用 secid 前缀匹配
                ticker = None
                for t, info in secid_map.items():
                    if info['secid'] == secid_short or info['secid'].startswith(secid_short):
                        ticker = t
                        break
                if not ticker:
                    continue
                current = float(parts[3])
                prev_close = float(parts[4])
                if current <= 0 or prev_close <= 0:
                    continue
                change = float(parts[31]) if len(parts) > 31 else (current - prev_close)
                change_pct = float(parts[32]) if len(parts) > 32 else ((current - prev_close) / prev_close * 100)
                result[ticker] = {
                    'c': current,
                    'd': change,
                    'dp': change_pct,
                    'h': float(parts[33]) if len(parts) > 33 else current,
                    'l': float(parts[34]) if len(parts) > 34 else current,
                    'o': float(parts[5]) if len(parts) > 5 else current,
                    'pc': prev_close,
                    'name': parts[1],
                }
            except (ValueError, IndexError) as e:
                continue
        return result
    except Exception as e:
        print(f"[Market] 请求失败: {type(e).__name__}: {e}")
        return {}


# Debug: count raw lines received
_MARKET_DEBUG = True


def get_market_data():
    """获取大盘指数 + 热门板块 + 情绪数据 (60秒缓存)"""
    now = time.time()
    if _market_cache.get('ts') and now - _market_cache['ts'] < 60:
        return _market_cache['data']

    # 构建 secid 映射（保持 cfg_dict 形式供 wrap_section 使用）
    all_secids = {}
    for k, v in {**MARKET_INDICES, **MARKET_SECTORS, **MARKET_SENTIMENT}.items():
        all_secids[k] = {'secid': v['secid']}

    # 批量拉取
    raw = fetch_market_batch(all_secids)

    def wrap_section(cfg_dict, raw_data):
        items = []
        up = down = 0
        for ticker, info in cfg_dict.items():
            q = raw_data.get(ticker)
            if q and q.get('c', 0) > 0:
                items.append({**info, 'ticker': ticker, 'quote': q})
                if q.get('dp', 0) >= 0:
                    up += 1
                else:
                    down += 1
        return {'items': items, 'up': up, 'down': down}

    data = {
        'indices': wrap_section(MARKET_INDICES, raw),
        'sectors': wrap_section(MARKET_SECTORS, raw),
        'sentiment': wrap_section(MARKET_SENTIMENT, raw),
        'ts': int(now)
    }

    # 计算综合情绪分数 (0-100，50为中性)
    idx_items = data['indices']['items']
    sec_items = data['sectors']['items']

    # 指数加权平均涨跌
    idx_avg_dp = 0
    if idx_items:
        weights = {'SPX': 0.4, 'IXIC': 0.3, 'DJI': 0.2, 'RUT': 0.1}
        total_w = sum(weights.get(i['ticker'], 0.1) for i in idx_items)
        idx_avg_dp = sum(
            i['quote']['dp'] * weights.get(i['ticker'], 0.1)
            for i in idx_items
        ) / max(total_w, 0.01)

    # 板块宽度
    sec_adv_pct = data['sectors']['up'] / max(len(data['sectors']['items']), 1) * 100

    # 综合情绪 = 60% 指数表现 + 40% 板块宽度
    idx_signal = 50 + idx_avg_dp * 6  # 每1%涨跌≈6分
    idx_signal = max(0, min(100, idx_signal))
    composite = idx_signal * 0.6 + sec_adv_pct * 0.4
    composite = round(max(0, min(100, composite)), 1)

    if composite >= 75:
        sentiment_label = '强烈乐观'
        sentiment_color = '#22c55e'
    elif composite >= 60:
        sentiment_label = '偏乐观'
        sentiment_color = '#4ade80'
    elif composite >= 45:
        sentiment_label = '中性'
        sentiment_color = '#f59e0b'
    elif composite >= 30:
        sentiment_label = '偏谨慎'
        sentiment_color = '#f87171'
    else:
        sentiment_label = '恐慌'
        sentiment_color = '#ef4444'

    data['composite'] = {
        'score': composite,
        'label': sentiment_label,
        'color': sentiment_color,
        'idx_avg_dp': round(idx_avg_dp, 2),
        'sec_adv_pct': round(sec_adv_pct, 1),
    }

    _market_cache['ts'] = now
    _market_cache['data'] = data
    ok = len(idx_items) + len(sec_items)
    print(f"[Market] indices={len(idx_items)} sectors={len(sec_items)} sentiment={len(data['sentiment']['items'])}")
    return data


def get_all_quotes():
    now = time.time()
    if _cache.get('ts') and now - _cache['ts'] < CACHE_TTL:
        return _cache['data']

    result = {}
    for ticker, info in STOCKS.items():
        # 1. 新浪（最稳定）
        try:
            data = fetch_sina(info['sina'])
            if data and data.get('c', 0) > 0:
                result[ticker] = data
                continue
        except Exception as e:
            print(f"[Sina:{ticker}] {e}")

        # 2. EastMoney（备选）
        try:
            data = fetch_eastmoney(info['secid'])
            if data and data.get('c', 0) > 0:
                result[ticker] = data
                continue
        except Exception as e:
            print(f"[EastMoney:{ticker}] {e}")

        # 3. Finnhub（兜底）
        try:
            data = fetch_finnhub(ticker)
            if data and data.get('c', 0) > 0:
                result[ticker] = data
                continue
        except Exception as e:
            print(f"[Finnhub:{ticker}] {e}")

        result[ticker] = None

    ok = sum(1 for v in result.values() if v)
    print(f"[Quotes] {ok}/{len(result)} stocks fetched at {time.strftime('%H:%M:%S')}")

    fx = 6.75
    try:
        fx = fetch_fx()
    except Exception as e:
        print(f"[FX] fallback: {e}")

    _cache['ts'] = now
    _cache['data'] = {'quotes': result, 'fx': fx, 'ok': ok}
    return _cache['data']


def load_holdings():
    """从服务器端 holdings.json 读取持仓"""
    path = os.path.join(STATIC_DIR, 'holdings.json')
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_HOLDINGS.copy()


def save_holdings(h):
    path = os.path.join(STATIC_DIR, 'holdings.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(h, f, ensure_ascii=False, indent=2)

    # 云端有 GitHub Token 时，直接推送到 GitHub 仓库（瞬时同步）
    if GITHUB_TOKEN:
        threading.Thread(target=push_holdings_to_github, args=(h,), daemon=True).start()


# ============ 持久化发送记录 ============
def load_sent_log():
    """读取今日已发送记录，日期变了自动清空"""
    today = time.strftime('%Y-%m-%d', time.localtime())
    try:
        with open(SENT_LOG_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if data.get('date') == today:
            return set(data.get('sent', []))
    except Exception:
        pass
    return set()

def save_sent_log(sent_set):
    """持久化今日已发送记录到磁盘，跨进程重启可恢复"""
    today = time.strftime('%Y-%m-%d', time.localtime())
    try:
        with open(SENT_LOG_FILE, 'w', encoding='utf-8') as f:
            json.dump({'date': today, 'sent': sorted(sent_set)}, f, ensure_ascii=False)
    except Exception:
        pass

def push_holdings_to_github(holdings):
    """通过 GitHub REST API 推送 holdings.json（避免 5 分钟延迟）"""
    import base64
    url = f'https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_FILE}'
    headers = {
        'Authorization': f'Bearer {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'CloudSync/1.0',
    }
    try:
        # 第一步：获取当前文件的 SHA
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            current = json.loads(resp.read().decode())
            sha = current.get('sha', '')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            sha = ''  # 文件不存在，将创建
        else:
            print(f"[GitHub] 获取 SHA 失败: {e.code}")
            return

    # 第二步：PUT 更新
    content_b64 = base64.b64encode(
        json.dumps(holdings, ensure_ascii=False, indent=2).encode('utf-8')
    ).decode('ascii')
    body = json.dumps({
        'message': 'auto-sync: 网页修改持仓',
        'content': content_b64,
        'sha': sha,
        'branch': 'main',
    }).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=headers, method='PUT')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
            if 'content' in result:
                print(f"[GitHub] holdings.json 已推送 ✓")
    except Exception as e:
        print(f"[GitHub] 推送失败: {e}")


def build_dca_plan(quotes, fx):
    """基于月定投金额 + 当前价格，计算本月建议买入清单"""
    total_usd = DCA_MONTHLY_RMB / fx
    plan = []

    # 固定买入
    for ticker, n in DCA_FIXED_SHARES:
        q = quotes.get(ticker)
        if q and q.get('c', 0) > 0:
            price = q['c']
            cost = n * price
            if total_usd >= cost:
                plan.append({'ticker': ticker, 'shares': n, 'price': price, 'cost': cost})
                total_usd -= cost

    # 剩余均分给 NVDY/AMZY/QDTE
    rest = [t for t in DCA_REST_TICKERS]
    per = total_usd / len(rest) if rest else 0
    for ticker in rest:
        q = quotes.get(ticker)
        if q and q.get('c', 0) > 0:
            price = q['c']
            n = int(per / price)
            if n > 0:
                cost = n * price
                plan.append({'ticker': ticker, 'shares': n, 'price': price, 'cost': cost})

    total_cost = sum(p['cost'] for p in plan)
    leftover = DCA_MONTHLY_RMB / fx - total_cost
    return plan, total_cost, leftover


def generate_report(holdings=None):
    """生成持仓日报文本"""
    if holdings is None:
        holdings = load_holdings()

    data = get_all_quotes()
    quotes = data['quotes']
    fx = data['fx']

    now = time.strftime('%Y-%m-%d %H:%M', time.localtime())
    days = ['周日','周一','周二','周三','周四','周五','周六']
    weekday = days[int(time.strftime('%w'))]

    lines = [f"{now} {weekday} 美股持仓 · 今日收益"]
    lines.append("=" * 40)

    total_value = 0
    total_pnl = 0

    for ticker, info in STOCKS.items():
        q = quotes.get(ticker)
        shares = holdings.get(ticker, 0)
        if not shares or not q or q.get('c', 0) <= 0:
            continue
        price = q['c']
        prev = q.get('pc', price)
        val = shares * price * fx
        pnl = shares * (price - prev) * fx
        pnl_pct = (price - prev) / prev * 100 if prev > 0 else 0
        total_value += val
        total_pnl += pnl

        sign = '+' if pnl >= 0 else ''
        lines.append(
            f"{ticker:<6} {shares:>5}股  ${price:>8.2f}  "
            f"¥{val:>10,.0f}  {sign}¥{pnl:>8,.0f}  {sign}{pnl_pct:.2f}%"
        )

    lines.append("=" * 40)
    lines.append(f"总市值   ¥{total_value:,.0f}")
    sign = '+' if total_pnl >= 0 else ''
    lines.append(f"今日盈亏  {sign}¥{total_pnl:,.0f}")
    lines.append(f"美元汇率  $1 = ¥{fx:.4f}")
    lines.append("")
    lines.append("-- 策 · 美股定投助手")

    return "\n".join(lines)


def send_email_via_resend(subject, body):
    """通过 Resend HTTPS API 发送邮件（Render 等云端环境 SMTP 被屏蔽时的替代方案）"""
    url = "https://api.resend.com/emails"
    # from 必须用 Resend 已验证的域名，@163.com 不归 Resend 管
    # Free 计划可使用 onboarding@resend.dev 测试发信
    from_addr = os.environ.get('RESEND_FROM', '美股定投助手 <onboarding@resend.dev>')
    # 云端可自定义收件人（解决 onboarding@resend.dev 只能发到注册邮箱的限制）
    resend_to = os.environ.get('RESEND_TO', '').strip()
    to_addr = resend_to or EMAIL_TO
    payload = json.dumps({
        "from": from_addr,
        "to": [to_addr],
        "subject": subject,
        "text": body,
    }).encode('utf-8')
    req = urllib.request.Request(url, data=payload)
    req.add_header('Authorization', f'Bearer {RESEND_API_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            print(f"[Resend] HTTP {resp.status}: {json.dumps(result)[:200]}")
            if 'id' in result:
                return True, None
            return False, result.get('message', '未知错误')
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()[:300] if e.fp else ''
        print(f"[Resend] HTTP {e.code}: {err_body}")
        return False, f'Resend HTTP {e.code}: {err_body}'
    except Exception as e:
        print(f"[Resend] 异常: {e}")
        return False, f'Resend: {e}'


def send_email_via_smtp(subject, body):
    """通过 163 SMTP 发送邮件（免费，无日限额）"""
    try:
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = Header(subject, 'utf-8')
        msg['From'] = SMTP_USER
        msg['To'] = EMAIL_TO
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, [EMAIL_TO], msg.as_string())
        print(f"[SMTP] 发送成功")
        return True, None
    except Exception as e:
        print(f"[SMTP] 发送失败: {e}")
        return False, str(e)

def send_email(subject, body):
    """发送邮件：优先 163 SMTP，失败后回退 Resend"""
    ok, err = send_email_via_smtp(subject, body)
    if ok:
        return True, None
    if RESEND_API_KEY:
        ok2, err2 = send_email_via_resend(subject, body)
        if ok2:
            print(f"[Email] SMTP失败，Resend 回退成功")
            return True, None
        return False, f'SMTP: {err} / Resend: {err2}'
    return False, f'SMTP: {err}'


def scheduler_loop():
    """定时推送：队列模式 + 持久化已发送记录 + 启动时补发遗漏"""
    global _sent_today, _last_send_time
    import queue as qmod
    pending = qmod.Queue()
    _daily_limit = len(load_schedule())  # 每日发送上限
    _daily_count = [0]  # 用列表让闭包可修改

    def sender_worker():
        """消费队列：逐一发送，失败重试一次，成功后写持久化日志"""
        global _last_send_time
        while True:
            task = pending.get()
            _daily_count[0] += 1
            if _daily_count[0] > _daily_limit:
                print(f"[Scheduler] 已达今日上限 {_daily_limit}，丢弃: {task['now']}")
                pending.task_done()
                continue
            today_slot, now, holdings = task['today_slot'], task['now'], task['holdings']

            ok = False
            for attempt in range(2):
                try:
                    report = generate_report(holdings)
                    subject = f"美股持仓日报 · {today_slot} {now}"
                    ok, err = send_email(subject, report)
                    if ok:
                        break
                except Exception as e:
                    err = str(e)
                if attempt == 0:
                    time.sleep(3)
            status = 'success' if ok else 'failed'
            msg = '已发送' if ok else f'失败(重试后): {err}'
            _last_send_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
            print(f"[Scheduler] {msg} ({now})")
            append_email_log({
                'time': f"{today_slot} {now}",
                'status': status,
                'subject': f"美股持仓日报 · {today_slot} {now}" if ok else '',
                'message': msg,
                'total_value': sum(
                    holdings.get(t, 0) * (get_all_quotes()['quotes'].get(t, {}) or {}).get('c', 0) * get_all_quotes()['fx']
                    for t in STOCKS
                    if holdings.get(t, 0) > 0 and (get_all_quotes()['quotes'].get(t, {}) or {}).get('c', 0) > 0
                ) if ok else 0
            })
            pending.task_done()

    threading.Thread(target=sender_worker, daemon=True).start()

    # 加载持久化已发送记录
    _sent_today = load_sent_log()
    today = time.strftime('%Y-%m-%d', time.localtime())
    print(f"[Scheduler] 恢复今日已发送: {len(_sent_today)} 个时间点")

    # 启动时补发：已禁用（防止 Render 部署时多实例同时触发）
    # 用户每小时都收邮件，漏一封影响不大；补发逻辑在 rolling deploy 时会刷邮箱
    print(f"[Scheduler] 启动补发已禁用（防多实例并发发送），等待下一个整点")

    # 主循环
    while True:
        now = time.strftime('%H:%M', time.localtime())
        today = time.strftime('%Y-%m-%d', time.localtime())

        # 每天 00:00 重置
        if now == '00:00' and _sent_today:
            _sent_today.clear()
            _daily_count[0] = 0
            save_sent_log(_sent_today)
            print("[Scheduler] 新的一天，已发送记录+计数器已重置")

        # 重新加载 schedule（支持运行时修改）
        scheduled = load_schedule()

        # ⚠️ 防双触发：60秒窗口内不重复发送（防 rolling deploy 多实例并发）
        if now in scheduled and now not in _sent_today:
            # 检查距上次发送是否 < 60 秒
            if _last_send_time:
                last_ts = time.mktime(time.strptime(_last_send_time, '%Y-%m-%d %H:%M:%S'))
                if time.time() - last_ts < 60:
                    time.sleep(10)
                    continue

            _sent_today.add(now)
            save_sent_log(_sent_today)
            holdings = load_holdings()
            if any(v > 0 for v in holdings.values()):
                pending.put({'today_slot': today, 'now': now, 'holdings': dict(holdings)})
                print(f"[Scheduler] 入队: {now}")
            else:
                print(f"[Scheduler] 无持仓，跳过 ({now})")
                append_email_log({
                    'time': f"{today} {now}",
                    'status': 'skipped',
                    'subject': '',
                    'message': '无持仓'
                })

        # 每 10 秒检查一次（更密集）
        time.sleep(10)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def send_head(self):
        # index.html 走专门的处理（支持 gzip）
        path = self.path.split('?')[0]
        if path in ('/', '/index.html'):
            try:
                full_path = os.path.join(STATIC_DIR, 'index.html')
                with open(full_path, 'rb') as f:
                    body = f.read()
                self.send_response(200)
                ctype = 'text/html; charset=utf-8'
                self.send_header('Content-Type', ctype)
                self.send_header('Cache-Control', 'public, max-age=3600')
                accept_enc = self.headers.get('Accept-Encoding', '')
                if 'gzip' in accept_enc:
                    import gzip as _gzip
                    body = _gzip.compress(body)
                    self.send_header('Content-Encoding', 'gzip')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                import io
                return io.BytesIO(body)
            except OSError:
                return super().send_head()
        return super().send_head()

    def do_GET(self):
        try:
            self._do_GET_inner()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            try:
                print(f"[Handler] GET {self.path}: {type(e).__name__}: {e}")
                self.send_json({'error': str(e), 'ok': False})
            except Exception:
                pass

    def _do_GET_inner(self):
        if self.path == '/api/quotes':
            self.send_json(get_all_quotes())
        elif self.path == '/api/fx':
            try:
                fx = fetch_fx()
                self.send_json({'fx': fx, 'ok': True})
            except Exception as e:
                self.send_json({'fx': 6.75, 'ok': False, 'error': str(e)})
        elif self.path == '/api/email-log':
            log = load_email_log()
            # 倒序返回（最新的在前）
            log['records'] = list(reversed(log['records']))
            log['count'] = len(log['records'])
            self.send_json(log)
        elif self.path == '/api/schedule':
            self.send_json({'times': load_schedule(), 'default': DEFAULT_SCHEDULED_TIMES})
        elif self.path == '/api/market':
            self.send_json(get_market_data())
        elif self.path == '/api/load-holdings':
            # GET 持仓数据（前端启动时拉取，与 server 同源）
            self.send_json({'holdings': load_holdings()})
        elif self.path == '/api/health':
            # 健康检查 + 调度器状态
            scheduled = load_schedule()
            now_hm = time.strftime('%H:%M', time.localtime())
            future = [t for t in scheduled if t >= now_hm]
            next_send = future[0] if future else (scheduled[0] if scheduled else None)
            self.send_json({
                'ok': True,
                'time': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime()),
                'uptime_seconds': int(time.time() - _start_time),
                'scheduler': {
                    'today_sent_count': len(_sent_today) if _sent_today else 0,
                    'next_send': next_send,
                    'last_send': _last_send_time,
                },
                'holdings': load_holdings(),
            })
        elif self.path == '/api/debug-config':
            # 调试：返回当前关键配置（脱敏）
            self.send_json({
                'resend_configured': bool(RESEND_API_KEY),
                'resend_prefix': RESEND_API_KEY[:8] + '...' if RESEND_API_KEY else None,
                'resend_to': os.environ.get('RESEND_TO', ''),
                'smtp_user': SMTP_USER,
                'email_to': EMAIL_TO,
                'port': PORT,
            })
        else:
            super().do_GET()

    def end_headers(self):
        # 静态文件（HTML/JS/CSS）：添加缓存头和 gzip 支持
        path = self.path.split('?')[0]
        # 缓存策略：HTML 1 小时（开发期短），JS/CSS 1 天
        if path.endswith('.html') or path == '/' or path == '/index.html':
            self.send_header('Cache-Control', 'public, max-age=3600')
        elif path.endswith('.js') or path.endswith('.css'):
            self.send_header('Cache-Control', 'public, max-age=86400')
        super().end_headers()

    def do_POST(self):
        try:
            self._do_POST_inner()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            try:
                print(f"[Handler] POST {self.path}: {type(e).__name__}: {e}")
                self.send_json({'error': str(e), 'ok': False})
            except Exception:
                pass

    def _do_POST_inner(self):
        if self.path == '/api/send-email':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            report = data.get('report', '')
            to = data.get('to', EMAIL_TO)
            subject = data.get('subject', '美股持仓日报')
            ok, err = send_email(subject, report)
            if ok:
                print(f"[Email] 日报已发送到 {to}")
                append_email_log({
                    'time': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'status': 'success',
                    'subject': subject,
                    'message': f'已发送至 {to} (手动)'
                })
                self.send_json({'ok': True})
            else:
                print(f"[Email] 发送失败: {err}")
                append_email_log({
                    'time': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'status': 'failed',
                    'subject': subject,
                    'message': err
                })
                self.send_json({'ok': False, 'error': err})
        elif self.path == '/api/holdings':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            save_holdings(data)
            print(f"[Holdings] 已同步: {data}")
            self.send_json({'ok': True})
        elif self.path == '/api/schedule':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            times = data.get('times', [])
            # 验证格式
            valid = []
            for t in times:
                try:
                    h, m = t.split(':')
                    h, m = int(h), int(m)
                    if 0 <= h < 24 and 0 <= m < 60:
                        valid.append(f"{h:02d}:{m:02d}")
                except Exception:
                    pass
            if valid:
                save_schedule(valid)
                print(f"[Schedule] 已更新: {valid}")
                self.send_json({'ok': True, 'times': valid})
            else:
                self.send_json({'ok': False, 'error': '无有效时间'})
        else:
            self.send_response(404)
            self.end_headers()

    def send_json(self, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        # 启用 gzip 压缩（体积缩小 70-80%）
        accept_enc = self.headers.get('Accept-Encoding', '')
        if 'gzip' in accept_enc:
            import gzip as _gzip
            body = _gzip.compress(body)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=60')  # 60s 浏览器缓存
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=60')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # 客户端断开，吞掉异常避免进程崩溃
            pass

    def log_message(self, format, *args):
        try:
            # Python 3.12+ 第一个参数可能是 HTTPStatus 枚举，不能直接 'in' 检查
            msg = format % args if args else format
            if '/api/' in str(msg):
                print(f"[{time.strftime('%H:%M:%S')}] {msg}")
        except Exception:
            pass


if __name__ == '__main__':
    # 启动定时推送线程
    print("[Boot] 启动调度器线程...", flush=True)
    scheduler = threading.Thread(target=scheduler_loop, daemon=True)
    scheduler.start()
    scheduled = load_schedule()
    print(f"[Boot] 定时推送已启动: {', '.join(scheduled[:6])}... (共 {len(scheduled)} 个时间点)", flush=True)

    # Render 免费版 15 分钟休眠 → 每 14 分钟自 ping 一次保持活跃
    if os.environ.get('RENDER'):
        def keep_alive():
            while True:
                time.sleep(14 * 60)
                try:
                    url = f"http://127.0.0.1:{PORT}/api/fx"
                    urllib.request.urlopen(url, timeout=5)
                except Exception:
                    pass
        ka = threading.Thread(target=keep_alive, daemon=True)
        ka.start()
        print("[KeepAlive] 每 14 分钟自 ping 防休眠")

    print(f"\n{'='*50}")
    print(f"  美股定投工具 — 本地代理服务器")
    print(f"  邮箱: {EMAIL_TO}")
    print(f"{'='*50}\n")

    server = None
    actual_port = PORT
    try:
        server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    except OSError:
        print(f"[Server] 端口 {PORT} 被占用，退回到 {ALT_PORT}")
        actual_port = ALT_PORT
        server = http.server.HTTPServer(('0.0.0.0', ALT_PORT), Handler)
    print(f"  地址: http://localhost:{actual_port}/index.html")
    print(f"  邮箱: {EMAIL_TO}")
    print(f"  定时: {', '.join(scheduled)}")
    print(f"{'='*50}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")
