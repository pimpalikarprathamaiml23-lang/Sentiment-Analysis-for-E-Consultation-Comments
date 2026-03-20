/* =============================================
   SIH E-Consultation Sentiment Analyzer
   script.js — All JavaScript Logic
   ============================================= */

// =============================================
// CONFIG — change this to your ngrok URL
// when running backend for mobile access
// =============================================
const API_BASE = 'http://localhost:5000';

// =============================================
// STATE
// =============================================
let history   = [];
let stats     = { total: 0, pos: 0, neg: 0, neu: 0 };
let trendData = [];

// =============================================
// API STATUS CHECK
// =============================================
async function checkAPI() {
  try {
    const r = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3000)
    });
    if (r.ok) {
      document.getElementById('apiDot').classList.add('online');
      document.getElementById('apiStatusText').textContent = 'API Online';
    } else {
      throw new Error('Not OK');
    }
  } catch {
    document.getElementById('apiStatusText').textContent = 'Demo Mode';
  }
}

// =============================================
// DEMO MODE — simulates TF results locally
// used when Flask backend is not running
// =============================================
function simulateSentiment(text) {
  const t = text.toLowerCase();

  const posWords = [
    'good','great','excellent','helpful','amazing','best','support',
    'improve','positive','benefit','love','happy','efficient','clear',
    'appreciate','well','outstanding','commendable','fantastic'
  ];
  const negWords = [
    'bad','poor','terrible','awful','worst','delay','problem','issue',
    'corrupt','fail','wrong','slow','useless','complaint','disappointed',
    'waste','pathetic','disgusting','negligence','failure'
  ];

  let posScore = 0.1, negScore = 0.1;

  posWords.forEach(w => { if (t.includes(w)) posScore += 0.15 + Math.random() * 0.1; });
  negWords.forEach(w => { if (t.includes(w)) negScore += 0.15 + Math.random() * 0.1; });

  posScore = Math.min(posScore + Math.random() * 0.2, 0.99);
  negScore = Math.min(negScore + Math.random() * 0.15, 0.99);

  let neuScore = 1 - posScore - negScore;
  if (neuScore < 0) {
    const total = posScore + negScore;
    posScore /= total;
    negScore /= total;
    neuScore = 0.01;
  }

  const max   = Math.max(posScore, negScore, neuScore);
  const label = max === posScore ? 'POSITIVE'
              : max === negScore ? 'NEGATIVE'
              : 'NEUTRAL';

  // Simple keyword extraction
  const stopwords = new Set([
    'the','is','a','an','and','or','for','to','of','in','this','that',
    'it','was','are','i','we','be','with','on','at','by','has','have',
    'been','not','no','very','will','from','they','their','there','our'
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));
  const keywords = [...new Set(words)].slice(0, 6);

  return {
    sentiment: label,
    confidence: {
      positive: +posScore.toFixed(3),
      negative: +negScore.toFixed(3),
      neutral:  +neuScore.toFixed(3)
    },
    keywords
  };
}

// =============================================
// MAIN ANALYZE FUNCTION
// Tries Flask API first, falls back to demo
// =============================================
async function analyzeSentiment() {
  const text = document.getElementById('commentInput').value.trim();
  if (!text) {
    alert('Please enter a comment to analyze.');
    return;
  }

  const btn     = document.getElementById('analyzeBtn');
  const spinner = document.getElementById('spinner');

  btn.disabled         = true;
  spinner.style.display = 'block';

  let result;
  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
      signal:  AbortSignal.timeout(5000)
    });
    result = await response.json();
  } catch {
    // Demo mode fallback — simulate a delay
    await new Promise(res => setTimeout(res, 800 + Math.random() * 500));
    result = simulateSentiment(text);
  }

  btn.disabled          = false;
  spinner.style.display = 'none';

  showResult(result, text);
  addToHistory(text, result);
  updateStats(result.sentiment);
  drawCharts();
}

