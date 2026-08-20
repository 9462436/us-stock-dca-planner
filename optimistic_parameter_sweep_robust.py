# optimistic_parameter_sweep_robust.py
"""
Robust parameter sweep with volatility and safety constraints.
- Uses the same fine grid as optimistic_parameter_sweep_fine.py.
- For each (sustainableYield_factor, erosion_delta) combo:
  * Runs 5 simulations (seeds 0‑4) to estimate monthly dividend distribution.
  * Computes:
      - avg_monthly_div  (mean)
      - min_monthly_div  (minimum)
      - std_dev           (standard deviation of the 5 simulations)
  * Applies two constraints:
      1) Safety threshold: min_monthly_div >= MIN_SAFE_DIVIDEND (0.7 × TARGET_DIVIDEND ≈ ¥14,000)
      2) Volatility cap: std_dev <= MAX_VOLATILITY (set to 12,000 for this analysis)
  * A combo is marked 'acceptable' only if both constraints are satisfied.
- The script reports:
  • total combos,
  • combos that satisfy the constraints,
  • hit rate among those (fraction with average ≥ TARGET_DIVIDEND),
  • the best acceptable combo (highest avg_monthly_div),
  • top‑5 acceptable combos.
- Best parameters are saved to best_params_robust.json for front‑end use.
"""

import copy, json, math, random, sys
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
TARGET_DIVIDEND = 20000                # ¥ per month goal

# Best combo from the earlier fine‑grained sweep
BEST_YIELD_FACTOR = 1.20
BEST_ERODE_DELTA = -2

# Simulation settings
SIMULATIONS = 5                          # number of random seeds per combo
MIN_SAFE_DIVIDEND = int(0.7 * TARGET_DIVIDEND)   # ≈ ¥14,000  (adjusted safety threshold)
MAX_VOLATILITY = 12000                     # max allowed std‑dev of the 5 simulations (larger cap)

# Fixed trading settings
FIXED_SHARES = [('XQQI', 5), ('SPYM', 2)]
REST_TICKERS = ['NVDY', 'AMZY', 'QDTE']

# ----------------------------------------------------------------------
# Helper functions (identical to earlier)
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
    """Run a full 20‑year simulation and return the final cumulative‑dividend record."""
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

        # Fixed‑share purchases
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
# Parameter grid (same as fine‑grained sweep)
# ----------------------------------------------------------------------
sustainableYield_factors = [1.00, 1.05, 1.10, 1.15, 1.20]   # step 0.05
erosion_deltas = [0, -1, -2]                               # reduce erosion by 0‑2 pts

# ----------------------------------------------------------------------
# Sweep with robust constraints
# ----------------------------------------------------------------------
results = []

for yf in sustainableYield_factors:
    for ed in erosion_deltas:
        # clone original config for this combo
        combo_config = copy.deepcopy(ORIG_CONFIG)

        # adjust sustainable yields
        for ticker, c in combo_config.items():
            c['sustainableYield'] *= yf

        # adjust erosion rates
        for ticker, c in combo_config.items():
            c['erosionRate'] += ed
            if c['erosionRate'] < 0:
                c['erosionRate'] = 0

        # run multiple simulations for statistics
        dividends = []
        for seed in range(SIMULATIONS):
            random.seed(seed)
            try:
                data = run_backtest(combo_config)
                monthly_div = calculate_monthly_dividend(data)
                dividends.append(monthly_div)
            except Exception as e:
                print(f"[Error] combo({yf},{ed},{seed}): {e}")
                continue

        if not dividends:
            continue

        # basic stats
        avg_div = sum(dividends) / len(dividends)
        min_div = min(dividends)
        std_dev = math.sqrt(sum((x - avg_div) ** 2 for x in dividends) / len(dividends))
        hit_cnt = sum(1 for d in dividends if d >= TARGET_DIVIDEND)
        hit_rate = hit_cnt / len(dividends)

        # robust constraints
        safe = min_div >= MIN_SAFE_DIVIDEND
        volatile_ok = std_dev <= MAX_VOLATILITY
        acceptable = safe and volatile_ok

        results.append({
            'sustainableYield_factor': yf,
            'erosion_delta': ed,
            'avg_monthly_div': avg_div,
            'min_monthly_div': min_div,
            'std_dev': std_dev,
            'hit_rate': hit_rate,
            'acceptable': acceptable
        })

# ----------------------------------------------------------------------
# Generate human‑readable report
# ----------------------------------------------------------------------
report_path = "optimistic_parameter_sweep_robust_report.txt"
best_acceptable = max((r for r in results if r['acceptable']), key=lambda x: x['avg_monthly_div'], default=None)

with open(report_path, "w", encoding="utf-8") as f:
    f.write("="*64 + "\n")
    f.write("稳健性增强型参数搜索报告\n")
    f.write("="*64 + "\n\n")
    f.write(f"总组合数: {len(results)}\n")
    acc_cnt = sum(1 for r in results if r['acceptable'])
    f.write(f"满足安全+波动率约束的组合: {acc_cnt}\n")
    # hit among acceptable
    hit_among_accept = sum(1 for r in results if r['acceptable'] and r['hit_rate'] >= 0.5)
    f.write(f"其中平均 ≥ {TARGET_DIVIDEND} 的比例: {hit_among_accept}\n")
    f.write("\n## 最佳可接受组合（最高平均月均股息）\n")
    if best_acceptable:
        f.write(f"- 参数: sustainableYield_factor={best_acceptable['sustainableYield_factor']}, erosion_delta={best_acceptable['erosion_delta']}\n")
        f.write(f"- 平均月均股息: ¥{best_acceptable['avg_monthly_div']:,.0f}\n")
        f.write(f"- 最小模拟股息: ¥{best_acceptable['min_monthly_div']:,.0f}\n")
        f.write(f"- 标准差: ¥{best_acceptable['std_dev']:,.0f}\n")
        f.write(f"- 命中率: {best_acceptable['hit_rate']*100:.1f}%\n")
    else:
        f.write("未发现满足约束的组合。\n")
    f.write("\n## 前 5 名可接受组合（按平均月均股息排序）\n")
    top5 = sorted([r for r in results if r['acceptable']], key=lambda x: x['avg_monthly_div'], reverse=True)[:5]
    for r in top5:
        f.write(f"- factor={r['sustainableYield_factor']}, delta={r['erosion_delta']} → avg=¥{r['avg_monthly_div']:,.0f}, min=¥{r['min_monthly_div']:,.0f}, std=¥{r['std_dev']:,.0f}, hit={r['hit_rate']*100:.1f}%\n")
    f.write("\n" + "="*64 + "\n")

# ----------------------------------------------------------------------
# Persist best parameters for front‑end
# ----------------------------------------------------------------------
if best_acceptable:
    best_json_path = "best_params_robust.json"
    with open(best_json_path, "w", encoding="utf-8") as jf:
        json.dump({
            "sustainableYield_factor": best_acceptable['sustainableYield_factor'],
            "erosion_delta": best_acceptable['erosion_delta']
        }, jf, ensure_ascii=False, indent=2)
    f.write(f"\n已保存最佳参数至 {best_json_path}\n")

print(f"报告已生成: {report_path}")
if best_acceptable:
    print(f"最佳参数已保存: best_params_robust.json")