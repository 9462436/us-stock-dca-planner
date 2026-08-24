# optimistic_parameter_sweep_fine.py
"""
Fine‑grained parameter sweep with a simple risk filter.
The script:
1. Defines a finer grid for sustainableYield_factor (1.00‑1.20 step 0.05)
   and erosion_delta (0, -1, -2).
2. For each combination it runs a few random simulations (seeds 0‑4)
   and records the resulting monthly dividend.
3. A combination is marked “acceptable” only if the minimum simulated
   dividend ≥ 0.8 × TARGET_DIVIDEND (≈ ¥16,000) – this acts as a basic
   risk constraint.
4. It writes a report (optimistic_parameter_sweep_fine_report.txt)
   containing:
   • total combos, acceptable combos and hit rate,
   • the best acceptable combo (highest average monthly dividend),
   • a short list of the top 5 acceptable combos.
5. The best parameters are saved to best_params_fine.json for the front‑end.
"""

import copy, json, math, random, sys
from datetime import datetime

# ----------------------------------------------------------------------
# 1. Base configuration (copied from the original script)
# ----------------------------------------------------------------------
STOCK_CONFIG = {
    'XQQI': {
        'price': 50.2393,
        'sustainableYield': 0.144,
        'expectedPriceReturn': -0.01,
        'annualVol': 0.15,
        'erosionRate': 5
    },
    'NVDY': {
        'price': 13.04,
        'sustainableYield': 0.173,
        'expectedPriceReturn': 0.00,
        'annualVol': 0.18,
        'erosionRate': 12
    },
    'AMZY': {
        'price': 11.04,
        'sustainableYield': 0.158,
        'expectedPriceReturn': -0.01,
        'annualVol': 0.15,
        'erosionRate': 13
    },
    'QDTE': {
        'price': 29.88,
        'sustainableYield': 0.173,
        'expectedPriceReturn': 0.02,
        'annualVol': 0.14,
        'erosionRate': 8
    },
    'SPYM': {
        'price': 91.56,
        'sustainableYield': 0.115,
        'expectedPriceReturn': 0.05,
        'annualVol': 0.12,
        'erosionRate': 3
    }
}
ORIG_CONFIG = {k: v.copy() for k, v in STOCK_CONFIG.items()}

FX_RATE = 6.757039
MONTHLY_INVEST_RMB = 7000
YEARS = 20
MONTHS = YEARS * 12
TAX_RATE = 0.0
TARGET_DIVIDEND = 20000                # ¥ per month goal
RISK_MIN_RATIO = 0.8                   # require min simulated div ≥ 0.8 × target
SIMULATIONS = 5                        # number of random seeds for risk check

# ----------------------------------------------------------------------
# 2. Parameter grid (fine‑grained)
# ----------------------------------------------------------------------
sustainableYield_factors = [1.00, 1.05, 1.10, 1.15, 1.20]   # step 0.05
erosion_deltas = [0, -1, -2]                               # reduce erosion by 0‑2 pts

FIXED_SHARES = [('XQQI', 5), ('SPYM', 2)]
REST_TICKERS = ['NVDY', 'AMZY', 'QDTE']

# ----------------------------------------------------------------------
# 3. Helper functions (same as original)
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

# ----------------------------------------------------------------------
# 4. Simplified back‑test that accepts a config dict
# ----------------------------------------------------------------------
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
        # 1) monthly investment
        monthly_invest = MONTHLY_INVEST_RMB
        monthly_invest_usd = monthly_invest / FX_RATE

        # fixed‑share purchases
        for ticker, shares in FIXED_SHARES:
            stock = next(s for s in stocks if s['ticker'] == ticker)
            cost_usd = shares * stock['price']
            stock['shares'] += shares
            stock['costBasis'] += cost_usd
            monthly_invest_usd -= cost_usd

        # remainder distributed evenly
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

        # 3) dividend payout & reinvestment
        for stock in stocks:
            if stock['shares'] > 0:
                div_per_share = stock['price'] * (stock['sustainableYield'] / 12)
                gross = stock['shares'] * div_per_share
                net = gross * (1 - TAX_RATE)
                stock['totalDividendsEarned'] += net
                # re‑invest
                stock['shares'] += net / stock['price']
                stock['costBasis'] += net

        # 4) price evolution with common + idiosyncratic shocks
        portfolio_vol = math.sqrt(sum(s['annualVol']**2 for s in stocks) / len(stocks)) / math.sqrt(12)
        common_shock = randn() * portfolio_vol
        for stock in stocks:
            idio_shock = randn() * (stock['annualVol'] / math.sqrt(12)) * 0.3
            monthly_ret = stock['monthlyPriceRet'] + common_shock + idio_shock
            stock['price'] *= (1 + monthly_ret)
            if stock['price'] < 0.01:
                stock['price'] = 0.01

    # final cumulative dividends in RMB
    cumulative_div_rmb = sum(s['totalDividendsEarned'] for s in stocks) * FX_RATE
    return [{'month': MONTHS, 'cumulative_dividends_rmb': cumulative_div_rmb}]

