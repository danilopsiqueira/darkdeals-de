// ============================
// DarkDeals DE — Application Logic
// ============================

// ---- Data: Platform Sources ----
const PLATFORMS = [
  // Mainstream
  {
    id: 'mobile_de',
    name: 'mobile.de',
    domain: 'mobile.de',
    icon: '🚗',
    category: 'mainstream',
    categoryLabel: 'Marketplace',
    darkSource: false,
    description: 'O maior marketplace de veículos da Alemanha. Mais de 1.4 milhões de anúncios ativos.',
    buildUrl: (f) => {
      // mobile.de uses specific category IDs, Transporter = cat:Van
      const params = new URLSearchParams({
        'dam': '0', // not damaged
        'fr': f.yearFrom + ':',
        'ml': ':' + f.kmMax,
        'ms': '', // all makes
        'vc': 'Van', // Vehicle class = Van/Transporter
        'cn': 'DE',
        'pe': (f.fuel === 'all') ? '' : (f.fuel === 'diesel' ? '3' : '5'), // 3=Diesel, 5=Electric
        'sfmr': 'false'
      });
      return `https://suchen.mobile.de/fahrzeuge/search.html?${params.toString()}`;
    }
  },
  {
    id: 'autoscout24',
    name: 'AutoScout24',
    domain: 'autoscout24.de',
    icon: '🔍',
    category: 'mainstream',
    categoryLabel: 'Marketplace',
    darkSource: false,
    description: 'Segundo maior marketplace europeu. Excelente para comparar preços entre dealers.',
    buildUrl: (f) => {
      const fuelMap = { diesel: 'D', electric: 'E', all: '' };
      const params = new URLSearchParams({
        'atype': 'C', // Cars
        'body': '6', // Van/Minibus
        'cy': 'D', // Germany
        'damaged_listing': 'exclude',
        'fregfrom': f.yearFrom,
        'kmto': f.kmMax,
        'fuel': fuelMap[f.fuel] || '',
        'sort': 'standard',
        'desc': '0',
        'ustate': 'N,U', // New and Used
      });
      return `https://www.autoscout24.de/lst/?${params.toString()}`;
    }
  },

  // Leasing Returns
  {
    id: 'leasingmarkt',
    name: 'LeasingMarkt',
    domain: 'leasingmarkt.de',
    icon: '🏷️',
    category: 'leasing',
    categoryLabel: 'Leasing Return',
    darkSource: true,
    description: 'Devoluções de leasing e takeovers. Veículos com manutenção completa a preços 20-30% abaixo do mercado.',
    buildUrl: (f) => {
      return `https://www.leasingmarkt.de/leasing/transporter`;
    }
  },
  {
    id: 'vehiculum',
    name: 'Vehiculum',
    domain: 'vehiculum.de',
    icon: '📋',
    category: 'leasing',
    categoryLabel: 'Leasing Return',
    darkSource: true,
    description: 'Plataforma de leasing com returns e ofertas especiais. Inclui veículos pré-configurados com desconto.',
    buildUrl: (f) => {
      return `https://www.vehiculum.de/transporter-leasing`;
    }
  },

  // Fleet / Rental
  {
    id: 'sixt',
    name: 'Sixt Neuwagen',
    domain: 'sixt-neuwagen.de',
    icon: '🚐',
    category: 'rental',
    categoryLabel: 'Ex-Rental',
    darkSource: true,
    description: 'Veículos ex-frota Sixt. Bem mantidos, baixa quilometragem, preços competitivos.',
    buildUrl: (f) => {
      return `https://www.sixt-neuwagen.de/gebrauchtwagen/transporter`;
    }
  },
  {
    id: 'europcar',
    name: 'Europcar Gebrauchtwagen',
    domain: 'europcar-gebrauchtwagen.de',
    icon: '🟢',
    category: 'rental',
    categoryLabel: 'Ex-Rental',
    darkSource: true,
    description: 'Frota Europcar descartada. Normalmente com full service history e km moderados.',
    buildUrl: (f) => {
      return `https://gebrauchtwagen.europcar.de/de/gebrauchtwagen`;
    }
  },

  // Auctions
  {
    id: 'autorola',
    name: 'Autorola',
    domain: 'autorola.de',
    icon: '🔨',
    category: 'auction',
    categoryLabel: 'Leilão B2B',
    darkSource: true,
    description: 'Leilões online B2B. Veículos de frotas empresariais a preços de wholesale. Podem ter acesso público.',
    buildUrl: (f) => {
      return `https://www.autorola.de/`;
    }
  },
  {
    id: 'bca',
    name: 'BCA Europe',
    domain: 'bca-europe.com',
    icon: '⚡',
    category: 'auction',
    categoryLabel: 'Leilão',
    darkSource: true,
    description: 'O maior leilão de veículos da Europa. Frotas corporativas, leasing returns, trade-ins.',
    buildUrl: (f) => {
      return `https://www.bca-europe.com/de/fahrzeuge-kaufen`;
    }
  },
  {
    id: 'vebeg',
    name: 'VEBEG',
    domain: 'vebeg.de',
    icon: '🏛️',
    category: 'auction',
    categoryLabel: 'Leilão Gov.',
    darkSource: true,
    description: 'Leilões governamentais e militares alemães. Veículos únicos a preços muito baixos. Fonte ultra-rara!',
    buildUrl: (f) => {
      return `https://www.vebeg.de/web/de/verkauf/suchen.htm`;
    }
  },

  // Certified Manufacturer
  {
    id: 'dasweltauto',
    name: 'Das WeltAuto',
    domain: 'dasweltauto.de',
    icon: '🔵',
    category: 'certified',
    categoryLabel: 'Certificado VW',
    darkSource: false,
    description: 'Usados certificados do grupo VW (VW Transporter, Caddy, Crafter). Garantia de fábrica incluída.',
    buildUrl: (f) => {
      const params = new URLSearchParams({
        'BodyType': 'Van',
        'FirstRegistrationFrom': f.yearFrom + '-01',
        'MileageTo': f.kmMax,
        'FuelType': f.fuel === 'all' ? '' : (f.fuel === 'diesel' ? 'Diesel' : 'Electric'),
      });
      return `https://www.dasweltauto.de/de/suche?${params.toString()}`;
    }
  },
  {
    id: 'mercedes',
    name: 'Mercedes Gebrauchtwagen',
    domain: 'mercedes-benz.de',
    icon: '⭐',
    category: 'certified',
    categoryLabel: 'Certificado MB',
    darkSource: false,
    description: 'Mercedes-Benz Sprinter, Vito, Citan usados certificados. Qualidade premium com garantia.',
    buildUrl: (f) => {
      return `https://www.mercedes-benz.de/passengercars/buy/used-search.html?q=%3Abodytype%3AVAN%3Amileage%3A0-${f.kmMax}%3Ayear%3A${f.yearFrom}-2026%3Afueltype%3A${f.fuel === 'diesel' ? 'DIESEL' : 'ELECTRIC'}`;
    }
  },
  {
    id: 'ford',
    name: 'Ford Gebrauchtwagen',
    domain: 'ford.de',
    icon: '🔷',
    category: 'certified',
    categoryLabel: 'Certificado Ford',
    darkSource: false,
    description: 'Ford Transit, Transit Custom, Transit Connect usados. A carrinha comercial mais vendida na Europa.',
    buildUrl: (f) => {
      return `https://www.ford.de/kaufberatung/gebrauchtwagen`;
    }
  },

  // Alternative / Lesser known
  {
    id: 'heycar',
    name: 'Heycar',
    domain: 'heycar.com',
    icon: '💎',
    category: 'alternative',
    categoryLabel: 'Agregador',
    darkSource: true,
    description: 'Agregador de dealers premium. Veículos verificados com garantia. Menos concorrência que mobile.de.',
    buildUrl: (f) => {
      const params = new URLSearchParams({
        'bodyTypes': 'van',
        'firstRegistration': f.yearFrom + '-01',
        'mileageTo': f.kmMax,
        'fuelTypes': f.fuel === 'all' ? '' : f.fuel,
      });
      return `https://www.heycar.com/de/gebrauchtwagen?${params.toString()}`;
    }
  },
  {
    id: 'pkw',
    name: 'PKW.de',
    domain: 'pkw.de',
    icon: '🟠',
    category: 'alternative',
    categoryLabel: 'Alternativo',
    darkSource: true,
    description: 'Marketplace alternativo com menos tráfego. Dealers colocam anúncios aqui que não estão nos grandes.',
    buildUrl: (f) => {
      return `https://www.pkw.de/gebrauchtwagen/transporter`;
    }
  },
  {
    id: 'instamotion',
    name: 'Instamotion',
    domain: 'instamotion.com',
    icon: '🔶',
    category: 'alternative',
    categoryLabel: 'Online Dealer',
    darkSource: true,
    description: 'Compra online com entrega. Veículos inspecionados, devoluções aceites. Preços transparentes.',
    buildUrl: (f) => {
      return `https://www.instamotion.com/gebrauchtwagen/transporter`;
    }
  },
  {
    id: 'autouncle',
    name: 'AutoUncle',
    domain: 'autouncle.de',
    icon: '📊',
    category: 'alternative',
    categoryLabel: 'Comparador',
    darkSource: true,
    description: 'Comparador de preços que classifica cada anúncio como "bom preço" ou "caro". Ótimo para validar.',
    buildUrl: (f) => {
      return `https://www.autouncle.de/de/gebrauchtwagen/lieferwagen?min_year=${f.yearFrom}&max_km=${f.kmMax}`;
    }
  }
];

