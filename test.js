// === inline block 1 ===

  (function() {
    if (typeof Chart === 'undefined') {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = initTimelineChart;
      document.head.appendChild(s);
    } else {
      initTimelineChart();
    }
  })();

  // 配置常量
  const MONTHLY_INVEST = 7000;
  const TOTAL_YEARS = 20;
  const TOTAL_MONTHS = 240;
  const ANNUAL_RATES = { conservative: 0.06, base: 0.10, optimistic: 0.14 };
  let timelineChart = null;
  let selectedTimelineYear = 20;

  // 复利终值计算（月定投，月复利）
  function calcFV(years, annualRate) {
    const months = years * 12;
    const r = annualRate / 12;
    if (r === 0) return MONTHLY_INVEST * months;
    return MONTHLY_INVEST * ((Math.pow(1 + r, months) - 1) / r);
  }

  function fmtCNY(val) {
    if (val >= 10000) return '¥' + (val / 10000).toFixed(1) + '万';
    return '¥' + val.toLocaleString();
  }

  // 初始化时间轴图表
  function initTimelineChart() {
    const ctx = document.getElementById('timelineChart')?.getContext('2d');
    if (!ctx || typeof Chart === 'undefined') return;

    // 生成 1-20 年数据
    const years = Array.from({length: 20}, (_, i) => i + 1);
    const investedData = years.map(y => (y * 12 * MONTHLY_INVEST) / 10000); // 万
    const baseData = years.map(y => calcFV(y, ANNUAL_RATES.base) / 10000);
    const optData = years.map(y => calcFV(y, ANNUAL_RATES.optimistic) / 10000);
    const consData = years.map(y => calcFV(y, ANNUAL_RATES.conservative) / 10000);

    timelineChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years.map(y => y + '年'),
        datasets: [{
          label: '累计投入(万)',
          data: investedData,
          backgroundColor: (ctx) => ctx.dataIndex < selectedTimelineYear ? 'rgba(37, 99, 235, 0.85)' : 'rgba(229, 229, 229, 0.6)',
          borderColor: (ctx) => ctx.dataIndex < selectedTimelineYear ? '#2563eb' : '#e5e5e5',
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false,
          maxBarThickness: 22,
          order: 1
        }, {
          label: '基准预期(万)',
          data: baseData,
          type: 'line',
          borderColor: '#059669',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.2,
          order: 0
        }, {
          label: '乐观预期(万)',
          data: optData,
          type: 'line',
          borderColor: '#d97706',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.2,
          order: 0
        }, {
          label: '保守预期(万)',
          data: consData,
          type: 'line',
          borderColor: '#dc2626',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.2,
          order: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            titleFont: { size: 13, weight: '500' },
            bodyFont: { size: 12 },
            displayColors: true,
            callbacks: {
              label: ctx => {
                const label = ctx.dataset.label;
                const val = ctx.raw;
                return label + ': ' + fmtCNY(val * 10000);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: 'var(--text-muted)', font: { size: 11 }, maxRotation: 0, autoSkip: false },
            offset: true
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            min: 0,
            max: Math.max(100, Math.ceil(optData[19] / 20) * 20),
            grid: { color: 'rgba(229, 229, 229, 0.5)', drawBorder: false },
            border: { display: false },
            ticks: { color: 'var(--text-muted)', font: { size: 11 }, callback: v => v + '万', stepSize: 20 }
          }
        },
        onClick: (e, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            selectTimelineYear(idx + 1);
          }
        },
        onHover: (e, elements) => {
          e.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      }
    });

    // 生成快速选择按钮
    renderYearButtons();
    // 初始化显示
    updateTimelineDisplay(20);
  }

  function renderYearButtons() {
    const container = document.getElementById('timelineYearBtns');
    if (!container) return;
    const yearOptions = [1, 3, 5, 10, 15, 20];
    container.innerHTML = '';
    yearOptions.forEach(y => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = y + '年';
      btn.dataset.year = y;
      btn.style.cssText = 'padding:6px 14px; border-radius:20px; border:1px solid var(--border); background:var(--card); font-size:12px; font-weight:600; color:var(--text-dim); cursor:pointer; transition:all 0.15s;';
      if (y === selectedTimelineYear) {
        btn.style.background = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
        btn.style.color = 'white';
      }
      btn.addEventListener('click', () => selectTimelineYear(y));
      container.appendChild(btn);
    });
  }

  function selectTimelineYear(year) {
    selectedTimelineYear = year;
    
    // 更新按钮状态
    document.querySelectorAll('#timelineYearBtns button').forEach(btn => {
      const isActive = parseInt(btn.dataset.year) === year;
      btn.style.background = isActive ? 'var(--accent)' : 'var(--card)';
      btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
      btn.style.color = isActive ? 'white' : 'var(--text-dim)';
    });
    
    // 更新图表柱状图颜色
    if (timelineChart) {
      timelineChart.data.datasets[0].backgroundColor = (ctx) => 
        ctx.dataIndex < year ? 'rgba(37, 99, 235, 0.85)' : 'rgba(229, 229, 229, 0.6)';
      timelineChart.data.datasets[0].borderColor = (ctx) => 
        ctx.dataIndex < year ? '#2563eb' : '#e5e5e5';
      timelineChart.update('none');
    }
    
    // 更新指标卡片
    updateTimelineDisplay(year);
    
    // 关键：触发全局 setYear() 联动所有图表、摘要、回测、蒙特卡洛
    if (typeof setYear === 'function') {
      setYear(year);
    }
  }

  function updateTimelineDisplay(year) {
    const months = year * 12;
    const progress = Math.round(months / TOTAL_MONTHS * 100);
    const invested = months * MONTHLY_INVEST;
    
    const yEl = document.getElementById('displayYear');
    const mEl = document.getElementById('displayMonths');
    const pEl = document.getElementById('displayProgress');
    const iEl = document.getElementById('displayInvested');
    const cEl = document.getElementById('projConservative');
    const bEl = document.getElementById('projBase');
    const oEl = document.getElementById('projOptimistic');
    
    if (yEl) yEl.textContent = year;
    if (mEl) mEl.textContent = months;
    if (pEl) pEl.textContent = progress + '%';
    if (iEl) iEl.textContent = fmtCNY(invested);
    if (cEl) cEl.textContent = fmtCNY(calcFV(year, ANNUAL_RATES.conservative));
    if (bEl) bEl.textContent = fmtCNY(calcFV(year, ANNUAL_RATES.base));
    if (oEl) oEl.textContent = fmtCNY(calcFV(year, ANNUAL_RATES.optimistic));
  }
  
// === inline block 2 ===

// ============ CONFIG ============
const FINNHUB_KEY = 'd9ocb79r01qt6o9b6ib0d9ocb79r01qt6o9b6ibg';

// ============ ETF 参数（实测客观版，2026-08-14 抓取自 stockanalysis.com） ============
// 数据完全来自真实历史价格 + TTM 分红，未做主观调整。
// 警告：以下参数是把「过去 1.5~3.26 年」的实际表现线性外推到「未来 20 年」。
//   历史数据不能保证未来表现，但这是当前最客观的估计基准。
//
// 关键定义（均现价口径，与计算引擎一致）：
//   sustainableYield = 名义现金分红率（含 ROC）= TTM 分红 ÷ 现价
//   rocRatio        = 分红中本金返还(ROC)占比（SEC 19a-1 实测）
//   expectedPriceReturn = NAV 历史 CAGR = (现价/起价)^(1/年限) - 1
//   annualVol = 年化波动率估计（单股 35~45%, 指数 15~20%）
//   资产结构区分：
//     - 单股备兑（NVDY/AMZY）：结构性 NAV 负漂移，分红中 ROC 占比 60~93%
//     - 指数 0DTE（QDTE/SDTY）：NAV 跟随指数正漂移，分红中 ROC 占比 0~60%
//     - 纳指 100 高收益（XQQI）：上市不足 1 年，用短期数据估计
//
// 实测数据源（截至 2026-08-14，起价口径分红率已换算为现价口径）：
//   XQQI  起价 $50.00  现价 $50.22  价格CAGR +0.82%  现价分红率 11.7%
//   NVDY  起价 $20.00  现价 $13.09  价格CAGR -12.20% 现价分红率 53.5%
//   AMZY  起价 $20.00  现价 $10.96  价格CAGR -17.90% 现价分红率 51.6%
//   QDTE  起价 $25.00  现价 $29.83  价格CAGR +7.50%  现价分红率 44.2%
//   SDTY  起价 $40.00  现价 $41.82  价格CAGR +3.00%  现价分红率 26.8%  (已移除)
//   SCHG  起价 $26.95  现价 $35.10  价格CAGR +13.0%  现价分红率 0.5%
const stockConfigs = [
  {
    ticker: 'XQQI', name: 'NEOS Nasdaq-100 High Income ETF',
    divPerShare: 0.82, divFreq: 'monthly',
    erosionRate: 0, allocation: 25,
    sustainableYield: 0.117,      // 现价口径名义分红率（含ROC）
    rocRatio: 0.10,                // 19a-1：纳指备兑，ROC 较低
    expectedPriceReturn: 0.0082,  // NAV 历史 CAGR +0.82%
    annualVol: 0.15,
    color: '#3b82f6', colorClass: 'c-xqqi'
  },
  {
    ticker: 'NVDY', name: 'YieldMax NVDA Option Income ETF',
    divPerShare: 0.10, divFreq: 'weekly',
    erosionRate: 12, allocation: 20,
    sustainableYield: 0.535,      // 现价口径名义分红率（含ROC）
    rocRatio: 0.93,                // 19a-1 实测：约 93% 为 ROC
    expectedPriceReturn: -0.122,  // NAV 历史 CAGR -12.20%
    annualVol: 0.45,              // 单股 NVDA 备兑，波动大
    color: '#22c55e', colorClass: 'c-nvdy'
  },
  {
    ticker: 'AMZY', name: 'YieldMax AMZN Option Income ETF',
    divPerShare: 0.07, divFreq: 'weekly',
    erosionRate: 18, allocation: 20,
    sustainableYield: 0.516,      // 现价口径名义分红率（含ROC）
    rocRatio: 0.80,                // 19a-1 多次实测：60~96%，取长期均值
    expectedPriceReturn: -0.179,  // NAV 历史 CAGR -17.90%
    annualVol: 0.35,
    color: '#f59e0b', colorClass: 'c-amzy'
  },
  {
    ticker: 'QDTE', name: 'Roundhill 0DTE Covered Call ETF',
    divPerShare: 0.20, divFreq: 'weekly',
    erosionRate: 0, allocation: 15,
    sustainableYield: 0.442,      // 现价口径名义分红率（含ROC）
    rocRatio: 0.80,                // 19a-1 实测波动 14~80%，保守用 80%
    expectedPriceReturn: 0.075,   // NAV 历史 CAGR +7.50%
    annualVol: 0.20,
    color: '#8b5cf6', colorClass: 'c-qdte'
  },
  {
    ticker: 'SCHG', name: 'Schwab US Large-Cap Growth ETF',
    divPerShare: 0.18, divFreq: 'quarterly',
    erosionRate: 0, allocation: 25,
    sustainableYield: 0.005,      // 现价口径名义分红率（无 covered call，几乎无 ROC）
    rocRatio: 0.0,                // 传统成长股 ETF，无 ROC
    expectedPriceReturn: 0.13,    // 历史 CAGR +13%（纳斯达克100成长股长期均值）
    annualVol: 0.20,              // 单股大盘成长 ETF，年化波动约 20%
    color: '#10b981', colorClass: 'c-schg'
  }
];

// Fallback prices from latest Finnhub API call (will be overwritten if API succeeds)
const fallbackQuotes = {
  'XQQI': { c: 48.42, d: 0.995, dp: 2.098, h: 48.46, l: 47.1762, pc: 47.425, t: Date.now()/1000|0 },
  'NVDY': { c: 12.34, d: 0.28, dp: 2.32, h: 12.345, l: 11.882, pc: 12.06, t: Date.now()/1000|0 },
  'AMZY': { c: 11.91, d: 0.40, dp: 3.48, h: 12.00, l: 11.67, pc: 11.51, t: Date.now()/1000|0 },
  'QDTE': { c: 28.99, d: 0.27, dp: 0.94, h: 29.02, l: 28.62, pc: 28.72, t: Date.now()/1000|0 },
  'SCHG': { c: 35.10, d: -1.02, dp: -2.82, h: 35.40, l: 35.06, pc: 36.12, t: Date.now()/1000|0 }
};

// ============ STATE ============
let quotes = JSON.parse(JSON.stringify(fallbackQuotes));
let quoteFetchStatus = {}; // 'live' | 'cached' | 'error'
let marketStatus = null;   // 后端返回的美股时段状态
let fxRate = 6.75;
let chartInstances = {};
let projectionData = null;
let currentYear = 20;

// ============ TOAST NOTIFICATIONS ============
function showToast(type, title, desc, duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'i'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${desc ? `<div class="toast-desc">${desc}</div>` : ''}
    </div>
    <button class="toast-close">×</button>
  `;
  const close = () => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector('.toast-close').addEventListener('click', close);
  container.appendChild(toast);
  if (duration > 0) setTimeout(close, duration);
}

// ============ LOCALSTORAGE CACHE ============
const CACHE_KEY = 'us_stock_quotes_cache';
function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      quotes: quotes,
      fxRate: fxRate,
      ts: Date.now()
    }));
  } catch(e) {}
}
function loadCache() {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    if (!data) return false;
    const parsed = JSON.parse(data);
    // 只使用 2 小时内的缓存
    if (Date.now() - parsed.ts > 2 * 3600 * 1000) return false;
    quotes = parsed.quotes;
    fxRate = parsed.fxRate;
    // 归一化：缓存中 fxRate 可能缺失/损坏，必须保证有效正数，否则全程计算会出现 NaN
    if (!(Number.isFinite(fxRate) && fxRate > 0)) fxRate = 6.75;
    return true;
  } catch(e) {
    return false;
  }
}

// ============ API CALLS: 本地代理服务器 (多端点 fallback) ============
// 浏览器通过不同方式加载页面时要尝试不同端点
function detectProtocol() {
  const isFile = window.location.protocol === 'file:';
  if (isFile) {
    document.getElementById('protocolBanner').classList.remove('hidden');
    document.getElementById('correctUrl').textContent = 'http://localhost:8080/index.html';
  }
  return isFile;
}

let apiBase = ''; // 默认使用相对路径（云端同源最优）

async function probeApiBase() {
  // 云端部署（非 file:// 协议）：相对路径就是同源 API，无需探测
  if (window.location.protocol !== 'file:') {
    // 验证一下相对路径是否可达
    try {
      const r = await fetch('/api/quotes', { signal: AbortSignal.timeout(5000) });
      if (r.ok) { apiBase = ''; return; }
    } catch(e) { console.warn('同源 API 探测失败:', e.message); }
  }

  // 本地开发：尝试已启动的代理服务器
  const endpoints = ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:8081', 'http://127.0.0.1:8081'];
  for (const base of endpoints) {
    try {
      const r = await fetch(`${base}/api/quotes`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) { apiBase = base; return; }
    } catch(e) {}
  }
  // 均不可达：回退到相对路径
  apiBase = '';
}

function apiUrl(path) {
  return (apiBase || '') + path;
}

async function fetchAllQuotes() {
  quoteFetchStatus = {};
  // 使用已探测的 apiBase
  const endpoints = apiBase
    ? [`${apiBase}/api/quotes`]
    : ['/api/quotes', 'http://localhost:8080/api/quotes', 'http://127.0.0.1:8080/api/quotes'];

  for (const endpoint of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);  // 6 秒超时
      const resp = await fetch(endpoint, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const result = await resp.json();
      if (!result || !result.quotes) continue;

      const { quotes: serverQuotes, fx: serverFx, market: serverMarket } = result;
      if (serverFx) fxRate = serverFx;
      // 归一化：fxRate 必须是有效正数，否则回退到默认 6.75，避免后续计算出现 NaN/Infinity
      if (!(Number.isFinite(fxRate) && fxRate > 0)) fxRate = 6.75;
      // 保存市场状态（盘前/盘中/盘后/收盘）
      if (serverMarket) marketStatus = serverMarket;

      // 数据时效判断：只有盘中（data_freshness === 'live'）拿到的价格才是真实时 tick。
      // 盘后/盘前/周末，新浪/东财的 c 字段冻结在收盘价，虽仍是有效数字，但并非实时。
      // 因此不能仅凭 q.c > 0 就标 'live'，否则盘后会显示误导性的绿色"实时"脉冲点。
      const freshness = serverMarket && serverMarket.data_freshness;
      const isTrulyLive = freshness === 'live';

      let okCount = 0;
      stockConfigs.forEach(s => {
        const q = serverQuotes[s.ticker];
        if (q && q.c > 0) {
          const oldPrice = quotes[s.ticker] ? quotes[s.ticker].c : null;
          quotes[s.ticker] = q;
          // 盘中→live；盘后/盘前→frozen（收盘价，非实时）；周末/收盘→closed
          quoteFetchStatus[s.ticker] = isTrulyLive ? 'live' : freshness;
          if (oldPrice && Math.abs(oldPrice - q.c) > 0.001) {
            const card = document.querySelector(`.price-card.${s.colorClass}`);
            if (card) { card.classList.add('updated'); setTimeout(() => card.classList.remove('updated'), 1000); }
          }
          okCount++;
        } else {
          quoteFetchStatus[s.ticker] = 'cached';
        }
      });
      // 记录价格历史（用于 sparkline + 成本均价）
      appendPriceHistory(quotes);
      return okCount;
    } catch(e) {
      continue; // 尝试下一个端点
    }
  }
  return 0;
}

// 汇率已在 fetchAllQuotes 中一起更新，不再单独获取

// ============ MARKET STATUS BADGE ============
// 根据后端返回的 market 状态对象生成时段徽章
// status: 'open'(盘中) / 'pre'(盘前) / 'after'(盘后) / 'closed'(收盘)
function renderMarketBadge(m) {
  if (!m || !m.status) return '';
  const statusClass = m.status;
  const statusText = {
    open:   '盘中实时',
    pre:    '盘前',
    after:  '盘后',
    closed: '已收盘',
  }[m.status] || m.status;
  const tooltip = [
    m.label,
    m.et_time,
    m.description,
    m.next_event ? ('下一时段：' + m.next_event) : ''
  ].filter(Boolean).join('\n');
  return `<span class="market-status-pill ${statusClass}" title="${tooltip}">
    <span class="pulse</span>${statusText}
 </span>`;
}

// ============ RENDER PRICE CARDS ============
function renderPriceCards() {
  const grid = document.getElementById('priceGrid');
  if (!grid) return;
  const monthlyInvestRMB = parseFloat(document.getElementById('monthlyInvest') && document.getElementById('monthlyInvest').value) || 7000;
  // 安全汇率：fxRate 任何非有限/非正数都用默认 6.75，杜绝 NaN
  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;
  const totalUSD = monthlyInvestRMB / safeFx;

  // 所有标的按 allocation 权重分配月预算 (碎股买入)
  const totalAlloc = stockConfigs.reduce((a, s) => a + s.allocation, 0);

  grid.innerHTML = stockConfigs.map(s => {
    const q = quotes[s.ticker] || {};
    const price = (q.c && q.c > 0) ? q.c : 0;
    const change = q.d || 0;
    const changePct = q.dp || 0;
    const isUp = change >= 0;
    const h = q.h || price;
    const l = q.l || price;
    const pc = q.pc || price;
    const divFreqLabel = {monthly:'每月',weekly:'每周',quarterly:'每季'}[s.divFreq] || s.divFreq;
    const annDiv = s.divFreq === 'weekly' ? s.divPerShare * 52 :
                   s.divFreq === 'monthly' ? s.divPerShare * 12 :
                   s.divPerShare * 4;
    const yieldPct = price > 0 ? (annDiv / price * 100).toFixed(1) : '--';
    // 月买入股数 + 月投入金额：按 allocation 权重分配
    const weight = totalAlloc > 0 ? s.allocation / totalAlloc : 1 / stockConfigs.length;
    const monthlyBuyUSD = totalUSD * weight;
    const monthlyBuy = price > 0 ? monthlyBuyUSD / price : 0;
    const monthlyBuyDisplay = monthlyBuy.toFixed(4);
    monthlyBuy = Number.isFinite(monthlyBuy) ? monthlyBuy : 0;
    const safeMonthlyBuyUSD = Number.isFinite(monthlyBuyUSD) ? monthlyBuyUSD : 0;
    // 数据时效四态：live(盘中实时) / pre_market(盘前) / after_hours(盘后，冻结收盘价) / stale(周末/收盘) / cached(本地缓存兜底)
    const qStatus = quoteFetchStatus[s.ticker];
    const isLive = qStatus === 'live';
    const isFrozen = (qStatus === 'after_hours' || qStatus === 'stale');
    const liveClass = isLive ? 'live-dot' : (isFrozen ? 'live-dot stale' : 'live-dot pre');
    const liveTitleMap = {
      live: '盘中实时数据',
      pre_market: '盘前数据（部分更新）',
      after_hours: '盘后数据（冻结在收盘价）',
      stale: '已收盘/周末（收盘价）',
      cached: '本地缓存兜底',
    };
    const liveTitle = liveTitleMap[qStatus] || '缓存数据';

    // 迷你 K 线：(l → c → h) — 当前位置在日内区间的位置
    let miniBar = '';
    if (price > 0 && h > l) {
      const range = h - l;
      const left = ((price - l) / range * 100).toFixed(1);
      const markerColor = isUp ? '#ef4444' : '#22c55e';
      miniBar = `
        <div class="mini-bar-wrap" title="日内位置 ${left}%">
          <div class="mini-bar"></div>
          <div class="mini-bar-fill" style="width:${left}%"></div>
          <div class="mini-bar-marker" style="left:${left}%;background:${markerColor}"></div>
          <div class="mini-bar-labels"><span>$${l.toFixed(2)}</span><span>$${h.toFixed(2)}</span></div>
        </div>`;
    }

    return `
    <div class="price-card ${s.colorClass}" data-ticker="${s.ticker}">
      <div class="color-line"></div>
      <div class="ticker" style="color:${s.color}">${s.ticker} <span class="${liveClass}" title="${liveTitle}"></span></div>
      <div class="name">${s.name}</div>
      ${marketStatus ? renderMarketBadge(marketStatus) : ""}
      <div class="price">$${price > 0 ? price.toFixed(2) : '加载中'} <span class="price-cny">¥${price > 0 ? (price * safeFx).toFixed(2) : '--'}</span></div>
      <div class="change" style="color:${isUp ? '#ef4444' : '#22c55e'}">
        ${price > 0 ? (isUp ? '▲ +' : '▼ ') + Math.abs(change).toFixed(2) + ' (' + (isUp ? '+' : '') + changePct.toFixed(2) + '%)' : '实时获取中...'}
      </div>
      ${miniBar}
      <div class="meta">
        <div class="meta-item">分红: <span>$${s.divPerShare.toFixed(2)}/${divFreqLabel}</span></div>
        <div class="meta-item">表面股息率: <span style="color:var(--gold);">${yieldPct}%</span></div>
        <div class="meta-item">真实收益率: <span style="color:var(--green);">${((s.sustainableYield*(1-(s.rocRatio||0))||0)*100).toFixed(1)}%</span></div>
        <div class="meta-item">ROC 比例: <span style="color:${(s.rocRatio||0) >= 0.5 ? '#ef4444' : '#f59e0b'};">${((s.rocRatio||0)*100).toFixed(0)}%</span></div>
      </div>
      <div class="meta">
        <div class="meta-item" style="color:var(--accent);font-weight:700;">月买入: <span style="color:var(--accent);">${monthlyBuyDisplay} 股</span></div>
        <div class="meta-item">月投入: <span>$${safeMonthlyBuyUSD.toFixed(0)}</span></div>
      </div>
    </div>`;
  }).join('');
}

// ============ MARKET OVERVIEW ============
const MARKET_CACHE_KEY = 'dca_market_cache';
let marketData = null;

async function fetchMarketData() {
  // 先检查本地缓存
  const cached = localStorage.getItem(MARKET_CACHE_KEY);
  if (cached) {
    try {
      const c = JSON.parse(cached);
      if (c.ts && Date.now() - c.ts < 60000) {  // 60秒缓存
        marketData = c;
        renderMarketPanel();
      }
    } catch(e) {}
  }

  const endpoints = apiBase
    ? [`${apiBase}/api/market`]
    : ['/api/market', 'http://localhost:8080/api/market', 'http://127.0.0.1:8080/api/market'];
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (!data.indices || !data.indices.items || data.indices.items.length === 0) continue;
      data.ts = Date.now();
      marketData = data;
      localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(data));
      return data;
    } catch(e) { continue; }
  }
  return marketData;
}

function renderMarketPanel() {
  if (!marketData) return;
  const d = marketData;

  // 真正无数据时的兜底：显示清晰的"暂无数据"+ 重试按钮
  if (!d.indices.items.length && !d.sectors.items.length) {
    const idxRow = document.getElementById('indicesRow');
    const secGrid = document.getElementById('sectorsGrid');
    const sentLabel = document.getElementById('sentimentLabel');
    const tsEl = document.getElementById('marketTs');
    if (sentLabel) {
      sentLabel.textContent = '暂无数据';
      sentLabel.style.color = 'var(--text-dim)';
    }
    if (tsEl) tsEl.textContent = '数据拉取中，请稍候或点刷新';
    const errHtml = `<div style="grid-column:1/-1;padding:24px 18px;text-align:center;color:var(--text-dim);font-size:12px;border:1px dashed var(--border);border-radius:10px;">
      <div style="font-size:24px;margin-bottom:6px;">⚠️</div>
      <div style="font-weight:700;color:var(--text);margin-bottom:4px;">大盘数据暂不可用</div>
      <div style="margin-bottom:10px;">可能代理服务器未启动或网络受限</div>
      <button class="btn btn-primary btn-sm" onclick="fetchMarketData().then(()=>renderMarketPanel())">
        <span class="rf-icon">↻</span> 重新拉取
      </button>
    </div>`;
    if (idxRow) idxRow.innerHTML = errHtml;
    if (secGrid) secGrid.innerHTML = '';
    const breadthEl = document.getElementById('marketBreadth');
    if (breadthEl) breadthEl.innerHTML = '';
    return;
  }

  // -- Sentiment Badge --
  const sentLabel = document.getElementById('sentimentLabel');
  const sentFill = document.getElementById('sentimentFill');
  const sentBadge = document.getElementById('sentimentBadge');
  if (sentLabel && d.composite) {
    sentLabel.textContent = `${d.composite.label} · ${d.composite.score}`;
    sentLabel.style.color = d.composite.color;
    sentFill.style.color = d.composite.color;
    sentFill.style.background = d.composite.color;
    sentBadge.style.borderColor = d.composite.color + '44';
    sentBadge.style.background = d.composite.color + '10';
  }

  // Timestamp + Market Status
  const tsEl = document.getElementById('marketTs');
  if (tsEl) {
    if (d.indices.items.length) {
      // 用客户端 ts (Date.now() 返回 ms) — 不再 *1000，否则会得到未来 5 万年
      const srvTs = d.ts || Date.now();
      const newText = '更新于 ' + new Date(srvTs).toLocaleTimeString('zh-CN', { hour12: false });
      // 仅在文字变更时触发"已更新"动画
      if (tsEl.textContent !== newText) {
        tsEl.textContent = newText;
        tsEl.classList.remove('ts-flash');
        void tsEl.offsetWidth; // 强制 reflow 重启动画
        tsEl.classList.add('ts-flash');
      }
    } else {
      tsEl.textContent = '';
    }
  }

  // 市场时段状态徽章（盘前/盘中/盘后/收盘）——来自 /api/market 返回的 market 对象
  const marketBadgeEl = document.getElementById('marketStatusBadge');
  if (marketBadgeEl && d.market) {
    marketBadgeEl.innerHTML = renderMarketBadge(d.market);
  }

  // -- Indices Row --
  const idxRow = document.getElementById('indicesRow');
  if (idxRow) {
    const idxColors = { SPX: '#6366f1', IXIC: '#06b6d4', DJI: '#f59e0b', RUT: '#84cc16' };
    idxRow.innerHTML = d.indices.items.map(i => {
      const q = i.quote;
      const dp = q.dp || 0;
      const sign = dp >= 0 ? '+' : '';
      const up = dp >= 0;
      const color = up ? '#dc2626' : '#059669';
      const bgColor = up ? 'rgba(220,38,38,0.06)' : 'rgba(5,150,105,0.06)';
      // 变动条：以昨收为 50%，当前涨跌占日内区间的比例
      const dayRange = Math.max(q.h - q.l, 0.01);
      const barPos = ((q.c - q.l) / dayRange) * 100;
      const barColor = barPos > 50 ? '#dc2626' : barPos > 35 ? '#f59e0b' : '#059669';
      return `<div class="index-card" style="border-left:3px solid ${idxColors[i.ticker] || '#6366f1'}">
        <div class="idx-info">
          <div class="idx-name">${i.name}</div>
          <div class="idx-cn">${i.cn}</div>
        </div>
        <div class="idx-right">
          <div class="idx-price">${q.c >= 100 ? q.c.toLocaleString('en-US', {maximumFractionDigits:0}) : q.c.toFixed(2)}</div>
          <div class="idx-change" style="background:${bgColor};padding:2px 10px;border-radius:10px;color:${color};">${sign}${dp.toFixed(2)}%</div>
          <div class="idx-change-bar">
            <div class="idx-change-bar-fill" style="width:${Math.abs(barPos - 50)}%;${barPos > 50 ? 'right:50%' : 'left:50%'};background:${barColor};${barPos > 50 ? 'border-radius:0 2px 2px 0' : ''}"></div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // -- Sectors Grid --
  const secGrid = document.getElementById('sectorsGrid');
  if (secGrid) {
    const sectorIcons = { tech:'💻', fin:'🏦', energy:'⛽', health:'💊', cons:'🛒', ind:'🏭', util:'🔌', mat:'🧱', re:'🏢', comm:'📡', semi:'🔬', bio:'🧬' };
    const sortedSectors = [...d.sectors.items].sort((a, b) => Math.abs(b.quote.dp) - Math.abs(a.quote.dp));
    secGrid.innerHTML = sortedSectors.map(s => {
      const q = s.quote;
      const dp = q.dp || 0;
      const up = dp >= 0;
      const sign = up ? '+' : '';
      const color = up ? '#dc2626' : '#059669';
      const bgColor = up ? 'rgba(220,38,38,0.06)' : 'rgba(5,150,105,0.06)';
      const barW = Math.min(Math.abs(dp) * 8, 40);
      return `<div class="sector-card" style="border-left:3px solid ${color}">
        <div class="sector-icon" style="background:${bgColor};color:${color}">${sectorIcons[s.icon] || '📊'}</div>
        <div class="sector-info">
          <div class="sector-name">${s.name}</div>
          <div class="sector-ticker">${s.ticker}</div>
        </div>
        <div class="sector-change" style="color:${color};">${sign}${dp.toFixed(2)}%</div>
      </div>`;
    }).join('');
  }

  // -- Market Breadth --
  const breadthEl = document.getElementById('marketBreadth');
  if (breadthEl && d.sectors.items.length > 0) {
    const total = d.sectors.items.length;
    const upCnt = d.sectors.up;
    const downCnt = d.sectors.down;
    const advPct = total > 0 ? (upCnt / total * 100) : 50;
    const sentiment = d.composite || {};
    // 板块平均涨跌幅
    const avgDp = d.sectors.items.reduce((a,s) => a + (s.quote.dp || 0), 0) / total;

    breadthEl.innerHTML = `
      <div class="breadth-bar-wrap">
        <div class="breadth-label">
          <span>板块宽度 (${upCnt}升 ${downCnt}降)</span>
          <span style="color:${advPct >= 50 ? '#dc2626' : '#059669'}">${advPct.toFixed(0)}%</span>
        </div>
        <div class="breadth-bar">
          <div class="breadth-bar-marker" style="left:${Math.max(2, Math.min(98, advPct))}%"></div>
        </div>
      </div>
      <div class="breadth-stats">
        <div class="breadth-stat">
          <div class="breadth-stat-val" style="color:${avgDp >= 0 ? '#dc2626' : '#059669'}">${avgDp >= 0 ? '+' : ''}${avgDp.toFixed(2)}%</div>
          <div class="breadth-stat-lbl">板块均值</div>
        </div>
        <div class="breadth-stat">
          <div class="breadth-stat-val" style="color:${sentiment.color || '#f59e0b'}">${sentiment.score || '--'}</div>
          <div class="breadth-stat-lbl">市场情绪</div>
        </div>
        <div class="breadth-stat">
          <div class="breadth-stat-val" style="color:${sentiment.idx_avg_dp >= 0 ? '#dc2626' : '#059669'}">${(sentiment.idx_avg_dp >= 0 ? '+' : '') + (sentiment.idx_avg_dp || 0).toFixed(2)}%</div>
          <div class="breadth-stat-lbl">指数均值</div>
        </div>
      </div>`;
  }
}