// =============================================
// SHOW RESULT PANEL
// =============================================
function showResult(result, text) {
  const panel = document.getElementById('resultPanel');
  panel.classList.add('show');

  const icons = { POSITIVE: '😊', NEGATIVE: '😠', NEUTRAL: '😐' };
  const cls   = result.sentiment.toLowerCase();

  // Sentiment badge
  const badge = document.getElementById('sentimentBadge');
  badge.className = `sentiment-badge ${cls}`;
  badge.innerHTML = `${icons[result.sentiment]} ${result.sentiment}`;

  // Comment preview
  const preview = text.length > 100 ? text.slice(0, 100) + '...' : text;
  document.getElementById('commentPreview').textContent = `"${preview}"`;

  // Confidence bars
  const conf = result.confidence;
  document.getElementById('confBars').innerHTML = `
    ${buildBar('Positive', conf.positive, 'pos')}
    ${buildBar('Negative', conf.negative, 'neg')}
    ${buildBar('Neutral',  conf.neutral,  'neu')}
  `;

  // Animate bars after render
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(b => {
      b.style.width = b.dataset.val;
    });
  }, 50);

  // Keywords
  const kwContainer = document.getElementById('keywords');
  kwContainer.innerHTML = (result.keywords || [])
    .map(k => `<span class="kw">${k}</span>`)
    .join('');
}

// Helper — builds a single confidence bar row
function buildBar(label, val, cls) {
  const pct = (val * 100).toFixed(1) + '%';
  return `
    <div class="bar-label">
      <span>${label}</span>
      <span>${pct}</span>
    </div>
    <div class="bar-track">
      <div class="bar-fill ${cls}" style="width:0" data-val="${pct}"></div>
    </div>
  `;
}