const CATEGORIES = [
  { id: 'mainstream', name: 'Marketplaces Principais', icon: '🔍', badge: 'mainstream', desc: 'Os maiores portais da Alemanha' },
  { id: 'leasing', name: 'Devoluções de Leasing', icon: '🏷️', badge: 'dark', desc: 'Fonte "Dark" — Preços 20-30% abaixo' },
  { id: 'rental', name: 'Frotas & Ex-Rental', icon: '🚐', badge: 'rental', desc: 'Fonte "Dark" — Ex-frotas com full service' },
  { id: 'auction', name: 'Leilões & Wholesale', icon: '🔨', badge: 'auction', desc: 'Fonte "Dark" — Preços de wholesale' },
  { id: 'certified', name: 'Usados Certificados', icon: '🏭', badge: 'certified', desc: 'Garantia de fábrica incluída' },
  { id: 'alternative', name: 'Plataformas Alternativas', icon: '💎', badge: 'alternative', desc: 'Fonte "Dark" — Menos concorrência' },
];

// ---- State ----
let currentFilters = {
  yearFrom: 2020,
  kmMax: 150000,
  fuel: 'all',
  vehicleType: 'transporter'
};

let savedDeals = [];
let radarDeals = [];
let activeTab = 'sources';
let lastRadarCount = 0;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadSavedDeals();
  renderAll();
  setupEventListeners();
  
  // Iniciar Radar fetch loop
  fetchRadarDeals();
  setInterval(fetchRadarDeals, 15000); // refresh 15s
});

