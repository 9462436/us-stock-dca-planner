# optimistic_noise_analysis.py
"""
Analyze sensitivity of monthly dividend to random noise.
Runs many simulations with a fixed parameter set (best combo from earlier analysis),
collects monthly dividend values, computes statistics, and exports an SVG histogram.
"""

import copy, math, random, json, sys
from datetime import datetime

# ----------------------------------------------------------------------
# Constants (same as earlier)
# ----------------------------------------------------------------------
STOCK_CONFIG = {
    'XQQI': {'price': 50.2393, 'sustainableYield': 0.144, 'expectedPriceReturn': -0.01, 'annualVol': 0.15, 'erosionRate': 5},
    'NVDY': {'price': 13.04, 'sustainableYield': 0.173, 'expectedPriceReturn': 0.00, 'annualVol': 0.18, 'erosionRate': 12},
    'AMZY': {'price': 11.04, 'sustainableYield': 0.158, 'expectedPriceReturn': -0.01, 'annualVol': 0.15, 'erosionRate': 13},
    'QDTE': {'price': 29.88, 'sustainableYield': 0.173, 'expectedPriceReturn': 0.02, 'annualVol': 0.14, 'erosionRate': 8},
    'SPYM': {'price': 91.56, 'sustainableYield': 0.115, 'expectedPriceReturn': 0.05, 'annualVol': 0.12, 'erosionRate': 3}
}
ORIG_CONFIG = {k: v.copy() for k, v in STOCK_CONFIG.items()}

FX_RATE = 6.757039
MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
TAX_RATE = 0.0
TARGET_DIVIDEND = 20000

# Best combo from previous analysis
BEST_YIELD_FACTOR = 1.20
BEST_ERODE_DELTA = -2

# Simulation settings
N_SIMULATIONS = 200   # number of random seeds to run
BIN_COUNT = 20        # histogram bins

# Fixed trading settings
FIXED_SHARES = [('XQQI', 5), ('SPYM', 2)]
REST_TICKERS = ['NVDY', 'AMZY', 'QDTE']

# ----------------------------------------------------------------------
# Helper functions (same as earlier)
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