// =============================================
// HISTORY TABLE
// =============================================
function addToHistory(text, result) {
  const icons = { POSITIVE: '😊', NEGATIVE: '😠', NEUTRAL: '😐' };
  const time  = new Date().toLocaleTimeString();

  history.unshift({ text, result, time });

  const chipClass = {
    POSITIVE: 'chip-pos',
    NEGATIVE: 'chip-neg',
    NEUTRAL:  'chip-neu'
  };

  const rows = history.map((h, i) => {
    const shortText   = h.text.length > 60 ? h.text.slice(0, 60) + '...' : h.text;
    const maxConf     = Math.max(
      h.result.confidence.positive,
      h.result.confidence.negative,
      h.result.confidence.neutral
    );
    return `
      <tr>
        <td class="row-num">${history.length - i}</td>
        <td class="row-text">${shortText}</td>
        <td>
          <span class="chip ${chipClass[h.result.sentiment]}">
            ${icons[h.result.sentiment]} ${h.result.sentiment}
          </span>
        </td>
        <td class="row-conf">${(maxConf * 100).toFixed(1)}%</td>
        <td class="row-time">${h.time}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('historyBody').innerHTML = rows;
}

// =============================================
// STATS COUNTERS
// =============================================
function updateStats(sentiment) {
  stats.total++;
  if      (sentiment === 'POSITIVE') stats.pos++;
  else if (sentiment === 'NEGATIVE') stats.neg++;
  else                               stats.neu++;

  // Trend array (keep last 10)
  trendData.push(sentiment === 'POSITIVE' ? 1 : sentiment === 'NEGATIVE' ? -1 : 0);
  if (trendData.length > 10) trendData.shift();

  document.getElementById('totalCount').textContent = stats.total;
  document.getElementById('posCount').textContent   = pct(stats.pos);
  document.getElementById('negCount').textContent   = pct(stats.neg);
  document.getElementById('neuCount').textContent   = pct(stats.neu);
}

function pct(val) {
  return stats.total ? Math.round(val / stats.total * 100) + '%' : '0%';
}

// =============================================
// CHARTS — drawn on <canvas> elements
// =============================================
function drawCharts() {
  drawDonut();
  drawLine();
}

// -- Donut Chart --
function drawDonut() {
  const canvas = document.getElementById('donutChart');
  const ctx    = canvas.getContext('2d');
  canvas.width = 180; canvas.height = 180;
  ctx.clearRect(0, 0, 180, 180);

  const total  = stats.pos + stats.neg + stats.neu || 1;
  const slices = [
    { val: stats.pos / total, color: '#10b981' },
    { val: stats.neg / total, color: '#ef4444' },
    { val: stats.neu / total, color: '#f59e0b' }
  ];

  let startAngle = -Math.PI / 2;
  slices.forEach(s => {
    const angle = s.val * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(90, 90);
    ctx.arc(90, 90, 75, startAngle, startAngle + angle);
    ctx.fillStyle = s.color;
    ctx.fill();
    startAngle += angle;
  });

  // Hollow centre
  ctx.beginPath();
  ctx.arc(90, 90, 45, 0, 2 * Math.PI);
  ctx.fillStyle = '#111827';
  ctx.fill();

  // Centre text
  ctx.fillStyle  = '#e2e8f0';
  ctx.font       = 'bold 18px Syne, sans-serif';
  ctx.textAlign  = 'center';
  ctx.fillText(stats.total, 90, 94);
  ctx.font       = '10px Space Mono, monospace';
  ctx.fillStyle  = '#64748b';
  ctx.fillText('TOTAL', 90, 110);
}

// -- Line / Trend Chart --
function drawLine() {
  const canvas = document.getElementById('lineChart');
  const ctx    = canvas.getContext('2d');
  canvas.width = 300; canvas.height = 180;
  ctx.clearRect(0, 0, 300, 180);

  if (trendData.length < 2) {
    ctx.fillStyle = '#64748b';
    ctx.font      = '11px Space Mono';
    ctx.textAlign = 'center';
    ctx.fillText('Add more comments to see trend', 150, 90);
    return;
  }

  const pts = trendData.map((v, i) => ({
    x: 20 + i * (260 / (trendData.length - 1)),
    y: 90 - v * 60
  }));

  // Gridlines
  ctx.strokeStyle = 'rgba(42,58,85,0.5)';
  ctx.lineWidth   = 1;
  [30, 90, 150].forEach(y => {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(280, y);
    ctx.stroke();
  });

  // Gradient line
  const grad = ctx.createLinearGradient(0, 0, 300, 0);
  grad.addColorStop(0, '#00d4ff');
  grad.addColorStop(1, '#7c3aed');
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Data point dots
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#00d4ff';
    ctx.fill();
  });

  // Axis labels
  ctx.fillStyle = '#64748b';
  ctx.font      = '9px Space Mono';
  ctx.textAlign = 'center';
  ctx.fillText('↑ Positive', 150, 22);
  ctx.fillText('Neutral',    150, 94);
  ctx.fillText('↓ Negative', 150, 165);
}

// =============================================
// CSV BULK UPLOAD
// =============================================
function toggleBulk() {
  const zone = document.getElementById('uploadZone');
  zone.classList.toggle('show');
}

async function handleCSV(input) {
  const file = input.files[0];
  if (!file) return;

  const rawText = await file.text();
  const lines   = rawText.split('\n').filter(Boolean);
  const headers = lines[0].toLowerCase().split(',');
  const colIdx  = headers.findIndex(h => h.includes('comment'));

  if (colIdx < 0) {
    alert('CSV must have a "comment" column in the header row.');
    return;
  }

  const comments = lines
    .slice(1)
    .map(line => line.split(',')[colIdx]?.replace(/"/g, '').trim())
    .filter(Boolean);

  for (const comment of comments) {
    document.getElementById('commentInput').value = comment;
    await new Promise(res => setTimeout(res, 300));
    await analyzeSentiment();
  }

  alert(`✅ Done! Analyzed ${comments.length} comments from CSV.`);
}

// =============================================
// UTILS
// =============================================
function clearInput() {
  document.getElementById('commentInput').value = '';
  document.getElementById('resultPanel').classList.remove('show');
}

// =============================================
// INIT — runs on page load
// =============================================
checkAPI();
drawCharts();
