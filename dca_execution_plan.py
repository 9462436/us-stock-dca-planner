#!/usr/bin/env python3
"""
Monthly DCA Execution Plan for Balanced Growth Portfolio
SCHG 50% | SPYM 10% | XQQI 15% | QDTE 20% | NVDY 5%
"""
import math

MONTHLY_RMB = 7000
FX_RATE = 6.757039
YEARS = 20
MONTHS = YEARS * 12

PRICES = {
    'SCHG': 35.10,
    'SPYM': 91.56,
    'XQQI': 50.22,
    'QDTE': 29.83,
    'NVDY': 13.09,
}

CAGR = {
    'SCHG': 0.13,
    'SPYM': 0.05,
    'XQQI': -0.01,
    'QDTE': 0.02,
    'NVDY': 0.00,
}

MONTHLY_GROWTH = {k: (1+v)**(1/12)-1 for k, v in CAGR.items()}

ALLOC = {
    'SCHG': 0.50,
    'SPYM': 0.10,
    'XQQI': 0.15,
    'QDTE': 0.20,
    'NVDY': 0.05,
}

YIELDS = {
    'SCHG': 0.10,
    'SPYM': 0.08,
    'XQQI': 0.10,
    'QDTE': 0.12,
    'NVDY': 0.12,
}

TAX_RATE = 0.10

print("=" * 130)
print("Monthly DCA Execution Plan - Balanced Growth")
print("SCHG 50% | SPYM 10% | XQQI 15% | QDTE 20% | NVDY 5%")
print(f"Monthly: RMB {MONTHLY_RMB:,} | FX: {FX_RATE} | Term: {YEARS}yr ({MONTHS} months)")
print("=" * 130)

prices = PRICES.copy()
shares = {k: 0 for k in PRICES}
cash_buffer = 0
total_invested = 0

print(f"\n{'Yr':>4} {'Mo':>4} {'Invest':>8} {'SCHG':>8} {'SPYM':>8} {'XQQI':>8} {'QDTE':>8} {'NVDY':>8} "
      f"{'TotalInv':>12} {'Value':>14} {'MoDiv':>10} {'Ann%':>8}")
print("-" * 130)

for month in range(1, MONTHS + 1):
    year = (month - 1) // 12 + 1
    month_in_year = (month - 1) % 12 + 1
    
    monthly_usd = MONTHLY_RMB / FX_RATE
    budgets = {k: monthly_usd * ALLOC[k] for k in ALLOC}
    
    for k in ALLOC:
        target_shares = int(budgets[k] / prices[k])
        if target_shares > 0:
            shares[k] += target_shares
            budgets[k] -= target_shares * prices[k]
    
    cash_buffer += sum(budgets.values()) * FX_RATE
    total_invested += MONTHLY_RMB
    
    portfolio_value_usd = sum(shares[k] * prices[k] for k in PRICES)
    portfolio_value_rmb = portfolio_value_usd * FX_RATE + cash_buffer
    
    monthly_div = sum(shares[k] * prices[k] * YIELDS[k] / 12 * (1 - TAX_RATE) for k in PRICES)
    monthly_div_rmb = monthly_div * FX_RATE
    
    if month >= 12:
        years_elapsed = month / 12
        annualized = (portfolio_value_rmb / total_invested) ** (1/years_elapsed) - 1
        annualized *= 100
    else:
        annualized = 0
    
    # Print Jan, Jun, Dec and first 3 months
    if month_in_year == 1 or month_in_year == 6 or month_in_year == 12 or month <= 3:
        print(f"{year:>4} {month_in_year:>4} {MONTHLY_RMB:>8,} "
              f"{shares['SCHG']:>8} {shares['SPYM']:>8} {shares['XQQI']:>8} {shares['QDTE']:>8} {shares['NVDY']:>8} "
              f"{total_invested:>12,} {portfolio_value_rmb:>14,.0f} {monthly_div_rmb:>10,.0f} {annualized:>7.1f}%")
    
    for k in PRICES:
        prices[k] *= (1 + MONTHLY_GROWTH[k])
        if prices[k] < 0.01:
            prices[k] = 0.01

# Final results
print("\n" + "=" * 130)
print("[FINAL RESULTS - End of Year 20]")
print("=" * 130)
print(f"\nTotal Invested: RMB {total_invested:,}")
print(f"Final Value (incl cash): RMB {portfolio_value_rmb:,.0f}")
print(f"Total Return: {(portfolio_value_rmb/total_invested - 1)*100:.1f}%")
print(f"Annualized Return: {annualized:.1f}%")
print(f"Monthly Real Dividend: RMB {monthly_div_rmb:,.0f}")
print(f"DCA Coverage: {monthly_div_rmb/MONTHLY_RMB*100:.0f}%")

