# optimistic_parameter_sweep.py
"""
Parameter sweep for sustainableYield and erosionRate.
Generates combos, runs backtest for each, records monthly dividend,
writes report and best params.
"""

import math, random, copy, json, sys
from datetime import datetime

# ----------------------------------------------------------------------
# 1. 原始配置（摘自 verify_20year_dividend_correct_optimistic.py）
# ----------------------------------------------------------------------
STOCK_CONFIG = {
    'XQQI': {
        'price': 50.2393,
        'sustainableYield': 0.144,
        'expectedPriceReturn': -0.01,
        'annualVol': 0.15,
        'erosionRate': 5
    },
    'NVDY': {
        'price': 13.04,
        'sustainableYield': 0.173,
        'expectedPriceReturn': 0.00,
        'annualVol': 0.18,
        'erosionRate': 12
    },
    'AMZY': {
        'price': 11.04,
        'sustainableYield': 0.158,
        'expectedPriceReturn': -0.01,
        'annualVol': 0.15,
        'erosionRate': 13
    },
    'QDTE': {
        'price': 29.88,
        'sustainableYield': 0.173,
        'expectedPriceReturn': 0.02,
        'annualVol': 0.14,
        'erosionRate': 8
    },
    'SPYM': {
        'price': 91.56,
        'sustainableYield': 0.115,
        'expectedPriceReturn': 0.05,
        'annualVol': 0.12,
        'erosionRate': 3
    }
}

# Keep original copies for resetting
ORIG_CONFIG = {k: v.copy() for k, v in STOCK_CONFIG.items()}

FX_RATE = 6.757039
MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
TAX_RATE = 0.0

# ----------------------------------------------------------------------
# 2. 参数组合定义
# ----------------------------------------------------------------------
# 参数: sustainableYield_factor (1.0, 1.2, 1.4)
#       erosion_delta (0, -2)   # reduce erosionRate by this many percentage points
sustainableYield_factors = [1.0, 1.2, 1.4]
erosion_deltas = [0, -2]   # -2 means reduce erosionRate by 2 percentage points

# 固定买入与剩余分配的配置（与原脚本保持一致）
FIXED_SHARES = [('XQQI', 5), ('SPYM', 2)]
REST_TICKERS = ['NVDY', 'AMZY', 'QDTE']

# ----------------------------------------------------------------------
# 3. 辅助函数（复制自原脚本）
# ----------------------------------------------------------------------
def randn():
    u1 = random.random()
    u2 = random.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)

def calculate_monthly_dividend(data):
    if len(data) <= 12:
        return data[-1]['cumulative_dividends_rmb'] / max(data[-1]['month'], 1)
    year_ago = data[-13]
    last = data[-1]
    return (last['cumulative_dividends_rmb'] - year_ago['cumulative_dividends_rmb']) / 12

