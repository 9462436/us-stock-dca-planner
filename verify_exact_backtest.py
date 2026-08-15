#!/usr/bin/env python3
"""
使用页面完全一致的回测逻辑验证20年后月均股息
关键点：
1. 不应用NAV动态降低派息率（使用固定baseDivYield）
2. 允许股数为小数（非整股）
3. 固定随机种子（42）
4. 期权价格回报 = expectedPriceReturn（页面显式设置）

参数来源：index.html (2026-08-15 实测校准版，基于 SEC 19a-1 分红通告 2026-08-12)
核心客观结论：
  1. YieldMax/0DTE 备兑 ETF 的「高分红」里 60%~97% 是「本金返还(ROC)」，即把本金发回给你，
     真实净投资收益(30日 SEC 收益率)仅 ~2.6%，指数 0DTE 类为 0 或负值。
  2. 因此 sustainableYield = 现金分红率(投资者实际收到)，expectedPriceReturn = NAV 侵蚀(负值)。
  3. 总回报 = sustainableYield + expectedPriceReturn ≈ 5%~7%，远低于表面分红率(20%~60%)。
实测锚点(2026-08-12 19a-1)：NVDY 分红率40.35%/ROC 93.36%；AMZY 60.96%/ROC 60~96%；
      QDTY 39.7%/SEC -0.94%；SDTY 26.4%/ROC 0~60%；SEC 净收益 NVDY 2.61%/AMZY 2.59%。
"""
import math

# ============ 页面实际配置参数 ============
MONTHLY_INVEST_RMB = 7000  # 月定投金额
YEARS = 20                 # 回测年数
MONTHS = YEARS * 12        # 总月数
FX_RATE = 6.757039         # USD/CNY 汇率
TAX_RATE = 0.10            # 10% 股息税

# 页面配置（来自index.html stockConfigs，2026-08-15 实测校准版）
# 总回报约束: sustainableYield + expectedPriceReturn ≈ 0.05-0.07
# XQQI: 8%-1%=7%, NVDY: 25%-20%=5%, AMZY: 25%-20%=5%, QDTE: 20%-15%=5%, SPYM: 8%-2%=6%
STOCK_CONFIGS = [
    {
        'ticker': 'XQQI',
        'price': 48.42,
        'sustainableYield': 0.08,
        'expectedPriceReturn': -0.01,
        'annualVol': 0.20,
        'erosionRate': 1,
        'allocation': 0,
        'color': '#3b82f6'
    },
    {
        'ticker': 'NVDY',
        'price': 12.34,
        'sustainableYield': 0.25,
        'expectedPriceReturn': -0.20,
        'annualVol': 0.22,
        'erosionRate': 20,
        'allocation': 20,
        'color': '#22c55e'
    },
    {
        'ticker': 'AMZY',
        'price': 11.91,
        'sustainableYield': 0.25,
        'expectedPriceReturn': -0.20,
        'annualVol': 0.20,
        'erosionRate': 20,
        'allocation': 20,
        'color': '#f59e0b'
    },
    {
        'ticker': 'QDTE',
        'price': 28.99,
        'sustainableYield': 0.20,
        'expectedPriceReturn': -0.15,
        'annualVol': 0.18,
        'erosionRate': 15,
        'allocation': 20,
        'color': '#8b5cf6'
    },
    {
        'ticker': 'SPYM',
        'price': 90.47,
        'sustainableYield': 0.08,
        'expectedPriceReturn': -0.02,
        'annualVol': 0.16,
        'erosionRate': 3,
        'allocation': 0,
        'color': '#06b6d4'
    }
]

# ============ 页面使用的随机数生成器 ============
rng_seed = 42
def rng():
    global rng_seed
    rng_seed = (rng_seed * 16807 + 0) % 2147483647
    return rng_seed / 2147483647

def randn():
    u = rng()
    v = rng()
    return math.sqrt(-2 * math.log(u if u > 0 else 0.0001)) * math.cos(2 * math.pi * v)