function renderAll() {
  renderStats();
  renderPlatforms();
  renderDeals();
  renderAnalysis();
  updateNavCounts();
}

// ---- Event Listeners ----
function setupEventListeners() {
  // Nav tabs
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Filters
  document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);

  // Deal form
  document.getElementById('form-add-deal').addEventListener('submit', handleAddDeal);

  // Export
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-clear-all').addEventListener('click', clearAllDeals);
}

// ---- Tabs ----
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tab}`);
  });
}

// ---- Filters ----
function applyFilters() {
  currentFilters.yearFrom = parseInt(document.getElementById('filter-year').value) || 2020;
  currentFilters.kmMax = parseInt(document.getElementById('filter-km').value) || 150000;
  currentFilters.fuel = document.getElementById('filter-fuel').value;
  currentFilters.vehicleType = document.getElementById('filter-type').value;
  
  renderPlatforms();
  showToast('✅', 'Filtros atualizados! Links regenerados.', 'success');
}

// ---- Stats ----
function renderStats() {
  const totalPlatforms = PLATFORMS.length;
  const darkSources = PLATFORMS.filter(p => p.darkSource).length;
  const totalDeals = savedDeals.length;
  const avgScore = totalDeals > 0 
    ? Math.round(savedDeals.reduce((sum, d) => sum + (d.score || 0), 0) / totalDeals) 
    : 0;

  document.getElementById('stat-platforms').textContent = totalPlatforms;
  document.getElementById('stat-dark').textContent = darkSources;
  document.getElementById('stat-deals').textContent = totalDeals;
  document.getElementById('stat-score').textContent = avgScore > 0 ? avgScore + '/100' : '—';
}

// ---- Platform Cards ----
function renderPlatforms() {
  const container = document.getElementById('platforms-container');
  container.innerHTML = '';

  CATEGORIES.forEach(cat => {
    const platforms = PLATFORMS.filter(p => p.category === cat.id);
    if (platforms.length === 0) return;

    const section = document.createElement('div');
    section.className = 'category-section';
    section.innerHTML = `
      <div class="category-header">
        <span class="icon">${cat.icon}</span>
        <h3>${cat.name}</h3>
        <span class="category-badge ${cat.badge}">${platforms.filter(p => p.darkSource).length > 0 ? '🕵️ Dark Source' : '📌 Standard'}</span>
        <span class="cat-desc">${cat.desc}</span>
      </div>
      <div class="platforms-grid" id="grid-${cat.id}"></div>
    `;
    container.appendChild(section);

    const grid = section.querySelector(`#grid-${cat.id}`);
    platforms.forEach((platform, index) => {
      const url = platform.buildUrl(currentFilters);
      const card = document.createElement('a');
      card.href = url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'platform-card card-animate';
      card.style.setProperty('--card-accent', getCategoryColor(cat.id));
      card.style.animationDelay = `${index * 0.05}s`;
      
      const iconBg = getCategoryBgColor(cat.id);
      
      card.innerHTML = `
        <div class="card-top">
          <div class="card-name">
            <span class="platform-icon" style="background:${iconBg}">${platform.icon}</span>
            <div>
              <h4>${platform.name}</h4>
              <span class="domain">${platform.domain}</span>
            </div>
          </div>
          <span class="card-tag ${platform.darkSource ? 'dark-source' : 'normal'}">
            ${platform.darkSource ? '🕵️ Dark' : platform.categoryLabel}
          </span>
        </div>
        <p class="card-description">${platform.description}</p>
        <div class="card-action">
          <span>Pesquisar ${currentFilters.vehicleType === 'transporter' ? 'Transporters' : 'Veículos'}</span>
          <span class="arrow">→</span>
        </div>
      `;
      grid.appendChild(card);
    });
  });
}