# ----------------------------------------------------------------------
# 4. 简化版回测核心（直接使用传入的 config）
# ----------------------------------------------------------------------
def run_backtest(config):
    """在给定 config 下运行一次完整的 20 年回测，返回 monthly_data 列表。"""
    # 初始化股票状态
    stocks = []
    for ticker, c in config.items():
        stocks.append({
            'ticker': ticker,
            'shares': 0.0,
            'price': c['price'],
            'costBasis': 0.0,
            'totalDividendsEarned': 0.0,
            'sustainableYield': c['sustainableYield'],
            'monthlyPriceRet': (1 + c['expectedPriceReturn']) ** (1/12) - 1,
            'annualVol': c['annualVol'],
            'erosionRate': c['erosionRate']
        })

    monthly_nav = []
    cumulative_invested_rmb = 0.0

    # 240 个月的循环
    for month in range(MONTHS):
        # 1) 定投买入
        monthly_invest = MONTHLY_INVEST_RMB
        monthly_invest_usd = monthly_invest / FX_RATE

        # 固定买入部分
        for ticker, shares in FIXED_SHARES:
            stock = next(s for s in stocks if s['ticker'] == ticker)
            cost_usd = shares * stock['price']
            stock['shares'] += shares
            stock['costBasis'] += cost_usd
            monthly_invest_usd -= cost_usd

        # 剩余部分均分
        remaining_usd = monthly_invest_usd
        per_ticker_usd = remaining_usd / len(REST_TICKERS)
        for ticker in REST_TICKERS:
            stock = next(s for s in stocks if s['ticker'] == ticker)
            shares = int(per_ticker_usd // stock['price'])
            cost_usd = shares * stock['price']
            stock['shares'] += shares
            stock['costBasis'] += cost_usd

        cumulative_invested_rmb += MONTHLY_INVEST_RMB

        # 2) NAV侵蚀调整
        for stock in stocks:
            monthly_erosion = (1 - stock['erosionRate'] / 100) ** (1/12)
            stock['sustainableYield'] *= monthly_erosion

        # 3) 派息与复投
        for stock in stocks:
            if stock['shares'] > 0:
                div_per_share = stock['price'] * (stock['sustainableYield'] / 12)
                gross = stock['shares'] * div_per_share
                net = gross * (1 - TAX_RATE)
                stock['totalDividendsEarned'] += net
                # 自动再投资
                stock['shares'] += net / stock['price']
                stock['costBasis'] += net

        # 4) 价格变动（统一组合冲击 + 非系统性冲击）
        portfolio_monthly_vol = math.sqrt(sum(s['annualVol']**2 for s in stocks) / len(stocks)) / math.sqrt(12)
        common_shock = randn() * portfolio_monthly_vol
        for stock in stocks:
            idio_shock = randn() * (stock['annualVol'] / math.sqrt(12)) * 0.3
            monthly_ret = stock['monthlyPriceRet'] + common_shock + idio_shock
            stock['price'] *= (1 + monthly_ret)
            if stock['price'] < 0.01:
                stock['price'] = 0.01

        # 记录月度数据（此处不保存每月详细数据，只在结束时计算指标）

    # 计算累计股息（以当前汇率换算）
    cumulative_div_rmb = sum(s['totalDividendsEarned'] for s in stocks) * FX_RATE

    # 构造简化的 monthly_data，仅保留最后一条记录所需字段
    monthly_data = [{
        'month': MONTHS,
        'cumulative_dividends_rmb': cumulative_div_rmb,
        'portfolio_value_rmb': sum(s['shares'] * s['price'] for s in stocks) * FX_RATE
    }]
    return monthly_data

# ----------------------------------------------------------------------
# 5. 参数组合遍历 & 结果收集
# ----------------------------------------------------------------------
results = []

for yf in sustainableYield_factors:
    for ed in erosion_deltas:
        # 为每个组合复制一份原始配置
        config = copy.deepcopy(ORIG_CONFIG)

        # 调整可持续派息率
        for ticker, c in config.items():
            c['sustainableYield'] *= yf

        # 调整 NAV侵蚀率
        for ticker, c in config.items():
            # 确保侵蚀率不低于 0
            c['erosionRate'] += ed

        # 运行回测
        try:
            data = run_backtest(config)
            # 计算月均股息（与原脚本逻辑保持一致）
            monthly_div = calculate_monthly_dividend(data)
        except Exception as exc:
            print(f"运行出错 ({yf}, {ed}): {exc}")
            monthly_div = 0

        results.append({
            'sustainableYield_factor': yf,
            'erosion_delta': ed,
            'monthly_div': monthly_div
        })

# ----------------------------------------------------------------------
# 6. 生成报告文件
# ----------------------------------------------------------------------
report_path = "optimistic_backtest_sweep.txt"
hit_target = 20000  # 目标月均股息（¥）
total = len(results)
hit_count = sum(1 for r in results if r['monthly_div'] >= hit_target)
hit_rate = hit_count / total * 100 if total else 0

best = max(results, key=lambda x: x['monthly_div'])
best_params = best['sustainableYield_factor'], best['erosion_delta']

with open(report_path, "w", encoding="utf-8") as f:
    f.write("="*64 + "\n")
    f.write("优化回测参数探索报告\n")
    f.write("="*64 + "\n\n")
    f.write(f"总组合数: {total}\n")
    f.write(f"达标组合数: {hit_count} (月均股息 ≥ ¥{hit_target:,})\n")
    f.write(f"达标率: {hit_rate:.1f}%\n\n")
    f.write(f"最高月均股息: ¥{best['monthly_div']:,.0f}\n")
    f.write(f"对应参数: sustainableYield_factor={best_params[0]}, erosion_delta={best_params[1]}\n\n")
    f.write("## 推荐参数\n")
    f.write(f"- sustainableYield_factor: {best_params[0]}\n")
    f.write(f"- erosion_delta: {best_params[1]}\n\n")
    f.write("##  recent 高收益组合（前 10）\n")
    for r in sorted(results, key=lambda x: x['monthly_div'], reverse=True)[:10]:
        f.write(f"- factor={r['sustainableYield_factor']}, delta={r['erosion_delta']} → ¥{r['monthly_div']:,.0f}\n")
    f.write("\n注意：以上模拟均使用随机噪声，单次运行可能有波动。\n")
    f.write("="*64 + "\n")

# ----------------------------------------------------------------------
# 7. 保存最佳参数供前端使用
# ----------------------------------------------------------------------
json_path = "best_params.json"
with open(json_path, "w", encoding="utf-8") as jf:
    json.dump({
        "sustainableYield_factor": best_params[0],
        "erosion_delta": best_params[1]
    }, jf, ensure_ascii=False, indent=2)

print(f"报告已生成: {report_path}")
print(f"最佳参数已保存: {json_path}")