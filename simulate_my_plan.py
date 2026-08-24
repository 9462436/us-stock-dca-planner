#!/usr/bin/env python3
"""
User Investment Plan - 20 Year Monte Carlo Simulation (Fixed Model)
Plan: SCHG 47%, SPYM 9%, XQQI 10%, QDTE 28%, NVDY 6%  (基于 2026-08-24 ¥7,045 月定投实际投入)
"""
import math
import random

MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
FX_RATE = 6.757039
TAX_RATE = 0.10

# Realistic parameters - yield erosion reduces both price AND dividend
STOCK_CONFIG = {
    'SCHG': {
        'price': 35.10,
        'initYield': 0.005,
        'rocRatio': 0.0,
        'expectedPriceReturn': 0.13,
        'annualVol': 0.20,
        'erosionRate': 0,
        'allocation': 47
    },
    'SPYM': {
        'price': 91.56,
        'initYield': 0.08,
        'rocRatio': 0.0,
        'expectedPriceReturn': 0.05,
        'annualVol': 0.12,
        'erosionRate': 3,
        'allocation': 9
    },
    'XQQI': {
        'price': 50.22,
        'initYield': 0.117,
        'rocRatio': 0.10,
        'expectedPriceReturn': 0.0082,
        'annualVol': 0.15,
        'erosionRate': 5,
        'allocation': 10
    },
    'QDTE': {
        'price': 29.83,
        'initYield': 0.442,
        'rocRatio': 0.80,
        'expectedPriceReturn': 0.075,
        'annualVol': 0.20,
        'erosionRate': 8,
        'allocation': 28
    },
    'NVDY': {
        'price': 13.09,
        'initYield': 0.535,
        'rocRatio': 0.93,
        'expectedPriceReturn': -0.122,
        'annualVol': 0.45,
        'erosionRate': 12,
        'allocation': 6
    }
}

def randn():
    u1 = random.random()
    u2 = random.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)

def run_simulation(seed=42):
    random.seed(seed)
    stocks = {}
    for ticker, config in STOCK_CONFIG.items():
        monthly_ret = (1 + config['expectedPriceReturn']) ** (1/12) - 1
        stocks[ticker] = {
            'ticker': ticker,
            'shares': 0.0,
            'price': config['price'],
            'costBasis': 0.0,
            'totalDivGross': 0.0,
            'totalDivNet': 0.0,
            'totalDivReal': 0.0,
            'currentYield': config['initYield'],
            'rocRatio': config['rocRatio'],
            'monthlyPriceRet': monthly_ret,
            'annualVol': config['annualVol'],
            'erosionRate': config['erosionRate'],
            'allocation': config['allocation']
        }
    
    cumulative_invested = 0.0
    monthly_data = []
    
    for month in range(MONTHS):
        monthly_usd = MONTHLY_INVEST_RMB / FX_RATE
        total_alloc = sum(s['allocation'] for s in stocks.values())
        
        # Buy shares
        for ticker, stock in stocks.items():
            budget = monthly_usd * (stock['allocation'] / total_alloc)
            shares_to_buy = int(budget / stock['price'])
            if shares_to_buy > 0:
                cost = shares_to_buy * stock['price']
                stock['shares'] += shares_to_buy
                stock['costBasis'] += cost
        
        cumulative_invested += MONTHLY_INVEST_RMB
        
        # Dividend payment (BEFORE price change)
        for stock in stocks.values():
            if stock['shares'] > 0:
                # Dividend per share = price * yield / 12
                div_per_share = stock['price'] * (stock['currentYield'] / 12)
                gross = stock['shares'] * div_per_share
                net = gross * (1 - TAX_RATE)
                real = net * (1 - stock['rocRatio'])
                
                stock['totalDivGross'] += gross
                stock['totalDivNet'] += net
                stock['totalDivReal'] += real
        
        # Price change (with erosion baked into expectedPriceReturn)
        portfolio_vol = math.sqrt(sum(s['annualVol']**2 for s in stocks.values()) / len(stocks)) / math.sqrt(12)
        common_shock = randn() * portfolio_vol
        
        for stock in stocks.values():
            idio_shock = randn() * (stock['annualVol'] / math.sqrt(12)) * 0.3
            monthly_ret = stock['monthlyPriceRet'] + common_shock + idio_shock
            stock['price'] *= (1 + monthly_ret)
            if stock['price'] < 0.01:
                stock['price'] = 0.01
        
        # Yield erosion (sustainable yield decreases over time)
        for stock in stocks.values():
            monthly_erosion = (1 - stock['erosionRate'] / 100) ** (1/12)
            stock['currentYield'] *= monthly_erosion
        
        # Record data
        portfolio_value = sum(s['shares'] * s['price'] for s in stocks.values())
        total_div_gross = sum(s['totalDivGross'] for s in stocks.values())
        total_div_real = sum(s['totalDivReal'] for s in stocks.values())
        
        monthly_data.append({
            'month': month + 1,
            'invested': cumulative_invested,
            'portfolio_value_usd': portfolio_value,
            'portfolio_value_rmb': portfolio_value * FX_RATE,
            'div_gross_rmb': total_div_gross * FX_RATE,
            'div_real_rmb': total_div_real * FX_RATE,
            'stocks': {t: {'shares': s['shares'], 'price': s['price'], 'yield': s['currentYield']} 
                      for t, s in stocks.items()}
        })
    
    return monthly_data

