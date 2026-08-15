#!/usr/bin/env python3
"""
使用页面完全一致的回����辑验证20年后月均股息
关��点：
1. 不应用NAV�����降低派息率（��定baseDivYield）
2. ��股��入（非整股）
3. ��定随机种子（42）
4. ��期价格回报 = -erosionRate/100/12（如果未显式设置）
"""
import math

# ============ 页面实际配置参数 ============
MONTHLY_INVEST_RMB = 7000  # 月定投金��
YEARS = 20                 # 回��年数
MONTHS = YEARS * 12        # 总月数
FX_RATE = 6.757039         # USD/CNY ��率
TAX_RATE = 0.10            # 10% ���息税

# 页面配置（来自index.html，2026-08-15 修正后）
# 约束: sustainableYield + expectedPriceReturn ≈ 0  (派息 ≈ NAV磨损, 总回报≈0)
STOCK_CONFIGS = [
    {
        'ticker': 'XQQI',
        'price': 48.42,
        'sustainableYield': 0.05,
        'expectedPriceReturn': -0.05,
        'annualVol': 0.20,
        'erosionRate': 5,
        'allocation': 0,
        'color': '#3b82f6'
    },
    {
        'ticker': 'NVDY',
        'price': 12.34,
        'sustainableYield': 0.12,
        'expectedPriceReturn': -0.12,
        'annualVol': 0.22,
        'erosionRate': 12,
        'allocation': 20,
        'color': '#22c55e'
    },
    {
        'ticker': 'AMZY',
        'price': 11.91,
        'sustainableYield': 0.13,
        'expectedPriceReturn': -0.13,
        'annualVol': 0.20,
        'erosionRate': 13,
        'allocation': 20,
        'color': '#f59e0b'
    },
    {
        'ticker': 'QDTE',
        'price': 28.99,
        'sustainableYield': 0.08,
        'expectedPriceReturn': -0.08,
        'annualVol': 0.18,
        'erosionRate': 8,
        'allocation': 20,
        'color': '#8b5cf6'
    },
    {
        'ticker': 'SPYM',
        'price': 90.47,
        'sustainableYield': 0.03,
        'expectedPriceReturn': -0.03,
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

# ============ 回����心��辑（完全复刻页面） ============
def run_backtest_exact():
    """完全复刻页面的回����辑"""
    # 初始化股票状态
    stocks = []
    total_alloc = sum(s['allocation'] for s in STOCK_CONFIGS)
    
    for s in STOCK_CONFIGS:
        px = s['price']
        # 使用可持续派息率作为baseDivYield（不随时间����！）
        base_div_yield = s['sustainableYield']
        # ��期价格回报（如果未设置，用 -erosionRate/100/12）
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
            'baseDivYield': base_div_yield,  # ��定，不随时间变化！
            'monthlyPriceRet': monthly_price_ret,
            'annualVol': s['annualVol'],
            'allocation': allocation,
            'color': s['color']
        })

    monthly_data = []
    monthly_nav = []
    cumulative_invested_rmb = 0.0

    # 组合��面年化波动率（加权平均）
    portfolio_annual_vol = sum(s['allocation'] * s['annualVol'] for s in stocks) / sum(s['allocation'] for s in stocks)
    portfolio_monthly_vol = portfolio_annual_vol / math.sqrt(12)

    # ����240个月
    for m in range(MONTHS):
        total_usd = MONTHLY_INVEST_RMB / FX_RATE
        month_invested_usd = 0.0

        # ��定��入：XQQI 5股/月，SPYM 2股/月
        xqqi = next(s for s in stocks if s['ticker'] == 'XQQI')
        if xqqi and total_usd >= 5 * xqqi['price']:
            xqqi['shares'] += 5
            xqqi['costBasis'] += 5 * xqqi['price']
            month_invested_usd += 5 * xqqi['price']
            total_usd -= 5 * xqqi['price']

        spym = next(s for s in stocks if s['ticker'] == 'SPYM')
        if spym and total_usd >= 2 * spym['price']:
            spym['shares'] += 2
            spym['costBasis'] += 2 * spym['price']
            month_invested_usd += 2 * spym['price']
            total_usd -= 2 * spym['price']

        # 权重分���剩余资金：NVDY/AMZY/QDTE（��股��入！）
        var_stocks = [s for s in stocks if s['ticker'] in ('NVDY', 'AMZY', 'QDTE')]
        var_total_alloc = sum(s['allocation'] for s in var_stocks)
        for st in var_stocks:
            w = st['allocation'] / var_total_alloc if var_total_alloc > 0 else 1 / len(var_stocks)
            budget = total_usd * w
            if st['price'] > 0:
                can_buy = budget / st['price']  # ��股！
                if can_buy > 0:
                    st['shares'] += can_buy
                    st['costBasis'] += budget
                    month_invested_usd += budget

        cumulative_invested_rmb += month_invested_usd * FX_RATE

        # ===== ���息计算：��定可持续分红率，不随时间���� =====
        for st in stocks:
            if st['shares'] <= 0:
                continue
            # 直接用baseDivYield（可持续派息率），不随时间变化！
            div_per_share = st['price'] * (st['baseDivYield'] / 12)
            gross = st['shares'] * div_per_share
            net = gross * (1 - TAX_RATE)
            st['totalDividendsEarned'] += net
            # 自动再投资（DRIP）
            st['shares'] += net / st['price']
            st['costBasis'] += net

        # ===== 价格变动 =====
        common_shock = randn() * portfolio_monthly_vol
        for st in stocks:
            idio_shock = randn() * (st['annualVol'] / math.sqrt(12)) * 0.3
            monthly_ret = st['monthlyPriceRet'] + common_shock + idio_shock
            st['price'] *= (1 + monthly_ret)
            if st['price'] < 0.01:
                st['price'] = 0.01

        # 计算组合市值
        portfolio_value_usd = sum(s['shares'] * s['price'] for s in stocks)
        portfolio_value_rmb = portfolio_value_usd * FX_RATE
        total_value_rmb = portfolio_value_rmb  # ���息已再投资入股价

        elapsed = m + 1
        years = elapsed / 12
        cagr = (math.pow(total_value_rmb / cumulative_invested_rmb, 1 / years) - 1) * 100 if cumulative_invested_rmb > 0 else 0

        monthly_nav.append(total_value_rmb)

        # ��计股息
        cumulative_div_rmb = sum(s['totalDividendsEarned'] for s in stocks) * FX_RATE

        monthly_data.append({
            'month': elapsed,
            'year': math.ceil(elapsed / 12),
            'invested_rmb': cumulative_invested_rmb,
            'portfolio_value_rmb': portfolio_value_rmb,
            'cumulative_dividends_rmb': cumulative_div_rmb,
            'total_value_rmb': total_value_rmb,
            'total_return_rmb': total_value_rmb - cumulative_invested_rmb,
            'total_return_pct': ((total_value_rmb - cumulative_invested_rmb) / cumulative_invested_rmb * 100) if cumulative_invested_rmb > 0 else 0,
            'annualized_roi': cagr,
            'stocks': [
                {
                    'ticker': s['ticker'],
                    'shares': s['shares'],
                    'price': s['price'],
                    'value_rmb': s['shares'] * s['price'] * FX_RATE,
                    'dividends_rmb': s['totalDividendsEarned'] * FX_RATE
                }
                for s in stocks
            ]
        })

    return monthly_data

