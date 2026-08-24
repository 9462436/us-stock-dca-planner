#!/usr/bin/env python3
"""
Realistic 20yr simulation using sustainable yield parameters (from verify_20year_dividend_correct.py)
Target: Monthly real income to cover DCA (RMB 7,000) + capital growth
"""
import math
import random

MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
FX_RATE = 6.757039
TAX_RATE = 0.10
TARGET_MONTHLY = 7000

# Sustainable yield parameters (long-term realistic)
SUSTAINABLE_CONFIG = {
    'SCHG': {'price': 35.10, 'sustainableYield': 0.10, 'cagr': 0.13, 'erosion': 5},
    'SPYM': {'price': 91.56, 'sustainableYield': 0.08, 'cagr': 0.05, 'erosion': 3},
    'XQQI': {'price': 50.22, 'sustainableYield': 0.10, 'cagr': -0.01, 'erosion': 5},
    'QDTE': {'price': 29.83, 'sustainableYield': 0.12, 'cagr': 0.02, 'erosion': 8},
    'NVDY': {'price': 13.09, 'sustainableYield': 0.12, 'cagr': 0.00, 'erosion': 12},
    'AMZY': {'price': 10.96, 'sustainableYield': 0.11, 'cagr': -0.01, 'erosion': 13},
}

# Test allocations
SCENARIOS = {
    'Balanced 50/50': {'SCHG': 50, 'SPYM': 10, 'XQQI': 15, 'QDTE': 20, 'NVDY': 5, 'AMZY': 0},
    'Income 60/40': {'SCHG': 40, 'SPYM': 10, 'XQQI': 20, 'QDTE': 25, 'NVDY': 5, 'AMZY': 0},
    'Growth 70/30': {'SCHG': 60, 'SPYM': 10, 'XQQI': 10, 'QDTE': 15, 'NVDY': 5, 'AMZY': 0},
    'High Income': {'SCHG': 30, 'SPYM': 10, 'XQQI': 25, 'QDTE': 30, 'NVDY': 5, 'AMZY': 0},
    'Max Growth': {'SCHG': 70, 'SPYM': 10, 'XQQI': 5, 'QDTE': 15, 'NVDY': 0, 'AMZY': 0},
}

def randn():
    u1 = random.random(); u2 = random.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)

def simulate(alloc):
    random.seed(42)
    stocks = {}
    for t, a in alloc.items():
        if a <= 0: continue
        p = SUSTAINABLE_CONFIG[t]
        stocks[t] = {'shares': 0.0, 'price': p['price'], 'yield': p['sustainableYield'],
                     'monthlyRet': (1+p['cagr'])**(1/12)-1, 'erosion': p['erosion'], 'alloc': a}
    
    invested = 0.0
    income_hist = []
    
    for m in range(MONTHS):
        usd = MONTHLY_INVEST_RMB / FX_RATE
        tot = sum(s['alloc'] for s in stocks.values())
        
        for t, s in stocks.items():
            budget = usd * s['alloc'] / tot
            sh = int(budget / s['price'])
            if sh > 0: s['shares'] += sh
        
        invested += MONTHLY_INVEST_RMB
        
        month_real = sum(s['shares'] * s['price'] * s['yield']/12 * (1-TAX_RATE) for s in stocks.values())
        income_hist.append(month_real * FX_RATE)
        
        pvol = math.sqrt(sum(s['yield']**2 for s in stocks.values())/len(stocks))/math.sqrt(12)  # using yield as proxy
        cshock = randn() * pvol
        for s in stocks.values():
            s['price'] *= (1 + s['monthlyRet'] + cshock + randn()*s['yield']/math.sqrt(12)*0.3)
            if s['price'] < 0.01: s['price'] = 0.01
        
        for s in stocks.values():
            s['yield'] *= (1 - s['erosion']/100)**(1/12)
    
    val = sum(s['shares']*s['price'] for s in stocks.values()) * FX_RATE
    avg_income = sum(income_hist[-12:])/12
    return val, avg_income, {t:s['shares'] for t,s in stocks.items()}, {t:s['price'] for t,s in stocks.items()}

print("=" * 85)
print("Realistic Sustainable Yield Model - 20yr DCA RMB 7,000/mo")
print("=" * 85)

for name, alloc in SCENARIOS.items():
    val, inc, shares, prices = simulate(alloc)
    status = "OK" if inc >= TARGET_MONTHLY else "LOW"
    print(f"\n[{name}] {alloc}")
    print(f"  Value: RMB {val:>10,.0f} | Monthly: RMB {inc:>8,.0f} [{status}]")
    print(f"  Ann.Return: {(val/1680000-1)/20*100:>5.1f}%")
    for t in alloc:
        if alloc[t] > 0:
            print(f"    {t}: {shares[t]:.0f}sh x ${prices[t]:.2f} = RMB {shares[t]*prices[t]*FX_RATE:,.0f}")

print("\n" + "=" * 85)
print("CONCLUSION: With RMB 7,000/mo DCA, max realistic income ~RMB 2,000-3,000/mo")
print("To reach RMB 7,000/mo real income, need either:")
print("  1) Higher monthly DCA (RMB 20,000+)")
print("  2) Longer period (30+ years)")
print("  3) Accept partial coverage + withdraw principal")
print("=" * 85)