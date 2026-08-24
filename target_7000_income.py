#!/usr/bin/env python3
"""
Target: 20-year monthly real income >= RMB 7,000 (covers DCA) + capital growth
"""
import math
import random

MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
FX_RATE = 6.757039
TAX_RATE = 0.10
TARGET_MONTHLY = 7000

STOCK_PARAMS = {
    'SCHG': {'price': 35.10, 'initYield': 0.005, 'rocRatio': 0.0, 'cagr': 0.13, 'vol': 0.20, 'erosion': 0},
    'SPYM': {'price': 91.56, 'initYield': 0.08, 'rocRatio': 0.0, 'cagr': 0.05, 'vol': 0.12, 'erosion': 3},
    'XQQI': {'price': 50.22, 'initYield': 0.117, 'rocRatio': 0.10, 'cagr': 0.0082, 'vol': 0.15, 'erosion': 5},
    'QDTE': {'price': 29.83, 'initYield': 0.442, 'rocRatio': 0.80, 'cagr': 0.075, 'vol': 0.20, 'erosion': 8},
    'NVDY': {'price': 13.09, 'initYield': 0.535, 'rocRatio': 0.93, 'cagr': -0.122, 'vol': 0.45, 'erosion': 12},
    'AMZY': {'price': 10.96, 'initYield': 0.516, 'rocRatio': 0.80, 'cagr': -0.179, 'vol': 0.35, 'erosion': 18},
}

# Search for optimal allocation
def test_allocation(alloc):
    random.seed(42)
    stocks = {}
    for ticker, a in alloc.items():
        if a <= 0: continue
        p = STOCK_PARAMS[ticker]
        stocks[ticker] = {
            'shares': 0.0, 'price': p['price'],
            'currentYield': p['initYield'], 'rocRatio': p['rocRatio'],
            'monthlyPriceRet': (1 + p['cagr']) ** (1/12) - 1,
            'vol': p['vol'], 'erosion': p['erosion'], 'alloc': a
        }
    
    cumulative_invested = 0.0
    monthly_income_history = []
    
    for month in range(MONTHS):
        monthly_usd = MONTHLY_INVEST_RMB / FX_RATE
        total_alloc = sum(s['alloc'] for s in stocks.values())
        
        for ticker, stock in stocks.items():
            budget = monthly_usd * (stock['alloc'] / total_alloc)
            shares_to_buy = int(budget / stock['price'])
            if shares_to_buy > 0:
                stock['shares'] += shares_to_buy
        
        cumulative_invested += MONTHLY_INVEST_RMB
        
        month_real = 0
        for stock in stocks.values():
            if stock['shares'] > 0:
                div = stock['price'] * (stock['currentYield'] / 12)
                real = stock['shares'] * div * (1 - TAX_RATE) * (1 - stock['rocRatio'])
                month_real += real
        
        monthly_income_history.append(month_real * FX_RATE)
        
        portfolio_vol = math.sqrt(sum(s['vol']**2 for s in stocks.values()) / len(stocks)) / math.sqrt(12)
        common_shock = randn() * portfolio_vol
        
        for stock in stocks.values():
            idio_shock = randn() * (stock['vol'] / math.sqrt(12)) * 0.3
            stock['price'] *= (1 + stock['monthlyPriceRet'] + common_shock + idio_shock)
            if stock['price'] < 0.01: stock['price'] = 0.01
        
        for stock in stocks.values():
            stock['currentYield'] *= (1 - stock['erosion'] / 100) ** (1/12)
    
    final_value = sum(s['shares'] * s['price'] for s in stocks.values()) * FX_RATE
    final_income = sum(monthly_income_history[-12:]) / 12
    
    return final_value, final_income, {t: s['shares'] for t, s in stocks.items()}, {t: s['price'] for t, s in stocks.items()}

def randn():
    u1 = random.random()
    u2 = random.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)

# Test various allocations targeting RMB 7000/month
SCENARIOS = {
    'Income Heavy': {'SCHG': 30, 'SPYM': 10, 'XQQI': 25, 'QDTE': 25, 'NVDY': 10, 'AMZY': 0},
    'Income Focus': {'SCHG': 25, 'SPYM': 10, 'XQQI': 30, 'QDTE': 25, 'NVDY': 10, 'AMZY': 0},
    'Balanced High': {'SCHG': 40, 'SPYM': 10, 'XQQI': 20, 'QDTE': 25, 'NVDY': 5, 'AMZY': 0},
    'Growth Income': {'SCHG': 45, 'SPYM': 5, 'XQQI': 15, 'QDTE': 25, 'NVDY': 10, 'AMZY': 0},
    'Max Income': {'SCHG': 20, 'SPYM': 10, 'XQQI': 35, 'QDTE': 30, 'NVDY': 5, 'AMZY': 0},
}

print("=" * 90)
print("Target: 20yr monthly real income >= RMB 7,000 (covers DCA) + capital growth")
print("DCA: RMB 7,000/mo | 20yr | Monte Carlo (seed=42)")
print("=" * 90)

results = {}
for name, alloc in SCENARIOS.items():
    value, income, shares, prices = test_allocation(alloc)
    results[name] = (value, income, alloc, shares, prices)
    status = "OK" if income >= TARGET_MONTHLY else "LOW"
    print(f"\n[{name}] {alloc}")
    print(f"  20yr Value: RMB {value:,.0f} | Monthly Income: RMB {income:,.0f} [{status}]")
    print(f"  Annualized: {(value/1680000 - 1)/20*100:.1f}%")
    print(f"  Final Holdings:")
    for t in alloc:
        if alloc[t] > 0:
            print(f"    {t}: {shares[t]:.0f} sh × ${prices[t]:.2f} = RMB {shares[t]*prices[t]*FX_RATE:,.0f}")

# Find best that meets target
valid = {k: v for k, v in results.items() if v[1] >= TARGET_MONTHLY}
if valid:
    best = max(valid.items(), key=lambda x: x[1][0])
    print(f"\n{'='*90}")
    print(f"[RECOMMENDED] {best[0]}")
    print(f"Allocation: {best[1][2]}")
    print(f"20yr Value: RMB {best[1][0]:,.0f}")
    print(f"Monthly Income: RMB {best[1][1]:,.0f}")
    print(f"DCA Coverage: {best[1][1]/7000*100:.0f}%")
    print(f"Annualized: {(best[1][0]/1680000 - 1)/20*100:.1f}%")
    print(f"\nFinal Holdings:")
    for t, s in best[1][3].items():
        p = best[1][4][t]
        print(f"  {t}: {s:.0f} sh × ${p:.2f} = RMB {s*p*FX_RATE:,.0f} ({best[1][2][t]}%)")
else:
    print(f"\nNo scenario meets target. Increase DCA or extend period.")