function getCategoryColor(catId) {
  const colors = {
    mainstream: 'var(--accent-blue)',
    leasing: 'var(--accent-gold)',
    rental: 'var(--accent-cyan)',
    auction: 'var(--accent-red)',
    certified: 'var(--accent-green)',
    alternative: 'var(--accent-purple)',
  };
  return colors[catId] || 'var(--accent-green)';
}

function getCategoryBgColor(catId) {
  const colors = {
    mainstream: 'rgba(59,130,246,0.15)',
    leasing: 'rgba(245,158,11,0.15)',
    rental: 'rgba(6,182,212,0.15)',
    auction: 'rgba(239,68,68,0.15)',
    certified: 'rgba(16,185,129,0.15)',
    alternative: 'rgba(139,92,246,0.15)',
  };
  return colors[catId] || 'rgba(16,185,129,0.15)';
}

// ---- Deal Tracker ----
function handleAddDeal(e) {
  e.preventDefault();
  const form = e.target;
  
  const deal = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    vehicle: form.querySelector('#deal-vehicle').value,
    price: parseFloat(form.querySelector('#deal-price').value) || 0,
    km: parseInt(form.querySelector('#deal-km').value) || 0,
    year: parseInt(form.querySelector('#deal-year').value) || 2020,
    fuel: form.querySelector('#deal-fuel').value,
    source: form.querySelector('#deal-source').value,
    link: form.querySelector('#deal-link').value,
    notes: form.querySelector('#deal-notes').value,
    addedAt: new Date().toISOString(),
  };

  // Calculate score
  deal.score = calculateDealScore(deal);

  savedDeals.push(deal);
  saveDealsToDisk();
  renderDeals();
  renderStats();
  renderAnalysis();
  updateNavCounts();
  form.reset();
  showToast('🎯', `"${deal.vehicle}" adicionado ao tracker!`, 'success');
}