def get_yearly_summary(data):
    summary = {}
    for year in [1, 2, 3, 5, 10, 15, 20]:
        idx = year * 12 - 1
        if idx < len(data):
            d = data[idx]
            if year == 1:
                monthly_real = d['div_real_rmb'] / 12
            else:
                prev_idx = (year - 1) * 12 - 1
                yearly_div = d['div_real_rmb'] - data[prev_idx]['div_real_rmb']
                monthly_real = yearly_div / 12
            
            summary[year] = {
                'invested': d['invested'],
                'value_rmb': d['portfolio_value_rmb'],
                'div_gross_rmb': d['div_gross_rmb'],
                'div_real_rmb': d['div_real_rmb'],
                'monthly_real_div': monthly_real,
                'return_pct': (d['portfolio_value_rmb'] - d['invested']) / d['invested'] * 100,
                'stocks': d['stocks']
            }
    return summary

def run_multiple_simulations(n=20):
    results = []
    for i in range(n):
        data = run_simulation(seed=i)
        summary = get_yearly_summary(data)
        results.append(summary)
    return results

def percentile(values, p):
    sorted_v = sorted(values)
    idx = int(len(sorted_v) * p / 100)
    return sorted_v[min(idx, len(sorted_v)-1)]

def main():
    print("=" * 80)
    print("20-Year DCA Simulation (Fixed Model)")
    print("Plan: SCHG 47% | SPYM 9% | XQQI 10% | QDTE 28% | NVDY 6%")
    print("Monthly: RMB 7,000 | FX: 6.757 | Tax: 10%")
    print("=" * 80)
    
    # Single run
    data = run_simulation(seed=42)
    summary = get_yearly_summary(data)
    
    print("\n[Single Run (seed=42)]")
    print(f"{'Year':<6} {'Invested':<14} {'Value':<14} {'DivGross':<14} {'DivReal':<14} {'Monthly':<10} {'ROI':<8}")
    print("-" * 80)
    for year in [1, 2, 3, 5, 10, 15, 20]:
        if year in summary:
            s = summary[year]
            print(f"Y{year:<5} {s['invested']:>11,.0f}  {s['value_rmb']:>11,.0f}  "
                  f"{s['div_gross_rmb']:>11,.0f}  {s['div_real_rmb']:>11,.0f}  "
                  f"{s['monthly_real_div']:>8,.0f}  {s['return_pct']:>6.1f}%")
    
    # Multi-run statistics
    print("\n[Monte Carlo: 20 Runs - Year 20 Statistics]")
    results = run_multiple_simulations(20)
    
    year20 = [r[20] for r in results if 20 in r]
    values = [s['value_rmb'] for s in year20]
    divs = [s['monthly_real_div'] for s in year20]
    returns = [s['return_pct'] for s in year20]
    
    print(f"  Portfolio Value:")
    print(f"    Mean:   RMB {sum(values)/len(values):>14,.0f}")
    print(f"    Median: RMB {percentile(values, 50):>14,.0f}")
    print(f"    P10:    RMB {percentile(values, 10):>14,.0f}")
    print(f"    P90:    RMB {percentile(values, 90):>14,.0f}")
    
    print(f"  Monthly Real Dividend:")
    print(f"    Mean:   RMB {sum(divs)/len(divs):>10,.0f}")
    print(f"    Median: RMB {percentile(divs, 50):>10,.0f}")
    print(f"    P10:    RMB {percentile(divs, 10):>10,.0f}")
    print(f"    P90:    RMB {percentile(divs, 90):>10,.0f}")
    
    print(f"  Total Return: {min(returns):.0f}% ~ {max(returns):.0f}%")
    print(f"  Annualized:   {(sum(returns)/len(returns)/20):.1f}%")
    
    # Portfolio breakdown
    print("\n[Portfolio Allocation (Year 20, seed=42)]")
    print(f"  {'Ticker':<8} {'Shares':<12} {'Price':<10} {'Value':<14} {'Yield':<8}")
    print("-" * 55)
    total_val = sum(info['shares'] * info['price'] * FX_RATE 
                    for info in summary[20]['stocks'].values())
    for ticker, info in summary[20]['stocks'].items():
        value = info['shares'] * info['price'] * FX_RATE
        pct = value / total_val * 100 if total_val > 0 else 0
        print(f"  {ticker:<8} {info['shares']:>10.1f}   ${info['price']:>8.2f}   "
              f"RMB{value:>10,.0f}  {info['yield']*100:>5.2f}%")

if __name__ == '__main__':
    main()