# ============ 回测核心逻辑（完全复刻页面） ============
def run_backtest_exact():
    """完全复刻页面的回测逻辑"""
    # 初始化股票状态
    stocks = []
    total_alloc = sum(s['allocation'] for s in STOCK_CONFIGS)

    for s in STOCK_CONFIGS:
        px = s['price']
        # 使用可持续派息率作为 baseDivYield（固定，不随时间变化）
        base_div_yield = s['sustainableYield']
        # 期权价格回报（页面显式设置）
        if s['expectedPriceReturn'] is not None:
            monthly_price_ret = s['expectedPriceReturn'] / 12
        else:
            monthly_price_ret = -s['erosionRate'] / 100 / 12

        allocation = s['allocation'] / total_alloc if total_alloc > 0 else 0.2

        stocks.append({
            'ticker': s['ticker'],
            'shares': 0.0,
            'costBasis': 0.0,
            'totalDividendsEarned': 0.0,
            'price': px,
            'initialPrice': px,
            'baseDivYield': base_div_yield,       # 固定，不随时间变化！
            'monthlyPriceRet': monthly_price_ret,
            'annualVol': s['annualVol'],
            'allocation': allocation,
            'color': s['color']
        })

    monthlyData = []
    monthlyNav = []
    cumulativeInvestedRMB = 0.0

    # 组合层面年化波动率（加权平均）
    portfolioAnnualVol = sum(s['allocation'] * s['annualVol'] for s in stocks)
    portfolioMonthlyVol = portfolioAnnualVol / math.sqrt(12)

    for m in range(MONTHS):
        total_usd = MONTHLY_INVEST_RMB / FX_RATE
        monthInvestedUSD = 0.0

        # 固定买入：XQQI 5股/月，SPYM 2股/月
        xqqi = next(s for s in stocks if s['ticker'] == 'XQQI')
        if xqqi and total_usd >= 5 * xqqi['price']:
            xqqi['shares'] += 5
            xqqi['costBasis'] += 5 * xqqi['price']
            monthInvestedUSD += 5 * xqqi['price']
            total_usd -= 5 * xqqi['price']

        spym = next(s for s in stocks if s['ticker'] == 'SPYM')
        if spym and total_usd >= 2 * spym['price']:
            spym['shares'] += 2
            spym['costBasis'] += 2 * spym['price']
            monthInvestedUSD += 2 * spym['price']
            total_usd -= 2 * spym['price']

        # 权重分配剩余资金：NVDY/AMZY/QDTE（允许小数股）
        varStocks = [s for s in stocks if s['ticker'] in ('NVDY', 'AMZY', 'QDTE')]
        varTotalAlloc = sum(s['allocation'] for s in varStocks)
        for st in varStocks:
            w = st['allocation'] / varTotalAlloc if varTotalAlloc > 0 else 1 / len(varStocks)
            budget = total_usd * w
            if st['price'] > 0:
                canBuy = budget / st['price']  # 允许小数股！
                if canBuy > 0:
                    st['shares'] += canBuy
                    st['costBasis'] += budget
                    monthInvestedUSD += budget

        cumulativeInvestedRMB += monthInvestedUSD * FX_RATE

        # ===== 股息计算：固定可持续分红率，不随波动率放大 =====
        for st in stocks:
            if st['shares'] <= 0:
                continue
            # 直接用 baseDivYield（可持续派息率），不随时间变化！
            divPerShare = st['price'] * (st['baseDivYield'] / 12)
            gross = st['shares'] * divPerShare
            net = gross * (1 - TAX_RATE)
            st['totalDividendsEarned'] += net
            # 自动再投资（DRIP）
            st['shares'] += net / st['price']
            st['costBasis'] += net

        # ===== 价格变动 =====
        common_shock = randn() * portfolioMonthlyVol
        for st in stocks:
            idio_shock = randn() * (st['annualVol'] / math.sqrt(12)) * 0.3
            monthly_ret = st['monthlyPriceRet'] + common_shock + idio_shock
            st['price'] *= (1 + monthly_ret)
            if st['price'] < 0.01:
                st['price'] = 0.01

        # 计算组合市值
        portfolioValueUSD = sum(s['shares'] * s['price'] for s in stocks)
        portfolioValueRMB = portfolioValueUSD * FX_RATE
        totalValueRMB = portfolioValueRMB  # 股息已再投入股价，不额外加

        elapsed = m + 1
        years = elapsed / 12
        cagr = (math.pow(totalValueRMB / cumulativeInvestedRMB, 1 / years) - 1) * 100 if cumulativeInvestedRMB > 0 else 0

        monthlyNav.append(totalValueRMB)

        # 累计股息
        cumulativeDivRMB = sum(s['totalDividendsEarned'] for s in stocks) * FX_RATE

        monthlyData.append({
            'month': elapsed,
            'year': math.ceil(elapsed / 12),
            'investedRMB': cumulativeInvestedRMB,
            'portfolioValueRMB': portfolioValueRMB,
            'cumulativeDividendsRMB': cumulativeDivRMB,
            'totalValueRMB': totalValueRMB,
            'totalReturnRMB': totalValueRMB - cumulativeInvestedRMB,
            'totalReturnPct': ((totalValueRMB - cumulativeInvestedRMB) / cumulativeInvestedRMB * 100) if cumulativeInvestedRMB > 0 else 0,
            'annualizedROI': cagr,
            'stocks': [
                {
                    'ticker': s['ticker'],
                    'shares': s['shares'],
                    'price': s['price'],
                    'valueRMB': s['shares'] * s['price'] * FX_RATE,
                    'dividendsRMB': s['totalDividendsEarned'] * FX_RATE
                }
                for s in stocks
            ]
        })

    return monthlyData