function calculateDealScore(deal) {
  let score = 50; // base

  // Price scoring (lower = better, estimated fair value for commercial vans 2020+)
  const fairPrice = 25000; // rough average for 2020+ transporter
  if (deal.price > 0) {
    const priceRatio = deal.price / fairPrice;
    if (priceRatio < 0.6) score += 30;
    else if (priceRatio < 0.75) score += 22;
    else if (priceRatio < 0.9) score += 15;
    else if (priceRatio < 1.0) score += 8;
    else if (priceRatio < 1.15) score += 0;
    else score -= 10;
  }

  // KM scoring
  if (deal.km < 30000) score += 15;
  else if (deal.km < 60000) score += 10;
  else if (deal.km < 100000) score += 5;
  else if (deal.km < 130000) score += 0;
  else score -= 5;

  // Year scoring
  const age = 2026 - deal.year;
  if (age <= 1) score += 10;
  else if (age <= 2) score += 7;
  else if (age <= 3) score += 4;
  else if (age <= 4) score += 2;

  // Dark source bonus
  const darkSources = ['leasing', 'rental', 'auction', 'trade-in'];
  if (darkSources.includes(deal.source)) score += 5;

  return Math.max(0, Math.min(100, score));
}

function getScoreClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  return 'poor';
}

function getScoreLabel(score) {
  if (score >= 80) return '🔥 Excellent';
  if (score >= 60) return '👍 Good';
  if (score >= 40) return '➡️ Average';
  return '⚠️ Poor';
}

