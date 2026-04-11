/* ═══════════════════════════════════════
   NOVAA — script.js (versi API)
   STORE sekarang di-fetch dari Google Apps Script
═══════════════════════════════════════ */

// ── CONFIG ──────────────────────────────────────────────────────
// Ganti dengan URL deploy Google Apps Script kamu
const API_URL   = 'https://script.google.com/macros/s/AKfycbwCUlWJJMOXG3nUsYRwUQIFqc-eOkGMGFZBtAjTQkyv2tcP6cnMAg2BytBlj3aCAbBG/exec';
const API_TOKEN = 'alifmm993';   // sama dengan SECRET_TOKEN di Code.gs (kosong = nonaktif)

// ── FOLDERS (tidak berubah) ──────────────────────────────────────
const FOLDERS = [
  {id:'f1',  code:'123',  name:'Outfit Kece Cewe',        emoji:'👗', count:0},
  {id:'f2',  code:'124',  name:'Skincare Murah Meriah',    emoji:'✨', count:0},
  {id:'f3',  code:'200',  name:'Gadget Hits 2025',         emoji:'📱', count:0},
  {id:'f4',  code:'201',  name:'Sepatu & Sandal',          emoji:'👟', count:0},
  {id:'f5',  code:'300',  name:'Dekorasi Kamar Aesthetic', emoji:'🏠', count:0},
  {id:'f6',  code:'301',  name:'Tas & Aksesoris',          emoji:'👜', count:0},
  {id:'f7',  code:'400',  name:'Peralatan Dapur Viral',    emoji:'🍳', count:0},
  {id:'f8',  code:'401',  name:'Olahraga & Fitness',       emoji:'💪', count:0},
  {id:'f9',  code:'500',  name:'Baju Anak & Bayi',         emoji:'🧒', count:0},
  {id:'f10', code:'501',  name:'Elektronik Rumah',         emoji:'🔌', count:0},
  {id:'f11', code:'1000', name:'Koleksi Spesial Ramadan',  emoji:'🌙', count:0},
  {id:'f12', code:'1001', name:'Bundle Hemat Bundling',    emoji:'🎁', count:0},
];

const TAG_LABELS = {mall:'🏬 Mall',diskon:'🔥 Diskon',best:'⭐ Best Seller',baru:'✨ Baru',terlaris:'📦 Terlaris',flash:'⚡ Flash Sale',free:'🚚 Free Ongkir'};

// ── STORE (diisi dari API) ───────────────────────────────────────
// Format: STORE['f1'] = [ {id, name, price, old, tags, img, link}, ... ]
let STORE = {};
let storeReady = false;

// Mapping dari format Sheet → format kartu produk
function mapProduct(p) {
  return {
    id:       p.product_id,
    folderId: p.folder_id,
    name:     p.product_name,
    price:    p.price,
    old:      p.old_price || '',
    tags:     (p.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    img:      p.image_url || '',
    link:     p.affiliate_link || '#',
  };
}

async function loadStore() {
  try {
    const url = new URL(API_URL);
    url.searchParams.set('action', 'get');
    if (API_TOKEN) url.searchParams.set('token', API_TOKEN);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'API error');

    // Reset store
    STORE = {};
    FOLDERS.forEach(f => { STORE[f.id] = []; f.count = 0; });

    // Populate
    (data.products || []).forEach(p => {
      const mapped = mapProduct(p);
      if (STORE[mapped.folderId] !== undefined) {
        STORE[mapped.folderId].push(mapped);
      }
    });

    // Update count di FOLDERS
    FOLDERS.forEach(f => { f.count = STORE[f.id].length; });

    storeReady = true;
  } catch(err) {
    console.warn('[Novaa] Gagal load produk dari API, pakai data lokal:', err.message);
    // Fallback: kosong, tampilkan pesan error
    storeReady = true;
  }
}

/* ═══════════════════════════════════════
   STATE
═══════════════════════════════════════ */
let activeFolder = null;
let page = 0;
const PAGE = 16;
let loading = false;
let done = false;

/* ═══════════════════════════════════════
   ELEMENTS
═══════════════════════════════════════ */
const $ = id => document.getElementById(id);
const homeView      = $('homeView');
const folderView    = $('folderView');
const overlay       = $('searchOverlay');
const searchInput   = $('searchInput');
const searchHint    = $('searchHint');
const searchResults = $('searchResults');
const searchLabel   = $('searchLabel');
const folderList    = $('folderList');
const productGrid   = $('productGrid');
const spinner       = $('spinner');
const sentinel      = $('sentinel');

/* ═══════════════════════════════════════
   SEARCH
═══════════════════════════════════════ */
let debounce;

function openSearch() {
  overlay.classList.add('open');
  setTimeout(() => searchInput.focus(), 80);
}
function closeSearch() {
  overlay.classList.remove('open');
  searchInput.value = '';
  showHint();
}
function showHint() {
  searchHint.style.display = 'flex';
  searchResults.style.display = 'none';
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounce);
  const q = searchInput.value.trim();
  if (!q) { showHint(); return; }
  debounce = setTimeout(() => {
    const hits = FOLDERS.filter(f =>
      f.code === q ||
      f.code.startsWith(q) ||
      f.name.toLowerCase().includes(q.toLowerCase())
    ).filter(f => f.count > 0 || !storeReady); // sembunyikan folder kosong kalau sudah load
    renderFolderResults(hits, q);
  }, 400);
});

