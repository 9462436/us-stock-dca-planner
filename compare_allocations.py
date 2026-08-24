#!/usr/bin/env python3
"""
Capital Growth Optimization - Compare different allocations
"""
import math
import random

MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
FX_RATE = 6.757039
TAX_RATE = 0.10

STOCK_PARAMS = {
    'SCHG': {'price': 35.10, 'initYield': 0.005, 'rocRatio': 0.0, 'cagr': 0.13, 'vol': 0.20, 'erosion': 0},
    'SPYM': {'price': 91.56, 'initYield': 0.08, 'rocRatio': 0.0, 'cagr': 0.05, 'vol': 0.12, 'erosion': 3},
    'XQQI': {'price': 50.22, 'initYield': 0.117, 'rocRatio': 0.10, 'cagr': 0.0082, 'vol': 0.15, 'erosion': 5},
    'QDTE': {'price': 29.83, 'initYield': 0.442, 'rocRatio': 0.80, 'cagr': 0.075, 'vol': 0.20, 'erosion': 8},
    'NVDY': {'price': 13.09, 'initYield': 0.535, 'rocRatio': 0.93, 'cagr': -0.122, 'vol': 0.45, 'erosion': 12},
    'AMZY': {'price': 10.96, 'initYield': 0.516, 'rocRatio': 0.80, 'cagr': -0.179, 'vol': 0.35, 'erosion': 18},
}

SCENARIOS = {
    'Current': {'SCHG': 25, 'SPYM': 20, 'XQQI': 15, 'QDTE': 15, 'NVDY': 12.5, 'AMZY': 12.5},
    'Growth Max': {'SCHG': 60, 'SPYM': 10, 'XQQI': 5, 'QDTE': 15, 'NVDY': 5, 'AMZY': 5},
    'Growth Pure': {'SCHG': 70, 'SPYM': 10, 'XQQI': 5, 'QDTE': 15, 'NVDY': 0, 'AMZY': 0},
    'Growth+Income': {'SCHG': 50, 'SPYM': 10, 'XQQI': 10, 'QDTE': 20, 'NVDY': 5, 'AMZY': 5},
    'Conservative': {'SCHG': 40, 'SPYM': 25, 'XQQI': 15, 'QDTE': 15, 'NVDY': 5, 'AMZY': 0},
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
        
        for stock in stocks.values():
            if stock['shares'] > 0:
                div_per_share = stock['price'] * (stock['currentYield'] / 12)
                gross = stock['shares'] * div_per_share
                real = gross * (1 - TAX_RATE) * (1 - stock['rocRatio'])
                stock['totalDivGross'] += gross
                stock['totalDivReal'] += real
        
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
            yearly_data.append({
                'year': year,
                'invested': cumulative_invested,
                'value_usd': portfolio_value,
                'value_rmb': portfolio_value * FX_RATE,
                'div_real_rmb': stock['totalDivReal'] * FX_RATE if stock else 0
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
    invested = results[0][year_idx]['invested'] if results else 0
    return {
        'mean': sum(values)/len(values) if values else 0,
        'median': sorted(values)[len(values)//2] if values else 0,
        'p10': sorted(values)[int(len(values)*0.1)] if values else 0,
        'p90': sorted(values)[int(len(values)*0.9)] if values else 0,
        'invested': invested,
        'roi': ((sum(values)/len(values))/invested - 1)*100 if values and invested else 0
    }

def main():
    print("=" * 100)
    print("Capital Growth Optimization - 20 Year Monte Carlo (20 runs)")
    print("Monthly: RMB 7,000 | FX: 6.757 | Tax: 10%")
    print("=" * 100)
    
    all_stats = {}
    for name, alloc in SCENARIOS.items():
        results = run_monte_carlo(alloc, n=20)
        stats = get_stats(results)
        all_stats[name] = stats
        print(f"\n[{name}] {alloc}")
        print(f"  Mean:   RMB {stats['mean']:>12,.0f}  ROI: {stats['roi']:>6.1f}%")
        print(f"  Median: RMB {stats['median']:>12,.0f}")
        print(f"  P10:    RMB {stats['p10']:>12,.0f}  (Worst 10%)")
        print(f"  P90:    RMB {stats['p90']:>12,.0f}  (Best 10%)")
    
    print("\n" + "=" * 100)
    print("COMPARISON SUMMARY")
    print("=" * 100)
    print(f"\n{'Scenario':<18} {'Mean Value':<16} {'Median':<16} {'P10(Low)':<16} {'P90(High)':<16} {'ROI':<8}")
    print("-" * 90)
    for name, stats in all_stats.items():
        print(f"{name:<18} {stats['mean']:>12,.0f}   {stats['median']:>12,.0f}   "
              f"{stats['p10']:>12,.0f}   {stats['p90']:>12,.0f}   {stats['roi']:>6.1f}%")
    
    # Find best
    best = max(all_stats.items(), key=lambda x: x[1]['mean'])
    print(f"\nBest for Capital Growth: [{best[0]}]")
    print(f"  Expected 20-year value: RMB {best[1]['mean']:,.0f}")
    print(f"  That's RMB {best[1]['mean'] - 1680000:,.0f} profit on RMB 1,680,000 invested")
    print(f"  Annualized return: {best[1]['roi']/20:.1f}%")

if __name__ == '__main__':
    main()
