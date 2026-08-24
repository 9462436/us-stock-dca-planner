#!/usr/bin/env python3
"""
Growth + Income Optimization - Find balance for RMB 800+/month cash flow
"""
import math
import random

MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
FX_RATE = 6.757039
TAX_RATE = 0.10
TARGET_MONTHLY_INCOME = 800  # RMB

STOCK_PARAMS = {
    'SCHG': {'price': 35.10, 'initYield': 0.005, 'rocRatio': 0.0, 'cagr': 0.13, 'vol': 0.20, 'erosion': 0},
    'SPYM': {'price': 91.56, 'initYield': 0.08, 'rocRatio': 0.0, 'cagr': 0.05, 'vol': 0.12, 'erosion': 3},
    'XQQI': {'price': 50.22, 'initYield': 0.117, 'rocRatio': 0.10, 'cagr': 0.0082, 'vol': 0.15, 'erosion': 5},
    'QDTE': {'price': 29.83, 'initYield': 0.442, 'rocRatio': 0.80, 'cagr': 0.075, 'vol': 0.20, 'erosion': 8},
    'NVDY': {'price': 13.09, 'initYield': 0.535, 'rocRatio': 0.93, 'cagr': -0.122, 'vol': 0.45, 'erosion': 12},
    'AMZY': {'price': 10.96, 'initYield': 0.516, 'rocRatio': 0.80, 'cagr': -0.179, 'vol': 0.35, 'erosion': 18},
}

SCENARIOS = {
    'Income Balanced': {'SCHG': 45, 'SPYM': 10, 'XQQI': 15, 'QDTE': 20, 'NVDY': 5, 'AMZY': 5},
    'Income Focus': {'SCHG': 35, 'SPYM': 10, 'XQQI': 20, 'QDTE': 25, 'NVDY': 5, 'AMZY': 5},
    'High Income': {'SCHG': 30, 'SPYM': 10, 'XQQI': 25, 'QDTE': 25, 'NVDY': 5, 'AMZY': 5},
    'Growth+800': {'SCHG': 55, 'SPYM': 10, 'XQQI': 10, 'QDTE': 20, 'NVDY': 5, 'AMZY': 0},
    'Balanced 800': {'SCHG': 45, 'SPYM': 15, 'XQQI': 15, 'QDTE': 20, 'NVDY': 5, 'AMZY': 0},
    'Max Growth+800': {'SCHG': 60, 'SPYM': 5, 'XQQI': 10, 'QDTE': 20, 'NVDY': 5, 'AMZY': 0},
}

def randn():
    u1 = random.random()
    u2 = random.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)

def run_simulation(allocation, seed=42):
    random.seed(seed)
    stocks = {}
    for ticker, alloc in allocation.items():
        if alloc <= 0:
            continue
        p = STOCK_PARAMS[ticker]
        stocks[ticker] = {
            'shares': 0.0, 'price': p['price'], 'costBasis': 0.0,
            'totalDivGross': 0.0, 'totalDivReal': 0.0,
            'currentYield': p['initYield'], 'rocRatio': p['rocRatio'],
            'monthlyPriceRet': (1 + p['cagr']) ** (1/12) - 1,
            'vol': p['vol'], 'erosion': p['erosion'], 'alloc': alloc
        }
    
    cumulative_invested = 0.0
    monthly_income_history = []
    yearly_data = []
    
    for month in range(MONTHS):
        monthly_usd = MONTHLY_INVEST_RMB / FX_RATE
        total_alloc = sum(s['alloc'] for s in stocks.values())
        
        for ticker, stock in stocks.items():
            budget = monthly_usd * (stock['alloc'] / total_alloc)
            shares_to_buy = int(budget / stock['price'])
            if shares_to_buy > 0:
                stock['shares'] += shares_to_buy
                stock['costBasis'] += shares_to_buy * stock['price']
        
        cumulative_invested += MONTHLY_INVEST_RMB
        
        # Calculate this month's real income
        month_real_income = 0
        for stock in stocks.values():
            if stock['shares'] > 0:
                div_per_share = stock['price'] * (stock['currentYield'] / 12)
                gross = stock['shares'] * div_per_share
                real = gross * (1 - TAX_RATE) * (1 - stock['rocRatio'])
                stock['totalDivGross'] += gross
                stock['totalDivReal'] += real
                month_real_income += real
        
        monthly_income_history.append(month_real_income * FX_RATE)
        
        # Price change
        portfolio_vol = math.sqrt(sum(s['vol']**2 for s in stocks.values()) / len(stocks)) / math.sqrt(12)
        common_shock = randn() * portfolio_vol
        
        for stock in stocks.values():
            idio_shock = randn() * (stock['vol'] / math.sqrt(12)) * 0.3
            monthly_ret = stock['monthlyPriceRet'] + common_shock + idio_shock
            stock['price'] *= (1 + monthly_ret)
            if stock['price'] < 0.01:
                stock['price'] = 0.01
        
        for stock in stocks.values():
            monthly_erosion = (1 - stock['erosion'] / 100) ** (1/12)
            stock['currentYield'] *= monthly_erosion
        
        if (month + 1) % 12 == 0:
            year = (month + 1) // 12
            portfolio_value = sum(s['shares'] * s['price'] for s in stocks.values())
            avg_income_12m = sum(monthly_income_history[-12:]) / 12
            yearly_data.append({
                'year': year,
                'invested': cumulative_invested,
                'value_rmb': portfolio_value * FX_RATE,
                'monthly_income_rmb': avg_income_12m,
                'total_div_real_rmb': stock['totalDivReal'] * FX_RATE if stock else 0
            })
    
    return yearly_data