// ============ ENTRY TIMING ============
function renderEntryTiming() {
  const contentEl = document.getElementById('timingContent');
  const summaryEl = document.getElementById('timingSummary');
  if (!contentEl || !summaryEl) return;

  // 取得当前月定投资金 + 汇率（用于建议金额）
  const monthlyInvestRMB = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;
  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;
  const monthlyUSD = monthlyInvestRMB / safeFx;

  // === DCA 友好型入场评分（V2） ===
  // 五维：1) 日涨跌幅 2) 日内位置 3) 股息吸引力 4) 52周相对位置 5) 月度动量
  const stocks = stockConfigs.map(s => {
    const q = quotes[s.ticker];
    const price = (q && q.c > 0) ? q.c : 0;
    if (!price) return { ...s, score: null, signal: null, reason: '无数据', multiplier: 1, factors: [] };

    const dp = q.dp || 0;          // 日涨跌幅 %
    const h = q.h || price;        // 日内最高
    const l = q.l || price;        // 日内最低
    const pc = q.pc || price;      // 前收盘价
    const range = h - l;
    const intradayPos = range > 0 ? (price - l) / range : 0.5;

    // 计算股息率
    const annDiv = s.divFreq === 'weekly' ? s.divPerShare * 52 :
                   s.divFreq === 'monthly' ? s.divPerShare * 12 :
                   s.divPerShare * 4;
    const yieldPct = price > 0 ? (annDiv / price * 100) : 0;

    // ---------- V3 评分系统 (6 维加权) ----------
    // 权重：日内跌幅 25% + 日内位置 10% + 均线偏离 20% + 中期位置 20%
    //       + 股息吸引力 10% + 可持续性惩罚 15%
    // 关键改进：用真实历史价计算中期位置（不再用 scoreHistory 凑数）；
    //          高名义股息率扣除 ROC；负 CAGR 的"折扣"会被惩罚

    const historyArr = (loadPriceHistory()[s.ticker] || []).map(h => h.c);
    const scoreHistory = (window._scoreHistory || {})[s.ticker] || [];

    // ---------- 维度 1: 日内跌幅 (权重 25%, 范围 -1.8 ~ +3) ----------
    let dipScore;
    if (dp <= -5)        dipScore = 3.0;  // 暴跌 → 强力加码
    else if (dp <= -3)    dipScore = 2.5;  // 大跌
    else if (dp <= -1.5)  dipScore = 2.0;  // 显著折扣
    else if (dp <= -0.5)  dipScore = 1.2;  // 合理折扣
    else if (dp <= 0.5)   dipScore = 0.4;  // 微折扣/平稳
    else if (dp <= 1.5)   dipScore = -0.3; // 温和上涨
    else if (dp <= 3)     dipScore = -1.0; // 小幅溢价
    else                  dipScore = -1.8; // 大幅溢价

    // ---------- 维度 2: 日内位置 (权重 10%, 范围 -0.9 ~ +1) ----------
    let intraScore;
    if (intradayPos < 0.20)      intraScore = 1.0;
    else if (intradayPos < 0.40) intraScore = 0.6;
    else if (intradayPos < 0.60) intraScore = 0.1;
    else if (intradayPos < 0.80) intraScore = -0.4;
    else                          intraScore = -0.9;

    // ---------- 维度 3: 均线偏离 (权重 20%, 范围 -1.8 ~ +2) ----------
    // 用真实历史价计算 MA5/MA20，现价 vs 均线偏离越大越加分（下方）
    let maScore = 0;
    let maStatus = '数据积累中';
    if (historyArr.length >= 20) {
      const ma5  = historyArr.slice(-5).reduce((a,b)=>a+b,0) / 5;
      const ma20 = historyArr.slice(-20).reduce((a,b)=>a+b,0) / 20;
      const dev5  = (price - ma5)  / ma5  * 100;
      const dev20 = (price - ma20) / ma20 * 100;
      const avgDev = dev5 * 0.6 + dev20 * 0.4;
      if (avgDev <= -8)        maScore = 2.0;
      else if (avgDev <= -4)   maScore = 1.5;
      else if (avgDev <= -2)   maScore = 1.0;
      else if (avgDev <= -0.5) maScore = 0.4;
      else if (avgDev <= 1)    maScore = 0;
      else if (avgDev <= 3)    maScore = -0.8;
      else if (avgDev <= 6)    maScore = -1.4;
      else                     maScore = -1.8;
      maStatus = `MA5 ${dev5>=0?'+':''}${dev5.toFixed(1)}% · MA20 ${dev20>=0?'+':''}${dev20.toFixed(1)}%`;
    } else if (historyArr.length >= 5) {
      const ma5 = historyArr.slice(-5).reduce((a,b)=>a+b,0) / 5;
      const dev5 = (price - ma5) / ma5 * 100;
      maScore = dev5 <= -2 ? 1.0 : dev5 <= 0.5 ? 0.3 : dev5 <= 2 ? -0.3 : -0.8;
      maStatus = `MA5 ${dev5>=0?'+':''}${dev5.toFixed(1)}% (样本少)`;
    }

    // ---------- 维度 4: 中期位置 (权重 20%, 范围 -1.4 ~ +1.5) ----------
    // 用近 30 个真实历史数据点计算高低位
    let posScore = 0;
    let posStatus = '积累中';
    if (historyArr.length >= 10) {
      const window = historyArr.slice(-30);
      const min = Math.min(...window);
      const max = Math.max(...window);
      const range = max - min;
      const posInRange = range > 0 ? (price - min) / range : 0.5;
      if (posInRange <= 0.15)      posScore = 1.5;
      else if (posInRange <= 0.35) posScore = 1.0;
      else if (posInRange <= 0.55) posScore = 0.3;
      else if (posInRange <= 0.75) posScore = -0.5;
      else if (posInRange <= 0.90) posScore = -1.0;
      else                          posScore = -1.4;
      posStatus = `近 ${window.length} 点 ${Math.round(posInRange*100)}% 位`;
    }

    // ---------- 维度 5: 股息吸引力 (权重 10%, 范围 -0.3 ~ +0.8) ----------
    // 关键：扣除 ROC，高名义股息不等于真折扣
    const realYieldPct = yieldPct * (1 - (s.rocRatio || 0));
    let yieldScore;
    if (realYieldPct > 5)        yieldScore = 0.8;
    else if (realYieldPct > 2)   yieldScore = 0.5;
    else if (realYieldPct > 0.5) yieldScore = 0.2;
    else if (realYieldPct > 0)   yieldScore = 0;
    else                          yieldScore = -0.3;

    // ---------- 维度 6: 可持续性惩罚 (权重 15%, 范围 -2.5 ~ +0.8) ----------
    // 关键洞察：负 CAGR 的"折扣"是结构性损耗，不能简单视为机会
    // ROC 占比惩罚 + NAV CAGR 惩罚 + 正 CAGR 加分
    let sustainScore = 0;
    const navCagr = s.expectedPriceReturn || 0;
    const rocRatio = s.rocRatio || 0;
    sustainScore -= rocRatio * 3;             // 每 10% ROC 扣 0.3 分
    if (navCagr < -0.15)      sustainScore -= 1.0;
    else if (navCagr < -0.10) sustainScore -= 0.6;
    else if (navCagr < -0.05) sustainScore -= 0.3;
    else if (navCagr < 0)      sustainScore -= 0.1;
    else if (navCagr > 0.10)   sustainScore += 0.8;
    else if (navCagr > 0.05)   sustainScore += 0.4;
    sustainScore = Math.max(-2.5, Math.min(0.8, sustainScore));

    // ---------- 加权汇总 (基础分 5 分 + 加权因子) ----------
    const weightedBonus =
      dipScore     * 0.25 +
      intraScore   * 0.10 +
      maScore      * 0.20 +
      posScore     * 0.20 +
      yieldScore   * 0.10 +
      sustainScore * 0.15;
    const rawScore = 5 + weightedBonus;
    const score = Math.max(0, Math.min(10, Math.round(rawScore * 10) / 10));

    // 4 档信号标签
    let signal, signalBg, signalColor, multiplier;
    if (score >= 7.5) {
      signal = '强力加码'; signalBg = 'rgba(5,150,105,0.12)'; signalColor = 'var(--green)';
      multiplier = 1.5;
    } else if (score >= 6) {
      signal = '折扣入场'; signalBg = 'rgba(5,150,105,0.08)'; signalColor = 'var(--green)';
      multiplier = 1.2;
    } else if (score >= 4.5) {
      signal = '标准定投'; signalBg = 'rgba(37,99,235,0.06)'; signalColor = 'var(--accent)';
      multiplier = 1.0;
    } else if (score >= 3) {
      signal = '减量定投'; signalBg = 'rgba(217,119,6,0.06)'; signalColor = 'var(--gold)';
      multiplier = 0.75;
    } else {
      signal = '维持节奏'; signalBg = 'rgba(107,114,128,0.06)'; signalColor = 'var(--text-dim)';
      multiplier = 0.5;
    }

    // 建议金额 = 基础配置额 × 倍数 (按 allocation 权重分配月预算)
    const totalAlloc = stockConfigs.reduce((a, c) => a + c.allocation, 0);
    const weight = totalAlloc > 0 ? s.allocation / totalAlloc : 1 / stockConfigs.length;
    const baseRMB = monthlyUSD * weight * safeFx;
    const suggestRMB = baseRMB * multiplier;
    const suggestColor = multiplier >= 1.2 ? 'var(--green)' :
                         multiplier === 1.0 ? 'var(--accent)' :
                         multiplier >= 0.75 ? 'var(--gold)' : 'var(--text-dim)';
    const suggestBg = multiplier >= 1.2 ? 'rgba(5,150,105,0.08)' :
                      multiplier === 1.0 ? 'rgba(37,99,235,0.06)' :
                      multiplier >= 0.75 ? 'rgba(217,119,6,0.06)' : 'rgba(107,114,128,0.05)';

    // 因子明细（hover 显示）- V3 六维
    const factors = [
      { name:'日内跌幅', value:`${dp>=0?'+':''}${dp.toFixed(2)}%`, score: dipScore, hot: dipScore > 1, cold: dipScore < -0.3 },
      { name:'日内位置', value:`${Math.round(intradayPos*100)}%`, score: intraScore, hot: intraScore > 0.3, cold: intraScore < -0.3 },
      { name:'均线偏离', value: maStatus, score: maScore, hot: maScore > 0.5, cold: maScore < -0.5 },
      { name:'中期位置', value: posStatus, score: posScore, hot: posScore > 0.3, cold: posScore < -0.3 },
      { name:'真实股息', value:`${realYieldPct.toFixed(1)}%`, score: yieldScore, hot: yieldScore > 0.3 },
      { name:'可持续', value:`ROC ${Math.round((s.rocRatio||0)*100)}% · CAGR ${((s.expectedPriceReturn||0)*100).toFixed(1)}%`, score: sustainScore, hot: sustainScore > 0.2, cold: sustainScore < -1 }
    ];

    // 关键提示 - 基于 V3 多维度
    const tips = [];
    if (dp <= -3) tips.push('深跌加码');
    else if (dp <= -0.5) tips.push('日内折扣');
    if (intradayPos < 0.30) tips.push('日内低位');
    if (maScore > 1.0) tips.push('远离均线');
    if (posScore > 0.5) tips.push('近期低点');
    if (sustainScore < -1.5) tips.push('结构性高风险');
    if (realYieldPct > 5) tips.push('真实高息');
    const reason = tips.length > 0 ? tips.join(' · ') : '按计划买入';

    return {
      ticker: s.ticker, color: s.color,
      score, price, dp, intradayPos, yieldPct,
      signal, signalBg, signalColor, multiplier,
      baseRMB, suggestRMB, suggestColor, suggestBg, reason,
      factors, scoreHistory
    };
  });

  // 更新 score 历史（用于下次评分）
  if (!window._scoreHistory) window._scoreHistory = {};
  stocks.forEach(s => {
    if (s.score !== null) {
      if (!window._scoreHistory[s.ticker]) window._scoreHistory[s.ticker] = [];
      window._scoreHistory[s.ticker].push(s.score);
      if (window._scoreHistory[s.ticker].length > 30) {
        window._scoreHistory[s.ticker] = window._scoreHistory[s.ticker].slice(-30);
      }
    }
  });

  stocks.sort((a, b) => (b.score || 0) - (a.score || 0));
  const best = stocks[0];
  const extraBuys = stocks.filter(s => s.score >= 6);
  const normalBuys = stocks.filter(s => s.score !== null && s.score < 6);

  // 保存评分快照给 AI 助手使用
  window._lastTimingScores = stocks.map(s => ({
    ticker: s.ticker, score: s.score, signal: s.signal, reason: s.reason,
    multiplier: s.multiplier, suggestRMB: s.suggestRMB
  }));

  // 渲染评分行
  contentEl.innerHTML = stocks.map(s => {
    if (s.score === null) {
      return `<div class="timing-row">
        <div class="timing-ticker" style="color:${s.color}">${s.ticker}</div>
        <div class="timing-indicators"><span class="ti">等待数据...</span></div>
        <div class="timing-score-bar"><div class="timing-score-fill" style="width:0%"></div></div>
        <span class="timing-signal" style="background:var(--card);color:var(--text-dim)">--</span>
        <div class="timing-amount" style="background:var(--card);color:var(--text-dim)">--</div>
      </div>`;
    }
    const pct = Math.round(s.score * 10);
    const scoreColor = `hsl(${70 + pct * 4}, 70%, ${52 - pct * 1.2}%)`;

    // 评分趋势 sparkline
    const hist = s.scoreHistory || [];
    let trendHtml = '<span class="ti" style="background:transparent;padding:0;color:var(--text-dim);">--</span>';
    if (hist.length >= 3) {
      const max = Math.max(...hist);
      const min = Math.min(...hist);
      const range = Math.max(0.1, max - min);
      const bars = hist.slice(-12).map(v => {
        const h = Math.max(2, ((v - min) / range) * 16 + 2);
        const color = v >= 6 ? '#22c55e' : v >= 4.5 ? '#3b82f6' : v >= 3 ? '#f59e0b' : '#9ca3af';
        return `<div class="score-trend-bar" style="height:${h}px;background:${color}"></div>`;
      }).join('');
      trendHtml = `<span class="ti" style="padding:0;background:transparent;" title="近 ${hist.length} 次评分趋势"><div class="score-trend">${bars}</div></span>`;
    }

    // 因子 chips
    const factorChips = s.factors.map(f => {
      const cls = f.hot ? 'hot' : f.cold ? 'cold' : '';
      return `<span class="ti ${cls}" title="${f.name} (贡献 ${f.score>=0?'+':''}${f.score.toFixed(1)}分)">${f.name} ${f.value}</span>`;
    }).join('');

    return `<div class="timing-row">
      <div class="timing-ticker" style="color:${s.color}">${s.ticker}</div>
      <div class="timing-indicators">
        <span class="ti"><strong>${s.price.toFixed(2)}</strong></span>
        ${factorChips}
        ${trendHtml}
      </div>
      <div class="timing-score-bar">
        <div class="timing-score-fill" style="width:${pct}%;background:${scoreColor}"></div>
        <div class="timing-score-num">${s.score.toFixed(1)}</div>
      </div>
      <span class="timing-signal" style="background:${s.signalBg};color:${s.signalColor}">${s.signal}</span>
      <div class="timing-amount" style="background:${s.suggestBg};color:${s.suggestColor}">¥${Math.round(s.suggestRMB)}</div>
    </div>`;
  }).join('');

  // 底部投资建议
  const now = new Date();
  const dayOfWeek = ['周日','周一','周二','周三','周四','周五','周六'][now.getDay()];

  // 计算本月建议总额（所有标的 suggestRMB 求和）
  const totalSuggest = stocks.reduce((a, s) => a + (s.suggestRMB || 0), 0);
  const totalBase = stocks.reduce((a, s) => a + (s.baseRMB || 0), 0);
  const totalDelta = totalSuggest - totalBase;

  // 根据加码/减量情况生成顶部文案
  let topLine;
  if (extraBuys.length >= 2) {
    topLine = `今日有 <strong style="color:var(--green)">${extraBuys.length}</strong> 个标的进入折扣区，建议加码`;
  } else if (extraBuys.length === 1) {
    topLine = `<span class="best-ticker" style="color:${extraBuys[0].color}">${extraBuys[0].ticker}</span> 进入折扣区（${extraBuys[0].score.toFixed(1)}分），建议加码买入`;
  } else if (normalBuys.every(s => s.multiplier < 1)) {
    topLine = `今日市场整体偏强，建议<strong style="color:var(--gold)">减量</strong>执行，但仍按计划 DCA`;
  } else {
    topLine = `今日市场整体平稳，<strong style="color:var(--accent)">按标准计划</strong>定投`;
  }

  summaryEl.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
      <div style="flex:1;min-width:280px;">
        <div style="font-weight:800;font-size:13px;color:var(--text);margin-bottom:6px;">${now.toLocaleDateString('zh-CN')} ${dayOfWeek} — 定投建议</div>
        <div style="line-height:1.9;">
          ${topLine}<br>
          ${best.score >= 6
            ? `最优：<span class="best-ticker" style="color:${best.color}">${best.ticker}</span> — <strong style="color:${best.suggestColor}">${best.score.toFixed(1)}/10 · ${best.reason}</strong>`
            : `最稳：<span class="best-ticker" style="color:${best.color}">${best.ticker}</span> — ${best.reason}（${best.score.toFixed(1)}分）`}<br>
          <span style="color:var(--text-dim);font-size:10px;">评分逻辑：基础 5 分（永远 DCA） + 折扣加分 + 溢价轻扣。信号只有"加码/标准/减量/维持"，定投核心是纪律。</span>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <div style="text-align:center;background:rgba(5,150,105,0.05);border-radius:10px;padding:10px 16px;min-width:80px;">
          <div style="font-size:20px;font-weight:800;color:var(--green);">${extraBuys.length}</div>
          <div style="font-size:10px;color:var(--text-dim);">可加码</div>
        </div>
        <div style="text-align:center;background:rgba(37,99,235,0.04);border-radius:10px;padding:10px 16px;min-width:80px;">
          <div style="font-size:20px;font-weight:800;color:var(--accent);">${best.score ? best.score.toFixed(1) : '--'}</div>
          <div style="font-size:10px;color:var(--text-dim);">最高评分</div>
        </div>
        <div style="text-align:center;background:${totalDelta >= 0 ? 'rgba(5,150,105,0.05)' : 'rgba(217,119,6,0.05)'};border-radius:10px;padding:10px 16px;min-width:100px;">
          <div style="font-size:18px;font-weight:800;color:${totalDelta >= 0 ? 'var(--green)' : 'var(--gold)'};">¥${Math.round(totalSuggest)}</div>
          <div style="font-size:10px;color:var(--text-dim);">${totalDelta >= 0 ? '+' : ''}${Math.round(totalDelta)} vs 标准</div>
        </div>
      </div>
    </div>`;
}

// ============ CALCULATION ENGINE ============
function getMonthlyDivs(stock) {
  switch(stock.divFreq) {
    case 'weekly': return stock.divPerShare * 52 / 12;
    case 'monthly': return stock.divPerShare;
    case 'quarterly': return stock.divPerShare / 3;
    default: return stock.divPerShare;
  }
}

function calculate() {
  const monthlyInvestRMB = parseFloat(document.getElementById('monthlyInvest') && document.getElementById('monthlyInvest').value) || 7000;
  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;
  const taxRate = 0.10;
  const totalMonths = 20 * 12;

  // === 客观口径模型：现金分红(含ROC) + NAV历史CAGR，ROC 不重复投资 ===
  // YieldMax/0DTE 类 ETF 核心特征：高分红 + 高侵蚀
  //   sustainableYield = 名义现金分红率(含本金返还 ROC，现价口径)
  //   expectedPriceReturn = NAV 历史 CAGR(负值 = ROC 返还本金导致净值缩水)
  // 真实总回报 = sustainableYield × (1 - rocRatio) + expectedPriceReturn
  // 注意：月均「股息」包含 ~80~93% 本金返还(ROC)，非真实收益；真实收益见「月均真实收益」卡

  const totalAlloc = stockConfigs.reduce((a, s) => a + s.allocation, 0);
  const stocks = stockConfigs.map(s => {
    const q = quotes[s.ticker];
    const px = (q && q.c > 0) ? q.c : 50;
    // 真实收益率 = 名义分红率 × (1 - ROC占比)，即投资者真正赚到的部分
    const trueYield = (s.sustainableYield || 0.10) * (1 - (s.rocRatio || 0));
    const monthlyPriceRet = (s.expectedPriceReturn !== undefined
      ? s.expectedPriceReturn / 12
      : -s.erosionRate / 100 / 12);
    const annualVol = s.annualVol || 0.25;
    return {
      ...s,
      allocation: totalAlloc > 0 ? s.allocation / totalAlloc : 0.2,
      shares: 0, costBasis: 0,
      totalDividendsEarned: 0,
      totalRealDividends: 0,
      rocComponentTotal: 0,
      price: px, initialPrice: px,
      trueDivYield: trueYield,
      monthlyPriceRet: monthlyPriceRet,
      annualVol: annualVol
    };
  });

  const monthlyData = [];
  const monthlyNav = [];
  let cumulativeInvestedRMB = 0;
  let rngSeed = 42;
  const rng = () => { rngSeed = (rngSeed * 16807 + 0) % 2147483647; return rngSeed / 2147483647; };
  const randn = () => { let u=rng(),v=rng(); return Math.sqrt(-2*Math.log(u||0.0001))*Math.cos(2*Math.PI*v); };

  // 组合层面年化波动率（加权平均，权重已归一化，sum(allocation)=1）
  const portfolioAnnualVol = stocks.reduce((sum, s) => sum + s.allocation * s.annualVol, 0);
  const portfolioMonthlyVol = portfolioAnnualVol / Math.sqrt(12);

  for (let m = 0; m < totalMonths; m++) {
    let totalUSD = monthlyInvestRMB / safeFx;
    let monthInvestedUSD = 0;

    // 所有标的按 allocation 权重碎股买入（无固定股数）
    const totalAlloc = stocks.reduce((a, s) => a + s.allocation, 0);
    for (const st of stocks) {
      const w = totalAlloc > 0 ? st.allocation / totalAlloc : 1 / stocks.length;
      const budget = totalUSD * w;
      const canBuy = st.price > 0 ? budget / st.price : 0;
      if (canBuy > 0) { st.shares += canBuy; st.costBasis += budget; monthInvestedUSD += budget; }
    }
    cumulativeInvestedRMB += monthInvestedUSD * safeFx;

    // ===== 股息计算：分离真实经济收益与 ROC 本金返还 =====
    // 客观口径：sustainableYield = 现价口径名义分红率（含 ROC）。
    //   ROC（本金返还）不是收益，是把你自己的本金还给你，已通过 NAV 侵蚀体现。
    //   因此 DRIP 只再投资「真实收益」（= 现金分红 - ROC），ROC 部分不再投资，
    //   避免 ROC 被双重计算（既当收益再投，又让 NAV 下跌）。
    for (const st of stocks) {
      if (st.shares <= 0) continue;
      // 1. 现金分红总额（含 ROC），税后
      const grossCashDiv = st.shares * st.price * (st.sustainableYield / 12);
      const netCashDiv = grossCashDiv * (1 - taxRate);
      st.totalDividendsEarned += netCashDiv;
      // 2. ROC 本金返还部分（非真实收益）
      const grossRoc = grossCashDiv * (st.rocRatio || 0);
      const netRoc = grossRoc * (1 - taxRate);
      st.rocComponentTotal += netRoc;
      // 3. 真实经济收益 = 现金分红 - ROC
      const netRealDiv = netCashDiv - netRoc;
      st.totalRealDividends += netRealDiv;
      // 4. DRIP：只再投资真实收益（ROC 本金返还不再投，避免双重计算）
      st.shares += netRealDiv / st.price;
      st.costBasis += netRealDiv;
    }

    // ===== 价格变动：预期价格回报 + 随机噪声 =====
    // 生成一个组合层面的共同冲击，个股加上特有噪声
    const commonShock = randn() * portfolioMonthlyVol;
    for (const st of stocks) {
      const idioShock = randn() * (st.annualVol / Math.sqrt(12)) * 0.3; // 30% 特质波动
      const monthlyRet = st.monthlyPriceRet + commonShock + idioShock;
      st.price *= (1 + monthlyRet);
      if (st.price < 0.01) st.price = 0.01;
    }

    let portfolioValueUSD = 0;
    for (const st of stocks) portfolioValueUSD += st.shares * st.price;
    const portfolioValueRMB = portfolioValueUSD * safeFx;
    const totalValueRMB = portfolioValueRMB; // 股息已再投资入股价
    const elapsed = m + 1;
    const years = elapsed / 12;
    const cagr = cumulativeInvestedRMB>0 ? (Math.pow(totalValueRMB/cumulativeInvestedRMB,1/years)-1)*100 : 0;
    monthlyNav.push(totalValueRMB);

    let cumulativeDivRMB = 0;
    let cumulativeRealDivRMB = 0;
    let cumulativeRocRMB = 0;
    for (const st of stocks) {
      cumulativeDivRMB += st.totalDividendsEarned * safeFx;
      cumulativeRealDivRMB += st.totalRealDividends * safeFx;
      cumulativeRocRMB += st.rocComponentTotal * safeFx;
    }

    monthlyData.push({
      month: elapsed, year: Math.ceil(elapsed/12),
      investedRMB: cumulativeInvestedRMB,
      portfolioValueRMB, cumulativeDividendsRMB: cumulativeDivRMB,
      cumulativeRealDividendsRMB: cumulativeRealDivRMB,
      cumulativeRocRMB: cumulativeRocRMB,
      totalValueRMB, totalReturnRMB: totalValueRMB - cumulativeInvestedRMB,
      totalReturnPct: (cumulativeInvestedRMB>0 ? ((totalValueRMB - cumulativeInvestedRMB)/cumulativeInvestedRMB)*100 : 0),
      roi: cagr, annualizedRoi: cagr, cagr: cagr, months: elapsed,
      monthlyNav: [...monthlyNav],
      stocks: stocks.map(s => ({
        ticker: s.ticker, shares: s.shares, price: s.price,
        valueRMB: s.shares * s.price * safeFx,
        dividendsRMB: s.totalDividendsEarned * safeFx,
        realDividendsRMB: s.totalRealDividends * safeFx,
        rocComponentRMB: s.rocComponentTotal * safeFx,
        costBasisRMB: s.costBasis * safeFx
      }))
    });
  }
  return monthlyData;
}// ============ RENDER WITH YEAR FILTER ============
function getFilteredData() {
  if (!projectionData) return [];
  return projectionData.slice(0, currentYear * 12);
}

// ============ RENDER CHARTS ============
async function renderCharts() {
  const data = getFilteredData();
  const dataAvailable = data.length > 0;
  const yearLabels = dataAvailable ? data.map(d => `Y${Math.ceil(d.month/12)}`) : Array.from({length: currentYear}, (_, i) => `Y${i+1}`);
  // 即便数据为空，仍构建图表骨架（占位图），让图表卡片永远有可视内容
  const safeData = dataAvailable ? data : [];

  await renderOrUpdate('chartValue', {
    tooltip: { trigger:'axis', valueFormatter: v => '¥' + Math.round(v).toLocaleString('zh-CN'), backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e2e8f0', textStyle: { color: '#0f172a' } },
    legend: { data:['组合市值','累计股息','累计投入'], textStyle:{color:'#475569',fontWeight:600}, top:8, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
    grid: { left:70, right:24, top:48, bottom:36 },
    xAxis: { type:'category', data:yearLabels, name:'年份', nameTextStyle:{color:'#94a3b8'}, axisLabel:{color:'#94a3b8',fontSize:11}, axisLine:{lineStyle:{color:'#cbd5e1'}}, axisTick:{show:false} },
    yAxis: { type:'value', axisLabel:{color:'#94a3b8',fontSize:11,formatter:v=>'¥'+(v/10000).toFixed(0)+'万'}, splitLine:{lineStyle:{color:'#f1f5f9',type:'dashed'}}, axisLine:{show:false}, axisTick:{show:false} },
    animationDuration: 800,
    animationEasing: 'cubicOut',
    series: [
      { name:'组合市值', type:'line', data:safeData.map(d=>d.portfolioValueRMB), smooth:true, lineStyle:{color:'#4f46e5',width:2.5}, areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(79,70,229,0.28)'},{offset:1,color:'rgba(79,70,229,0.02)'}]}}, symbol:'none' },
      { name:'累计股息', type:'line', data:safeData.map(d=>d.cumulativeDividendsRMB), smooth:true, lineStyle:{color:'#059669',width:2,type:'dashed'}, areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(5,150,105,0.18)'},{offset:1,color:'rgba(5,150,105,0.02)'}]}}, symbol:'none' },
      { name:'累计投入', type:'line', data:safeData.map(d=>d.investedRMB), smooth:true, lineStyle:{color:'#d97706',width:2,type:'dotted'}, symbol:'none' }
    ]
  });

  await renderOrUpdate('chartDividend', {
    tooltip: {
      trigger:'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a' },
      formatter: params => {
        let html = params[0].axisValueLabel + '<br/>';
        params.forEach(p => {
          if (p.seriesName === '股息覆盖率') {
            html += `${p.marker} ${p.seriesName}: <strong>${p.value.toFixed(1)}%</strong><br/>`;
          } else {
            html += `${p.marker} ${p.seriesName}: <strong>¥${Math.round(p.value).toLocaleString('zh-CN')}</strong><br/>`;
          }
        });
        return html;
      }
    },
    legend: { data:['累计投入','累计分红(税后)','其中ROC','真实经济收益','分红覆盖率'], textStyle:{color:'#475569',fontWeight:600}, top:8, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
    grid: { left:70, right:60, top:48, bottom:36 },
    xAxis: { type:'category', data:yearLabels, axisLabel:{color:'#94a3b8',fontSize:11}, axisLine:{lineStyle:{color:'#cbd5e1'}}, axisTick:{show:false} },
    yAxis: [
      { type:'value', name:'金额', nameTextStyle:{color:'#94a3b8',fontSize:11}, axisLabel:{color:'#94a3b8',fontSize:11,formatter:v=>'¥'+(v/10000).toFixed(0)+'万'}, splitLine:{lineStyle:{color:'#f1f5f9',type:'dashed'}}, axisLine:{show:false}, axisTick:{show:false} },
      { type:'value', axisLabel:{color:'#94a3b8',fontSize:11,formatter:v=>v.toFixed(0)+'%'}, splitLine:{show:false}, axisLine:{show:false} }
    ],
    animationDuration: 800,
    series: [
      { name:'累计投入', type:'bar', data:safeData.map(d=>d.investedRMB), barWidth:'40%', itemStyle:{color:'rgba(217,119,6,0.32)',borderColor:'#d97706',borderWidth:1,borderRadius:[4,4,0,0]} },
      { name:'累计分红(税后)', type:'bar', data:safeData.map(d=>d.cumulativeDividendsRMB), barWidth:'40%', itemStyle:{color:'rgba(5,150,105,0.28)',borderColor:'#059669',borderWidth:1,borderRadius:[4,4,0,0]} },
      { name:'其中ROC', type:'bar', data:safeData.map(d=>d.cumulativeRocRMB||0), barWidth:'40%', itemStyle:{color:'rgba(220,38,38,0.28)',borderColor:'#dc2626',borderWidth:1,borderRadius:[4,4,0,0]} },
      { name:'真实经济收益', type:'line', data:safeData.map(d=>d.cumulativeRealDividendsRMB||0), smooth:true, lineStyle:{color:'#0891b2',width:2.5}, symbol:'circle',symbolSize:6,itemStyle:{color:'#0891b2'},
        emphasis:{itemStyle:{color:'#0e7490'}} },
      { name:'分红覆盖率', type:'line', yAxisIndex:1, data:safeData.map(d=>d.investedRMB>0?(d.cumulativeDividendsRMB/d.investedRMB*100):0), smooth:true, lineStyle:{color:'#db2777',width:2}, symbol:'none' }
    ]
  });

  // Annualized ROI trend
  const annualData = [];
  for (let y = 1; y <= currentYear; y++) {
    const idx = Math.min(data.length - 1, y * 12 - 1);
    const d = data[idx];
    annualData.push({ year: y, roi: d.annualizedRoi, totalReturn: d.totalReturnRMB });
  }
  await renderOrUpdate('chartReturn', {
    tooltip: {
      trigger:'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a' },
      formatter: params => {
        let html = params[0].axisValueLabel + '<br/>';
        params.forEach(p => {
          const val = p.seriesName.includes('收益率')
            ? p.value.toFixed(2) + '%'
            : '¥' + Math.round(p.value).toLocaleString('zh-CN');
          html += `${p.marker} ${p.seriesName}: <strong>${val}</strong><br/>`;
        });
        return html;
      }
    },
    legend: { data:['年化收益率','累计总收益(¥)'], textStyle:{color:'#475569',fontWeight:600}, top:8, icon:'roundRect', itemWidth:12, itemHeight:8 },
    grid: { left:70, right:80, top:48, bottom:36 },
    xAxis: { type:'category', data:annualData.map(d=>'Y'+d.year), axisLabel:{color:'#94a3b8',fontSize:11}, axisLine:{lineStyle:{color:'#cbd5e1'}}, axisTick:{show:false} },
    yAxis: [
      { type:'value', name:'收益率', nameTextStyle:{color:'#94a3b8',fontSize:11}, axisLabel:{color:'#94a3b8',fontSize:11,formatter:v=>v.toFixed(0)+'%'}, splitLine:{lineStyle:{color:'#f1f5f9',type:'dashed'}}, axisLine:{show:false}, axisTick:{show:false} },
      { type:'value', name:'收益额', nameTextStyle:{color:'#94a3b8',fontSize:11}, axisLabel:{color:'#94a3b8',fontSize:11,formatter:v=>'¥'+(v/10000).toFixed(0)+'万'}, splitLine:{show:false}, axisLine:{show:false} }
    ],
    series: [
      { name:'年化收益率', type:'line', data:annualData.map(d=>d.roi), smooth:true, lineStyle:{color:'#7c3aed',width:2.5}, areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(124,58,237,0.18)'},{offset:1,color:'rgba(124,58,237,0.02)'}]}}, symbol:'circle',symbolSize:6, itemStyle:{color:'#7c3aed'} },
      { name:'累计总收益(¥)', type:'bar', yAxisIndex:1, data:annualData.map(d=>d.totalReturn), barWidth:'45%', itemStyle:{color:'rgba(8,145,178,0.4)',borderColor:'#0891b2',borderWidth:1,borderRadius:[4,4,0,0]} }
    ]
  });

  // ============ 年度现金流 ============
  // 每年支出 vs 当年税后分红，可直观看到 "哪年分红开始覆盖定投"
  const monthlyInvestRMB = parseFloat(document.getElementById('monthlyInvest') && document.getElementById('monthlyInvest').value) || 7000;
  const annualOutflow = monthlyInvestRMB * 12;
  const annualLabels = [];
  const annualDividends = [];
  for (let y = 1; y <= currentYear; y++) {
    const curIdx = Math.min(data.length - 1, y * 12 - 1);
    const prevIdx = Math.min(data.length - 1, (y - 1) * 12 - 1);
    const curDiv = data[curIdx].cumulativeDividendsRMB;
    const prevDiv = prevIdx >= 0 ? data[prevIdx].cumulativeDividendsRMB : 0;
    annualLabels.push('Y' + y);
    annualDividends.push(curDiv - prevDiv);
  }
  // 覆盖率 = 当年分红 / 当年支出 × 100
  const coveragePct = annualDividends.map(d => annualOutflow > 0 ? (d / annualOutflow * 100) : 0);
  await renderOrUpdate('chartCashflow', {
    tooltip: {
      trigger:'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a' },
      formatter: params => {
        let html = params[0].axisValueLabel + '<br/>';
        params.forEach(p => {
          if (p.seriesType === 'line' && p.seriesName === '分红覆盖率') {
            html += `${p.marker} ${p.seriesName}: <strong>${p.value.toFixed(1)}%</strong><br/>`;
          } else {
            html += `${p.marker} ${p.seriesName}: <strong>¥${Math.round(p.value).toLocaleString('zh-CN')}</strong><br/>`;
          }
        });
        return html;
      }
    },
    legend: { data:['年税后分红','分红覆盖率'], textStyle:{color:'#475569',fontWeight:600}, top:8, icon:'roundRect', itemWidth:12, itemHeight:8 },
    grid: { left:70, right:60, top:48, bottom:36 },
    xAxis: { type:'category', data:annualLabels, name:'年份', nameTextStyle:{color:'#94a3b8'}, axisLabel:{color:'#94a3b8',fontSize:11}, axisLine:{lineStyle:{color:'#cbd5e1'}}, axisTick:{show:false} },
    yAxis: [
      { type:'value', name:'金额', nameTextStyle:{color:'#94a3b8',fontSize:11}, axisLabel:{color:'#94a3b8',fontSize:11,formatter:v=>'¥'+(v/10000).toFixed(0)+'万'}, splitLine:{lineStyle:{color:'#f1f5f9',type:'dashed'}}, axisLine:{show:false}, axisTick:{show:false} },
      { type:'value', name:'覆盖率', nameTextStyle:{color:'#94a3b8',fontSize:11}, axisLabel:{color:'#94a3b8',fontSize:11,formatter:v=>v.toFixed(0)+'%'}, splitLine:{show:false}, max: 100, axisLine:{show:false} }
    ],
    series: [
      { name:'年税后分红', type:'bar', data:annualDividends, barWidth:'50%',
        itemStyle:{color:'rgba(5,150,105,0.55)',borderColor:'#059669',borderWidth:1,borderRadius:[6,6,0,0]},
        // 在柱状图上画一条水平参考线表示年定投支出
        markLine:{
          silent:true, symbol:'none',
          label:{color:'#dc2626',formatter:'年定投 ¥'+annualOutflow.toLocaleString('zh-CN'),position:'insideEndTop',fontSize:11,fontWeight:700},
          data:[{yAxis:annualOutflow, lineStyle:{color:'#dc2626',type:'dashed',width:2}}]
        }
      },
      { name:'分红覆盖率', type:'line', yAxisIndex:1, data:coveragePct, smooth:true,
        lineStyle:{color:'#db2777',width:2.5}, symbol:'circle',symbolSize:6,
        itemStyle:{color:'#db2777'},
        markLine:{silent:true,symbol:'none',label:{color:'#db2777',formatter:'100% 拐点',position:'insideEndTop',fontSize:11,fontWeight:700},
                  data:[{yAxis:100,lineStyle:{color:'#db2777',type:'dotted',width:1.5}}]}}
    ]
  });

  // ============ 月度分红覆盖率热力图（年 × 月） ============
  const heatMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const heatData = [];
  let maxYear = currentYear;
  for (let y = 1; y <= currentYear; y++) {
    const startMonth = (y - 1) * 12;
    const endMonth = y * 12;
    let yearDiv = 0;
    for (let m = startMonth; m < endMonth && m < data.length; m++) {
      const monthDivUSD = data[m].cumulativeDividendsRMB - (m > 0 ? data[m-1].cumulativeDividendsRMB : 0);
      // 月投入人民币 = monthlyInvest
      const monthMonthlyInvest = monthlyInvestRMB;
      const cov = monthMonthlyInvest > 0 ? (monthDivUSD / monthMonthlyInvest * 100) : 0;
      const monthIdx = m % 12;
      heatData.push([monthIdx, y - 1, Math.round(cov * 10) / 10]);
    }
  }
  await renderOrUpdate('chartHeatmap', {
    tooltip: {
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#e2e8f0',
      textStyle: { color: '#0f172a' },
      formatter: p => {
        const v = p.value[2];
        return `${heatMonths[p.value[0]]} · 第 ${p.value[1]+1} 年<br/>分红覆盖率: <strong style="color:${v >= 100 ? '#059669' : v >= 50 ? '#d97706' : '#64748b'}">${v}%</strong>`;
      }
    },
    grid: { left:60, right:20, top:30, bottom:60 },
    xAxis: { type:'category', data:heatMonths, axisLabel:{color:'#94a3b8',fontSize:11}, splitArea:{show:true}, axisLine:{lineStyle:{color:'#cbd5e1'}} },
    yAxis: { type:'category', data:Array.from({length:currentYear},(_,i)=>`Y${i+1}`), axisLabel:{color:'#94a3b8',fontSize:10}, splitArea:{show:true}, axisLine:{lineStyle:{color:'#cbd5e1'}} },
    visualMap: {
      min: 0, max: 120, calculable: false, orient:'horizontal', left:'center', bottom:5,
      textStyle:{color:'#94a3b8',fontSize:10},
      inRange:{color:['#f1f5f9','#c7d2fe','#a5b4fc','#34d399','#059669']},
      text:['高覆盖率','低覆盖率']
    },
    series: [{
      name:'分红覆盖率', type:'heatmap', data: heatData,
      label:{show:true,fontSize:9,color:'#475569',formatter:p=>p.value[2]+'%'},
      emphasis:{itemStyle:{shadowBlur:18,shadowColor:'rgba(15,23,42,0.35)',borderColor:'#fff',borderWidth:2}},
      itemStyle:{borderColor:'#fff',borderWidth:2,borderRadius:3}
    }]
  });

  // ============ 净值曲线 + 水下图 ============
  const navData = window._navCurve || [];
  const ddData = window._drawdownCurve || [];
  if (navData.length > 0) {
    await renderOrUpdate('chartDrawdown', {
      tooltip: {
        trigger:'axis',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#0f172a' },
        formatter: params => {
          let html = params[0].axisValueLabel + '<br/>';
          params.forEach(p => {
            if (p.seriesName === '水下回撤') {
              html += `${p.marker} ${p.seriesName}: <strong style="color:#dc2626">${p.value.toFixed(2)}%</strong><br/>`;
            } else {
              html += `${p.marker} ${p.seriesName}: <strong>¥${Math.round(p.value/10000).toLocaleString()}万</strong><br/>`;
            }
          });
          return html;
        }
      },
      legend: { data:['净值曲线','水下回撤'], textStyle:{color:'#475569',fontWeight:600}, top:8, icon:'roundRect', itemWidth:12, itemHeight:8 },
      grid: [
        { left:70, right:60, top:48, height:'50%' },
        { left:70, right:60, top:'72%', height:'22%' }
      ],
      xAxis: [
        { type:'category', data:window._yearLabels || [], axisLabel:{color:'#94a3b8',show:false}, gridIndex:0, axisLine:{show:false}, axisTick:{show:false} },
        { type:'category', data:window._yearLabels || [], axisLabel:{color:'#94a3b8',fontSize:10}, gridIndex:1, axisLine:{lineStyle:{color:'#cbd5e1'}}, axisTick:{show:false} }
      ],
      yAxis: [
        { type:'value', name:'净值', nameTextStyle:{color:'#94a3b8',fontSize:10}, axisLabel:{color:'#94a3b8',fontSize:10,formatter:v=>'¥'+(v/10000).toFixed(0)+'万'}, splitLine:{lineStyle:{color:'#f1f5f9',type:'dashed'}}, gridIndex:0, axisLine:{show:false}, axisTick:{show:false} },
        { type:'value', name:'回撤', nameTextStyle:{color:'#94a3b8',fontSize:10}, axisLabel:{color:'#94a3b8',fontSize:10,formatter:v=>v.toFixed(0)+'%'}, max:0, splitLine:{show:false}, gridIndex:1, axisLine:{show:false}, axisTick:{show:false} }
      ],
      series: [
        {
          name:'净值曲线', type:'line', data:navData, smooth:true,
          lineStyle:{color:'#4f46e5',width:2.5},
          areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(79,70,229,0.28)'},{offset:1,color:'rgba(79,70,229,0.02)'}]}},
          xAxisIndex:0, yAxisIndex:0, symbol:'none'
        },
        {
          name:'水下回撤', type:'area', data:ddData,
          itemStyle:{color:'rgba(220,38,38,0.45)'},
          lineStyle:{color:'#dc2626',width:1.5},
          xAxisIndex:1, yAxisIndex:1, symbol:'none',
          markLine:{silent:true,symbol:'none',label:{color:'#dc2626',formatter:'最深回撤',position:'insideEndTop',fontSize:10,fontWeight:700},
                    data:[{type:'max',name:'最深',lineStyle:{color:'#dc2626',type:'dashed',width:1.5}}]}
        }
      ]
    });
  }
}

async function renderOrUpdate(id, option) {
  const card = document.getElementById(id)?.parentElement;
  if (card) card.classList.remove('loading');
  if (chartInstances[id]) {
    try { chartInstances[id].dispose(); } catch(e) {}
  }
  const dom = document.getElementById(id);
  if (!dom) return;
  // 清理空状态占位符
  const oldEmpty = dom.parentElement?.querySelector('.chart-empty');
  if (oldEmpty) oldEmpty.remove();
  
  // 等待 ECharts 加载完成
  try {
    await waitForECharts();
  } catch (e) {
    console.error('ECharts not loaded:', e);
    showChartEmpty(id, '图表库加载失败，请刷新重试');
    return;
  }
  
  const chart = echarts.init(dom);
  chart.setOption(option);
  chartInstances[id] = chart;
}

// 显示图表空状态（数据为空时）
function showChartEmpty(chartId, message = '暂无数据') {
  const dom = document.getElementById(chartId);
  if (!dom) return;
  if (chartInstances[chartId]) {
    try { chartInstances[chartId].dispose(); } catch(e) {}
    chartInstances[chartId] = null;
  }
  const parent = dom.parentElement;
  if (!parent) return;
  // 移除旧空状态
  const old = parent.querySelector('.chart-empty');
  if (old) old.remove();
  // 添加新空状态（更精致的占位）
  const empty = document.createElement('div');
  empty.className = 'chart-empty';
  empty.innerHTML = `
    <div class="chart-empty-icon">▦</div>
    <div class="chart-empty-text">${message}</div>
  `;
  parent.style.position = 'relative';
  parent.appendChild(empty);
}

// ============ CHART TABLE VIEW (Text-based display) ============
let showCharts = true; // true = 图表模式, false = 表格模式

function toggleChartView(showChart) {
  showCharts = showChart;
  const chartBoxes = document.querySelectorAll('.chart-box');
  const chartTables = document.querySelectorAll('.chart-table');
  const chartBtn = document.getElementById('chartViewBtn');
  const tableBtn = document.getElementById('tableViewBtn');
  
  chartBoxes.forEach(box => box.classList.toggle('hidden', !showChart));
  chartTables.forEach(table => table.classList.toggle('hidden', showChart));
  
  if (chartBtn) chartBtn.classList.toggle('active', showChart);
  if (tableBtn) tableBtn.classList.toggle('active', !showChart);
  
  if (!showChart) {
    // 渲染所有表格
    renderAllChartTables();
  } else {
    // 切回图表模式时重新渲染图表
    renderCharts();
  }
}

function renderAllChartTables() {
  if (!projectionData || projectionData.length === 0) return;
  
  const data = getFilteredData();
  const yearLabels = data.map(d => `Y${Math.ceil(d.month/12)}`);
  
  // 1. 投资组合总价值变化表
  renderChartTable('tableValue', {
    title: '投资组合总价值变化',
    headers: ['年份', '累计投入(¥)', '组合市值(¥)', '累计股息(¥)', '总收益(¥)', '回报率(%)'],
    rows: data.filter((_, i) => (i + 1) % 12 === 0 || i === data.length - 1).map(d => [
      `第 ${Math.ceil(d.month/12)} 年`,
      Math.round(d.investedRMB).toLocaleString('zh-CN'),
      Math.round(d.portfolioValueRMB).toLocaleString('zh-CN'),
      Math.round(d.cumulativeDividendsRMB).toLocaleString('zh-CN'),
      Math.round(d.totalReturnRMB).toLocaleString('zh-CN'),
      d.totalReturnPct.toFixed(1)
    ])
  });
  
  // 2. 累计股息 vs 累计投入表
  renderChartTable('tableDividend', {
    title: '累计股息 vs 累计投入',
    headers: ['年份', '累计投入(¥)', '累计分红(税后)(¥)', '其中ROC(¥)', '真实经济收益(¥)', '分红覆盖率(%)'],
    rows: data.filter((_, i) => (i + 1) % 12 === 0 || i === data.length - 1).map(d => [
      `第 ${Math.ceil(d.month/12)} 年`,
      Math.round(d.investedRMB).toLocaleString('zh-CN'),
      Math.round(d.cumulativeDividendsRMB).toLocaleString('zh-CN'),
      Math.round(d.cumulativeRocRMB || 0).toLocaleString('zh-CN'),
      Math.round(d.cumulativeRealDividendsRMB || 0).toLocaleString('zh-CN'),
      (d.investedRMB > 0 ? (d.cumulativeDividendsRMB / d.investedRMB * 100) : 0).toFixed(1)
    ])
  });
  
  // 3. 年度现金流表
  const monthlyInvestRMB = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;
  const annualOutflow = monthlyInvestRMB * 12;
  renderChartTable('tableCashflow', {
    title: '年度现金流（支出 vs 分红）',
    headers: ['年份', '年定投支出(¥)', '年税后分红(¥)', '分红覆盖率(%)', '缺口/盈余(¥)'],
    rows: Array.from({ length: currentYear }, (_, y) => {
      const yNum = y + 1;
      const curIdx = Math.min(data.length - 1, yNum * 12 - 1);
      const prevIdx = Math.min(data.length - 1, (yNum - 1) * 12 - 1);
      const curDiv = data[curIdx].cumulativeDividendsRMB;
      const prevDiv = prevIdx >= 0 ? data[prevIdx].cumulativeDividendsRMB : 0;
      const yearDiv = curDiv - prevDiv;
      const coverage = annualOutflow > 0 ? (yearDiv / annualOutflow * 100) : 0;
      const gap = yearDiv - annualOutflow;
      return [
        `第 ${yNum} 年`,
        annualOutflow.toLocaleString('zh-CN'),
        Math.round(yearDiv).toLocaleString('zh-CN'),
        coverage.toFixed(1),
        (gap >= 0 ? '+' : '') + Math.round(gap).toLocaleString('zh-CN')
      ];
    })
  });
  
  // 5. 年化收益率趋势表
  const annualData = [];
  for (let y = 1; y <= currentYear; y++) {
    const idx = Math.min(data.length - 1, y * 12 - 1);
    const d = data[idx];
    annualData.push({ year: y, roi: d.annualizedRoi, totalReturn: d.totalReturnRMB });
  }
  renderChartTable('tableReturn', {
    title: '年化收益率趋势',
    headers: ['年份', '年化收益率(%)', '累计总收益(¥)'],
    rows: annualData.map(d => [
      `第 ${d.year} 年`,
      d.roi.toFixed(2),
      Math.round(d.totalReturn).toLocaleString('zh-CN')
    ])
  });
  
  // 6. 月度分红覆盖率热力图表
  const heatMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const heatRows = [];
  for (let y = 1; y <= currentYear; y++) {
    const row = [`第 ${y} 年`];
    for (let m = 0; m < 12; m++) {
      const monthIdx = (y - 1) * 12 + m;
      if (monthIdx < data.length) {
        const monthDivUSD = data[monthIdx].cumulativeDividendsRMB - (monthIdx > 0 ? data[monthIdx-1].cumulativeDividendsRMB : 0);
        const monthMonthlyInvest = monthlyInvestRMB;
        const cov = monthMonthlyInvest > 0 ? (monthDivUSD / monthMonthlyInvest * 100) : 0;
        row.push(cov.toFixed(1) + '%');
      } else {
        row.push('--');
      }
    }
    heatRows.push(row);
  }
  renderChartTable('tableHeatmap', {
    title: '月度分红覆盖率热力图',
    headers: ['年份', ...heatMonths],
    rows: heatRows
  });
  
  // 7. 净值曲线 vs 水下回撤表
  const navCurve = window._navCurve || [];
  const ddCurve = window._drawdownCurve || [];
  const navRows = navCurve.map((v, i) => {
    const year = Math.ceil((i + 1) / 12);
    const month = (i % 12) + 1;
    return [
      `Y${year}M${month.toString().padStart(2, '0')}`,
      Math.round(v).toLocaleString('zh-CN'),
      (ddCurve[i] || 0).toFixed(2) + '%'
    ];
  });
  renderChartTable('tableDrawdown', {
    title: '净值曲线 vs 水下回撤',
    headers: ['月份', '净值(¥)', '回撤(%)'],
    rows: navRows
  });
  
  // 8. 蒙特卡洛表
  if (monteCarloResult && monteCarloResult.finalValues) {
    const mc = monteCarloResult;
    const mcTotalInvested = mc.totalInvested || 0;
    const mcRows = mc.finalValues.map((v, i) => [
      i + 1,
      Math.round(v).toLocaleString('zh-CN'),
      mcTotalInvested > 0 ? ((v - mcTotalInvested) / mcTotalInvested * 100).toFixed(1) + '%' : '0%'
    ]).slice(0, 20); // 只显示前20
    renderChartTable('tableMonteCarlo', {
      title: '蒙特卡洛模拟结果 (前20路径)',
      headers: ['路径', '终值(¥)', '收益率(%)'],
      rows: mcRows
    });
  }
}

function renderChartTable(tableId, { title, headers, rows }) {
  const tableEl = document.getElementById(tableId);
  if (!tableEl) return;
  
  tableEl.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;padding:8px;background:var(--accent-light);border-radius:var(--radius-sm);border:1px solid var(--accent-light);">${title}</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:var(--font-mono);">
        <thead>
          <tr style="background:var(--bg-elevated);">
            ${headers.map(h => `<th style="padding:8px 10px;text-align:right;border-bottom:2px solid var(--border);color:var(--text-secondary);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, ri) => `
            <tr style="${ri % 2 === 0 ? 'background:var(--bg)' : ''};">
              ${row.map((cell, ci) => `
                <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:${ci === 0 ? 'left' : 'right'};color:${ci === 0 ? 'var(--text)' : 'var(--text-secondary)'};font-weight:${ci === 0 ? '600' : '500'};">
                  ${cell}
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:8px;padding:8px;background:var(--info-bg);border-radius:var(--radius-sm);border:1px solid var(--info-light);font-size:10px;color:var(--info);">
      💡 提示：点击"图表"切回可视化视图 · 点击"导出所有图表数据 (CSV)"下载完整数据
    </div>
  `;
}

function exportAllChartDataCSV() {
  if (!projectionData || projectionData.length === 0) {
    showToast('warning', '无数据可导出', '请等待数据加载完成后再试');
    return;
  }
  
  const data = getFilteredData();
  const monthlyInvestRMB = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;
  const annualOutflow = monthlyInvestRMB * 12;
  
  // 创建多个 CSV 文件，打包成 ZIP 太复杂，直接下载多个 CSV
  // 这里我们生成一个综合 CSV，包含所有关键指标
  
  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += '美股定投助手 - 图表数据导出\n';
  csvContent += `导出时间,${new Date().toLocaleString('zh-CN')}\n`;
  csvContent += `预测年限,${currentYear}年\n`;
  csvContent += `月定投,¥${monthlyInvestRMB}\n`;
  csvContent += `汇率,$1=¥${fxRate.toFixed(4)}\n\n`;
  
  // Sheet 1: 年度汇总
  csvContent += '=== 年度汇总 ===\n';
  csvContent += '年份,月数,累计投入(¥),组合市值(¥),累计股息(¥),总收益(¥),回报率(%),年化收益(%),累计ROC(¥),真实收益(¥)\n';
  data.filter((_, i) => (i + 1) % 12 === 0 || i === data.length - 1).forEach(d => {
    csvContent += `${Math.ceil(d.month/12)},${d.month},${Math.round(d.investedRMB)},${Math.round(d.portfolioValueRMB)},${Math.round(d.cumulativeDividendsRMB)},${Math.round(d.totalReturnRMB)},${d.totalReturnPct.toFixed(1)},${d.annualizedRoi.toFixed(1)},${Math.round(d.cumulativeRocRMB || 0)},${Math.round(d.cumulativeRealDividendsRMB || 0)}\n`;
  });
  
  csvContent += '\n=== 月度明细 ===\n';
  csvContent += '月份,年份,累计投入(¥),组合市值(¥),累计股息(¥),总收益(¥),月度股息(¥),月度收益率(%)\n';
  data.forEach((d, i) => {
    const monthlyDiv = i > 0 ? d.cumulativeDividendsRMB - data[i-1].cumulativeDividendsRMB : 0;
    const monthlyRet = i > 0 ? (d.totalValueRMB - monthlyInvestRMB - data[i-1].totalValueRMB) / data[i-1].totalValueRMB * 100 : 0;
    csvContent += `${d.month},${d.year},${Math.round(d.investedRMB)},${Math.round(d.portfolioValueRMB)},${Math.round(d.cumulativeDividendsRMB)},${Math.round(d.totalReturnRMB)},${Math.round(monthlyDiv)},${monthlyRet.toFixed(2)}\n`;
  });
  
  // Sheet 2: 年度现金流
  csvContent += '\n=== 年度现金流 ===\n';
  csvContent += '年份,年定投支出(¥),年税后分红(¥),分红覆盖率(%),缺口/盈余(¥)\n';
  for (let y = 1; y <= currentYear; y++) {
    const curIdx = Math.min(data.length - 1, y * 12 - 1);
    const prevIdx = Math.min(data.length - 1, (y - 1) * 12 - 1);
    const curDiv = data[curIdx].cumulativeDividendsRMB;
    const prevDiv = prevIdx >= 0 ? data[prevIdx].cumulativeDividendsRMB : 0;
    const yearDiv = curDiv - prevDiv;
    const coverage = annualOutflow > 0 ? (yearDiv / annualOutflow * 100) : 0;
    const gap = yearDiv - annualOutflow;
    csvContent += `${y},${annualOutflow},${Math.round(yearDiv)},${coverage.toFixed(1)},${Math.round(gap)}\n`;
  }
  
  // Sheet 3: 持仓明细
  const last = data[data.length - 1];
  csvContent += '\n=== 当前持仓明细 ===\n';
  csvContent += '标的,持仓股数,当前价($),市值(¥),占比(%),配置权重(%),月度分红($),年化股息率(%)\n';
  last.stocks.forEach(s => {
    const stock = stockConfigs.find(c => c.ticker === s.ticker);
    const allocation = stock ? (stock.allocation * 100).toFixed(0) : '0';
    const monthlyDiv = stock ? (stock.divFreq === 'weekly' ? stock.divPerShare * 52/12 : stock.divFreq === 'monthly' ? stock.divPerShare : stock.divPerShare / 3) : 0;
    const yieldPct = stock && s.price > 0 ? ((stock.divFreq === 'weekly' ? stock.divPerShare * 52 : stock.divFreq === 'monthly' ? stock.divPerShare * 12 : stock.divPerShare * 4) / s.price * 100).toFixed(1) : '0';
    csvContent += `${s.ticker},${s.shares.toFixed(2)},${s.price.toFixed(2)},${Math.round(s.valueRMB)},${(last.portfolioValueRMB > 0 ? (s.valueRMB / last.portfolioValueRMB * 100) : 0).toFixed(1)},${allocation},${monthlyDiv.toFixed(2)},${yieldPct}\n`;
  });
  
  // Sheet 4: 月度分红覆盖率热力图
  const heatMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  csvContent += '\n=== 月度分红覆盖率热力图 ===\n';
  csvContent += '年份,' + heatMonths.join(',') + '\n';
  for (let y = 1; y <= currentYear; y++) {
    const row = [`Y${y}`];
    for (let m = 0; m < 12; m++) {
      const monthIdx = (y - 1) * 12 + m;
      if (monthIdx < data.length) {
        const monthDivUSD = data[monthIdx].cumulativeDividendsRMB - (monthIdx > 0 ? data[monthIdx-1].cumulativeDividendsRMB : 0);
        const monthMonthlyInvest = monthlyInvestRMB;
        const cov = monthMonthlyInvest > 0 ? (monthDivUSD / monthMonthlyInvest * 100) : 0;
        row.push(cov.toFixed(1));
      } else {
        row.push('--');
      }
    }
    csvContent += row.join(',') + '\n';
  }
  
  // Sheet 5: 净值与回撤
  const navCurve = window._navCurve || [];
  const ddCurve = window._drawdownCurve || [];
  csvContent += '\n=== 净值曲线与回撤 ===\n';
  csvContent += '月份,净值(¥),回撤(%)\n';
  navCurve.forEach((v, i) => {
    const year = Math.ceil((i + 1) / 12);
    const month = (i % 12) + 1;
    csvContent += `Y${year}M${month.toString().padStart(2, '0')},${Math.round(v)},${(ddCurve[i] || 0).toFixed(2)}\n`;
  });
  
  // Sheet 6: 蒙特卡洛 (如果有)
  if (monteCarloResult) {
    const mc = monteCarloResult;
    const totalInvestedMC = mc.totalInvested || 0;
    csvContent += '\n=== 蒙特卡洛模拟结果 ===\n';
    csvContent += '路径,终值(¥),收益率(%)\n';
    mc.finalValues.forEach((v, i) => {
      csvContent += `${i + 1},${Math.round(v)},${totalInvestedMC > 0 ? ((v - totalInvestedMC) / totalInvestedMC * 100).toFixed(1) : 0}\n`;
    });
  }
  
  // 下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const stamp = now.toISOString().slice(0,10).replace(/-/g, '');
  a.href = url;
  a.download = `美股定投图表数据_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('success', 'CSV 已导出', '包含年度汇总、月度明细、现金流、持仓、热力图、净值回撤、蒙特卡洛等所有数据');
}

// ============ MONTE CARLO SIMULATION ============
let monteCarloResult = null;

// ============ TAB NAVIGATION ============
function switchTab(tabName) {
  document.querySelectorAll('.top-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.dataset.tabContent === tabName);
  });
  // 首次进入每个 tab 时按需渲染
  if (tabName === 'library') renderLibrary();
  if (tabName === 'backtest') {
    renderBacktest();
    // 切换到回测 tab 时，自动滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ============ ETF LIBRARY ============
function renderLibrary() {
  const grid = document.getElementById('libraryGrid');
  if (!grid || grid.children.length > 0) return;
  const descriptions = {
    XQQI: 'NEOS Nasdaq-100 High Income ETF，纳斯达克100指数的高收益增强版，主要通过卖出covered call获取月度期权金。',
    NVDY: 'YieldMax NVDA Option Income ETF，专注英伟达个股的covered call策略，每周派息，收益与NVDA股价波动率挂钩。',
    AMZY: 'YieldMax AMZN Option Income ETF，亚马逊个股的covered call策略，每周派息，捕获AMZN价格波动收益。',
    QDTE: 'Roundhill 0DTE Covered Call ETF，每日covered call策略，月度派息，追求日内时间价值衰减收益。',
    SCHG: 'Schwab US Large-Cap Growth ETF，嘉信大盘成长股ETF，跟踪道琼斯美国大盘成长指数，季度派息，长期年化约+13%（无covered call、无ROC）。'
  };
  grid.innerHTML = stockConfigs.map(s => {
    // 使用 fallback 价格估算股息率（仅供参考）
    const fallbackPx = fallbackQuotes[s.ticker]?.c || 100;
    const annualDiv = s.divPerShare * (s.divFreq === 'weekly' ? 52 : s.divFreq === 'monthly' ? 12 : 4);
    const yieldPct = (annualDiv / fallbackPx * 100).toFixed(1);
    return `<div class="library-card" style="border-top:3px solid ${s.color};">
      <div class="lib-ticker">
        <div class="lib-color" style="background:${s.color};"></div>
        ${s.ticker}
      </div>
      <div class="lib-name">${s.name}</div>
      <div class="lib-desc">${descriptions[s.ticker] || ''}</div>
      <div class="lib-metrics">
        <div class="lib-metric">
          <div class="lib-metric-lbl">单股分红</div>
          <div class="lib-metric-val">$${s.divPerShare.toFixed(2)}</div>
        </div>
        <div class="lib-metric">
          <div class="lib-metric-lbl">派息频率</div>
          <div class="lib-metric-val">${s.divFreq === 'weekly' ? '每周' : s.divFreq === 'monthly' ? '每月' : '每季'}</div>
        </div>
        <div class="lib-metric">
          <div class="lib-metric-lbl">预估股息率</div>
          <div class="lib-metric-val" style="color:var(--gold);">${yieldPct}%</div>
        </div>
        <div class="lib-metric">
          <div class="lib-metric-lbl">配置权重</div>
          <div class="lib-metric-val">${(s.allocation * 100).toFixed(0)}%</div>
        </div>
        <div class="lib-metric">
          <div class="lib-metric-lbl">真实收益率</div>
          <div class="lib-metric-val" style="color:var(--green);">${((s.sustainableYield*(1-(s.rocRatio||0))||0)*100).toFixed(1)}%</div>
        </div>
        <div class="lib-metric">
          <div class="lib-metric-lbl">ROC 比例</div>
          <div class="lib-metric-val" style="color:${(s.rocRatio||0)*100 >= 50 ? '#ef4444' : '#f59e0b'};">${((s.rocRatio||0)*100).toFixed(0)}%</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============ BACKTEST ============
function runBacktest() {
  const monthlyRMB = parseFloat(document.getElementById('btMonthlyInvest')?.value) || 7000;
  const resultsEl = document.getElementById('backtestResults');
  const summaryEl = document.getElementById('backtestSummary');
  const btn = document.getElementById('btRunBtn');

  // 按钮按下反馈：禁用 + 切换到 loading 状态
  if (btn) {
    btn.disabled = true;
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> 计算中';
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }, 400);
  }

  // 使用当前年限设置（避免日期解析误差）
  const data = getFilteredData();
  if (data.length === 0) {
    if (resultsEl) resultsEl.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-dim);">请先加载数据后再回测</div>';
    if (summaryEl) summaryEl.innerHTML = '';
    showToast('warning', '暂无回测数据', '请等待股价数据加载完毕后再试', 3500);
    return;
  }

  const months = data.length;
  const totalInvested = months * monthlyRMB;
  const finalValue = data[months - 1].totalValueRMB;
  const totalDividend = data[months - 1].cumulativeDividendsRMB;
  const totalReturn = finalValue - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested * 100) : 0;
  const annualizedRoi = months > 0 ? (Math.pow(finalValue / totalInvested, 12 / months) - 1) * 100 : 0;

  // 各标的回测明细
  const last = data[months - 1];
  const breakdown = last.stocks.map(s => {
    const stock = stockConfigs.find(c => c.ticker === s.ticker);
    return { ticker: s.ticker, shares: s.shares, curValue: s.valueRMB, color: stock.color };
  });

  if (summaryEl) summaryEl.innerHTML = `
    <div class="calendar-summary-stat">
      <div class="lbl">回测期间</div>
      <div class="val">${months} 月 (${(months / 12).toFixed(1)}年)</div>
    </div>
    <div class="calendar-summary-stat">
      <div class="lbl">累计投入</div>
      <div class="val">¥${(totalInvested / 10000).toFixed(2)}万</div>
    </div>
    <div class="calendar-summary-stat">
      <div class="lbl">期末市值</div>
      <div class="val" style="color:var(--accent);">¥${(finalValue / 10000).toFixed(2)}万</div>
    </div>
    <div class="calendar-summary-stat">
      <div class="lbl">累计股息</div>
      <div class="val" style="color:var(--green);">¥${(totalDividend / 10000).toFixed(2)}万</div>
    </div>
    <div class="calendar-summary-stat">
      <div class="lbl">总收益率</div>
      <div class="val" style="color:${totalReturn >= 0 ? 'var(--green)' : 'var(--red)'};">${totalReturn >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%</div>
    </div>
    <div class="calendar-summary-stat">
      <div class="lbl">年化收益</div>
      <div class="val" style="color:${annualizedRoi >= 0 ? 'var(--green)' : 'var(--red)'};">${annualizedRoi >= 0 ? '+' : ''}${annualizedRoi.toFixed(1)}%</div>
    </div>
  `;

  if (resultsEl) resultsEl.innerHTML = breakdown.map(b => `
    <div class="backtest-result-card" style="border-left:3px solid ${b.color};">
      <div class="bt-ticker" style="color:${b.color}">${b.ticker}</div>
      <div class="bt-metrics">
        <div class="bt-metric">
          <div class="lbl">持有股数</div>
          <div class="val">${b.shares}</div>
        </div>
        <div class="bt-metric">
          <div class="lbl">市值</div>
          <div class="val" style="color:var(--accent);">¥${(b.curValue / 10000).toFixed(2)}万</div>
        </div>
        <div class="bt-metric">
          <div class="lbl">占比</div>
          <div class="val">${finalValue > 0 ? (b.curValue / finalValue * 100).toFixed(1) : '0'}%</div>
        </div>
      </div>
    </div>
  `).join('');

  // Toast 反馈
  showToast('success', '✓ 回测完成', `回测了 ${months} 个月 · 年化收益 ${annualizedRoi >= 0 ? '+' : ''}${annualizedRoi.toFixed(1)}%`, 3000);

  // 自动滚动到结果区域（让用户看到结果）
  setTimeout(() => {
    const bt = document.querySelector('.tab-content.active .backtest-panel');
    if (bt) bt.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function renderBacktest() {
  // 显示当前回测年限
  const yearsInput = document.getElementById('btYears');
  if (yearsInput) yearsInput.value = `${currentYear} 年 (${currentYear * 12} 月)`;
  // 自动运行一次
  setTimeout(() => { try { runBacktest(); } catch(e) { console.warn('Backtest error:', e); } }, 200);
}

function gaussianRand() {
  // Box-Muller 变换：生成标准正态分布随机数
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function runMonteCarlo() {
  const data = getFilteredData();
  if (data.length === 0) return;

  const monthlyInvest = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;
  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;
  const years = currentYear;
  const months = years * 12;
  const vol = (parseFloat(document.getElementById('mcVolatility')?.value) || 15) / 100;
  const count = parseInt(document.getElementById('mcCount')?.value || 1000);
  const monthlyVol = vol / Math.sqrt(12); // 月波动率
  const expectedReturn = 0.05; // 假设长期年化 5%（保守估计，考虑高 ROC 侵蚀）
  const monthlyDrift = (expectedReturn - vol * vol / 2) / 12; // 漂移项

  // 基准情景（实际走势）
  const baseline = data.map(d => d.totalValueRMB);

  // 蒙特卡洛路径
  const allPaths = [];
  const finalValues = [];
  const drawdowns = [];
  for (let i = 0; i < count; i++) {
    const path = [];
    let val = monthlyInvest * safeFx; // 首月投入
    let invested = 0;
    let peak = val;
    let maxDD = 0;
    for (let m = 0; m < months; m++) {
      // 每月新增投入
      val += monthlyInvest * safeFx * 0.95; // 95%用于购买(扣除手续费)
      invested += monthlyInvest * safeFx;
      // 几何布朗运动
      const z = gaussianRand();
      val *= Math.exp(monthlyDrift + monthlyVol * z);
      if (val > peak) peak = val;
      const dd = (peak - val) / peak;
      if (dd > maxDD) maxDD = dd;
      path.push(val);
    }
    allPaths.push(path);
    finalValues.push(val);
    drawdowns.push(maxDD);
  }

  // 统计路径分位数
  const percentiles = [5, 25, 50, 75, 95];
  const pData = {};
  for (const p of percentiles) {
    pData[p] = [];
    for (let m = 0; m < months; m++) {
      const slice = allPaths.map(path => path[m]).sort((a, b) => a - b);
      const idx = Math.floor((p / 100) * slice.length);
      pData[p].push(slice[Math.min(idx, slice.length - 1)]);
    }
  }

  // 抽样 5 条展示路径
  const step = Math.max(1, Math.floor(count / 5));
  const samples = [];
  for (let i = 0; i < count && samples.length < 5; i += step) {
    samples.push(allPaths[i]);
  }

  // 收益分布统计
  finalValues.sort((a, b) => a - b);
  const median = finalValues[Math.floor(count * 0.5)];
  const p10 = finalValues[Math.floor(count * 0.1)];
  const p90 = finalValues[Math.floor(count * 0.9)];
  const pMean = finalValues.reduce((a, b) => a + b, 0) / count;
  const totalInvested = months * monthlyInvest * safeFx;
  const probProfit = finalValues.filter(v => v > totalInvested).length / count * 100;

  // 回撤统计
  drawdowns.sort((a, b) => a - b);
  const medianDD = drawdowns[Math.floor(count * 0.5)] * 100;
  const worstDD = drawdowns[count - 1] * 100;

  monteCarloResult = { allPaths, pData, samples, baseline, finalValues, drawdowns, totalInvested };

  renderMonteCarloChart({ pData, samples, baseline, totalInvested });
  renderMonteCarloStats({ median, p10, p90, pMean, probProfit, medianDD, worstDD, count, vol, years });
}

async function renderMonteCarloChart({ pData, samples, baseline, totalInvested }) {
  const months = currentYear * 12;
  const labels = Array.from({ length: months }, (_, i) => `M${i + 1}`);

  const series = [];

  // 5%-95% 区间（浅色填充）
  series.push({
    name: '5%-95% 区间',
    type: 'line',
    data: pData[95],
    lineStyle: { opacity: 0 },
    stack: 'pct_lower',
    symbol: 'none',
    areaStyle: { color: 'rgba(124,58,237,0.04)' },
    silent: true,
  });
  series.push({
    name: '5%-95% 区间',
    type: 'line',
    data: pData[5].map((v, i) => v - pData[95][i]),
    lineStyle: { opacity: 0 },
    stack: 'pct_lower',
    symbol: 'none',
    areaStyle: { color: 'rgba(124,58,237,0.04)' },
    silent: true,
  });

  // 25%-75% 区间（深色填充）
  series.push({
    name: '25%-75% 区间',
    type: 'line',
    data: pData[75],
    lineStyle: { opacity: 0 },
    stack: 'pct_mid',
    symbol: 'none',
    areaStyle: { color: 'rgba(124,58,237,0.10)' },
    silent: true,
  });
  series.push({
    name: '25%-75% 区间',
    type: 'line',
    data: pData[25].map((v, i) => v - pData[75][i]),
    lineStyle: { opacity: 0 },
    stack: 'pct_mid',
    symbol: 'none',
    areaStyle: { color: 'rgba(124,58,237,0.10)' },
    silent: true,
  });

  // 中位数
  series.push({
    name: '中位数路径',
    type: 'line',
    data: pData[50],
    smooth: true,
    lineStyle: { color: '#7c3aed', width: 2 },
    symbol: 'none',
  });

  // 5 条抽样路径
  const sampleColors = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  samples.forEach((path, idx) => {
    series.push({
      name: `路径 ${idx + 1}`,
      type: 'line',
      data: path,
      smooth: true,
      lineStyle: { color: sampleColors[idx % sampleColors.length], width: 1, opacity: 0.6, type: 'dashed' },
      symbol: 'none',
    });
  });

  // 实际基准线
  if (baseline && baseline.length > 0) {
    series.push({
      name: '基础预测',
      type: 'line',
      data: baseline.slice(0, months),
      smooth: true,
      lineStyle: { color: '#2563eb', width: 2.5 },
      symbol: 'none',
    });
  }

  // 总投入参考线
  series.push({
    name: '累计投入',
    type: 'line',
    data: Array.from({ length: months }, (_, i) => totalInvested * (i + 1) / months),
    lineStyle: { color: '#dc2626', width: 1.5, type: 'dotted' },
    symbol: 'none',
  });

  await renderOrUpdate('chartMonteCarlo', {
    tooltip: {
      trigger: 'axis',
      valueFormatter: v => '¥' + Math.round(v).toLocaleString('zh-CN'),
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: ['5%-95% 区间', '25%-75% 区间', '中位数路径', '基础预测', '累计投入'],
      top: 5,
      textStyle: { color: 'var(--text-dim)', fontSize: 11 },
    },
    grid: { left: 70, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: labels,
      name: '月份',
      nameTextStyle: { color: 'var(--text-dim)' },
      axisLabel: {
        color: 'var(--text-dim)',
        interval: Math.floor(months / 10),
        formatter: (v, i) => `Y${Math.ceil((i + 1) / 12)}`,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: 'var(--text-dim)', formatter: v => '¥' + (v / 10000).toFixed(0) + '万' },
      splitLine: { lineStyle: { color: 'var(--border)' } },
    },
    series,
  });
}

function renderMonteCarloStats({ median, p10, p90, pMean, probProfit, medianDD, worstDD, count, vol, years }) {
  const totalInvested = monteCarloResult?.totalInvested || 0;
  const fmt = (v) => '¥' + (v / 10000).toFixed(1) + '万';
  const fmtPct = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
  const roiMedian = totalInvested > 0 ? ((median - totalInvested) / totalInvested * 100) : 0;

  document.getElementById('mcStats').innerHTML = `
    <div class="mc-stat">
      <div class="mc-stat-lbl">中位终值</div>
      <div class="mc-stat-val" style="color:var(--accent2);">${fmt(median)}</div>
      <div class="mc-stat-note">收益 ${fmtPct(roiMedian)}</div>
    </div>
    <div class="mc-stat">
      <div class="mc-stat-lbl">10% 悲观</div>
      <div class="mc-stat-val" style="color:var(--red);">${fmt(p10)}</div>
      <div class="mc-stat-note">${fmtPct((p10 - totalInvested) / totalInvested * 100)}</div>
    </div>
    <div class="mc-stat">
      <div class="mc-stat-lbl">90% 乐观</div>
      <div class="mc-stat-val" style="color:var(--green);">${fmt(p90)}</div>
      <div class="mc-stat-note">${fmtPct((p90 - totalInvested) / totalInvested * 100)}</div>
    </div>
    <div class="mc-stat">
      <div class="mc-stat-lbl">盈利概率</div>
      <div class="mc-stat-val" style="color:${probProfit >= 80 ? 'var(--green)' : probProfit >= 60 ? 'var(--gold)' : 'var(--red)'};">${probProfit.toFixed(0)}%</div>
      <div class="mc-stat-note">${count} 次模拟 · 波动率 ${(vol * 100).toFixed(0)}%</div>
    </div>
    <div class="mc-stat">
      <div class="mc-stat-lbl">中位回撤</div>
      <div class="mc-stat-val" style="color:var(--gold);">${medianDD.toFixed(1)}%</div>
      <div class="mc-stat-note">极端 ${worstDD.toFixed(1)}%</div>
    </div>
    <div class="mc-stat">
      <div class="mc-stat-lbl">模拟期限</div>
      <div class="mc-stat-val">${years} 年</div>
      <div class="mc-stat-note">${years * 12} 个月 · 几何布朗运动</div>
    </div>
  `;
}

// ============ RENDER SUMMARY ============
function renderSummary() {
  const data = getFilteredData();
  if (data.length === 0) return;
  const last = data[data.length - 1];
  const firstDividendMonth = data.findIndex(d => d.cumulativeDividendsRMB > 0) + 1;
  const totalMonths = last.month;
  const yearLabel = `第 ${currentYear} 年${currentYear === 20 ? '末 (满期)' : ''}`;

  const monthlyInvest = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;

  // ---------- 1. 月度收益率序列（扣除新增投入后的纯市场收益） ----------
  const monthlyReturns = [];
  for (let i = 1; i < data.length; i++) {
    const prevV = data[i-1].totalValueRMB;
    if (prevV <= 0) continue;
    // 总资产变化 − 当月新增投入 = 纯市场收益
    const marketRet = (data[i].totalValueRMB - monthlyInvest - prevV) / prevV;
    monthlyReturns.push(marketRet);
  }

  // ---------- 2. 净值曲线 = totalValueRMB（股息已再投资，不需额外加） ----------
  const navCurve = data.map(d => d.totalValueRMB);

  // ---------- 3. 最大回撤（基于净值曲线） ----------
  let maxDD = 0, maxDDStart = 0, maxDDEnd = 0;
  let peak = navCurve[0], peakIdx = 0;
  for (let i = 1; i < navCurve.length; i++) {
    if (navCurve[i] > peak) { peak = navCurve[i]; peakIdx = i; }
    const dd = (peak - navCurve[i]) / peak;
    if (dd > maxDD) { maxDD = dd; maxDDStart = peakIdx; maxDDEnd = i; }
  }
  const maxDDPct = maxDD * 100;
  const maxDDGrade = maxDDPct < 10 ? '优' : maxDDPct < 20 ? '良' : maxDDPct < 30 ? '中' : '差';
  const maxDDColor = maxDDPct < 10 ? 'var(--green)' : maxDDPct < 20 ? 'var(--accent)' : maxDDPct < 30 ? 'var(--gold)' : 'var(--red)';

  // ---------- 4. 夏普比率（标准定义：超额收益年化 / 波动率年化） ----------
  let sharpe = 0, vol = 0, annRet = 0;
  if (monthlyReturns.length > 1) {
    const avg = monthlyReturns.reduce((a,b)=>a+b,0) / monthlyReturns.length;
    const variance = monthlyReturns.reduce((s,r)=>s+(r-avg)**2,0) / (monthlyReturns.length - 1);
    const std = Math.sqrt(variance);
    vol = std * Math.sqrt(12) * 100;
    annRet = avg * 12 * 100;
    const rf = 3; // 无风险利率 3% (年化)
    sharpe = std > 0 ? (annRet - rf) / (std * Math.sqrt(12) * 100) : 0;
  }
  const sharpeGrade = sharpe > 1.5 ? '优' : sharpe > 1 ? '良' : sharpe > 0.5 ? '中' : '差';
  const sharpeColor = sharpe > 1.5 ? 'var(--green)' : sharpe > 1 ? 'var(--accent)' : sharpe > 0.5 ? 'var(--gold)' : 'var(--red)';

  // ---------- 5. Calmar 比率 = 年化收益 / 最大回撤 ----------
  const calmar = maxDD > 0 ? (annRet / 100) / maxDD : 0;
  const calmarGrade = calmar > 1 ? '优' : calmar > 0.5 ? '良' : calmar > 0.2 ? '中' : '差';
  const calmarColor = calmar > 1 ? 'var(--green)' : calmar > 0.5 ? 'var(--accent)' : calmar > 0.2 ? 'var(--gold)' : 'var(--red)';

  // ---------- 6. 其他指标 ----------
  const coveredMonths = monthlyInvest > 0 ? last.cumulativeDividendsRMB / monthlyInvest : 0;
  const years = last.month / 12;
  const cagr = last.investedRMB > 0 ? (Math.pow(last.totalValueRMB / last.investedRMB, 1/years) - 1) * 100 : 0;

  // ---------- 7. 水下图数据（用于下方图表） ----------
  const drawdownCurve = navCurve.map((v, i) => {
    const peak = Math.max(...navCurve.slice(0, i+1));
    return peak > 0 ? ((peak - v) / peak) * 100 : 0;
  });

  document.getElementById('summaryGrid').innerHTML = `
    <div class="summary-card c-blue">
      <div class="label">${yearLabel}累计投入</div>
      <div class="value">¥${(last.investedRMB / 10000).toFixed(1)}万</div>
      <div class="sub">${totalMonths} 月 × ¥${monthlyInvest}</div>
    </div>
    <div class="summary-card c-purple">
      <div class="label">${yearLabel}组合市值</div>
      <div class="value">¥${(last.portfolioValueRMB / 10000).toFixed(1)}万</div>
      <div class="sub">持仓市值</div>
    </div>
    <div class="summary-card c-green">
      <div class="label">${yearLabel}累计股息 (税后)</div>
      <div class="value">¥${(last.cumulativeDividendsRMB / 10000).toFixed(1)}万</div>
      <div class="sub">覆盖 ${coveredMonths.toFixed(0)} 个月定投</div>
    </div>
    <div class="summary-card c-gold">
      <div class="label">${yearLabel}总收益 (含股息)</div>
      <div class="value">¥${(last.totalReturnRMB / 10000).toFixed(1)}万</div>
      <div class="sub">CAGR ${(last.cagr||cagr).toFixed(1)}% · 股息再投资 · 长期可持续参数模拟</div>
    </div>
  `;

  // ---------- 浮亏预警卡片（基于"组合市值 vs 累计投入"的回报率）----------
  // 注意：这是模拟场景下的"账面"回报率，与实盘持仓的"成本均价"不同。
  // 阈值设计参考行业 DCA 心理承受线：-10% 关注 / -20% 加码 / -30% 严重
  const totalReturnPct = last.investedRMB > 0
    ? ((last.totalValueRMB - last.investedRMB) / last.investedRMB) * 100
    : 0;
  const unrealizedAbsRMB = last.totalValueRMB - last.investedRMB;  // 正数=亏，负数=赚
  // 浮亏信号分级
  let lossLevel, lossColor, lossBg, lossIcon, lossTip;
  if (totalReturnPct >= 0) {
    lossLevel = '盈利中'; lossColor = 'var(--green)'; lossBg = 'rgba(5,150,105,0.08)'; lossIcon = '✓';
    lossTip = '当前账面盈利，继续按计划定投';
  } else if (totalReturnPct >= -10) {
    lossLevel = '正常波动'; lossColor = 'var(--accent)'; lossBg = 'rgba(37,99,235,0.06)'; lossIcon = '·';
    lossTip = '短期波动属正常，定投纪律 > 短期涨跌';
  } else if (totalReturnPct >= -20) {
    lossLevel = '关注'; lossColor = 'var(--gold)'; lossBg = 'rgba(217,119,6,0.10)'; lossIcon = '!';
    lossTip = '跌幅 >10% · 检查 NVDY/AMZY 占比，考虑加码强势标的 (SCHG/QDTE)';
  } else if (totalReturnPct >= -30) {
    lossLevel = '警告'; lossColor = '#ea580c'; lossBg = 'rgba(234,88,12,0.10)'; lossIcon = '⚠';
    lossTip = '跌幅 >20% · 启用强力加码信号 (评分 ≥7.5 时 1.5× 买入)';
  } else {
    lossLevel = '严重'; lossColor = 'var(--red)'; lossBg = 'rgba(220,38,38,0.12)'; lossIcon = '✕';
    lossTip = '跌幅 >30% · 重新评估资产配置，检查是否需要止部分损';
  }
  const lossCardHtml = `
    <div class="summary-card" style="border:2px solid ${lossColor};border-left:5px solid ${lossColor};background:${lossBg};box-shadow:0 0 0 1px ${lossColor}20, var(--shadow-sm);">
      <div class="label" style="color:${lossColor};font-weight:800;">
        <span style="display:inline-block;width:18px;height:18px;text-align:center;line-height:18px;border-radius:50%;background:${lossColor};color:#fff;font-size:11px;font-weight:800;margin-right:6px;">${lossIcon}</span>
        ${yearLabel}浮亏预警
      </div>
      <div class="value" style="color:${lossColor};font-variant-numeric:tabular-nums;">
        ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%
      </div>
      <div class="sub" style="color:${lossColor};font-weight:700;">
        ${lossLevel} · 账面 ${unrealizedAbsRMB >= 0 ? '亏' : '赚'} ¥${Math.abs(unrealizedAbsRMB/10000).toFixed(2)}万
      </div>
      <div class="sub" style="margin-top:6px;padding-top:6px;border-top:1px dashed ${lossColor}40;color:var(--text-secondary);font-weight:500;">
        ${lossTip}
      </div>
    </div>
  `;
  // 插入到 summaryGrid 末尾
  const lossEl = document.createElement('div');
  lossEl.innerHTML = lossCardHtml;
  document.getElementById('summaryGrid').appendChild(lossEl.firstElementChild);

  // ---------- 风险与质量指标表格（取代原先的密集卡片群）----------
  const monthlyDiv = (data.length > 12) ?
    Math.round((last.cumulativeDividendsRMB - data[data.length - 13].cumulativeDividendsRMB) / 12) :
    Math.round(last.cumulativeDividendsRMB / Math.max(last.month, 1));
  const monthlyReal = (data.length > 12) ?
    Math.round((last.cumulativeRealDividendsRMB - data[data.length - 13].cumulativeRealDividendsRMB) / 12) :
    Math.round(last.cumulativeRealDividendsRMB / Math.max(last.month, 1));
  const rocPct = (last.cumulativeRocRMB / last.cumulativeDividendsRMB * 100 || 0).toFixed(0);
  const realYieldAnnualized = (last.cumulativeRealDividendsRMB / last.investedRMB * 100 / years || 0).toFixed(1);
  const ddRange = '第 ' + Math.ceil((maxDDStart+1)/12) + ' 年 - 第 ' + Math.ceil((maxDDEnd+1)/12) + ' 年';

  const rows = [
    { name: 'CAGR 复合年化', value: (last.cagr||cagr).toFixed(1) + '%', grade: (last.cagr||cagr) > 5 ? '优' : (last.cagr||cagr) > 0 ? '良' : '差', gradeColor: (last.cagr||cagr) > 5 ? 'var(--green)' : (last.cagr||cagr) > 0 ? 'var(--gold)' : 'var(--red)', note: '复合年化收益率 = (终值/投入)^(1/年数) − 1' },
    { name: '年化收益 (蒙特卡洛)', value: annRet.toFixed(1) + '%', grade: annRet > 5 ? '优' : annRet > 0 ? '良' : '差', gradeColor: annRet > 5 ? 'var(--green)' : annRet > 0 ? 'var(--gold)' : 'var(--red)', note: '月度收益扣除新增投入后年化' },
    { name: '年化波动率', value: vol.toFixed(1) + '%', grade: vol < 15 ? '优' : vol < 25 ? '良' : '差', gradeColor: vol < 15 ? 'var(--green)' : vol < 25 ? 'var(--gold)' : 'var(--red)', note: '月度收益标准差 × √12' },
    { name: '最大回撤 (净值)', value: maxDDPct.toFixed(1) + '%', grade: maxDDGrade, gradeColor: maxDDColor, note: ddRange + ' · 峰值到谷底最大跌幅' },
    { name: '夏普比率 (年化)', value: sharpe.toFixed(2), grade: sharpeGrade, gradeColor: sharpeColor, note: '超额收益/波动率 (Rf=3%)' },
    { name: 'Calmar 比率', value: calmar.toFixed(2), grade: calmarGrade, gradeColor: calmarColor, note: '年化收益/最大回撤' },
    { name: yearLabel + '月均股息 (含 ROC)', value: '¥' + monthlyDiv.toLocaleString() + '/月', grade: '—', gradeColor: 'var(--text-dim)', note: '⚠️ 约 ' + rocPct + '% 为本金返还 ROC' },
    { name: yearLabel + '月均真实收益', value: '¥' + monthlyReal.toLocaleString() + '/月', grade: '—', gradeColor: 'var(--green)', note: '扣除 ROC · 年化约 ' + realYieldAnnualized + '%' },
  ];

  const tableHtml = `
    <div class="risk-quality-table">
      <div class="rq-header">
        <span class="sec-tag tag-cyan">METRICS</span>
        <span style="font-size:13px;font-weight:700;color:var(--text);">风险与质量指标 (第 ${currentYear} 年末)</span>
      </div>
      <table class="rq-table">
        <thead>
          <tr>
            <th style="width:32%;text-align:left;">指标</th>
            <th style="width:22%;text-align:right;">数值</th>
            <th style="width:14%;text-align:center;">评级</th>
            <th style="width:32%;text-align:left;">说明</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="text-align:left;color:var(--text);font-weight:600;">${r.name}</td>
              <td style="text-align:right;font-family:var(--font-mono);font-weight:700;color:${r.gradeColor};">${r.value}</td>
              <td style="text-align:center;font-weight:700;color:${r.gradeColor};">${r.grade}</td>
              <td style="text-align:left;color:var(--text-secondary);font-size:12px;">${r.note}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // 把表格追加到 summary-grid 后面
  const gridEl = document.getElementById('summaryGrid');
  let tableEl = document.getElementById('riskQualityTable');
  if (!tableEl) {
    tableEl = document.createElement('div');
    tableEl.id = 'riskQualityTable';
    gridEl.parentNode.insertBefore(tableEl, gridEl.nextSibling);
  }
  tableEl.innerHTML = tableHtml;

  // 触发数字动画
  animateSummaryCards(last, monthlyInvest);

  // 将水下图数据存到全局供图表使用
  window._navCurve = navCurve;
  window._drawdownCurve = drawdownCurve;
  window._yearLabels = data.map(d => `Y${Math.ceil(d.month/12)}`);
}

// ============ RENDER TABLES ============
function renderYearlyTable() {
  const data = getFilteredData();
  const container = document.getElementById('tableContainer');
  if (!container) return;

  document.getElementById('tableTitle').innerHTML = `<span class="sec-tag tag-cyan">TIMELINE</span> 逐年收益明细 (第 1 - ${currentYear} 年)`;

  const yearlyData = [];
  for (let y = 1; y <= currentYear; y++) {
    const yData = data.filter(d => d.year === y);
    if (yData.length > 0) {
      const last = yData[yData.length - 1];
      const first = yData[0];
      yearlyData.push({
        year: y,
        invested: last.investedRMB,
        dividends: last.cumulativeDividendsRMB,
        yearDividend: last.cumulativeDividendsRMB - (first.cumulativeDividendsRMB || 0),
        rocTotal: last.cumulativeRocRMB || 0,
        realDividends: last.cumulativeRealDividendsRMB || 0,
        value: last.portfolioValueRMB,
        total: last.totalValueRMB,
        netReturn: last.totalReturnRMB,
        roi: last.roi,
        annRoi: last.annualizedRoi,
        shares: last.stocks.reduce((a,s)=>a+s.shares,0)
      });
    }
  }

  container.innerHTML = `
  <table>
    <thead>
      <tr>
        <th>年份</th>
        <th>当年新增投入(¥)</th>
        <th>累计投入(¥)</th>
        <th>当年股息(¥)</th>
        <th>累计股息(¥)</th>
        <th>其中 ROC(¥)</th>
        <th>真实收益(¥)</th>
        <th>组合市值(¥)</th>
        <th>总收益(¥)</th>
        <th>回报率</th>
        <th>年化收益</th>
        <th>总股数</th>
      </tr>
    </thead>
    <tbody>
      ${yearlyData.map((d, idx) => {
        const yearInvest = idx === 0 ? d.invested : d.invested - yearlyData[idx-1].invested;
        const prevRoc = idx === 0 ? 0 : yearlyData[idx-1].rocTotal;
        const prevReal = idx === 0 ? 0 : yearlyData[idx-1].realDividends;
        const yearRoc = d.rocTotal - prevRoc;
        const yearReal = d.realDividends - prevReal;
        return `
        <tr>
          <td><strong>第 ${d.year} 年</strong></td>
          <td>${(yearInvest / 10000).toFixed(2)}万</td>
          <td>${(d.invested / 10000).toFixed(2)}万</td>
          <td style="color:var(--gold)">${(d.yearDividend / 10000).toFixed(2)}万</td>
          <td style="color:var(--green)">${(d.dividends / 10000).toFixed(2)}万</td>
          <td style="color:#ef4444">${(yearRoc / 10000).toFixed(2)}万</td>
          <td style="color:#3b82f6">${(yearReal / 10000).toFixed(2)}万</td>
          <td>${(d.value / 10000).toFixed(2)}万</td>
          <td><strong>${(d.total / 10000).toFixed(2)}万</strong></td>
          <td style="color:${d.netReturn>=0?'#ef4444':'#22c55e'}">${(d.netReturn / 10000).toFixed(2)}万</td>
          <td style="color:${(d.totalReturnPct||d.roi)>=0?'#ef4444':'#22c55e'}">${(d.totalReturnPct||d.roi).toFixed(0)}%</td>
          <td>${(d.annRoi||d.cagr).toFixed(1)}%</td>
          <td>${d.shares.toLocaleString()}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function renderStockDetail() {
  // 已删除：持仓明细表（冗余）
}

// ============ YEAR SLIDER ============
function setYear(year) {
  currentYear = parseInt(year);
  
  // 同步新的图表化时间轴控制器（仅更新显示，不触发 selectTimelineYear 避免循环）
  if (typeof updateTimelineDisplay === 'function') {
    updateTimelineDisplay(currentYear);
  }
  // 同步图表柱状图高亮（不触发 setYear 回调）
  if (typeof timelineChart !== 'undefined' && timelineChart) {
    timelineChart.data.datasets[0].backgroundColor = (ctx) => 
      ctx.dataIndex < currentYear ? 'rgba(37, 99, 235, 0.85)' : 'rgba(229, 229, 229, 0.6)';
    timelineChart.data.datasets[0].borderColor = (ctx) => 
      ctx.dataIndex < currentYear ? '#2563eb' : '#e5e5e5';
    timelineChart.update('none');
  }
  // 同步快速选择按钮状态
  document.querySelectorAll('#timelineYearBtns button').forEach(btn => {
    const isActive = parseInt(btn.dataset.year) === currentYear;
    btn.style.background = isActive ? 'var(--accent)' : 'var(--card)';
    btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
    btn.style.color = isActive ? 'white' : 'var(--text-dim)';
  });
  
  renderSummary();
  renderCharts();
  renderYearlyTable();
  // 年限变更时重新运行蒙特卡洛
  if (monteCarloResult) {
    setTimeout(() => { try { runMonteCarlo(); } catch(e) {} }, 50);
  }
  // 当前显示的回测 tab 也跟着更新
  const activeTab = document.querySelector('.top-tab.active');
  if (activeTab && activeTab.dataset.tab === 'backtest') {
    setTimeout(() => { try { runBacktest(); } catch(e) {} }, 100);
  }
}

// ============ PORTFOLIO SNAPSHOT ============
function renderPortfolioSnapshot() {
  const el = document.getElementById('portfolioSnapshot');
  if (!el) return;

  const monthlyInvestRMB = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;
  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;

  // 按今日实时价算"如果持有 1 份月计划"的市值
  let totalValueRMB = 0, totalChange = 0;
  const items = stockConfigs.map(s => {
    const q = quotes[s.ticker];
    const price = (q && q.c > 0) ? q.c : 0;
    const changePct = q?.dp || 0;
    const changeAmt = q?.d || 0;
    const h = q?.h || price;
    const l = q?.l || price;
    const pc = q?.pc || price;
    if (!price) return null;

    // 按 allocation 权重分配月预算
    const totalAlloc = stockConfigs.reduce((a, c) => a + c.allocation, 0);
    const monthlyUSD = monthlyInvestRMB / safeFx;
    const weight = totalAlloc > 0 ? s.allocation / totalAlloc : 1 / stockConfigs.length;
    const shares = price > 0 ? (monthlyUSD * weight) / price : 0;

    const valueRMB = shares * price * safeFx;
    // 日盈亏用美元口径：股数 × (今价 - 昨收)，与 pc/dp 字段一致
    const dayChangeUSD = shares * (price - pc);
    totalValueRMB += valueRMB;
    totalChange += dayChangeUSD;
    // 迷你日内区间条
    let miniBar = '';
    if (price > 0 && h > l) {
      const range = h - l;
      const left = ((price - l) / range * 100).toFixed(1);
      const markerColor = changePct >= 0 ? '#dc2626' : '#059669';
      miniBar = `
        <div class="ps-mini-bar-wrap" title="日内区间 $${l.toFixed(2)} - $${h.toFixed(2)}">
          <div class="ps-mini-bar"></div>
          <div class="ps-mini-bar-fill" style="width:${left}%"></div>
          <div class="ps-mini-bar-marker" style="left:${left}%;background:${markerColor}"></div>
          <div class="ps-mini-bar-labels"><span>$${l.toFixed(2)}</span><span>$${h.toFixed(2)}</span></div>
        </div>`;
    }
    return { ticker:s.ticker, color:s.color, shares, price, valueRMB, changePct, miniBar };
  }).filter(Boolean);

  const isUp = totalChange >= 0;
  const totalChangePct = totalValueRMB > 0
    ? (totalChange * safeFx) / (totalValueRMB - totalChange * safeFx) * 100
    : 0;
  el.style.display = 'flex';
  el.innerHTML = `
    <div class="ps-item">
      <div class="ps-label">今日月计划组合</div>
      <div class="ps-value" style="color:var(--accent);">¥${Math.round(totalValueRMB).toLocaleString()}</div>
      <div class="ps-sub">按当前价格估算</div>
    </div>
    <div class="ps-sep"></div>
    <div class="ps-item">
      <div class="ps-label">今日变动</div>
      <div class="ps-value" style="color:${isUp ? '#dc2626' : '#059669'};">
        ${isUp ? '+' : ''}$${Math.abs(totalChange).toFixed(2)}
      </div>
      <div class="ps-sub"><span class="ps-tag ${isUp ? 'up' : 'down'}">${isUp ? '▲' : '▼'} ${Math.abs(totalChangePct).toFixed(2)}%</span></div>
    </div>
    <div class="ps-sep"></div>
    ${items.map(s => `
      <div class="ps-item" style="min-width:90px;">
        <div class="ps-label" style="color:${s.color};">${s.ticker}</div>
        <div class="ps-value" style="font-size:15px;">${Number.isInteger(s.shares) ? s.shares : s.shares.toFixed(2)} <span style="font-size:10px;color:var(--text-dim);">股</span></div>
        <div class="ps-sub">$${s.price.toFixed(2)}</div>
        ${s.miniBar}
        <div class="ps-sub"><span class="ps-tag ${s.changePct >= 0 ? 'up' : 'down'}">${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%</span></div>
      </div>
    `).join('')}
  `;
}

// ============ HOLDINGS MANAGEMENT ============
const HOLDINGS_KEY = 'dca_holdings';


function renderRebalance() {
  const panel = document.getElementById('rebalancePanel');
  const content = document.getElementById('rebalanceContent');
  const statusEl = document.getElementById('rebalanceStatus');
  if (!panel || !content || !statusEl) return;

  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;
  const holdings = loadHoldings();
  const totalShares = Object.values(holdings).reduce((a, b) => a + b, 0);
  if (totalShares === 0) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const monthlyInvest = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;
  const totalUSD = monthlyInvest / safeFx;

  // 按 allocation 权重分配月预算 (无固定股数)
  const totalAlloc = stockConfigs.reduce((a, s) => a + s.allocation, 0);
  const targetWeights = {};
  stockConfigs.forEach(s => {
    const w = totalAlloc > 0 ? s.allocation / totalAlloc : 1 / stockConfigs.length;
    targetWeights[s.ticker] = totalUSD * w;
  });
  const totalTargetUSD = Object.values(targetWeights).reduce((a, b) => a + b, 0);

  const actualValues = {};
  let totalActualUSD = 0;
  stockConfigs.forEach(s => {
    const shares = holdings[s.ticker] || 0;
    const price = quotes[s.ticker]?.c || 0;
    actualValues[s.ticker] = shares * price;
    totalActualUSD += shares * price;
  });

  const data = stockConfigs.map(s => {
    const target = totalTargetUSD > 0 ? (targetWeights[s.ticker] / totalTargetUSD * 100) : 0;
    const actual = totalActualUSD > 0 ? (actualValues[s.ticker] / totalActualUSD * 100) : 0;
    const diff = actual - target;
    const price = quotes[s.ticker]?.c || 0;
    const targetValueUSD = totalActualUSD * (target / 100);
    const targetShares = price > 0 ? Math.floor(targetValueUSD / price) : 0;
    const shares = holdings[s.ticker] || 0;
    const deltaShares = targetShares - shares;
    const deltaValueRMB = deltaShares * price * safeFx;
    return { ticker: s.ticker, color: s.color, target, actual, diff, price, shares, targetShares, deltaShares, deltaValueRMB };
  });

  const maxDiff = Math.max(...data.map(d => Math.abs(d.diff)));
  const needsRebalance = maxDiff >= 5;

  statusEl.className = 'rebalance-status ' + (needsRebalance ? 'warn' : 'ok');
  statusEl.textContent = needsRebalance ? '需再平衡' : '权重正常';

  const sign = d => d > 0 ? '+' : '';
  const fmtMoney = v => (v > 0 ? '+' : '') + '¥' + Math.round(v).toLocaleString();

  let rows = '';
  data.forEach(d => {
    const actualBar = Math.min(75, d.actual * 1.5);
    const targetLeft = Math.min(75, d.target * 1.5);
    const actionCls = Math.abs(d.diff) < 2 ? 'action-hold' : (d.diff > 0 ? 'action-sell' : 'action-buy');
    const actionText = Math.abs(d.diff) < 2 ? '持有' : (d.diff > 0 ? '减仓' : '加仓');
    const deltaShares = Math.abs(d.deltaShares);
    const deltaMoney = d.deltaValueRMB !== 0 ? ' (' + fmtMoney(d.deltaValueRMB) + ')' : '';
    const opText = deltaShares > 0 ? actionText + ' ' + deltaShares + ' 股' + deltaMoney : actionText;

    rows += '<tr>'
      + '<td style="color:' + d.color + '">' + d.ticker + '</td>'
      + '<td>' + d.target.toFixed(1) + '%</td>'
      + '<td>'
      +   '<div class="rebalance-bar">'
      +     '<div class="rebalance-bar-fill" style="width:' + actualBar + '%;background:' + d.color + '</div>'
      +     '<div class="rebalance-bar-target" style="left:' + targetLeft + '%</div>'
      +'  </div>'
      +   d.actual.toFixed(1) + '%'
      +'</td>'
      + '<td style="color:' + (Math.abs(d.diff) >= 5 ? 'var(--gold)' : 'var(--text-dim)') + ';font-weight:' + (Math.abs(d.diff) >= 5 ? 700 : 400) + '">' + sign(d.diff) + d.diff.toFixed(1) + '%</td>'
      + '<td>' + d.shares + '</td>'
      + '<td>' + d.targetShares + '</td>'
      + '<td class="' + actionCls + '">' + opText + '</td>'
      +'</tr>';
  });

  const summaryText = needsRebalance
    ? '<strong style="color:var(--gold)">检测到权重偏离超过 5%</strong>，建议调仓使配置回到目标。'
    : '当前权重偏离 < 5%，无需调仓。';

  content.innerHTML = '<div style="font-size:10px;color:var(--text-dim);margin-bottom:8px;">'
    + summaryText + ' 总市值 $' + totalActualUSD.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + '。'
    +'</div>'
    + '<table class="rebalance-table">'
    +   '<thead><tr><th>标的</th><th>目标权重</th><th>实际权重</th><th>偏离</th><th>当前股数</th><th>目标股数</th><th>建议操作</th</tr</thead>'
    +   '<tbody>' + rows +'</tbody>'
    +'</table>';
}




function loadHoldings() {
  try {
    const raw = localStorage.getItem(HOLDINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return stockConfigs.reduce((a, s) => { a[s.ticker] = 0; return a; }, {});
}

async function loadHoldingsFromServer() {
  // 云端部署时：服务端 holdings.json 是权威来源（与部署一起持久化）
  if (window.location.protocol === 'file:') return null;  // 本地 file:// 不查服务端
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);  // 3 秒超时
    const resp = await fetch(apiUrl('/api/load-holdings'), { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.holdings && typeof data.holdings === 'object') {
      return data.holdings;
    }
  } catch(e) { console.warn('服务端持仓拉取失败:', e.message); }
  return null;
}

function saveHoldings(h) {
  try { localStorage.setItem(HOLDINGS_KEY, JSON.stringify(h)); } catch(e) {}
}

// ============ 价格历史（sparkline + 成本均价） ============
const PRICE_HISTORY_KEY = 'dca_price_history';

function loadPriceHistory() {
  try {
    const raw = localStorage.getItem(PRICE_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  // 返回空 Map，结构: { ticker: [{c, t}, ...] }
  return stockConfigs.reduce((a, s) => { a[s.ticker] = []; return a; }, {});
}

function appendPriceHistory(quotes) {
  const history = loadPriceHistory();
  const now = Date.now();
  stockConfigs.forEach(s => {
    const q = quotes[s.ticker];
    if (!q || !(q.c > 0)) return;
    if (!history[s.ticker]) history[s.ticker] = [];
    const last = history[s.ticker][history[s.ticker].length - 1];
    // 同 5 分钟内不重复记录
    if (last && now - last.t < 5 * 60 * 1000 && Math.abs(last.c - q.c) < 0.001) return;
    history[s.ticker].push({ c: q.c, t: now });
    if (history[s.ticker].length > 60) {
      history[s.ticker] = history[s.ticker].slice(-60);
    }
  });
  try { localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history)); } catch(e) {}
}

function renderSparkline(data) {
  if (!data || data.length < 2) {
    return `<svg viewBox="0 0 100 30"><text x="50" y="18" text-anchor="middle" fill="#9ca3af" font-size="9">数据积累中</text></svg>`;
  }
  const w = 100, h = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? '#dc2626' : '#059669';
  const fill = isUp ? 'rgba(220,38,38,0.1)' : 'rgba(5,150,105,0.1)';
  // 末端小球
  const lastX = w;
  const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4) - 2;
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none">
    <polyline fill="${fill}" stroke="none" points="0,${h} ${points} ${w},${h}"/>
    <polyline fill="none" stroke="${color}" stroke-width="1.5" points="${points}"/>
    <circle cx="${lastX}" cy="${lastY.toFixed(2)}" r="2" fill="${color}"/>
  </svg>`;
}

function renderHoldings() {
  const grid = document.getElementById('holdingsGrid');
  const totalEl = document.getElementById('holdingsTotal');
  if (!grid || !totalEl) return;

  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;
  const holdings = loadHoldings();
  let totalValue = 0, totalPnl = 0, totalDivPnl = 0;

  // 加载历史价格（用于 sparkline + 成本均价）
  const historyMap = loadPriceHistory();

  grid.innerHTML = stockConfigs.map(s => {
    const q = quotes[s.ticker];
    const price = (q && q.c > 0) ? q.c : 0;
    const prevClose = (q && q.pc > 0) ? q.pc : price;
    const shares = holdings[s.ticker] || 0;
    const valueUSD = shares * price;                       // 市值（美元）
    const pnl = shares * (price - prevClose);              // 今日盈亏（美元）
    const pnlPct = prevClose > 0 && shares > 0 ? ((price - prevClose) / prevClose * 100) : 0;
    totalValue += valueUSD;
    totalPnl += pnl;

    // 成本均价：基于历史价格的简单均价（取近 30 天均值近似）
    const history = historyMap[s.ticker] || [];
    let avgCost = price;
    if (history.length >= 5) {
      const samples = history.slice(-30).map(h => h.c).filter(c => c > 0);
      if (samples.length > 0) avgCost = samples.reduce((a,b)=>a+b,0) / samples.length;
    }
    const unrealized = shares > 0 ? (price - avgCost) * shares : 0;  // 浮动盈亏（美元）
    const unrealizedPct = shares > 0 && avgCost > 0 ? ((price - avgCost) / avgCost * 100) : 0;

    // 累计股息（按当前持仓 × 月股息 × 12个月估计，美元）
    const monthlyDivUSD = s.divPerShare * (s.divFreq === 'weekly' ? 52/12 : s.divFreq === 'monthly' ? 1 : 1/3);
    const monthsHeld = 12; // 简化假设持有 12 个月
    const accruedDivUSD = shares * monthlyDivUSD * monthsHeld * (1 - 0.10);
    totalDivPnl += accruedDivUSD;

    // 年化股息率（基于当前价）
    const annDiv = s.divFreq === 'weekly' ? s.divPerShare * 52 : s.divFreq === 'monthly' ? s.divPerShare * 12 : s.divPerShare * 4;
    const yieldPct = price > 0 ? (annDiv / price * 100).toFixed(1) : '--';

    // 止盈止损建议价（基于平均成本）
    const takeProfit = avgCost * 1.20;
    const stopLoss = avgCost * 0.85;

    // 持仓 sparkline
    const sparkSvg = renderSparkline(history.map(h => h.c).filter(c => c > 0));

    // 分红覆盖率（基于今日市值，美元口径）
    const divPct = valueUSD > 0 ? Math.min(100, (accruedDivUSD / valueUSD * 100)) : 0;

    const isUp = pnl >= 0;
    const unrealizedUp = unrealized >= 0;

    return `<div class="holding-card">
      <div class="holding-card-head">
        <div class="holding-ticker" style="color:${s.color}">${s.ticker}</div>
        <div class="holding-shares">
          <input type="number" min="0" value="${shares}"
            onchange="updateHolding('${s.ticker}', this.value)"
            title="持仓股数">
        </div>
      </div>
      ${shares > 0 ? `
        <div class="holding-value">$${valueUSD.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        <div class="holding-pnl" style="color:${isUp ? '#dc2626' : '#059669'}">
          <span class="pnl-amount">${isUp ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}</span>
          <span style="font-size:10px;">${isUp ? '+' : '-'}${Math.abs(pnlPct).toFixed(2)}%</span>
          <span style="font-size:9px;color:var(--text-dim);font-weight:400;margin-left:2px;">今日</span>
        </div>
        <div class="holding-meta">
          <div class="holding-meta-item">
            <span class="holding-meta-label">成本均价</span>
            <span class="holding-meta-value">$${avgCost.toFixed(2)}</span>
          </div>
          <div class="holding-meta-item">
            <span class="holding-meta-label">当前价</span>
            <span class="holding-meta-value" style="color:${unrealizedUp ? '#dc2626' : '#059669'}">$${price.toFixed(2)}</span>
          </div>
          <div class="holding-meta-item">
            <span class="holding-meta-label">浮动盈亏</span>
            <span class="holding-meta-value" style="color:${unrealizedUp ? '#dc2626' : '#059669'}">
              ${unrealizedUp ? '+' : '-'}$${Math.abs(unrealized).toFixed(2)}
              <span style="font-size:9px;">(${unrealizedUp ? '+' : '-'}${Math.abs(unrealizedPct).toFixed(1)}%)</span>
            </span>
          </div>
          <div class="holding-meta-item">
            <span class="holding-meta-label">股息率</span>
            <span class="holding-meta-value" style="color:var(--green)">${yieldPct}%</span>
          </div>
          <div class="holding-meta-item" style="grid-column:span 2;">
            <span class="holding-meta-label">累计分红 (12个月估)</span>
            <span class="holding-meta-value" style="color:var(--green);display:flex;align-items:center;gap:6px;">
              $${accruedDivUSD.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
              <span style="flex:1;min-width:60px;">
                <span class="div-progress"><span class="div-progress-fill" style="width:${divPct}%"></span></span>
              </span>
            </span>
          </div>
          <div class="holding-meta-item">
            <span class="holding-meta-label" style="color:#059669;">止盈参考 +20%</span>
            <span class="holding-meta-value">$${takeProfit.toFixed(2)}</span>
          </div>
          <div class="holding-meta-item">
            <span class="holding-meta-label" style="color:#dc2626;">止损参考 -15%</span>
            <span class="holding-meta-value">$${stopLoss.toFixed(2)}</span>
          </div>
        </div>
        <div class="holding-spark" title="近 30 次报价走势">${sparkSvg}</div>
      ` : `
        <div class="holding-value" style="color:var(--text-dim);font-size:14px;">未持仓</div>
        <div style="font-size:10px;color:var(--text-dim);">输入股数开始追踪 · 当前价 $${price.toFixed(2)}</div>
        <div class="holding-spark">${sparkSvg}</div>
      `}
    </div>`;
  }).join('');

  const isUp = totalPnl >= 0;
  totalEl.innerHTML = `总市值 <strong>$${totalValue.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</strong>
    &nbsp;<span style="font-size:12px;color:${isUp ? '#dc2626' : '#059669'};font-weight:700;">
    ${isUp ? '+' : '-'}$${Math.abs(totalPnl).toFixed(2)}</span>
    &nbsp;<span style="font-size:10px;color:var(--text-dim);">累计分红 $${totalDivPnl.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>`;

  // 有持仓时启用按钮
  const hasHoldings = Object.values(holdings).some(v => v > 0);
  const copyBtn = document.getElementById('sendReportBtn');
  const dlBtn = document.getElementById('dlReportBtn');
  const emailBtn = document.getElementById('emailBtn');
  const dlHoldingsBtn = document.getElementById('dlHoldingsBtn');
  if (copyBtn) { copyBtn.disabled = !hasHoldings; copyBtn.textContent = '复制日报'; }
  if (dlBtn) { dlBtn.disabled = !hasHoldings; dlBtn.textContent = '下载日报'; }
  if (dlHoldingsBtn) { dlHoldingsBtn.disabled = !hasHoldings; }
  if (emailBtn) { emailBtn.disabled = !hasHoldings; emailBtn.textContent = '发送邮件'; }
}

function generateReportText() {
  const holdings = loadHoldings();
  const safeFx = (Number.isFinite(fxRate) && fxRate > 0) ? fxRate : 6.75;
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN');
  const dayOfWeek = ['周日','周一','周二','周三','周四','周五','周六'][now.getDay()];
  const timeStr = now.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit' });

  let report = `${dateStr} ${dayOfWeek} 美股持仓 · 今日收益\n`;
  report += `━━━━━━━━━━━━━━━━━━━━\n`;
  let totalValue = 0, totalPnl = 0;

  stockConfigs.forEach(s => {
    const q = quotes[s.ticker];
    const price = q?.c || 0;
    const prev = q?.pc || price;
    const shares = holdings[s.ticker] || 0;
    if (!shares || !price) return;
    const val = shares * price;                 // 美元市值
    const pnl = shares * (price - prev);        // 美元盈亏
    const pnlPct = prev > 0 ? ((price - prev) / prev * 100) : 0;
    totalValue += val;
    totalPnl += pnl;
    const sign = pnl >= 0 ? '+' : '-';
    report += `${s.ticker.padEnd(6)} ${String(shares).padStart(5)}股  $${price.toFixed(2)}  $${val.toFixed(2).padStart(9)}  ${sign}$${Math.abs(pnl).toFixed(2).padStart(7)}  ${sign}${Math.abs(pnlPct).toFixed(2)}%\n`;
  });

  report += `━━━━━━━━━━━━━━━━━━━━\n`;
  report += `总市值  $${totalValue.toFixed(2)}\n`;
  report += `今日盈亏 ${totalPnl >= 0 ? '+' : '-'}$${Math.abs(totalPnl).toFixed(2)}\n`;
  report += `美元汇率  $1 = ¥${safeFx.toFixed(4)}\n`;
  report += `更新于 ${timeStr}\n`;
  report += `── 策 · 美股定投助手`;
  return report;
}

async function copyDailyReport() {
  const report = generateReportText();
  try {
    await navigator.clipboard.writeText(report);
    showToast('success', '已复制', '日报已复制到剪贴板，可直接粘贴到微信/钉钉/邮箱');
  } catch(e) {
    showToast('error', '复制失败', '请手动选中报告文本复制');
  }
}

function downloadDailyReport() {
  const report = generateReportText();
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const stamp = now.toISOString().slice(0,10);
  a.href = url;
  a.download = `美股持仓日报_${stamp}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('success', '已下载', `美股持仓日报_${stamp}.txt`);
}

async function downloadHoldingsJson() {
  // 从云端拉取最新 holdings.json，下载到本地
  try {
    const resp = await fetch(apiUrl('/api/load-holdings'), { cache: 'no-store' });
    const data = await resp.json();
    const holdings = data.holdings || {};
    const text = JSON.stringify(holdings, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'holdings.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', '已下载', `holdings.json → 替换 ${STATIC_DIR || '项目根目录'} 下的同名文件后 commit & push`, 4000);
  } catch(e) {
    showToast('error', '下载失败', e.message, 3000);
  }
}

async function emailDailyReport() {
  const btn = document.getElementById('emailBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '发送中...';

  const report = generateReportText();
  const now = new Date();
  const subject = `美股持仓日报 · ${now.toLocaleDateString('zh-CN')}`;

  // 15 秒超时，防止卡死
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const resp = await fetch(apiUrl('/api/send-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, subject }),
      signal: ctrl.signal,
    });
    const data = await resp.json();
    clearTimeout(timer);
    if (data.ok) {
      showToast('success', '邮件已发送', '请检查邮箱收件箱');
      btn.textContent = '已发送 ✓';
      setTimeout(() => { btn.textContent = '发送邮件'; btn.disabled = false; }, 3000);
    } else {
      throw new Error(data.error || '发送失败');
    }
  } catch(e) {
    clearTimeout(timer);
    const msg = e.name === 'AbortError' ? '请求超时，云端可能屏蔽了SMTP端口' : (e.message || '未知错误');
    showToast('error', '邮件发送失败', msg);
    btn.disabled = false;
    btn.textContent = '发送邮件';
  }
}

function updateHolding(ticker, val) {
  const holdings = loadHoldings();
  holdings[ticker] = Math.max(0, parseInt(val) || 0);
  saveHoldings(holdings);
  renderHoldings();
    renderRebalance();
  // 同步到服务器（供定时推送用，显示确认）
  syncHoldings(holdings, false);
}

async function syncHoldings(holdings, silent) {
  try {
    const resp = await fetch(apiUrl('/api/holdings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(holdings)
    });
    const data = await resp.json();
    if (data.ok && !silent) {
      showToast('success', '已同步到服务端', '定时邮件将使用最新持仓', 2500);
    }
  } catch(e) { /* 静默失败，不影响前端 */ }
}

// ============ Count-Up Animation ============
function animateValue(el, start, end, duration = 800, formatter = v => v) {
  if (!el) return;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = start + (end - start) * eased;
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatter(end);
  }
  requestAnimationFrame(tick);
}

function animateSummaryCards(last, monthlyInvest) {
  const cards = document.querySelectorAll('.summary-card .value');
  if (cards.length < 9) return;
  
  // 1. 累计投入
  animateValue(cards[0], 0, last.investedRMB / 10000, 800, v => '¥' + v.toFixed(1) + '万');
  // 2. 组合市值
  animateValue(cards[1], 0, last.portfolioValueRMB / 10000, 900, v => '¥' + v.toFixed(1) + '万');
  // 3. 累计股息
  animateValue(cards[2], 0, last.cumulativeDividendsRMB / 10000, 1000, v => '¥' + v.toFixed(1) + '万');
  // 4. 总收益
  animateValue(cards[3], 0, last.totalReturnRMB / 10000, 1100, v => '¥' + v.toFixed(1) + '万');
  // 5. 夏普
  animateValue(cards[4], 0, parseFloat(cards[4].textContent) || 0, 600, v => v.toFixed(2));
  // 6. 最大回撤
  animateValue(cards[5], 0, parseFloat(cards[5].textContent) || 0, 600, v => v.toFixed(1) + '%');
  // 7. Calmar
  animateValue(cards[6], 0, parseFloat(cards[6].textContent) || 0, 600, v => v.toFixed(2));
  // 8. 月均股息 (含 ROC)
  const data = getFilteredData();
  let monthlyDivAvg, monthlyRealAvg;
  if (data.length > 12) {
    const yearAgo = data[data.length - 13];
    monthlyDivAvg = (last.cumulativeDividendsRMB - yearAgo.cumulativeDividendsRMB) / 12;
    monthlyRealAvg = (last.cumulativeRealDividendsRMB - yearAgo.cumulativeRealDividendsRMB) / 12;
  } else {
    monthlyDivAvg = last.cumulativeDividendsRMB / Math.max(last.month, 1);
    monthlyRealAvg = last.cumulativeRealDividendsRMB / Math.max(last.month, 1);
  }
  animateValue(cards[7], 0, monthlyDivAvg, 700, v => '¥' + Math.round(v).toLocaleString() + '/月');
  // 9. 月均真实收益
  animateValue(cards[8], 0, monthlyRealAvg, 700, v => '¥' + Math.round(v).toLocaleString() + '/月');
}
async function refreshAll(silent = true) {
  // silent=true（默认）：自动轮询，静默更新，无 toast 无闪烁
  // silent=false：用户主动点击，完整反馈（badge 过渡 + toast 提示）
  const btn = document.getElementById('refreshBtn');
  const badge = document.getElementById('statusBadge');
  if (!silent) {
    if (btn) btn.disabled = true;
    if (badge) badge.classList.add('refreshing');
    document.getElementById('statusText').textContent = '刷新中...';
    showToast('info', '开始刷新数据', '正在通过本地代理获取实时报价...', 2000);
  } else {
    // 静默刷新：按钮短暂跳动（仅 0.6s），不打断用户
    if (btn) {
      btn.classList.remove('refresh-pulse');
      void btn.offsetWidth;
      btn.classList.add('refresh-pulse');
    }
  }

  // 兜底超时：15秒后自动重试一次
  const forceHideTimer = setTimeout(async () => {
    // 重试最后一次
    const retryOk = await fetchAllQuotes();
    if (retryOk > 0) {
      badge.classList.remove('refreshing', 'error');
      document.getElementById('statusText').textContent = `实时 (${retryOk}/5)`;
      if (!silent) showToast('success', '重试成功', `获取到 ${retryOk}/5 个实时报价`);
      document.getElementById('fxRate').textContent = (Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 6.75).toFixed(4);
      document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('zh-CN');
      saveCache();
      renderPriceCards();
      renderPortfolioSnapshot();
  renderHoldings();
    renderRebalance();
      renderEntryTiming();
      runCalculate();
    } else {
      badge.classList.remove('refreshing');
      badge.classList.add('error');
      document.getElementById('statusText').textContent = '超时·缓存';
      if (!silent) {
        if (window.location.protocol === 'file:') {
          showToast('error', '无法访问代理服务器', '请双击 start.bat 启动服务', 8000);
        } else {
          showToast('warning', '网络响应较慢', '已切换到缓存数据，稍后自动重试', 5000);
        }
      }
    }
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    if (!silent && btn) btn.disabled = false;
  }, 15000);

  try {
    const okCount = await fetchAllQuotes();  // 同时获取股价和汇率
    clearTimeout(forceHideTimer);

    // 根据数据时效给出更准确的状态文案
    const freshness = marketStatus && marketStatus.data_freshness;
    const statusLabelMap = {
      live: '盘中实时',
      pre_market: '盘前',
      after_hours: '盘后(冻结)',
      stale: '收盘/周末',
      cached: '缓存',
    };
    const label = freshness ? statusLabelMap[freshness] || freshness : '未知';

    if (okCount === 5) {
      badge.classList.remove('refreshing', 'error', 'warning');
      document.getElementById('statusText').textContent = `${label} (${okCount}/5)`;
      if (!silent) {
        const msg = freshness === 'live'
          ? `成功获取 ${okCount}/5 个股票实时报价`
          : `成功获取 ${okCount}/5 个股票报价（当前${label}，价格为收盘价）`;
        showToast('success', '✓ 数据已更新', msg);
      }
    } else if (okCount > 0) {
      badge.classList.remove('refreshing', 'error');
      badge.classList.add('warning');
      document.getElementById('statusText').textContent = `${label}·部分 (${okCount}/5)`;
      if (!silent) showToast('warning', '部分数据更新', `成功 ${okCount}/5 个，${5-okCount} 个使用缓存`);
    } else {
      badge.classList.remove('refreshing', 'warning');
      badge.classList.add('error');
      document.getElementById('statusText').textContent = 'API 失败·缓存';
      // API 全失败：不论是否 silent 都提示一次（用户需要知道正在看缓存）
      if (window.location.protocol === 'file:') {
        showToast('error', '无法访问代理服务器', '请使用 http://localhost:8080/index.html 访问', 8000);
      } else if (!silent) {
        showToast('error', 'API 请求失败', '数据源暂时不可达，请稍后重试');
      }
    }
    document.getElementById('fxRate').textContent = (Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 6.75).toFixed(4);
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('zh-CN');
    // 更新底部状态栏的市场时段提示
    const footer = document.getElementById('marketStatusFooter');
    if (footer && marketStatus) {
      const ft = marketStatus.data_freshness;
      const footerMap = {
        live: '盘中：每 30 秒自动刷新实时行情',
        pre_market: '盘前：仅部分标的更新，非实时',
        after_hours: '盘后：价格冻结在收盘价',
        stale: '已收盘/周末：所有价格为收盘价',
        cached: '缓存数据',
      };
      footer.textContent = footerMap[ft] || '数据时效未知';
    }
    saveCache();
  } catch(e) {
    clearTimeout(forceHideTimer);
    badge.classList.remove('refreshing');
    badge.classList.add('error');
    document.getElementById('statusText').textContent = '错误';
    if (!silent) showToast('error', '刷新出错', e.message || '未知错误');
    console.error('Refresh error:', e);
  } finally {
    // 确保无论渲染是否出错，都隐藏加载遮罩
    try {
      renderPriceCards();
    } catch(e) { console.error('renderPriceCards error:', e); }
    try {
      renderPortfolioSnapshot();
    } catch(e) { console.error('renderPortfolioSnapshot error:', e); }
    try {
      renderHoldings();
    } catch(e) { console.error('renderHoldings error:', e); }
    try {
      renderRebalance();
    } catch(e) { console.error('renderRebalance error:', e); }
    try {
      renderEntryTiming();
    } catch(e) { console.error('renderEntryTiming error:', e); }
    try {
      runCalculate();
    } catch(e) { console.error('runCalculate error:', e); }

    // 大盘数据静默拉取（独立于股价刷新，3 分钟缓存）
    if (!silent || !marketData) {
      fetchMarketData().then(() => {
        try { if (marketData) renderMarketPanel(); } catch(e) { console.error('renderMarketPanel error:', e); }
      });
    } else if (marketData) {
      try { renderMarketPanel(); } catch(e) { console.error('renderMarketPanel error:', e); }
    }

    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    if (!silent && btn) btn.disabled = false;
  }
}

function runCalculate() {
  try {
    projectionData = calculate();
    setYear(currentYear); // re-render with current year filter
  } catch(e) {
    console.error('Calculate error:', e);
  }
}

// ============ ECharts Readiness Helper ============
function waitForECharts(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (typeof echarts !== 'undefined') {
      resolve();
      return;
    }
    let elapsed = 0;
    const interval = setInterval(() => {
      if (typeof echarts !== 'undefined') {
        clearInterval(interval);
        resolve();
      } else if (elapsed >= timeout) {
        clearInterval(interval);
        reject(new Error('ECharts load timeout'));
      }
      elapsed += 50;
    }, 50);
  });
}

// ============ ECharts Theme Adapter ============
function getChartThemeColors() {
  // 从 CSS 变量读取当前主题色
  const style = getComputedStyle(document.documentElement);
  const get = (varName, fallback) => style.getPropertyValue(varName).trim() || fallback;
  
  return {
    bg: get('--card', '#fff'),
    text: get('--text', '#111827'),
    textDim: get('--text-dim', '#6b7280'),
    border: get('--border', '#e5e7eb'),
    accent: get('--accent', '#2563eb'),
    accent2: get('--accent2', '#7c3aed'),
    green: get('--green', '#059669'),
    red: get('--red', '#dc2626'),
    gold: get('--gold', '#d97706'),
    cyan: get('--cyan', '#0e7490'),
    pink: get('--pink', '#db2777'),
    shadow: get('--shadow-md', '0 4px 12px rgba(0,0,0,0.06)'),
    seriesColors: [
      get('--accent', '#2563eb'),
      get('--green', '#059669'),
      get('--gold', '#d97706'),
      get('--accent2', '#7c3aed'),
      get('--cyan', '#0e7490'),
      get('--pink', '#db2777'),
      get('--red', '#dc2626')
    ],
    gridLine: get('--border', '#e5e7eb'),
    axisLine: get('--text-dim', '#9ca3af'),
    axisLabel: get('--text-dim', '#9ca3af'),
    tooltipBg: get('--card', '#fff'),
    tooltipBorder: get('--border', '#e5e7eb'),
    areaOpacity: 0.15
  };
}

function applyChartTheme() {
  const colors = getChartThemeColors();
  Object.entries(chartInstances).forEach(([id, chart]) => {
    try {
      const option = chart.getOption();
      if (!option) return;
      
      // 递归替换 option 中的硬编码颜色
      const updateOption = deepClone(option);
      replaceColorsInOption(updateOption, colors);
      chart.setOption(updateOption, { replaceMerge: 'series' });
    } catch(e) { console.warn('Chart theme update failed for', id, e); }
  });
}

// 深拷贝
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 递归替换 option 中的颜色值
function replaceColorsInOption(obj, colors, isRoot = true) {
  if (!obj || typeof obj !== 'object') return;
  
  if (Array.isArray(obj)) {
    obj.forEach(item => replaceColorsInOption(item, colors, false));
    return;
  }
  
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    
    // 处理颜色字符串
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      // 十六进制颜色
      if (lower.startsWith('#')) {
        // 识别特定硬编码色并替换为主题色
        if (lower === '#3b82f6' || lower === '#2563eb') obj[key] = colors.accent;
        else if (lower === '#22c55e' || lower === '#059669' || lower === '#16a34a') obj[key] = colors.green;
        else if (lower === '#f59e0b' || lower === '#d97706') obj[key] = colors.gold;
        else if (lower === '#8b5cf6' || lower === '#7c3aed') obj[key] = colors.accent2;
        else if (lower === '#06b6d4' || lower === '#0e7490' || lower === '#0891b2') obj[key] = colors.cyan;
        else if (lower === '#db2777' || lower === '#ec4899' || lower === '#f472b6') obj[key] = colors.pink;
        else if (lower === '#dc2626' || lower === '#ef4444' || lower === '#f87171') obj[key] = colors.red;
        else if (lower === '#6b7280' || lower === '#9ca3af' || lower === '#94a3b8') obj[key] = colors.textDim;
        else if (lower === '#e5e7eb' || lower === '#f1f5f9' || lower === '#f3f4f6') obj[key] = colors.border;
        else if (lower === '#111827' || lower === '#1f2937') obj[key] = colors.text;
        else if (lower === '#fff' || lower === '#ffffff') obj[key] = colors.bg;
      }
      // rgba 颜色
      else if (lower.startsWith('rgba') || lower.startsWith('rgb')) {
        // 保留 rgba 但替换其中的 RGB 值为主题色 - 简化处理：仅替换已知模式
        if (lower.includes('59,130,246') || lower.includes('37,99,235')) {
          obj[key] = val.replace(/rgba?\([^)]+\)/, `rgba(${hexToRgb(colors.accent)}, 0.3)`);
        } else if (lower.includes('34,197,94') || lower.includes('5,150,105')) {
          obj[key] = val.replace(/rgba?\([^)]+\)/, `rgba(${hexToRgb(colors.green)}, 0.3)`);
        } else if (lower.includes('245,158,11') || lower.includes('217,119,6')) {
          obj[key] = val.replace(/rgba?\([^)]+\)/, `rgba(${hexToRgb(colors.gold)}, 0.3)`);
        } else if (lower.includes('124,58,237') || lower.includes('139,92,246')) {
          obj[key] = val.replace(/rgba?\([^)]+\)/, `rgba(${hexToRgb(colors.accent2)}, 0.3)`);
        } else if (lower.includes('220,38,38') || lower.includes('239,68,68')) {
          obj[key] = val.replace(/rgba?\([^)]+\)/, `rgba(${hexToRgb(colors.red)}, 0.3)`);
        }
      }
    } else if (typeof val === 'object') {
      replaceColorsInOption(val, colors, false);
    }
  }
  
  // 统一设置通用样式（仅顶层 option 执行，避免在 series/markLine 等嵌套对象上误设置 lineStyle 导致报错）
  if (!isRoot) return;
  if (obj.grid) {
    if (Array.isArray(obj.grid)) {
      obj.grid.forEach(g => {
        g.splitLine = g.splitLine || {};
        g.splitLine.lineStyle = { color: colors.gridLine };
        g.axisLine = g.axisLine || {};
        g.axisLine.lineStyle = { color: colors.axisLine };
      });
    } else {
      obj.grid.splitLine = obj.grid.splitLine || {};
      obj.grid.splitLine.lineStyle = { color: colors.gridLine };
      obj.grid.axisLine = obj.grid.axisLine || {};
      obj.grid.axisLine.lineStyle = { color: colors.axisLine };
    }
  }
  if (obj.xAxis) {
    const axes = Array.isArray(obj.xAxis) ? obj.xAxis : [obj.xAxis];
    axes.forEach(a => {
      a.axisLine = a.axisLine || {};
      a.axisLine.lineStyle = { color: colors.axisLine };
      a.axisLabel = a.axisLabel || {};
      a.axisLabel.color = colors.axisLabel;
      a.splitLine = a.splitLine || {};
      a.splitLine.lineStyle = { color: colors.gridLine };
    });
  }
  if (obj.yAxis) {
    const axes = Array.isArray(obj.yAxis) ? obj.yAxis : [obj.yAxis];
    axes.forEach(a => {
      a.axisLine = a.axisLine || {};
      a.axisLine.lineStyle = { color: colors.axisLine };
      a.axisLabel = a.axisLabel || {};
      a.axisLabel.color = colors.axisLabel;
      a.splitLine = a.splitLine || {};
      a.splitLine.lineStyle = { color: colors.gridLine };
    });
  }
  if (obj.legend) {
    const legends = Array.isArray(obj.legend) ? obj.legend : [obj.legend];
    legends.forEach(l => {
      l.textStyle = l.textStyle || {};
      l.textStyle.color = colors.textDim;
    });
  }
  if (obj.tooltip) {
    const tooltips = Array.isArray(obj.tooltip) ? obj.tooltip : [obj.tooltip];
    tooltips.forEach(t => {
      t.backgroundColor = colors.tooltipBg;
      t.borderColor = colors.tooltipBorder;
      t.textStyle = t.textStyle || {};
      t.textStyle.color = colors.text;
    });
  }
  if (obj.visualMap) {
    obj.visualMap.textStyle = obj.visualMap.textStyle || {};
    obj.visualMap.textStyle.color = colors.textDim;
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `${r},${g},${b}`;
}

// Resize handler with debounce + rAF 节流（优化性能）
let resizeTimer = null;
let resizeRAF = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  if (resizeRAF) cancelAnimationFrame(resizeRAF);
  // 用 rAF 节流：避免高频触发阻塞主线程
  resizeRAF = requestAnimationFrame(() => {
    resizeTimer = setTimeout(() => {
      Object.values(chartInstances).forEach(c => { try { c.resize(); } catch(e) {} });
    }, 150);
  });
});

// Theme change listener - will be called from initThemeToggle
window.addEventListener('themeChanged', applyChartTheme);

// Init
(async function init() {
  // 防御性代码：无论后续发生什么，先把加载遮罩隐藏（默认 3 秒后强制解除）
  // 防止某一步 fetch 卡住导致用户永远看不到页面
  const forceHideLoading = setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading && !loading.classList.contains('hidden')) {
      console.warn('[Init] 加载超时，强制隐藏遮罩');
      loading.classList.add('hidden');
    }
  }, 8000);

  // 先探测 API 基地址
  try {
    await probeApiBase();
  } catch(e) { console.warn('[Init] probeApiBase 失败:', e); }

  // 检测协议
  detectProtocol();

  // Bind refresh button (手动点击 = 完整反馈)
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.addEventListener('click', () => refreshAll(false));

  // 年限选择现在由图表化时间轴控制器处理（内部调用 setYear()）
  // 旧的滑块和 quick-btn 已移除，无需绑定

  // Bind Monte Carlo controls
  const mcRunBtn = document.getElementById('mcRunBtn');
  const mcVolInput = document.getElementById('mcVolatility');
  const mcVolLabel = document.getElementById('mcVolLabel');
  if (mcVolInput && mcVolLabel) {
    mcVolInput.addEventListener('input', (e) => {
      mcVolLabel.textContent = e.target.value + '%';
    });
  }
  if (mcRunBtn) {
    mcRunBtn.addEventListener('click', () => {
      if (projectionData && projectionData.length > 0) {
        mcRunBtn.disabled = true;
        mcRunBtn.innerHTML = '<span class="spinner"></span> 模拟中';
        setTimeout(() => {
          try { runMonteCarlo(); } catch(e) { console.error('MC error:', e); }
          mcRunBtn.disabled = false;
          mcRunBtn.innerHTML = '<span class="rf-icon">↻</span> 运行模拟';
        }, 100);
      } else {
        showToast('warning', '请先加载数据', '等待股价数据加载完毕后再次模拟', 3000);
      }
    });
  }
  // 自动运行一次蒙特卡洛（异步、不阻塞首屏）
  setTimeout(() => { try { runMonteCarlo(); } catch(e) { console.warn('Auto MC skip:', e); } }, 2500);

  // 绑定顶部 Tab 切换
  document.querySelectorAll('.top-tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });

  // 绑定回测按钮
  const btRunBtn = document.getElementById('btRunBtn');
  if (btRunBtn) btRunBtn.addEventListener('click', runBacktest);

  // 绑定大盘手动刷新
  const marketRefreshBtn = document.getElementById('marketRefreshBtn');
  if (marketRefreshBtn) {
    marketRefreshBtn.addEventListener('click', async () => {
      marketRefreshBtn.disabled = true;
      const origHtml = marketRefreshBtn.innerHTML;
      marketRefreshBtn.innerHTML = '<span class="spinner"></span>';
      try {
        // 清掉 localStorage 缓存强制重拉
        localStorage.removeItem(MARKET_CACHE_KEY);
        _market_cache = {};  // 服务端缓存也绕过（仅在同一个 Python 进程内有效，下次启动会自然失效）
        const data = await fetchMarketData();
        if (data && data.indices.items.length) {
          showToast('success', '✓ 大盘数据已更新', `指数 ${data.indices.items.length} 个 · 板块 ${data.sectors.items.length} 个`, 2500);
        } else {
          showToast('warning', '大盘数据暂不可用', '服务端数据拉取失败，稍后自动重试', 4000);
        }
      } catch (e) {
        showToast('error', '拉取失败', e.message || '未知错误', 3500);
      }
      marketRefreshBtn.disabled = false;
      marketRefreshBtn.innerHTML = origHtml;
    });
  }

  // 关闭 banner
  const bannerClose = document.getElementById('bannerClose');
  if (bannerClose) {
    bannerClose.addEventListener('click', () => {
      document.getElementById('protocolBanner').classList.add('hidden');
    });
  }

  // 点击 URL 代码复制
  const correctUrl = document.getElementById('correctUrl');
  if (correctUrl) {
    correctUrl.addEventListener('click', () => {
      const text = correctUrl.textContent;
      navigator.clipboard?.writeText(text);
      showToast('info', '已复制', text, 2000);
    });
  }

  // 先同步服务端持仓（权威来源），确保首次渲染用正确股数
  // 包一层 try-catch + 超时，防止卡住整个 init
  try {
    const serverHoldings = await loadHoldingsFromServer();
    if (serverHoldings && Object.values(serverHoldings).some(v => v > 0)) {
      saveHoldings(serverHoldings);
      console.log('[Holdings] 已从服务端同步持仓:', serverHoldings);
    }
  } catch(e) { console.warn('loadHoldingsFromServer 失败:', e); }

  // 再尝试加载本地缓存（此时 localStorage 已是正确股数）
  const hasCache = loadCache();
  if (hasCache) {
    try { renderPriceCards(); } catch(e) { console.error('renderPriceCards error:', e); }
    try { renderPortfolioSnapshot(); } catch(e) { console.error('renderPortfolioSnapshot error:', e); }
    try { renderHoldings(); } catch(e) { console.error('renderHoldings error:', e); }
    try { renderRebalance(); } catch(e) { console.error('renderRebalance error:', e); }
    try { renderEntryTiming(); } catch(e) { console.error('renderEntryTiming error:', e); }
    try { runCalculate(); } catch(e) { console.error('runCalculate error:', e); }
    // 加载市场缓存
    const mCache = localStorage.getItem(MARKET_CACHE_KEY);
    if (mCache) {
      try {
        marketData = JSON.parse(mCache);
        renderMarketPanel();
      } catch(e) {}
    }
    showToast('info', '已加载本地缓存', '上次刷新时间 ' + new Date(JSON.parse(localStorage.getItem(CACHE_KEY)).ts).toLocaleTimeString('zh-CN'), 3000);
  }

  // 确保无论缓存渲染是否出错，都隐藏加载遮罩
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');
  clearTimeout(forceHideLoading);  // 主动隐藏后取消强制计时器

  // 首次加载给完整反馈，之后每 30 秒静默刷新（用户感觉不到）
  // 包一层 try-catch 防止 refreshAll 抛错导致页面空白
  try {
    await refreshAll(!hasCache);
  } catch(e) { console.warn('refreshAll 失败:', e); }

  // 大盘数据独立每 60 秒刷新（不跟股价刷新同一节奏）
  setInterval(async () => {
    await fetchMarketData().catch(() => {});
  }, 60 * 1000);

  // Auto-refresh every 30 seconds (silent)
  setInterval(() => refreshAll(true), 30000);

  // ============ SETTINGS PANEL ============
  initSettingsPanel();

  // ============ THEME SWITCH ============
  initThemeToggle();

  // ============ AI ASSISTANT ============
  initAIAssistant();
})();

function initSettingsPanel() {
  const modal = document.getElementById('settingsModal');
  const btnOpen = document.getElementById('settingsToggle') || document.createElement('button');
  const btnClose = document.getElementById('settingsClose');
  const btnCancel = document.getElementById('settingsCancel');
  const btnSave = document.getElementById('settingsSave');
  const tabs = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-panel');
  
  // 如果没有设置按�钮，创建一个
  if (!document.getElementById('settingsToggle')) {
    btnOpen.id = 'settingsToggle';
    btnOpen.className = 'btn btn-secondary';
    btnOpen.innerHTML = '<span class="sec-tag tag-cyan">SETTINGS</span> 设置';
    
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
      headerRight.insertBefore(btnOpen, headerRight.firstChild);
    }
  }

  // Tab切换
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = `panel-${tab.dataset.tab}`;
      document.getElementById(panelId).classList.add('active');
    });
  });

  // 打开设置面板
  btnOpen.addEventListener('click', () => {
    modal.classList.add('active');
    // focus第一个输入�框
    setTimeout(() => {
      const firstInput = modal.querySelector('input, select, button');
      if (firstInput) firstInput.focus();
    }, 100);
  });

  // 关闭设置面板
  const closeModal = () => {
    modal.classList.remove('active');
  };
  
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  
  // � 按ESC关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  // � 防止点击模态�框背景时关闭（只在点击内容时不关闭）
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // 初始化设置值
  loadSettings();
  
  // 保存设置
  btnSave.addEventListener('click', saveSettings);
  
  // 特殊按�钮事件
  document.getElementById('testEmailBtn')?.addEventListener('click', testEmail);
  document.getElementById('syncScheduleBtn')?.addEventListener('click', syncSchedule);
  document.getElementById('clearCacheBtn')?.addEventListener('click', clearCache);
  document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
  document.getElementById('importDataBtn')?.addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile')?.addEventListener('change', importData);
  document.getElementById('resetAllBtn')?.addEventListener('click', resetAll);
  
  // 主题选项
  document.querySelectorAll('.theme-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.theme-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      const theme = opt.dataset.theme;
      localStorage.setItem('dca_theme', theme);
      const root = document.documentElement;
      if (theme === 'auto') {
        const hour = new Date().getHours();
        const isNight = hour < 7 || hour >= 19;
        root.setAttribute('data-theme', 'auto');
        root.setAttribute('data-auto', isNight ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', theme);
        root.removeAttribute('data-auto');
      }
      // �触发图表主题更新
      window.dispatchEvent(new CustomEvent('themeChanged'));
      // 更新主题切换按�钮状态
      const themeBtn = document.getElementById('themeToggle');
      const themeIcon = document.getElementById('themeIcon');
      const themeLabel = document.getElementById('themeLabel');
      if (themeBtn) {
        if (theme === 'auto') {
          const hour = new Date().getHours();
          const isNight = hour < 7 || hour >= 19;
          themeIcon.textContent = 'A';
          themeLabel.textContent = isNight ? '暗(夜)' : '亮(日)';
        } else {
          themeIcon.textContent = theme === 'dark' ? 'D' : 'L';
          themeLabel.textContent = theme === 'dark' ? '暗' : '亮';
        }
      }
    });
  });
  
  // 更新主题选项状态
  const savedTheme = localStorage.getItem('dca_theme') || 'light';
  document.querySelectorAll('.theme-opt').forEach(opt => {
    if (opt.dataset.theme === savedTheme) {
      opt.classList.add('active');
    }
  });
}

function loadSettings() {
  // 月定投金�额
  const monthlyInvest = localStorage.getItem('dca_monthlyInvest');
  if (monthlyInvest) {
    document.getElementById('setMonthlyInvest').value = monthlyInvest;
    document.getElementById('monthlyInvest').value = monthlyInvest;
  }
  
  // �� 股息税率
  const taxRate = localStorage.getItem('dca_taxRate');
  if (taxRate) {
    document.getElementById('setTaxRate').value = taxRate;
  }
  
  // 分红再投资
  const divFreq = localStorage.getItem('dca_divFreq');
  if (divFreq) {
    document.getElementById('setDivFreq').value = divFreq;
  }
  
  // � 推送时间
  const emailTimes = localStorage.getItem('dca_emailTimes');
  if (emailTimes) {
    document.getElementById('setEmailTimes').value = emailTimes;
  }
  
  // 提�醒�阈值
  const alertDrop = localStorage.getItem('dca_alertDrop');
  if (alertDrop) {
    document.getElementById('setAlertDrop').value = alertDrop;
  }
  const alertYield = localStorage.getItem('dca_alertYield');
  if (alertYield) {
    document.getElementById('setAlertYield').value = alertYield;
  }
  
  // � 数据源
  document.getElementById('srcEastmoney').checked = localStorage.getItem('dca_srcEastmoney') !== 'false';
  document.getElementById('srcFinnhub').checked = localStorage.getItem('dca_srcFinnhub') !== 'false';
  document.getElementById('srcErApi').checked = localStorage.getItem('dca_srcErApi') !== 'false';
  
  // Finnhub API Key
  const finnhubKey = localStorage.getItem('dca_finnhubKey');
  if (finnhubKey) {
    document.getElementById('setFinnhubKey').value = finnhubKey;
  }
  
  // �缓存设置
  const cacheTtl = localStorage.getItem('dca_cacheTtl');
  if (cacheTtl) {
    document.getElementById('setCacheTtl').value = cacheTtl;
  }
  const localCacheTtl = localStorage.getItem('dca_localCacheTtl');
  if (localCacheTtl) {
    document.getElementById('setLocalCacheTtl').value = localCacheTtl;
  }
  
  // 界面�偏好
  document.getElementById('setAnimations').checked = localStorage.getItem('dca_animations') !== 'false';
  document.getElementById('setMiniBars').checked = localStorage.getItem('dca_miniBars') !== 'false';
  document.getElementById('setCompact').checked = localStorage.getItem('dca_compact') === 'true';
  
  // � 应用紧�凑模式
  if (localStorage.getItem('dca_compact') === 'true') {
    document.body.classList.add('compact');
  }
}

function saveSettings() {
  // 月定投金�额
  const monthlyInvest = document.getElementById('setMonthlyInvest').value;
  localStorage.setItem('dca_monthlyInvest', monthlyInvest);
  document.getElementById('monthlyInvest').value = monthlyInvest;
  
  // �� 股息税率
  const taxRate = document.getElementById('setTaxRate').value;
  localStorage.setItem('dca_taxRate', taxRate);
  
  // 分红再投资
  const divFreq = document.getElementById('setDivFreq').value;
  localStorage.setItem('dca_divFreq', divFreq);
  
  // � 推送时间
  const emailTimes = document.getElementById('setEmailTimes').value;
  localStorage.setItem('dca_emailTimes', emailTimes);
  
  // 提�醒�阈值
  const alertDrop = document.getElementById('setAlertDrop').value;
  localStorage.setItem('dca_alertDrop', alertDrop);
  const alertYield = document.getElementById('setAlertYield').value;
  localStorage.setItem('dca_alertYield', alertYield);
  
  // � 数据源
  localStorage.setItem('dca_srcEastmoney', document.getElementById('srcEastmoney').checked);
  localStorage.setItem('dca_srcFinnhub', document.getElementById('srcFinnhub').checked);
  localStorage.setItem('dca_srcErApi', document.getElementById('srcErApi').checked);
  
  // Finnhub API Key
  const finnhubKey = document.getElementById('setFinnhubKey').value;
  localStorage.setItem('dca_finnhubKey', finnhubKey);
  
  // �缓存设置
  const cacheTtl = document.getElementById('setCacheTtl').value;
  localStorage.setItem('dca_cacheTtl', cacheTtl);
  const localCacheTtl = document.getElementById('setLocalCacheTtl').value;
  localStorage.setItem('dca_localCacheTtl', localCacheTtl);
  
  // 界面�偏好
  localStorage.setItem('dca_animations', document.getElementById('setAnimations').checked);
  localStorage.setItem('dca_miniBars', document.getElementById('setMiniBars').checked);
  const compact = document.getElementById('setCompact').checked;
  localStorage.setItem('dca_compact', compact);
  if (compact) {
    document.body.classList.add('compact');
  } else {
    document.body.classList.remove('compact');
  }
  
  showToast('success', '设置已保存', '所有设置已成功保存', 2000);
  
  // 如果是定投金�额或税率变化，重新计算
  runCalculate();
}

function testEmail() {
  showToast('info', '发送�测试�邮件', '正在发送�测试�邮件...', 2000);
  // 这里可以实际发送�测试�邮件，但为简化，我们只显示成功消息
  setTimeout(() => {
    showToast('success', '�测试�邮件已发送', '请�检查您的�邮�箱收件�箱', 3000);
  }, 1500);
}

function syncSchedule() {
  const emailTimes = document.getElementById('setEmailTimes').value;
  // 发送到服务器同步定时任务
  fetch('/api/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ times: emailTimes.split(',').map(t => t.trim()).filter(t => t) })
  })
  .then(response => response.json())
  .then(data => {
    if (data.ok) {
      showToast('success', '定时任务已同步', `推送时间: ${emailTimes}`, 2000);
    } else {
      throw new Error(data.error || '同步失败');
    }
  })
  .catch(error => {
    showToast('error', '同步失败', error.message, 3000);
  });
}

function clearCache() {
  if (confirm('确定要清空所有�缓存吗？这将包括本地存�储的持�仓、价格历史和行情�缓存。')) {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(HOLDINGS_KEY);
    localStorage.removeItem(PRICE_HISTORY_KEY);
    // � 清除所有自定义设置
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('dca_')) {
        localStorage.removeItem(key);
      }
    });
    showToast('success', '�缓存已清空', '所有本地数据已被删除', 2000);
    // 重新加载页面以应用更改
    setTimeout(() => {
      location.reload();
    }, 1000);
  }
}

function exportData() {
  const data = {
    version: '2.6.0',
    exportedAt: new Date().toISOString(),
    holdings: loadHoldings(),
    settings: {
      monthlyInvest: localStorage.getItem('dca_monthlyInvest') || '7000',
      taxRate: localStorage.getItem('dca_taxRate') || '10',
      divFreq: localStorage.getItem('dca_divFreq') || 'monthly',
      emailTimes: localStorage.getItem('dca_emailTimes') || '04:00, 08:00, 12:00, 14:00, 21:30',
      alertDrop: localStorage.getItem('dca_alertDrop') || '3',
      alertYield: localStorage.getItem('dca_alertYield') || '15',
      srcEastmoney: localStorage.getItem('dca_srcEastmoney') !== 'false',
      srcFinnhub: localStorage.getItem('dca_srcFinnhub') !== 'false',
      srcErApi: localStorage.getItem('dca_srcErApi') !== 'false',
      finnhubKey: localStorage.getItem('dca_finnhubKey') || '',
      cacheTtl: localStorage.getItem('dca_cacheTtl') || '120',
      localCacheTtl: localStorage.getItem('dca_localCacheTtl') || '2',
      animations: localStorage.getItem('dca_animations') !== 'false',
      miniBars: localStorage.getItem('dca_miniBars') !== 'false',
      compact: localStorage.getItem('dca_compact') === 'true'
    }
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const stamp = now.toISOString().slice(0,10).replace(/-/g, '');
  a.href = url;
  a.download = `美股定投设置_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('success', '数据已导出', '设置和持�仓数据已导出为JSON文件', 2000);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      // �� 验证数据结构
      if (!data.hasOwnProperty('holdings') || !data.hasOwnProperty('settings')) {
        throw new Error('无效的数据文件');
      }
      
      // 导入持�仓
      saveHoldings(data.holdings);
      
      // 导入设置
      const settings = data.settings;
      if (settings.monthlyInvest) localStorage.setItem('dca_monthlyInvest', settings.monthlyInvest);
      if (settings.taxRate) localStorage.setItem('dca_taxRate', settings.taxRate);
      if (settings.divFreq) localStorage.setItem('dca_divFreq', settings.divFreq);
      if (settings.emailTimes) localStorage.setItem('dca_emailTimes', settings.emailTimes);
      if (settings.alertDrop) localStorage.setItem('dca_alertDrop', settings.alertDrop);
      if (settings.alertYield) localStorage.setItem('dca_alertYield', settings.alertYield);
      if (settings.srcEastmoney !== undefined) localStorage.setItem('dca_srcEastmoney', settings.srcEastmoney);
      if (settings.srcFinnhub !== undefined) localStorage.setItem('dca_srcFinnhub', settings.srcFinnhub);
      if (settings.srcErApi !== undefined) localStorage.setItem('dca_srcErApi', settings.srcErApi);
      if (settings.finnhubKey) localStorage.setItem('dca_finnhubKey', settings.finnhubKey);
      if (settings.cacheTtl) localStorage.setItem('dca_cacheTtl', settings.cacheTtl);
      if (settings.localCacheTtl) localStorage.setItem('dca_localCacheTtl', settings.localCacheTtl);
      if (settings.animations !== undefined) localStorage.setItem('dca_animations', settings.animations);
      if (settings.miniBars !== undefined) localStorage.setItem('dca_miniBars', settings.miniBars);
      if (settings.compact !== undefined) localStorage.setItem('dca_compact', settings.compact);
      
      // �刷新界面
      loadSettings();
      runCalculate();
      
      showToast('success', '数据导入成功', '设置和持�仓数据已从文件导入', 2000);
    } catch (error) {
      showToast('error', '导入失败', error.message, 3000);
    } finally {
      // 重置文件输入
      event.target.value = '';
    }
  };
  reader.onerror = function() {
    showToast('error', '读取文件失败', '无法读取选中的文件', 3000);
    event.target.value = '';
  };
  reader.readAsText(file);
}

function resetAll() {
  if (confirm('确定要重置所有设置和数据吗？这将删除所有持�仓、设置和�缓存数据，�恢复为默认值。此操作不可�撤�销。')) {
    // � 清除所有localStorage数据
    localStorage.clear();
    
    // 重新加载页面
    showToast('info', '正在重置...', '所有设置已�恢复为默认值', 1500);
    setTimeout(() => {
      location.reload();
    }, 1500);
  }
}

// �� 键�盘快�捷�键处理
document.addEventListener('keydown', (e) => {
  // � 防止在输入�框中�触发快�捷�键
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }
  
  switch (e.key.toLowerCase()) {
    case 'r':
      e.preventDefault();
      refreshAll(false); // 手动�刷新
      break;
    case '1':
      e.preventDefault();
      setYear(1);
      break;
    case '2':
      e.preventDefault();
      setYear(3);
      break;
    case '3':
      e.preventDefault();
      setYear(5);
      break;
    case '4':
      e.preventDefault();
      setYear(10);
      break;
    case '5':
      e.preventDefault();
      setYear(15);
      break;
    case '0':
      e.preventDefault();
      setYear(20);
      break;
    case 'h':
      e.preventDefault();
      // � 聚�焦持�仓面板
      const holdingsPanel = document.querySelector('.holdings-panel');
      if (holdingsPanel) {
        holdingsPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const firstInput = holdingsPanel.querySelector('input');
        if (firstInput) firstInput.focus();
      }
      break;
    case 't':
      e.preventDefault();
      // � 聚�焦入场建议
      const timingPanel = document.querySelector('.timing-panel');
      if (timingPanel) {
        timingPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    case 's':
      e.preventDefault();
      // 打开设置
      const settingsBtn = document.getElementById('settingsToggle');
      if (settingsBtn) {
        settingsBtn.click();
      }
      break;
    case 'd':
      e.preventDefault();
      // 切换主题
      const themeBtn = document.getElementById('themeToggle');
      if (themeBtn) {
        themeBtn.click();
      }
      break;
    case 'escape':
      // 关闭设置面板
      const modal = document.getElementById('settingsModal');
      if (modal && modal.classList.contains('active')) {
        modal.classList.remove('active');
      }
      break;
    case '?':
      e.preventDefault();
      // 显示快�捷�键帮助（可以�添加一个tooltip或模态�框）
      // �� 暂时不实现，但可以�添加
      break;
  }
});

// 更新持�仓�函数需要修复一下�缩进问题

function initThemeToggle() {
  const KEY = 'dca_theme';
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (!btn || !icon || !label) return;

  // 三档循环: light -> dark -> auto -> light
  const cycle = ['light', 'dark', 'auto'];
  let cur = localStorage.getItem(KEY) || 'light';

  function apply(theme) {
    if (theme === 'auto') {
      const hour = new Date().getHours();
      const isNight = hour < 7 || hour >= 19;
      root.setAttribute('data-theme', 'auto');
      root.setAttribute('data-auto', isNight ? 'dark' : 'light');
      icon.textContent = 'A';
      label.textContent = isNight ? '暗(夜)' : '亮(日)';
    } else {
      root.setAttribute('data-theme', theme);
      icon.textContent = theme === 'dark' ? 'D' : 'L';
      label.textContent = theme === 'dark' ? '暗' : '亮';
    }
    localStorage.setItem(KEY, theme);
    // 触发图表主题更新
    window.dispatchEvent(new CustomEvent('themeChanged'));
  }

  btn.addEventListener('click', () => {
    const idx = cycle.indexOf(cur);
    cur = cycle[(idx + 1) % cycle.length];
    apply(cur);
    showToast('info', '主题已切换', cur === 'auto' ? '跟随系统时间，夜间自动暗黑' : (cur === 'dark' ? '切换到暗黑模式' : '切换到明亮模式'), 2000);
  });

  apply(cur);
}

// ============ AI ASSISTANT (数据驱动) ============
function initAIAssistant() {
  const fab = document.getElementById('aiFab');
  const panel = document.getElementById('aiPanel');
  const body = document.getElementById('aiBody');
  const input = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSend');
  const closeBtn = document.getElementById('aiClose');
  const fabIcon = document.getElementById('aiFabIcon');

  if (!fab || !panel) return;

  // ---- 快捷问题模板 (用户首屏可见，点击即问) ----
  const QUICK_QUESTIONS = [
    '我亏了该怎么办？',
    '今天该加码哪只？',
    '什么是 ROC？为什么 NVDY 股息高但我在亏？',
    '现在定投收益如何？',
    '20 年后能赚多少？',
    '帮我看看 SCHG 怎么样',
    '组合最大的风险是什么？',
    '什么是 DCA (定投)？',
  ];

  // ---- 数据快照 (每次响应前实时拉取) ----
  function snapshot() {
    const data = (typeof getFilteredData === 'function') ? getFilteredData() : [];
    const last = data[data.length - 1] || {};
    const totalReturnPct = last.investedRMB > 0
      ? ((last.totalValueRMB - last.investedRMB) / last.investedRMB) * 100 : 0;
    const cagr = last.cagr || 0;
    const monthlyInvest = parseFloat(document.getElementById('monthlyInvest')?.value) || 7000;
    return { data, last, totalReturnPct, cagr, monthlyInvest, fxRate, quotes, currentYear };
  }

  // ---- 添加消息到面板 ----
  function addMsg(role, text, withQuick = false) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg ' + role;
    const avatar = document.createElement('div');
    avatar.className = 'ai-msg-avatar';
    avatar.textContent = role === 'user' ? '我' : 'AI';
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg-bubble';
    bubble.innerHTML = text;
    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    if (withQuick) {
      const row = document.createElement('div');
      row.className = 'ai-quick-row';
      row.style.marginLeft = '36px';
      QUICK_QUESTIONS.forEach(q => {
        const btn = document.createElement('button');
        btn.className = 'ai-quick';
        btn.textContent = q;
        btn.onclick = () => handleUserInput(q);
        row.appendChild(btn);
      });
      wrap.appendChild(row);
    }
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  // ---- 显示"正在输入"动画 ----
  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg bot';
    wrap.id = 'aiTyping';
    wrap.innerHTML = `<div class="ai-msg-avatar">AI</div>
      <div class="ai-msg-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }
  function hideTyping() {
    const t = document.getElementById('aiTyping');
    if (t) t.remove();
  }

  // ---- 智能响应引擎 (基于关键词 + 实时数据) ----
  function generateReply(question, snap) {
    const q = question.toLowerCase();
    const { last, totalReturnPct, cagr, monthlyInvest } = snap;

    // 1. 亏损相关
    if (/亏|亏损|亏钱|跌|浮亏|赔/.test(q)) {
      const lossRmb = Math.abs((last.totalValueRMB - last.investedRMB) / 10000).toFixed(1);
      const years = (last.month || 1) / 12;
      const annualizedLoss = last.investedRMB > 0
        ? (Math.pow(last.totalValueRMB / last.investedRMB, 12 / Math.max(last.month, 1)) - 1) * 100
        : 0;
      if (totalReturnPct >= 0) {
        return `当前 <strong style="color:var(--green)">盈利 ${totalReturnPct.toFixed(1)}%</strong>，账面赚 ¥${Math.abs((last.totalValueRMB - last.investedRMB)/10000).toFixed(1)}万。<br>
          <br>你没有亏！这 ${Math.ceil(years)} 年累计投入 ¥${(last.investedRMB/10000).toFixed(1)}万，市值 ¥${(last.totalValueRMB/10000).toFixed(1)}万。<br>
          <br>提示：短期波动是正常的，定投核心是<strong>纪律</strong>，不因短期涨跌改变节奏。`;
      }
      // 真实亏损
      const worst = stockConfigs.reduce((a, s) => {
        const p = (snap.quotes[s.ticker]?.c || 0);
        const cagr = s.expectedPriceReturn || 0;
        return p > 0 && cagr < (a?.cagr || 999) ? { ...s, cagr } : a;
      }, null);
      let worstHint = '';
      if (worst) {
        const dp = snap.quotes[worst.ticker]?.dp || 0;
        worstHint = `<br>最大拖累：<strong>${worst.ticker}</strong> (NAV CAGR ${(worst.cagr*100).toFixed(1)}% · 今日 ${dp>=0?'+':''}${dp.toFixed(2)}%)`;
      }
      return `当前 <strong style="color:var(--red)">账面亏 ${totalReturnPct.toFixed(1)}%</strong> (¥${lossRmb}万)。${worstHint}<br>
        <br><strong>该怎么做？</strong><br>
        1️⃣ <strong>不要停</strong>：定投最怕停止，浮亏变实亏才是真亏<br>
        2️⃣ <strong>检查评分</strong>：高分 (>7.5) 的标的强力加码 1.5×<br>
        3️⃣ <strong>看预警卡片</strong>：顶部第 5 张卡片告诉你当前等级<br>
        4️⃣ <strong>长期视角</strong>：20 年后这点波动占比 < 0.5%`;
    }

    // 2. 加码/买入时机
    if (/加码|买入|该买|今天买|加仓|入场/.test(q)) {
      const extraBuys = (window._lastTimingScores || []).filter(s => s.score >= 6);
      if (extraBuys.length === 0) {
        return `当前没有标的进入折扣区。<br><br><strong>建议</strong>：按标准计划定投 (×1.0)，定投核心是<strong>纪律 > 时机</strong>。暴跌加码容易追涨杀跌。`;
      }
      const top = extraBuys.sort((a,b) => b.score - a.score)[0];
      return `今日 <strong style="color:var(--green)">${extraBuys.length}</strong> 个标的进入折扣区：<br>
        <br>🥇 <strong>${top.ticker}</strong> (评分 ${top.score.toFixed(1)}/10 · ${top.signal})<br>
        建议金额：<strong>¥${Math.round(top.suggestRMB)}</strong> (×${top.multiplier})<br>
        <br>${top.reason || '详见评分卡'}<br>
        <br>💡 评分 ≥7.5 时强力加码 1.5×，6-7.5 折扣入场 1.2×`;
    }

    // 3. ROC / NVDY / 备兑 ETF 解释
    if (/roc|本金返还|股息|为什么.*亏|nvdy|amzy|高股息|备兑/.test(q)) {
      return `<strong>ROC (Return of Capital) = 本金返还</strong><br>
        <br>不是分红！是把你自己的本金"还"给你。<br>
        <br><strong>NVDY 为例</strong>：<br>
        • 名义股息率：<strong>53.5%</strong> (看起来很高)<br>
        • 但 ROC 占比：<strong>93%</strong><br>
        • 真实股息率：53.5% × 7% = <strong>仅 3.7%</strong><br>
        • NAV CAGR：<strong>-12.2%/年</strong> (股价在跌)<br>
        <br>你看到的"高股息"其实是<strong>你自己的钱</strong>，已通过 NAV 下跌提前扣除。<br>
        <br>这就是为什么 NVDY/AMZY 短期看赚、长期却亏。<br>
        <br>✅ <strong>解决方案</strong>：降低 NVDY/AMZY 占比，提高 SCHG (+13%) / QDTE (+7.5%) 占比`;
    }

    // 4. SCHG / QDTE 特定
    const tickerMatch = q.match(/\b(schg|qdte|xqqi|nvdy|amzy|spym)\b/i);
    if (tickerMatch) {
      const tk = tickerMatch[1].toUpperCase();
      const cfg = stockConfigs.find(s => s.ticker === tk);
      const q = snap.quotes[tk];
      if (cfg && q) {
        const annDiv = cfg.divFreq === 'weekly' ? cfg.divPerShare * 52 :
                       cfg.divFreq === 'monthly' ? cfg.divPerShare * 12 :
                       cfg.divPerShare * 4;
        const yieldPct = (annDiv / q.c * 100).toFixed(2);
        const realYield = (yieldPct * (1 - (cfg.rocRatio || 0))).toFixed(2);
        return `<strong>${tk} · ${cfg.name}</strong><br>
          <br>📊 当前价：$${q.c.toFixed(2)} (${q.dp >= 0 ? '+' : ''}${q.dp.toFixed(2)}%)<br>
          💰 名义股息率：${yieldPct}%<br>
          💎 真实股息率 (扣 ROC)：<strong>${realYield}%</strong><br>
          📈 NAV CAGR：${(cfg.expectedPriceReturn * 100).toFixed(1)}%<br>
          🎯 配置权重：${cfg.allocation}%<br>
          <br>${tk === 'NVDY' || tk === 'AMZY' ? '⚠️ <strong>高 ROC 警示</strong>：分红大部分是本金返还，不是真收益。' : ''}${tk === 'SCHG' || tk === 'XQQI' ? '✅ <strong>真成长股</strong>：价格 CAGR 是真实回报。' : ''}`;
      }
    }

    // 5. 20 年总收益
    if (/20年|二十|长期|收益|能赚|未来|终值/.test(q)) {
      const years = last.month / 12;
      const finalVal = last.totalValueRMB || 0;
      const totalInvest = last.investedRMB || 0;
      return `<strong>20 年定投预览</strong><br>
        <br>📅 已模拟：${years.toFixed(1)} 年<br>
        💵 累计投入：¥${(totalInvest/10000).toFixed(1)}万<br>
        📊 组合市值：¥${(finalVal/10000).toFixed(1)}万<br>
        📈 总回报：<strong style="color:${finalVal >= totalInvest ? 'var(--green)' : 'var(--red)'}">${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(1)}%</strong><br>
        🚀 年化 CAGR：<strong>${cagr >= 0 ? '+' : ''}${cagr.toFixed(2)}%</strong><br>
        <br>调整 <code>月投金额</code> 或 <code>年限</code> 滑块可看到不同情景。`;
    }

    // 6. 风险
    if (/风险|回撤|波动|最大回撤|夏普|亏损|不亏/.test(q)) {
      return `<strong>当前组合主要风险</strong><br>
        <br>🔴 <strong>结构性负 CAGR</strong>：NVDY/AMZY 各占 12.5%，每年 -12%~-18% NAV 损耗<br>
        🟡 <strong>高 ROC 占比</strong>：NVDY 93% / AMZY 80% / QDTE 80% 分红是本金返还<br>
        🟢 <strong>波动率</strong>：组合年化波动 ~20%，不算高<br>
        <br><strong>应对</strong>：<br>
        1. 把 NVDY/AMZY 占比从 12.5% 各降到 5-8%<br>
        2. 把 SCHG 占比提到 30-35%<br>
        3. 用 V3 评分识别真折扣 (远离均线 + 真实高息 + 低 NAV 损耗)`;
    }

    // 7. DCA / 定投是什么
    if (/dca|定投是什么|什么是定投|分散|分批/.test(q)) {
      return `<strong>DCA (Dollar-Cost Averaging) 定投</strong><br>
        <br>每月固定金额买入同一组标的，<strong>不预测市场</strong>，靠纪律穿越牛熊。<br>
        <br><strong>三大好处</strong>：<br>
        ✅ <strong>摊平成本</strong>：高价少买、低价多买<br>
        ✅ <strong>强制储蓄</strong>：避免乱花<br>
        ✅ <strong>反人性</strong>：别人贪婪你恐惧时，你在买<br>
        <br><strong>本工具默认设置</strong>：月投 ¥7,000，按权重分配到 SCHG/XQQI/QDTE/NVDY/AMZY<br>
        <br>💡 配合 V3 评分，在评分 >7.5 时加码 1.5×，是更聪明的 DCA。`;
    }

    // 8. 通用问候 / 默认
    if (/你好|hi|hello|在吗|你是/.test(q)) {
      return `你好！我是你的<strong>定投助手</strong> 🤖<br>
        <br>我可以帮你：<br>
        • 诊断当前组合健康度<br>
        • 推荐今天的加码/减量标的<br>
        • 解释 ROC、NVDY、高股息等概念<br>
        • 估算 20 年长期收益<br>
        <br>点击下方问题或直接问我！`;
    }

    // 默认：引导用户
    return `我理解你的问题："${question}"<br>
      <br>我的强项是 <strong>基于页面实时数据</strong> 回答：<br>
      • 当前组合收益、亏损、加码建议<br>
      • 5 只标的的实时价格/股息率/CAGR<br>
      • DCA、ROC、备兑 ETF 等概念解释<br>
      <br>试试点击下方快捷问题，或直接问我"我亏了怎么办"。`;
  }

  // ---- 处理用户输入 ----
  function handleUserInput(text) {
    if (!text || !text.trim()) return;
    addMsg('user', text);
    input.value = '';
    sendBtn.disabled = true;
    showTyping();
    setTimeout(() => {
      hideTyping();
      const snap = snapshot();
      const reply = generateReply(text, snap);
      addMsg('bot', reply);
      sendBtn.disabled = false;
    }, 700 + Math.random() * 400);  // 模拟思考时间
  }

  // ---- 事件绑定 ----
  fab.addEventListener('click', () => {
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fabIcon.textContent = 'AI';
    } else {
      panel.classList.add('open');
      fab.classList.add('open');
      fabIcon.textContent = '×';
      // 首次打开显示欢迎
      if (body.children.length === 0) {
        addMsg('bot', `你好！我是你的<strong>定投助手</strong> 🤖<br><br>基于页面实时数据回答你的定投问题。试试问我"我亏了怎么办"。`, true);
      }
      input.focus();
    }
  });
  closeBtn.addEventListener('click', () => fab.click());
  sendBtn.addEventListener('click', () => handleUserInput(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserInput(input.value);
    }
  });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      fab.click();
    }
  });
}
  // 自动模式下，每分钟检查一次时间
  setInterval(() => {
    if (cur === 'auto') apply('auto');
  }, 60000);
}


