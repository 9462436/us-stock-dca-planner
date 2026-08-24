#!/usr/bin/env python3
import math

PRICES = {
    'SCHG': 35.10,
    'SPYM': 91.56,
    'XQQI': 50.22,
    'QDTE': 29.83,
    'NVDY': 13.09,
}

PARAMS = {
    'SCHG': {'cagr': 0.13, 'yield': 0.10, 'roc': 0.0, 'erosion': 5},
    'SPYM': {'cagr': 0.05, 'yield': 0.08, 'roc': 0.0, 'erosion': 3},
    'XQQI': {'cagr': -0.01, 'yield': 0.10, 'roc': 0.10, 'erosion': 5},
    'QDTE': {'cagr': 0.02, 'yield': 0.12, 'roc': 0.80, 'erosion': 8},
    'NVDY': {'cagr': 0.00, 'yield': 0.12, 'roc': 0.93, 'erosion': 12},
}

ALLOC = {'SCHG': 0.60, 'SPYM': 0.10, 'XQQI': 0.10, 'QDTE': 0.15, 'NVDY': 0.05}
FX = 6.757039
MONTHLY_RMB = 7000
TAX = 0.10

shares = {k: 0 for k in PRICES}
prices = PRICES.copy()
yield_curr = {k: PARAMS[k]['yield'] for k in PRICES}
total_invested = 0
monthly_div_history = []

for month in range(1, 241):
    usd = MONTHLY_RMB / FX
    for k in ALLOC:
        budget = usd * ALLOC[k]
        new_shares = int(budget / prices[k])
        shares[k] += new_shares
    total_invested += MONTHLY_RMB
    month_div = 0
    for k in PRICES:
        gross = shares[k] * prices[k] * yield_curr[k] / 12
        real = gross * (1 - TAX) * (1 - PARAMS[k]['roc'])
        month_div += real
    monthly_div_history.append(month_div * FX)
    for k in PRICES:
        prices[k] *= (1 + PARAMS[k]['cagr'] / 12)
    for k in PRICES:
        yield_curr[k] *= (1 - PARAMS[k]['erosion'] / 100) ** (1/12)

portfolio_usd = sum(shares[k] * prices[k] for k in PRICES)
portfolio_rmb = portfolio_usd * FX
avg_div_12m = sum(monthly_div_history[-12:]) / 12
ann_return = ((portfolio_rmb / total_invested) ** (1/20) - 1) * 100

print("=" * 70)
print("New Portfolio Returns Projection (20 Years)")
print("SCHG 60% | SPYM 10% | XQQI 10% | QDTE 15% | NVDY 5%")
print("=" * 70)
print("Total Invested:  RMB {:,}".format(total_invested))
print("Final Value:     RMB {:,.0f}".format(portfolio_rmb))
print("Total Return:    {:.1f}%".format((portfolio_rmb/total_invested - 1)*100))
print("Annualized:      {:.1f}%".format(ann_return))
print("Monthly Div:     RMB {:,.0f}".format(avg_div_12m))
print("DCA Coverage:    {:.0f}%".format(avg_div_12m/MONTHLY_RMB*100))
print()
print("Final Holdings:")
print("{:<8} {:>8} {:>10} {:>14}".format("Ticker", "Shares", "Price", "Value(RMB)"))
print("-" * 45)
for k in ['SCHG', 'SPYM', 'XQQI', 'QDTE', 'NVDY']:
    val = shares[k] * prices[k] * FX
    print("{:<8} {:>8,} ${:>9.2f} RMB{:>12,.0f}".format(k, shares[k], prices[k], val))
print("-" * 45)
print("{:<8} {:>8} {:>10} RMB{:>12,.0f}".format("TOTAL", "", "", portfolio_rmb))

print()
print("Monthly Dividend by Ticker:")
print("{:<8} {:>12}".format("Ticker", "MoDiv(RMB)"))
print("-" * 25)
total_div = 0
for k in ['SCHG', 'SPYM', 'XQQI', 'QDTE', 'NVDY']:
    div = shares[k] * prices[k] * yield_curr[k] / 12 * (1 - TAX) * (1 - PARAMS[k]['roc']) * FX
    total_div += div
    print("{:<8} RMB{:>10,.0f}".format(k, div))
print("-" * 25)
print("{:<8} RMB{:>10,.0f}".format("TOTAL", total_div))

print()
print("Year-by-Year Summary:")
print("{:<6} {:>12} {:>12} {:>10} {:>8}".format("Year", "Invested", "Value", "MoDiv", "Ann%"))
print("-" * 50)

# Re-run to capture yearly data
shares2 = {k: 0 for k in PRICES}
prices2 = PRICES.copy()
yield2 = {k: PARAMS[k]['yield'] for k in PRICES}
inv2 = 0
div_hist2 = []

for month in range(1, 241):
    usd = MONTHLY_RMB / FX
    for k in ALLOC:
        budget = usd * ALLOC[k]
        shares2[k] += int(budget / prices2[k])
    inv2 += MONTHLY_RMB
    md = 0
    for k in PRICES:
        gross = shares2[k] * prices2[k] * yield2[k] / 12
        real = gross * (1 - TAX) * (1 - PARAMS[k]['roc'])
        md += real
    div_hist2.append(md * FX)
    for k in PRICES:
        prices2[k] *= (1 + PARAMS[k]['cagr'] / 12)
    for k in PRICES:
        yield2[k] *= (1 - PARAMS[k]['erosion'] / 100) ** (1/12)
    if month % 12 == 0:
        year = month // 12
        val = sum(shares2[k] * prices2[k] for k in PRICES) * FX
        avg_d = sum(div_hist2[-12:]) / 12
        ann = ((val / inv2) ** (1/year) - 1) * 100
        print("Y{:<5} RMB{:>10,}  RMB{:>10,.0f}  RMB{:>8,.0f}  {:>5.1f}%".format(year, inv2, val, avg_d, ann))