def run_monte_carlo(allocation, n=20):
    results = []
    for i in range(n):
        data = run_simulation(allocation, seed=i)
        results.append(data)
    return results

def get_stats(results, year_idx=19):
    values = [r[year_idx]['value_rmb'] for r in results if len(r) > year_idx]
    incomes = [r[year_idx]['monthly_income_rmb'] for r in results if len(r) > year_idx]
    invested = results[0][year_idx]['invested'] if results else 0
    return {
        'mean_value': sum(values)/len(values) if values else 0,
        'median_value': sorted(values)[len(values)//2] if values else 0,
        'mean_income': sum(incomes)/len(incomes) if incomes else 0,
        'median_income': sorted(incomes)[len(incomes)//2] if incomes else 0,
        'invested': invested,
        'roi': ((sum(values)/len(values))/invested - 1)*100 if values and invested else 0
    }

def main():
    print("=" * 110)
    print("Growth + Income Optimization - Target: RMB 800+/month cash flow")
    print("Monthly Invest: RMB 7,000 | FX: 6.757 | Tax: 10% | 20-Year Monte Carlo (20 runs)")
    print("=" * 110)
    
    all_stats = {}
    for name, alloc in SCENARIOS.items():
        results = run_monte_carlo(alloc, n=20)
        stats = get_stats(results)
        all_stats[name] = stats
        income_status = "OK" if stats['mean_income'] >= TARGET_MONTHLY_INCOME else "LOW"
        print(f"\n[{name}] {alloc}")
        print(f"  Value:  Mean RMB {stats['mean_value']:>12,.0f} | Median RMB {stats['median_value']:>12,.0f} | ROI {stats['roi']:>6.1f}%")
        print(f"  Income: Mean RMB {stats['mean_income']:>8,.0f}/mo [{income_status}] | Median RMB {stats['median_income']:>8,.0f}/mo")
    
    print("\n" + "=" * 110)
    print("SUMMARY TABLE")
    print("=" * 110)
    print(f"\n{'Scenario':<20} {'SCHG':<6} {'SPYM':<6} {'XQQI':<6} {'QDTE':<6} {'NVDY':<6} {'AMZY':<6} {'Value':<14} {'Income/mo':<12} {'ROI':<8}")
    print("-" * 100)
    for name, alloc in SCENARIOS.items():
        stats = all_stats[name]
        print(f"{name:<20} {alloc['SCHG']:<6} {alloc['SPYM']:<6} {alloc['XQQI']:<6} {alloc['QDTE']:<6} {alloc['NVDY']:<6} {alloc['AMZY']:<6} "
              f"{stats['mean_value']:>10,.0f}   {stats['mean_income']:>8,.0f}   {stats['roi']:>6.1f}%")
    
    # Find best that meets income target
    valid = {k: v for k, v in all_stats.items() if v['mean_income'] >= TARGET_MONTHLY_INCOME}
    if valid:
        best_growth = max(valid.items(), key=lambda x: x[1]['mean_value'])
        print(f"\n{'=' * 110}")
        print(f"RECOMMENDED: [{best_growth[0]}]")
        print(f"  Alloc: {SCENARIOS[best_growth[0]]}")
        print(f"  20-Year Value: RMB {best_growth[1]['mean_value']:,.0f}")
        print(f"  Monthly Income: RMB {best_growth[1]['mean_income']:,.0f}")
        print(f"  Total Profit: RMB {best_growth[1]['mean_value'] - 1680000:,.0f}")
        print(f"  Annualized: {best_growth[1]['roi']/20:.1f}%")
    else:
        print(f"\nNOTE: No scenario meets RMB 800/month target. Consider longer DCA period.")

if __name__ == '__main__':
    main()