function renderFolderResults(hits, q) {
  searchHint.style.display = 'none';
  searchResults.style.display = 'block';

  if (!hits.length) {
    searchLabel.textContent = 'Tidak ditemukan';
    folderList.innerHTML = `<div class="not-found"><div class="big">🙈</div>Kode "<b>${q}</b>" tidak ada.<br>Cek ulang kode di videonya ya!</div>`;
    return;
  }

  searchLabel.textContent = hits.length === 1 ? '1 folder ditemukan' : `${hits.length} folder ditemukan`;
  folderList.innerHTML = hits.map(f => `
    <div class="folder-card fi" data-id="${f.id}">
      <div class="f-emoji">${f.emoji}</div>
      <div class="f-info">
        <div class="f-code">Kode ${f.code}</div>
        <div class="f-name">${f.name}</div>
        <div class="f-meta">${f.count} produk</div>
      </div>
      <div class="f-arr">›</div>
    </div>`).join('');

  requestAnimationFrame(() => {
    folderList.querySelectorAll('.fi').forEach((el, i) =>
      setTimeout(() => el.classList.add('v'), i * 60));
  });
}

folderList.addEventListener('click', e => {
  const card = e.target.closest('[data-id]');
  if (!card) return;
  const folder = FOLDERS.find(f => f.id === card.dataset.id);
  if (folder) openFolder(folder);
});

$('openSearch').addEventListener('click', openSearch);
$('homeCta').addEventListener('click', openSearch);
$('closeSearch').addEventListener('click', closeSearch);
$('reSearch').addEventListener('click', openSearch);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

/* ═══════════════════════════════════════
   FOLDER VIEW
═══════════════════════════════════════ */
function openFolder(folder) {
  closeSearch();
  activeFolder = folder;
  page = 0; done = false;
  productGrid.innerHTML = '';

  $('ftName').textContent = folder.name;
  $('ftSub').textContent  = `Kode: ${folder.code} · ${folder.count} produk`;

  homeView.style.display   = 'none';
  folderView.style.display = 'block';
  window.scrollTo({top: 0});
  loadPage();
}

$('backBtn').addEventListener('click', () => {
  folderView.style.display = 'none';
  homeView.style.display   = 'flex';
  activeFolder = null;
  productGrid.innerHTML = '';
});

/* ═══════════════════════════════════════
   PAGINATION — Infinite Scroll
═══════════════════════════════════════ */
function loadPage() {
  if (loading || done || !activeFolder) return;
  loading = true;
  spinner.style.display = 'flex';

  // Simulasi async tick (di produksi data sudah ada di STORE)
  setTimeout(() => {
    const all   = STORE[activeFolder.id] || [];
    const start = page * PAGE;
    const chunk = all.slice(start, start + PAGE);

    if (!chunk.length) {
      done = true;
      spinner.style.display = 'none';
      loading = false;
      if (page === 0) {
        productGrid.innerHTML = `<div class="empty-msg"><div class="big">📦</div>Belum ada produk di sini.</div>`;
      }
      return;
    }

    chunk.forEach((p, i) => {
      const el = buildCard(p);
      productGrid.appendChild(el);
      setTimeout(() => el.classList.add('v'), i * 35);
    });

    observeImages();
    page++;
    if (start + PAGE >= all.length) done = true;
    spinner.style.display = 'none';
    loading = false;
  }, 80); // lebih cepat karena data sudah lokal
}

function buildCard(p) {
  const el = document.createElement('article');
  el.className = 'card fi';
  el.innerHTML = `
    <div class="card-img">
      <div class="img-ph">🛍️</div>
      <img data-src="${p.img}" alt="${p.name}">
    </div>
    <div class="tag-row">${p.tags.map(t => `<span class="tag ${t}">${TAG_LABELS[t]||t}</span>`).join('')}</div>
    <div class="card-body">
      <div class="card-name">${p.name}</div>
      <div class="card-price">Rp ${p.price}${p.old ? `<span class="card-price-old">Rp ${p.old}</span>` : ''}</div>
      <button class="card-btn">Beli Sekarang →</button>
    </div>`;
  el.querySelector('.card-btn').addEventListener('click', ev => {
    ev.stopPropagation();
    if (p.link && p.link !== '#') window.open(p.link, '_blank');
    else alert('Link belum tersedia.');
  });
  return el;
}

// Lazy load images
let imgObs;
function observeImages() {
  if (!imgObs) {
    imgObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const img = e.target;
        img.src = img.dataset.src;
        img.onload = () => img.classList.add('show');
        imgObs.unobserve(img);
      });
    }, {rootMargin:'160px'});
  }
  document.querySelectorAll('img[data-src]').forEach(img => imgObs.observe(img));
}

new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) loadPage();
}, {rootMargin:'200px'}).observe(sentinel);

/* ═══════════════════════════════════════
   INIT — load data dari API saat halaman buka
═══════════════════════════════════════ */
(async () => {
  await loadStore();
  // Kalau ada folder/kode di URL hash, langsung buka
  // contoh: index.html#123
  const hash = location.hash.replace('#','');
  if (hash) {
    const f = FOLDERS.find(x => x.code === hash);
    if (f) openFolder(f);
  }
})();