# ============ 计算月均股息 ============
def calculateMonthlyDividend(data):
    """计算最后一年月均股息（与页面逻辑一致）"""
    if len(data) <= 12:
        return data[-1]['cumulativeDividendsRMB'] / max(data[-1]['month'], 1)
    yearAgo = data[-13]  # 13个月前的数据
    last = data[-1]
    monthlyDiv = (last['cumulativeDividendsRMB'] - yearAgo['cumulativeDividendsRMB']) / 12
    return monthlyDiv


# ============ 主程序 ============
def main():
    print("=" * 60)
    print("20年后月均股息验证 - 复刻页面回测逻辑")
    print("=" * 60)
    print()
    print("关键参数（与页面一致）：")
    print(f"  月定投金额：¥{MONTHLY_INVEST_RMB}")
    print(f"  回测年数：{YEARS}年 ({MONTHS}个月)")
    print(f"  汇率：{FX_RATE}")
    print(f"  股息税率：{TAX_RATE*100}%")
    print(f"  固定随机种子：42")
    print(f"  约束: sustainableYield + expectedPriceReturn ≈ 0.05-0.07 (总回报)")
    print()

    print("初始配置：")
    print(f"  {'代码':<8} {'价格':>10} {'可持续股息率':>14} {'价格回报':>10} {'年化波动':>10} {'固定/权重':>10}")
    print(f"  {'-'*8} {'-'*10} {'-'*14} {'-'*10} {'-'*10} {'-'*10}")
    for s in STOCKS_CONFIGS_PRINT():
        alloc_str = 'XQQI 5股' if s['ticker']=='XQQI' else ('SPYM 2股' if s['ticker']=='SPYM' else f"{s['allocation']}%")
        print(f"  {s['ticker']:<8} ${s['price']:>9.2f} {s['sustainableYield']*100:>13.1f}%   {s['expectedPriceReturn']*100:>+9.1f}%   {s['annualVol']*100:>9.1f}%   {alloc_str:>10}")

    print()
    print("开始回测...")

    data = run_backtest_exact()

    last = data[-1]
    print()
    print("=" * 60)
    print(f"回测结果（第 {YEARS} 年）")
    print("=" * 60)

    print()
    print(f"  累计投入(含DRIP)：¥{last['investedRMB']:,.0f}")
    print(f"  期末总市值：      ¥{last['portfolioValueRMB']:,.0f}")
    print(f"  累计派息：        ¥{last['cumulativeDividendsRMB']:,.0f}")
    print(f"  总收益：          ¥{last['totalReturnRMB']:,.0f}")
    print(f"  总收益率：        {last['totalReturnPct']:.1f}%")
    print(f"  年化ROI：        {last['annualizedROI']:.1f}%")

    monthlyDiv = calculateMonthlyDividend(data)
    print()
    print("=" * 60)
    print(f"最后一年月均股息：¥{monthlyDiv:,.0f}/月")
    print("=" * 60)

    # 年度月均股息增长曲线
    print()
    print("年度月均股息增长：")
    for year in [1, 3, 5, 10, 15, 20]:
        if year * 12 <= len(data):
            idx = year * 12 - 1
            if idx >= 12:
                yearAgoIdx = idx - 12
                yearDiv = (data[idx]['cumulativeDividendsRMB'] - data[yearAgoIdx]['cumulativeDividendsRMB']) / 12
                print(f"  第{year:>2}年：¥{yearDiv:>10,.0f}/月")
            else:
                yearDiv = data[idx]['cumulativeDividendsRMB'] / data[idx]['month']
                print(f"  第{year:>2}年：¥{yearDiv:>10,.0f}/月")

    # 合理性分析
    print()
    print("合理性分析：")
    divReturnPct = (last['cumulativeDividendsRMB'] / last['investedRMB'] * 100) if last['investedRMB'] > 0 else 0
    priceReturnPct = last['totalReturnPct'] - divReturnPct
    print(f"  股息收益占比：{divReturnPct:.1f}%")
    print(f"  价格变动收益：{priceReturnPct:.1f}%")
    print(f"  ⚠️  注：股息收益占比 >100% 意味着「股息」主要来自本金返还(ROC)")
    print(f"      即基金把本金发回给你、净值同步缩水，并非真实盈利。")
    print()

    # 真实净收益（30日 SEC 收益率口径，剔除 ROC）
    print("客观校准说明（基于 2026-08-12 SEC 19a-1 实测）：")
    print("  表面分红率 20%~60%，其中 60%~97% 是本金返还(ROC)")
    print("  真实净投资收益(30日 SEC 收益率)：NVDY 2.61% / AMZY 2.59% / QDTY -0.94%")
    print("  因此「月均股息」里约 90% 是拿回自己的本金，真实收益约为此数的 1/10")
    print()
    print(f"结论：表面月均派息 ¥{monthlyDiv:,.0f}/月，但其中约 90% 是本金返还(ROC)")
    print(f"      真实净被动收益 ≈ ¥{monthlyDiv*0.1:,.0f}/月；")
    print(f"      期末总市值 ¥{last['portfolioValueRMB']:,.0f}，现金 CAGR {last['annualizedROI']:.1f}%")
    print(f"      总回报(现金投入) {last['totalReturnPct']:.1f}% —— 这才是衡量财富增长的客观口径")

    # 多次模拟（不同随机种子）
    print()
    print("多次模拟稳定性（5个随机种子）：")
    results = []
    for seed in [42, 123, 456, 789, 999]:
        global rng_seed
        rng_seed = seed
        dataI = run_backtest_exact()
        monthlyDivI = calculateMonthlyDividend(dataI)
        results.append(monthlyDivI)
        print(f"  种子{seed:>3}：¥{monthlyDivI:>10,.0f}/月")

    avg = sum(results) / len(results)
    print(f"  平均值：    ¥{avg:>10,.0f}/月")
    print(f"  中位数：    ¥{sorted(results)[len(results)//2]:>10,.0f}/月")
    print(f"  波动范围：  ¥{min(results):.0f} - ¥{max(results):.0f}/月")
    print()
    print("=" * 60)


def STOCKS_CONFIGS_PRINT():
    return STOCK_CONFIGS


if __name__ == '__main__':
    main()