print(f"\nFinal Holdings:")
print(f"{'Ticker':<8} {'Shares':>10} {'Price':>10} {'Value(RMB)':>14} {'Weight':>8} {'MoDiv(RMB)':>12}")
print("-" * 70)
for k in ['SCHG', 'SPYM', 'XQQI', 'QDTE', 'NVDY']:
    val = shares[k] * prices[k] * FX_RATE
    div = shares[k] * prices[k] * YIELDS[k] / 12 * (1 - TAX_RATE) * FX_RATE
    pct = val / portfolio_value_rmb * 100
    print(f"{k:<8} {shares[k]:>10,} ${prices[k]:>9.2f} RMB{val:>12,.0f} {pct:>6.1f}% RMB{div:>10,.0f}")

print(f"{'TOTAL':<8} {'':>10} {'':>10} RMB{portfolio_value_rmb:>12,.0f} {'100.0%':>8} RMB{monthly_div_rmb:>10,.0f}")

# Milestones
print("\n" + "=" * 130)
print("[KEY MILESTONES]")
print("=" * 130)

prices = PRICES.copy()
shares = {k: 0 for k in PRICES}
cash_buffer = 0
total_invested = 0
first_income_7000 = None
first_2x = None

for month in range(1, MONTHS + 1):
    monthly_usd = MONTHLY_RMB / FX_RATE
    budgets = {k: monthly_usd * ALLOC[k] for k in ALLOC}
    
    for k in ALLOC:
        target_shares = int(budgets[k] / prices[k])
        if target_shares > 0:
            shares[k] += target_shares
            budgets[k] -= target_shares * prices[k]
    
    cash_buffer += sum(budgets.values()) * FX_RATE
    total_invested += MONTHLY_RMB
    
    portfolio_value_usd = sum(shares[k] * prices[k] for k in PRICES)
    portfolio_value_rmb = portfolio_value_usd * FX_RATE + cash_buffer
    monthly_div = sum(shares[k] * prices[k] * YIELDS[k] / 12 * (1 - TAX_RATE) for k in PRICES)
    monthly_div_rmb = monthly_div * FX_RATE
    
    if monthly_div_rmb >= 7000 and first_income_7000 is None:
        first_income_7000 = month
        print(f"Monthly real dividend >= RMB 7,000: Month {month} (Year {(month-1)//12+1}, Month {(month-1)%12+1})")
    
    if portfolio_value_rmb >= total_invested * 2 and first_2x is None:
        first_2x = month
        print(f"Portfolio value >= 2x invested: Month {month} (Year {(month-1)//12+1}, Month {(month-1)%12+1}) RMB {portfolio_value_rmb:,.0f}")
    
    for k in PRICES:
        prices[k] *= (1 + MONTHLY_GROWTH[k])
        if prices[k] < 0.01:
            prices[k] = 0.01

# Annual summary
print("\n[ANNUAL SUMMARY]")
print(f"{'Year':<6} {'Invested':>12} {'Value':>14} {'MoDiv':>10} {'Ann%':>8}")
print("-" * 50)

prices = PRICES.copy()
shares = {k: 0 for k in PRICES}
cash_buffer = 0
total_invested = 0

for month in range(1, MONTHS + 1):
    monthly_usd = MONTHLY_RMB / FX_RATE
    budgets = {k: monthly_usd * ALLOC[k] for k in ALLOC}
    
    for k in ALLOC:
        target_shares = int(budgets[k] / prices[k])
        if target_shares > 0:
            shares[k] += target_shares
            budgets[k] -= target_shares * prices[k]
    
    cash_buffer += sum(budgets.values()) * FX_RATE
    total_invested += MONTHLY_RMB
    
    portfolio_value_usd = sum(shares[k] * prices[k] for k in PRICES)
    portfolio_value_rmb = portfolio_value_usd * FX_RATE + cash_buffer
    monthly_div = sum(shares[k] * prices[k] * YIELDS[k] / 12 * (1 - TAX_RATE) for k in PRICES)
    monthly_div_rmb = monthly_div * FX_RATE
    
    if month % 12 == 0:
        year = month // 12
        annualized = (portfolio_value_rmb / total_invested) ** (1/year) - 1
        annualized *= 100
        print(f"Year{year:<4} RMB{total_invested:>10,}  RMB{portfolio_value_rmb:>12,.0f}  RMB{monthly_div_rmb:>8,.0f}  {annualized:>7.1f}%")
    
    for k in PRICES:
        prices[k] *= (1 + MONTHLY_GROWTH[k])
        if prices[k] < 0.01:
            prices[k] = 0.01