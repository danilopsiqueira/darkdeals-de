// ============================================
// DarkDeals DE v3.0 — Minimalist App Logic
// ============================================

let allDeals = [];
let filteredDeals = [];
let lastFetchTime = null;

// ---- Apify Cloud Connection ----
const APIFY_TOKEN = atob("YXBpZnlfYXBpX2o3OXZzWWlwMU4zVnlUUWVKTkY2Mm1FdWlzckNPNjFtamNGMg==");
const APIFY_URL = `https://api.apify.com/v2/acts/fRCmGC2SFtITA3Jmf/runs/last/dataset/items?token=${APIFY_TOKEN}`;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    setupListeners();
    fetchDeals();
    setInterval(fetchDeals, 30000); // Auto-refresh 30s
});

function setupListeners() {
    document.getElementById('btn-refresh').addEventListener('click', () => {
        const btn = document.getElementById('btn-refresh');
        btn.classList.add('spinning');
        fetchDeals().then(() => {
            setTimeout(() => btn.classList.remove('spinning'), 500);
        });
    });

    ['filter-profit', 'filter-source', 'filter-sort', 'filter-price'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
}

// ---- Fetch from Apify Cloud ----
async function fetchDeals() {
    try {
        const response = await fetch(`${APIFY_URL}&t=${Date.now()}`);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        if (data.length > 0) {
            allDeals = data.map(enrichDeal);
            lastFetchTime = new Date();
            updateLiveStatus(true, data.length);
            applyFilters();
            showToast('🟢', `${data.length} deals sincronizados da Cloud`);
        } else {
            updateLiveStatus(true, 0);
        }
    } catch (e) {
        console.warn('Fetch error:', e);
        updateLiveStatus(false);
    }
}

// ---- Enrich deal data by parsing AI notes ----
function enrichDeal(deal) {
    const notes = deal.notes || '';

    // Extract estimated PT price from AI verdict
    let ptPrice = 0;
    const ptMatch = notes.match(/StandVirtual[^:]*:\s*~?\s*(\d[\d.,]*)\s*(?:€|EUR)/i);
    if (ptMatch) {
        ptPrice = parseFloat(ptMatch[1].replace('.', '').replace(',', '.'));
    }

    // Extract total cost with legalization
    let totalCost = 0;
    const costMatch = notes.match(/Custo\s*Final[^:]*:\s*~?\s*(\d[\d.,]*)\s*(?:€|EUR)/i);
    if (costMatch) {
        totalCost = parseFloat(costMatch[1].replace('.', '').replace(',', '.'));
    }

    // Extract estimated profit
    let profit = 0;
    const profitMatch = notes.match(/Lucro\s*Estimado[^:]*:\s*~?\s*(\d[\d.,]*)\s*(?:€|EUR)/i);
    if (profitMatch) {
        profit = parseFloat(profitMatch[1].replace('.', '').replace(',', '.'));
    }

    // Fallback calc if AI didn't provide clear numbers
    if (profit === 0 && ptPrice > 0 && deal.price > 0) {
        totalCost = deal.price + 800 + 300 + 500; // Transport + ISV + Repair
        profit = ptPrice - totalCost;
    }
    if (totalCost === 0 && deal.price > 0) {
        totalCost = deal.price + 1600; // Rough total
    }
    if (ptPrice === 0 && profit > 0 && totalCost > 0) {
        ptPrice = totalCost + profit;
    }

    // Extract damage level
    let damage = 'Desconhecido';
    const dmgMatch = notes.match(/Danos?:\s*([^.]+)/i);
    if (dmgMatch) {
        damage = dmgMatch[1].trim().substring(0, 40);
    }

    // ISV Estimation for construction company (benefícios fiscais)
    // Commercial vehicles (N1 category) used by construction companies get reduced ISV
    let isvEstimate = 300; // Base flat estimate
    if (deal.price > 10000) isvEstimate = 450;
    if (deal.price > 12000) isvEstimate = 600;
    // Construction company benefit: commercial vehicles used in business = ISV reduction ~40-60%
    let isvWithBenefit = Math.round(isvEstimate * 0.45); // ~55% reduction for empresa de construção
    let isvSaving = isvEstimate - isvWithBenefit;

    // Detect source for chip styling
    let sourceKey = 'autoscout';
    const notesLow = notes.toLowerCase();
    if (notesLow.includes('mobile.de')) sourceKey = 'mobile';
    else if (notesLow.includes('kleinanzeigen')) sourceKey = 'kleinanzeigen';
    else if (notesLow.includes('auto1') || notesLow.includes('openlane') || notesLow.includes('b2b')) sourceKey = 'b2b';
    else if (notesLow.includes('autoscout')) sourceKey = 'autoscout';

    let sourceLabel = 'AutoScout24';
    if (sourceKey === 'mobile') sourceLabel = 'mobile.de';
    if (sourceKey === 'kleinanzeigen') sourceLabel = 'Kleinanzeigen';
    if (sourceKey === 'b2b') sourceLabel = 'B2B Wholesale';

    return {
        ...deal,
        ptPrice,
        totalCost,
        profit,
        damage,
        isvEstimate,
        isvWithBenefit,
        isvSaving,
        sourceKey,
        sourceLabel,
    };
}

// ---- Filters ----
function applyFilters() {
    const minProfit = parseInt(document.getElementById('filter-profit').value) || 0;
    const sourceFilter = document.getElementById('filter-source').value;
    const sortBy = document.getElementById('filter-sort').value;
    const maxPrice = parseInt(document.getElementById('filter-price').value) || 99999;

    filteredDeals = allDeals.filter(d => {
        if (d.profit < minProfit) return false;
        if (d.price > maxPrice) return false;
        if (sourceFilter !== 'all') {
            if (sourceFilter === 'autoscout' && d.sourceKey !== 'autoscout') return false;
            if (sourceFilter === 'mobile' && d.sourceKey !== 'mobile') return false;
            if (sourceFilter === 'kleinanzeigen' && d.sourceKey !== 'kleinanzeigen') return false;
            if (sourceFilter === 'b2b' && d.sourceKey !== 'b2b') return false;
        }
        return true;
    });

    // Sort
    if (sortBy === 'profit') filteredDeals.sort((a, b) => b.profit - a.profit);
    else if (sortBy === 'price-asc') filteredDeals.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') filteredDeals.sort((a, b) => b.price - a.price);
    else if (sortBy === 'score') filteredDeals.sort((a, b) => (b.score || 0) - (a.score || 0));

    renderDeals();
    updateStats();
}

// ---- Render Deal Cards ----
function renderDeals() {
    const grid = document.getElementById('deals-grid');
    const loading = document.getElementById('loading-state');
    const empty = document.getElementById('empty-state');

    if (loading) loading.remove();

    if (filteredDeals.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    grid.innerHTML = filteredDeals.map((deal, i) => {
        const profitClass = deal.profit >= 3000 ? '' : 'low';
        const accentColor = deal.profit >= 5000 ? 'var(--accent-green)' :
                           deal.profit >= 3000 ? 'var(--accent-gold)' :
                           'var(--accent-blue)';

        // Clean AI notes for display (remove source prefix and emojis)
        let aiNote = (deal.notes || '').replace(/^[^|]*\|\s*/, '').replace(/🤖\s*IA:\s*/i, '').trim();
        if (aiNote.length > 200) aiNote = aiNote.substring(0, 200) + '...';

        return `
            <div class="deal-card" style="--card-accent: ${accentColor}; animation-delay: ${i * 0.04}s">
                <div class="card-header">
                    <span class="vehicle-name">${esc(deal.vehicle)}</span>
                    <span class="source-chip ${deal.sourceKey}">${deal.sourceLabel}</span>
                </div>

                <div class="price-row">
                    <div class="price-box de">
                        <span class="price-label">🇩🇪 Preço Alemanha</span>
                        <span class="price-value">€${fmt(deal.price)}</span>
                    </div>
                    <div class="price-box pt">
                        <span class="price-label">🇵🇹 Mercado PT</span>
                        <span class="price-value">${deal.ptPrice > 0 ? '€' + fmt(deal.ptPrice) : '—'}</span>
                    </div>
                </div>

                <div class="profit-strip ${profitClass}">
                    <div>
                        <span class="profit-label">Lucro Estimado</span>
                        <div style="font-size:0.6rem;color:var(--text-muted);margin-top:2px">
                            ISV c/ benefício construção: €${fmt(deal.isvWithBenefit)}
                            <span style="color:var(--accent-green);font-weight:600">(poupa €${fmt(deal.isvSaving)})</span>
                        </div>
                    </div>
                    <span class="profit-value">${deal.profit > 0 ? '+€' + fmt(deal.profit) : '—'}</span>
                </div>

                <div class="meta-row">
                    <span class="meta-tag">📅 ${deal.year || '—'}</span>
                    <span class="meta-tag">🛣️ ${deal.km > 0 ? fmt(deal.km) + ' km' : '—'}</span>
                    <span class="meta-tag">⛽ ${deal.fuel === 'electric' ? 'Elétrico' : 'Diesel'}</span>
                    <span class="meta-tag">🔧 ${esc(deal.damage)}</span>
                </div>

                ${aiNote ? `<div class="ai-note">🧠 ${esc(aiNote)}</div>` : ''}

                <div class="card-actions">
                    ${deal.link ? `<a href="${esc(deal.link)}" target="_blank" rel="noopener" class="btn btn-primary">🔗 Ver Anúncio</a>` : ''}
                    <button class="btn btn-secondary" onclick="copyDeal('${esc(deal.vehicle)}', ${deal.price}, ${deal.profit})">📋 Copiar</button>
                </div>
            </div>
        `;
    }).join('');
}

// ---- Update Stats ----
function updateStats() {
    const deals = filteredDeals;
    const count = deals.length;
    const profits = deals.map(d => d.profit).filter(p => p > 0);
    const avgProfit = profits.length > 0 ? Math.round(profits.reduce((a, b) => a + b, 0) / profits.length) : 0;
    const bestProfit = profits.length > 0 ? Math.max(...profits) : 0;

    document.querySelector('#stat-deals .stat-number').textContent = count;
    document.querySelector('#stat-profit .stat-number').textContent = avgProfit > 0 ? '€' + fmt(avgProfit) : '—';
    document.querySelector('#stat-best .stat-number').textContent = bestProfit > 0 ? '€' + fmt(bestProfit) : '—';
}

// ---- Live Status ----
function updateLiveStatus(online, count) {
    const badge = document.getElementById('live-badge');
    const text = document.getElementById('live-text');
    const updateEl = document.getElementById('last-update');

    if (online) {
        badge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
        text.textContent = count !== undefined ? `${count} deals · Live` : 'Conectado';
        if (updateEl && lastFetchTime) {
            updateEl.textContent = 'Última sync: ' + lastFetchTime.toLocaleTimeString('pt-PT');
        }
    } else {
        badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        text.textContent = 'Offline';
    }
}

// ---- Utilities ----
function fmt(n) {
    if (typeof n !== 'number' || isNaN(n)) return '0';
    return n.toLocaleString('de-DE');
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(icon, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ---- Copy Deal to Clipboard ----
window.copyDeal = function(vehicle, price, profit) {
    const text = `🚛 ${vehicle}\n💰 Preço DE: €${fmt(price)}\n📈 Lucro Est.: €${fmt(profit)}`;
    navigator.clipboard.writeText(text).then(() => {
        showToast('📋', 'Deal copiado!');
    }).catch(() => {
        showToast('⚠️', 'Não foi possível copiar');
    });
}