function renderDeals() {
  const tbody = document.getElementById('deals-tbody');
  if (!tbody) return;

  if (savedDeals.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h4>Nenhum deal guardado</h4>
            <p>Pesquise nas plataformas acima e adicione os melhores deals aqui para comparar.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort by score descending
  const sorted = [...savedDeals].sort((a, b) => (b.score || 0) - (a.score || 0));

  tbody.innerHTML = sorted.map(deal => {
    const sourceClass = getSourceBadgeClass(deal.source);
    const scoreClass = getScoreClass(deal.score || 0);
    return `
      <tr>
        <td>
          <strong>${escapeHtml(deal.vehicle)}</strong>
          ${deal.notes ? `<br><small style="color:var(--text-muted)">${escapeHtml(deal.notes)}</small>` : ''}
        </td>
        <td><strong>€${deal.price.toLocaleString('de-DE')}</strong></td>
        <td>${deal.km.toLocaleString('de-DE')} km</td>
        <td>${deal.year}</td>
        <td>${deal.fuel === 'diesel' ? '⛽ Diesel' : '⚡ Elétrico'}</td>
        <td><span class="source-badge ${sourceClass}">${getSourceLabel(deal.source)}</span></td>
        <td><span class="score-badge ${scoreClass}">${getScoreLabel(deal.score || 0)}</span></td>
        <td>
          ${deal.link ? `<a href="${escapeHtml(deal.link)}" target="_blank" rel="noopener" class="deal-link">🔗 Ver</a>` : '—'}
          <button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="removeDeal('${deal.id}')">✕</button>
        </td>
      </tr>
    `;
  }).join('');
}

function getSourceBadgeClass(source) {
  const map = {
    'leasing': 'leasing',
    'rental': 'rental',
    'auction': 'auction',
    'certified': 'certified',
    'marketplace': 'marketplace',
    'trade-in': 'trade-in',
  };
  return map[source] || 'marketplace';
}

function getSourceLabel(source) {
  const labels = {
    'leasing': '🏷️ Leasing Return',
    'rental': '🚐 Ex-Rental',
    'auction': '🔨 Leilão',
    'certified': '✅ Certificado',
    'marketplace': '🔍 Marketplace',
    'trade-in': '🔄 Trade-In',
  };
  return labels[source] || source;
}

function removeDeal(id) {
  savedDeals = savedDeals.filter(d => d.id !== id);
  saveDealsToDisk();
  renderDeals();
  renderStats();
  renderAnalysis();
  updateNavCounts();
  showToast('🗑️', 'Deal removido.', 'warning');
}

function clearAllDeals() {
  if (savedDeals.length === 0) return;
  if (!confirm('Tem certeza que deseja apagar todos os deals guardados?')) return;
  savedDeals = [];
  saveDealsToDisk();
  renderDeals();
  renderStats();
  renderAnalysis();
  updateNavCounts();
  showToast('🗑️', 'Todos os deals foram apagados.', 'warning');
}

// ---- Analysis ----
function renderAnalysis() {
  const container = document.getElementById('analysis-content');
  if (!container) return;

  if (savedDeals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h4>Sem dados para análise</h4>
        <p>Adicione deals no tracker para ver comparações e análises de preço.</p>
      </div>
    `;
    return;
  }

  const prices = savedDeals.map(d => d.price).filter(p => p > 0);
  const kms = savedDeals.map(d => d.km).filter(k => k > 0);
  const avgPrice = prices.length > 0 ? prices.reduce((a,b) => a+b, 0) / prices.length : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const avgKm = kms.length > 0 ? kms.reduce((a,b) => a+b, 0) / kms.length : 0;

  const bySource = {};
  savedDeals.forEach(d => {
    if (!bySource[d.source]) bySource[d.source] = [];
    bySource[d.source].push(d);
  });

  const bestDeal = [...savedDeals].sort((a,b) => (b.score||0) - (a.score||0))[0];

  container.innerHTML = `
    <div class="analysis-grid">
      <div class="analysis-card">
        <h3>💰 Análise de Preço</h3>
        <div class="price-bar">
          <div class="price-bar-header">
            <span class="label">Preço Mínimo</span>
            <span class="value">€${minPrice.toLocaleString('de-DE')}</span>
          </div>
          <div class="price-bar-track">
            <div class="price-bar-fill green" style="width:${maxPrice > 0 ? (minPrice/maxPrice*100) : 0}%"></div>
          </div>
        </div>
        <div class="price-bar">
          <div class="price-bar-header">
            <span class="label">Preço Médio</span>
            <span class="value">€${Math.round(avgPrice).toLocaleString('de-DE')}</span>
          </div>
          <div class="price-bar-track">
            <div class="price-bar-fill gold" style="width:${maxPrice > 0 ? (avgPrice/maxPrice*100) : 0}%"></div>
          </div>
        </div>
        <div class="price-bar">
          <div class="price-bar-header">
            <span class="label">Preço Máximo</span>
            <span class="value">€${maxPrice.toLocaleString('de-DE')}</span>
          </div>
          <div class="price-bar-track">
            <div class="price-bar-fill red" style="width:100%"></div>
          </div>
        </div>
        <div class="price-bar" style="margin-top:1rem">
          <div class="price-bar-header">
            <span class="label">Quilometragem Média</span>
            <span class="value">${Math.round(avgKm).toLocaleString('de-DE')} km</span>
          </div>
          <div class="price-bar-track">
            <div class="price-bar-fill blue" style="width:${(avgKm/150000*100)}%"></div>
          </div>
        </div>
      </div>

      <div class="analysis-card">
        <h3>🏆 Melhor Deal</h3>
        ${bestDeal ? `
          <div style="padding:1rem;background:rgba(16,185,129,0.08);border-radius:var(--radius-md);border:1px solid rgba(16,185,129,0.2);margin-bottom:1rem">
            <h4 style="color:var(--accent-green);font-size:1.1rem">${escapeHtml(bestDeal.vehicle)}</h4>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-top:0.25rem">
              €${bestDeal.price.toLocaleString('de-DE')} · ${bestDeal.km.toLocaleString('de-DE')} km · ${bestDeal.year}
            </p>
            <span class="score-badge ${getScoreClass(bestDeal.score)}" style="margin-top:0.5rem">
              Score: ${bestDeal.score}/100
            </span>
          </div>
        ` : ''}
        
        <h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem">Por Fonte:</h4>
        ${Object.entries(bySource).map(([source, deals]) => `
          <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border-subtle)">
            <span class="source-badge ${getSourceBadgeClass(source)}">${getSourceLabel(source)}</span>
            <span style="font-size:0.85rem;color:var(--text-secondary)">${deals.length} deal${deals.length>1?'s':''} · Avg €${Math.round(deals.reduce((s,d)=>s+d.price,0)/deals.length).toLocaleString('de-DE')}</span>
          </div>
        `).join('')}
      </div>

      <div class="analysis-card" style="grid-column: 1 / -1">
        <h3>💡 Dicas de Pesquisa "Dark"</h3>
        <ul class="tips-list">
          <li><span class="tip-icon">🕵️</span> <strong>Leasing Returns:</strong> Veículos devolvidos no fim do leasing normalmente têm manutenção completa e estão 20-30% abaixo do preço de mercado. Procure em LeasingMarkt e Vehiculum.</li>
          <li><span class="tip-icon">🚐</span> <strong>Ex-Rental:</strong> Sixt e Europcar vendem frotas com 1-2 anos. Alto km mas com full service history e preços muito competitivos.</li>
          <li><span class="tip-icon">🔨</span> <strong>Leilões:</strong> Autorola e BCA têm veículos de frotas corporativas. Registe-se para acesso. VEBEG tem leilões do governo alemão — fonte ultra-rara!</li>
          <li><span class="tip-icon">🔄</span> <strong>Trade-In:</strong> Quando um cliente troca o carro, o dealer pode ter a carrinha a um preço baixo. Pergunte diretamente a concessionários se têm trade-ins não publicados.</li>
          <li><span class="tip-icon">📊</span> <strong>AutoUncle:</strong> Use para validar se um preço é justo. Classifica automaticamente cada anúncio como "bom preço" ou "caro" vs. mercado.</li>
          <li><span class="tip-icon">💎</span> <strong>Timing:</strong> Os melhores deals aparecem ao final do mês/trimestre quando dealers precisam cumprir objetivos. Janeiro e Setembro são meses fortes.</li>
        </ul>
      </div>
    </div>
  `;
}

// ---- Nav Counts ----
function updateNavCounts() {
  const countEl = document.getElementById('nav-deals-count');
  if (countEl) {
    countEl.textContent = savedDeals.length;
    countEl.style.display = savedDeals.length > 0 ? 'inline' : 'none';
  }
}

// ---- Persistence ----
function saveDealsToDisk() {
  localStorage.setItem('darkdeals_de_deals', JSON.stringify(savedDeals));
  localStorage.setItem('darkdeals_de_filters', JSON.stringify(currentFilters));
}

function loadSavedDeals() {
  try {
    const deals = localStorage.getItem('darkdeals_de_deals');
    if (deals) savedDeals = JSON.parse(deals);
    const filters = localStorage.getItem('darkdeals_de_filters');
    if (filters) {
      currentFilters = { ...currentFilters, ...JSON.parse(filters) };
      // Sync UI
      setTimeout(() => {
        const yearEl = document.getElementById('filter-year');
        const kmEl = document.getElementById('filter-km');
        const fuelEl = document.getElementById('filter-fuel');
        const typeEl = document.getElementById('filter-type');
        if (yearEl) yearEl.value = currentFilters.yearFrom;
        if (kmEl) kmEl.value = currentFilters.kmMax;
        if (fuelEl) fuelEl.value = currentFilters.fuel;
        if (typeEl) typeEl.value = currentFilters.vehicleType;
      }, 0);
    }
  } catch (e) {
    console.warn('Could not load saved data:', e);
  }
}

// ---- Export CSV ----
function exportCSV() {
  if (savedDeals.length === 0) {
    showToast('⚠️', 'Nenhum deal para exportar.', 'warning');
    return;
  }

  const headers = ['Veículo', 'Preço (€)', 'Quilómetros', 'Ano', 'Combustível', 'Fonte', 'Score', 'Link', 'Notas', 'Data'];
  const rows = savedDeals.map(d => [
    d.vehicle,
    d.price,
    d.km,
    d.year,
    d.fuel,
    d.source,
    d.score,
    d.link,
    d.notes,
    new Date(d.addedAt).toLocaleDateString('pt-PT')
  ]);

  const csv = [headers.join(';'), ...rows.map(r => r.map(v => `"${v}"`).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `darkdeals_de_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥', `${savedDeals.length} deals exportados para CSV!`, 'success');
}

// ---- Toast ----
function showToast(icon, message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icon}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Utils ----
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Radar Logic ----
async function fetchRadarDeals() {
  try {
    statusEl.innerHTML = '<span class="status-dot"></span> Sincronizado com Apify Cloud (Live)';
        
    // Ponto de ligação com a Nuvem (Fase 5 API Sync)
    const vaultKey = atob("YXBpZnlfYXBpX2o3OXZzWWlwMU4zVnlUUWVKTkY2Mm1FdWlzckNPNjFtamNGMg==");
    const response = await fetch(`https://api.apify.com/v2/acts/fRCmGC2SFtITA3Jmf/runs/last/dataset/items?token=${vaultKey}`, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
    
    if (!response.ok) throw new Error('Falha API Nuvem');
    const deals = await response.json();
    if (JSON.stringify(deals) !== JSON.stringify(radarDeals)) {
      const newCount = deals.length - radarDeals.length;
      radarDeals = deals;
      renderRadarDeals();
      
      if (newCount > 0 && lastRadarCount > 0) {
        showToast('🚨', `Radar encontrou ${newCount} novo(s) deal(s)!`, 'warning');
      }
      lastRadarCount = deals.length;
      
      const countEl = document.getElementById('nav-radar-count');
      if (countEl) {
        countEl.textContent = radarDeals.length;
        countEl.style.display = radarDeals.length > 0 ? 'inline' : 'none';
      }
    }
  } catch (e) {
    console.log('Radar still waiting for data...', e);
  }
}

function renderRadarDeals() {
  const tbody = document.getElementById('radar-tbody');
  if (!tbody) return;

  if (radarDeals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Monitorizando aguardar novos deals...</td></tr>';
    return;
  }

  tbody.innerHTML = radarDeals.map(deal => {
    const scoreClass = getScoreClass(deal.score || 0);
    return `
      <tr style="background: rgba(239, 68, 68, 0.05)">
        <td>
          <strong>${escapeHtml(deal.vehicle)}</strong>
          <br><small style="color:var(--accent-red)">${escapeHtml(deal.notes)}</small>
        </td>
        <td><strong>€${deal.price.toLocaleString('de-DE')}</strong></td>
        <td>${deal.km.toLocaleString('de-DE')} km</td>
        <td>${deal.year}</td>
        <td><span class="score-badge ${scoreClass}">${getScoreLabel(deal.score || 0)}</span></td>
        <td>
          <a href="${escapeHtml(deal.link)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">🔗 Ver no AutoScout24</a>
          <button class="btn btn-secondary btn-sm" onclick="saveRadarDeal('${deal.id}')" style="margin-left:6px">Salvar</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.saveRadarDeal = function(id) {
  const deal = radarDeals.find(d => d.id === id);
  if (!deal) return;
  
  if (!savedDeals.some(d => d.id === deal.id)) {
    savedDeals.push(deal);
    saveDealsToDisk();
    renderDeals();
    renderStats();
    renderAnalysis();
    updateNavCounts();
    showToast('🎯', 'Deal do Radar movido para o Tracker!', 'success');
  } else {
    showToast('⚠️', 'Este deal já está no tracker.', 'warning');
  }
}