def run_backtest(config):
    """Runs a full 20‑year simulation and returns the final cumulative‑dividend record."""
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

    for month in range(MONTHS):
        # 1) Investment
        monthly_invest = MONTHLY_INVEST_RMB
        monthly_invest_usd = monthly_invest / FX_RATE

        # Fixed-share purchases
        for ticker, shares in FIXED_SHARES:
            stock = next(s for s in stocks if s['ticker'] == ticker)
            cost_usd = shares * stock['price']
            stock['shares'] += shares
            stock['costBasis'] += cost_usd
            monthly_invest_usd -= cost_usd

        # Remainder distributed evenly
        remaining_usd = monthly_invest_usd
        per_ticker_usd = remaining_usd / len(REST_TICKERS)
        for ticker in REST_TICKERS:
            stock = next(s for s in stocks if s['ticker'] == ticker)
            shares = int(per_ticker_usd // stock['price'])
            cost_usd = shares * stock['price']
            stock['shares'] += shares
            stock['costBasis'] += cost_usd

        # 2) NAV erosion
        for stock in stocks:
            monthly_erosion = (1 - stock['erosionRate'] / 100) ** (1/12)
            stock['sustainableYield'] *= monthly_erosion

        # 3) Dividend payout & reinvestment
        for stock in stocks:
            if stock['shares'] > 0:
                div_per_share = stock['price'] * (stock['sustainableYield'] / 12)
                gross = stock['shares'] * div_per_share
                net = gross * (1 - TAX_RATE)
                stock['totalDividendsEarned'] += net
                # reinvest
                stock['shares'] += net / stock['price']
                stock['costBasis'] += net

        # 4) Price evolution with common + idiosyncratic shocks
        portfolio_vol = math.sqrt(sum(s['annualVol']**2 for s in stocks) / len(stocks)) / math.sqrt(12)
        common_shock = randn() * portfolio_vol
        for stock in stocks:
            idio_shock = randn() * (stock['annualVol'] / math.sqrt(12)) * 0.3
            monthly_ret = stock['monthlyPriceRet'] + common_shock + idio_shock
            stock['price'] *= (1 + monthly_ret)
            if stock['price'] < 0.01:
                stock['price'] = 0.01

    cumulative_div_rmb = sum(s['totalDividendsEarned'] for s in stocks) * FX_RATE
    return [{'month': MONTHS, 'cumulative_dividends_rmb': cumulative_div_rmb}]

# ----------------------------------------------------------------------
# Prepare config with best parameters
# ----------------------------------------------------------------------
config = copy.deepcopy(ORIG_CONFIG)

for ticker, c in config.items():
    c['sustainableYield'] *= BEST_YIELD_FACTOR

for ticker, c in config.items():
    c['erosionRate'] += BEST_ERODE_DELTA
    if c['erosionRate'] < 0:
        c['erosionRate'] = 0

# ----------------------------------------------------------------------
# Run simulations and collect monthly dividends
# ----------------------------------------------------------------------
dividends = []
for seed in range(N_SIMULATIONS):
    random.seed(seed)
    try:
        data = run_backtest(config)
        monthly_div = calculate_monthly_dividend(data)
        dividends.append(monthly_div)
    except Exception as e:
        print(f"[Error] seed {seed}: {e}")
        continue

# ----------------------------------------------------------------------
# Compute statistics
# ----------------------------------------------------------------------
dividends_f = dividends  # list of floats
if dividends_f:
    mean_val = sum(dividends_f) / len(dividends_f)
    median_val = sorted(dividends_f)[len(dividends_f)//2]
    std_val = math.sqrt(sum((x - mean_val)**2 for x in dividends_f) / len(dividends_f))
    min_val = min(dividends_f)
    max_val = max(dividends_f)
    p5_val = sorted(dividends_f)[int(0.05*len(dividends_f))]
    p95_val = sorted(dividends_f)[int(0.95*len(dividends_f))]
    stats = {
        "count": len(dividends_f),
        "mean": mean_val,
        "median": median_val,
        "std": std_val,
        "min": min_val,
        "max": max_val,
        "p5": min_val,          # placeholder, will be overwritten below
        "p95": max_val          # placeholder, will be overwritten below
    }
    # overwrite p5 and p95 with actual percentiles
    sorted_vals = sorted(dividends_f)
    stats["p5"] = sorted_vals[int(0.05*len(dividends_f))]
    stats["p95"] = sorted_vals[int(0.95*len(dividends_f))]
else:
    stats = {"count":0,"mean":0,"median":0,"std":0,"min":0,"max":0,"p5":0,"p95":0}

with open("noise_sensitivity_stats.json", "w", encoding="utf-8") as jf:
    json.dump(stats, jf, ensure_ascii=False, indent=2)

# ----------------------------------------------------------------------
# Generate SVG histogram
# ----------------------------------------------------------------------
sorted_vals = sorted(dividends_f)
if sorted_vals:
    min_v, max_v = sorted_vals[0], sorted_vals[-1]
else:
    min_v, max_v = 0, 1
bin_width = (max_v - min_v) / BIN_COUNT
bins = [min_v + i * bin_width for i in range(BIN_COUNT + 1)]
hist_counts = [0] * BIN_COUNT
for v in dividends_f:
    idx = min(int((v - min_v) / bin_width), BIN_COUNT - 1)
    hist_counts[idx] += 1

SVG_WIDTH = 600
SVG_HEIGHT = 400
BAR_WIDTH = SVG_WIDTH / BIN_COUNT
svg_parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" style="background:#fff">']
# axes
svg_parts.append('<line x1="50" y1="350" x2="550" y2="350" stroke="#000" stroke-width="2"/>')
svg_parts.append('<line x1="50" y1="350" x2="50" y2="50" stroke="#000" stroke-width="2"/>')
# y-axis ticks
y_ticks = 5
for i in range(y_ticks + 1):
    vy = 350 - i * (300 / y_ticks)
    svg_parts.append(f'<line x1="45" y1="{vy}" x2="50" y2="{vy}" stroke="#000" stroke-width="1"/>')
    label = int((i / y_ticks) * max(hist_counts) if max(hist_counts) > 0 else 0)
    svg_parts.append(f'<text x="30" y="{vy+5}" font-size="12" text-anchor="end" fill="#000">{label}</text>')
# draw bars
for i, cnt in enumerate(hist_counts):
    x = 50 + i * BAR_WIDTH
    bar_h = 300 * cnt / max(hist_counts) if max(hist_counts) > 0 else 0
    y = 350 - bar_h
    svg_parts.append(f'<rect x="{x}" y="{y}" width="{BAR_WIDTH-1}" height="{bar_h}" fill="#69b3a2"/>')
    svg_parts.append(f'<text x="{x + BAR_WIDTH/2}" y="{y-5}" font-size="12" text-anchor="middle" fill="#fff">{cnt}</text>')
svg_parts.append('</svg>')
svg_content = "\n".join(svg_parts)
with open("noise_sensitivity_chart.svg", "w", encoding="utf-8") as f:
    f.write(svg_content)

print(f"分析完成，收集 {len(dividends_f)} 笔模拟结果，已写入 stats.json 与 chart.svg")
print(f"统计信息: {stats}")