# ----------------------------------------------------------------------
# 5. Parameter sweep with risk filtering
# ----------------------------------------------------------------------
results = []

for yf in sustainableYield_factors:
    for ed in erosion_deltas:
        # clone original config for this combo
        config = copy.deepcopy(ORIG_CONFIG)

        # adjust sustainable yields
        for ticker, c in config.items():
            c['sustainableYield'] *= yf

        # adjust erosion rates
        for ticker, c in config.items():
            c['erosionRate'] += ed
            if c['erosionRate'] < 0:
                c['erosionRate'] = 0

        # run multiple simulations for risk assessment
        sim_dividends = []
        for seed in range(SIMULATIONS):
            random.seed(seed)                # reproducible shock randomness
            sim_config = copy.deepcopy(config)
            try:
                data = run_backtest(sim_config)
                monthly_div = calculate_monthly_dividend(data)
                sim_dividends.append(monthly_div)
            except Exception as e:
                print(f"[Error] combo({yf},{ed},{seed}): {e}")
                continue

        avg_div = sum(sim_dividends) / len(sim_dividends) if sim_dividends else 0
        min_div = min(sim_dividends) if sim_dividends else 0
        hit_cnt = sum(1 for d in sim_dividends if d >= TARGET_DIVIDEND)
        hit_rate = hit_cnt / len(sim_dividends) if sim_dividends else 0
        acceptable = min_div >= (RISK_MIN_RATIO * TARGET_DIVIDEND)

        results.append({
            'sustainableYield_factor': yf,
            'erosion_delta': ed,
            'avg_monthly_div': avg_div,
            'min_monthly_div': min_div,
            'hit_rate': hit_rate,
            'acceptable': acceptable
        })

# ----------------------------------------------------------------------
# 6. Generate human‑readable report
# ----------------------------------------------------------------------
report_path = "optimistic_parameter_sweep_fine_report.txt"
best_acceptable = max((r for r in results if r['acceptable']), key=lambda x: x['avg_monthly_div'], default=None)

with open(report_path, "w", encoding="utf-8") as f:
    f.write("="*64 + "\n")
    f.write("细化参数搜索报告（含风险过滤）\n")
    f.write("="*64 + "\n\n")
    f.write(f"总组合数: {len(results)}\n")
    acc_cnt = sum(1 for r in results if r['acceptable'])
    f.write(f"满足风险约束的组合: {acc_cnt}\n")
    # overall hit rate among acceptable combos
    hit_among_accept = sum(1 for r in results if r['acceptable'] and r['hit_rate'] >= 0.5)
    f.write(f"其中命中率 ≥10% 的组合: {hit_among_accept}\n")
    f.write("\n## 最佳可接受组合（最大平均月均股息）\n")
    if best_acceptable:
        f.write(f"- 参数: sustainableYield_factor={best_acceptable['sustainableYield_factor']}, erosion_delta={best_acceptable['erosion_delta']}\n")
        f.write(f"- 平均月均股息: ¥{best_acceptable['avg_monthly_div']:,.0f}\n")
        f.write(f"- 最低模拟股息: ¥{best_acceptable['min_monthly_div']:,.0f}\n")
        f.write(f"- 命中率: {best_acceptable['hit_rate']*100:.1f}%\n")
    else:
        f.write("未发现满足风险约束的组合。\n")
    f.write("\n## 前 5 名可接受组合（按平均月均股息排序）\n")
    top5 = sorted([r for r in results if r['acceptable']], key=lambda x: x['avg_monthly_div'], reverse=True)[:5]
    for r in top5:
        f.write(f"- factor={r['sustainableYield_factor']}, delta={r['erosion_delta']} → avg=¥{r['avg_monthly_div']:,.0f}, min=¥{r['min_monthly_div']:,.0f}, hit={r['hit_rate']*100:.1f}%\n")
    f.write("\n" + "="*64 + "\n")

# ----------------------------------------------------------------------
# 7. Persist best parameters for front‑end consumption
# ----------------------------------------------------------------------
if best_acceptable:
    best_json_path = "best_params_fine.json"
    with open(best_json_path, "w", encoding="utf-8") as jf:
        json.dump({
            "sustainableYield_factor": best_acceptable['sustainableYield_factor'],
            "erosion_delta": best_acceptable['erosion_delta']
        }, jf, ensure_ascii=False, indent=2)
    f.write(f"\n已保存最佳参数至 {best_json_path}\n")

print(f"报告已生成: {report_path}")
if best_acceptable:
    print(f"最佳参数已保存: best_params_fine.json")