# ============ 计算月均股息 ============
def calculate_monthly_dividend(data):
    """计算最后一年月均股息（与页面��辑一致：第4276-4283行）"""
    if len(data) <= 12:
        return data[-1]['cumulative_dividends_rmb'] / max(data[-1]['month'], 1)

    year_ago = data[-13]  # 13个月前的数据
    last = data[-1]
    monthly_div = (last['cumulative_dividends_rmb'] - year_ago['cumulative_dividends_rmb']) / 12
    return monthly_div

# ============ 主程序 ============
def main():
    print("=" * 100)
    print("20年后月均股息验证 - 完全复刻页面回����辑")
    print("=" * 100)
    print("\n关��参数（与页面一致）：")
    print("  月定投金��：{}".format(MONTHLY_INVEST_RMB))
    print("  回��年限：{}年 ({}个月)".format(YEARS, MONTHS))
    print("  ��率：{}".format(FX_RATE))
    print("  ���息税率：{}%".format(TAX_RATE * 100))
    print("  ��定随机种子：42")
    print("  关��差��：")
    print("    * baseDivYield��定不变（不应用NAV�����降低派息率）")
    print("    * ��股��入（非整股）")
    
    returns_list = [f'{s["ticker"]}:{s["expectedPriceReturn"]*100:+.1f}%/年' for s in STOCK_CONFIGS]
    print("    * ��期价格回报：{}".format(', '.join(returns_list)))

    print("\n初始配置：")
    print("  {:<8} {:<12} {:<15} {:<15} {:<12} {:<12} {:<10}".format('代码', '初始价格', '可持续派息率', '长期价格回报', '年化波动率', '��定��入', '权重'))
    print("  {:<8} {:<12} {:<15} {:<15} {:<12} {:<12} {:<10}".format('-'*8, '-'*12, '-'*15, '-'*15, '-'*12, '-'*12, '-'*10))
    for s in STOCK_CONFIGS:
        fixed = 'XQQI' if s['ticker']=='XQQI' else ('SPYM' if s['ticker']=='SPYM' else '')
        weight = "{}%".format(s['allocation']*5) if s['allocation'] > 0 else "��定"
        print("  {:<8} ${:<11.2f} {:>13.1f}%   {:>13.1f}%/年   {:>10.1f}%   {:<12} {:<10}".format(
            s['ticker'], s['price'], s['sustainableYield']*100,
            s['expectedPriceReturn']*100, s['annualVol']*100, fixed, weight))

    print("\n开始回��...")

    # 运行回��
    data = run_backtest_exact()

    # 结果分��
    last = data[-1]
    print("\n" + "=" * 100)
    print("回��结果（第{}年）".format(YEARS))
    print("=" * 100)

    print("\n��计投入：��{:,.0f}".format(last['invested_rmb']))
    print("期末市值：��{:,.0f}".format(last['portfolio_value_rmb']))
    print("��计股息：��{:,.0f}".format(last['cumulative_dividends_rmb']))
    print("总收益：��{:,.0f}".format(last['total_return_rmb']))
    print("总收益率：{:.1f}%".format(last['total_return_pct']))
    print("年化收益：{:.1f}%".format(last['annualized_roi']))

    # 计算最后一年月均股息
    monthly_div = calculate_monthly_dividend(data)
    print("\n" + "=" * 100)
    print("最后一年月均股息：��{:,.0f}/月".format(monthly_div))
    print("=" * 100)

    # 与页面显示对比
    page_displayed = 12000  # 页面显示的"20年后月均股息约1.2万"（经济约束修正后）
    print("\n【与页面显示对比】")
    print("  页面显示：20年后月均股息 ��{:,}+/月".format(page_displayed))
    print("  本模��：{}年后月均股息 ��{:,.0f}/月".format(YEARS, monthly_div))

    if monthly_div >= page_displayed:
        print("  �� ����结果支持页面显示")
        print("  �� ���差：{:+.1f}%".format((monthly_div / page_displayed - 1) * 100))
    else:
        print("  �� ����结果低于页面显示")
        print("  �� ���差：{:+.1f}%".format((monthly_div / page_displayed - 1) * 100))

    # ����明��
    print("\n【期末持��明��】")
    print("  {:<8} {:<15} {:<12} {:<15} {:<8}".format('代码', '持��股数', '当前价格', '市值', '占比'))
    print("  {:<8} {:<15} {:<12} {:<15} {:<8}".format('-'*8, '-'*15, '-'*12, '-'*15, '-'*8))
    for stock in last['stocks']:
        percentage = (stock['value_rmb'] / last['portfolio_value_rmb'] * 100) if last['portfolio_value_rmb'] > 0 else 0
        print("  {:<8} {:>13.2f}股   ${:>10.2f}   ��{:>12,.0f}   {:>5.1f}%".format(
            stock['ticker'], stock['shares'], stock['price'], stock['value_rmb'], percentage))

    # 年度月均股息增长����
    print("\n【年度月均股息增长����】")
    for year in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20]:
        if year * 12 <= len(data):
            idx = year * 12 - 1
            if idx >= 12:
                year_ago_idx = idx - 12
                year_div = (data[idx]['cumulative_dividends_rmb'] - data[year_ago_idx]['cumulative_dividends_rmb']) / 12
                print("  第{:2d}年：��{:,.0f}/月".format(year, year_div))
            else:
                year_div = data[idx]['cumulative_dividends_rmb'] / data[idx]['month']
                print("  第{:2d}年：��{:,.0f}/月".format(year, year_div))

    # 合理性分��
    print("\n【合理性分��】")
    div_return_pct = (last['cumulative_dividends_rmb'] / last['invested_rmb'] * 100)
    price_return_pct = last['total_return_pct'] - div_return_pct
    print("\n1. ��益来源��解：")
    print("   ��计股息收益率：{:.1f}%".format(div_return_pct))
    print("   价格变动收益：{:.1f}%".format(price_return_pct))

    print("\n2. 复投效应分��：")
    initial_monthly_div = data[11]['cumulative_dividends_rmb'] / 12 if len(data) >= 12 else 0
    final_monthly_div = monthly_div
    growth_factor = final_monthly_div / initial_monthly_div if initial_monthly_div > 0 else 0
    print("   第1年月均股息：��{:,.0f}/月".format(initial_monthly_div))
    print("   第20年月均股息：��{:,.0f}/月".format(final_monthly_div))
    print("   ���长倍数：{:.1f}倍".format(growth_factor))

    print("\n3. ���息率保持不变：")
    print("   baseDivYield��定为可持续派息率：")
    for s in STOCK_CONFIGS:
        print("     {}: {:.1f}%".format(s['ticker'], s['sustainableYield']*100))

    print("\n" + "=" * 100)
    conclusion = "��� 合理" if monthly_div >= page_displayed * 0.8 else "��� ���乐观"
    print("验证结论：页面显示的月均股息��{:,}+/月 {}".format(page_displayed, conclusion))
    print("=" * 100)

    # 多次模��（不同随机种子）
    print("\n【��定性验证 - 5个不同随机种子】")
    results = []
    for seed in [42, 123, 456, 789, 999]:
        global rng_seed
        rng_seed = seed
        data_i = run_backtest_exact()
        monthly_div_i = calculate_monthly_dividend(data_i)
        results.append(monthly_div_i)
        print("  种子{}: ��{:,.0f}/月".format(seed, monthly_div_i))

    avg_monthly_div = sum(results) / len(results)
    min_div, max_div = min(results), max(results)
    print("\n  统计：")
    print("  平均值：��{:,.0f}/月".format(avg_monthly_div))
    print("  中位数：��{:,.0f}/月".format(sorted(results)[len(results)//2]))
    print("  ��动范��：��{:,.0f} - ��{:,.0f}/月".format(min_div, max_div))

    if avg_monthly_div >= page_displayed * 0.8:
        print("\n  �� 多次模��基本支持页面显示")
    else:
        print("\n  �� 多次模��平均值低于页面显示��期")

if __name__ == '__main__':
    main()