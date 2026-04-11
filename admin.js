/* ═══════════════════════════════════════════════════
   NOVAA ADMIN — admin.js
   Vanilla JS, no framework, CRUD via Google Apps Script
═══════════════════════════════════════════════════ */

const VALID_TAGS = ['best','flash','diskon','baru','terlaris','mall','free'];

/* ── STATE ── */
let cfg = {url:'', token:''};          // API config
let allProducts = [];                  // semua produk
let allFolders = [];                   // semua folder
let currentFolder = null;              // folder aktif untuk view produk
let currentView = 'folder';            // 'folder' atau 'product'
let editingId = null;                  // product_id sedang diedit
let editingFolderId = null;            // folder_id sedang diedit
let confirmCallback = null;

/* ── HELPERS ── */
const $ = id => document.getElementById(id);
const qs = (sel, parent=document) => parent.querySelector(sel);

function getHeaders() {
  // Google Apps Script tidak mendukung custom header via browser (CORS issues).
  // Jangan gunakan 'Content-Type: application/json' atau 'X-Token'.
  // Kita kirim token via query param (GET) atau JSON payload body (POST).
  return undefined; 
}

function buildUrl(params={}) {
  const u = new URL(cfg.url);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k,v));
  if (cfg.token) u.searchParams.set('token', cfg.token);
  return u.toString();
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function fmt(n) {
  // Tambah titik ribuan
  return String(n).replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── TOAST ── */
function toast(msg, type='ok', duration=2800) {
  const wrap = $('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icons = {ok:'✓', err:'✕', info:'ℹ'};
  el.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ── LOADING ── */
function setLoading(on) {
  $('loadingOverlay').classList.toggle('open', on);
}

/* ── CONFIRM MODAL ── */
function confirm(title, msg, cb) {
  $('confirmTitle').textContent = title;
  $('confirmMsg').textContent = msg;
  confirmCallback = cb;
  $('confirmModal').classList.add('open');
}
$('confirmNo').addEventListener('click', () => { $('confirmModal').classList.remove('open'); confirmCallback=null; });
$('confirmYes').addEventListener('click', () => {
  $('confirmModal').classList.remove('open');
  if (confirmCallback) { confirmCallback(); confirmCallback=null; }
});

/* ── API CONFIG ── */
function loadCfg() {
  try {
    const saved = JSON.parse(localStorage.getItem('novaa_admin_cfg') || '{}');
    if (saved.url) { cfg = saved; $('apiUrl').value = cfg.url; $('apiToken').value = cfg.token||''; }
  } catch(e){}
}

$('btnSaveApi').addEventListener('click', () => {
  const url = $('apiUrl').value.trim();
  const token = $('apiToken').value.trim();
  if (!url) { toast('URL tidak boleh kosong!','err'); return; }
  cfg = {url, token};
  localStorage.setItem('novaa_admin_cfg', JSON.stringify(cfg));
  toast('Config tersimpan!','ok');
  fetchData();
});

/* ── FETCH DATA (Products & Folders) ── */
async function fetchData() {
  if (!cfg.url) { toast('Set API URL dulu','err'); return; }
  setLoading(true);
  try {
    // GET request tidak perlu headers (fetch default no-cors untuk redirect Apps Script)
    const res = await fetch(buildUrl({action:'get'}));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Gagal fetch');
    
    allProducts = data.products || [];
    allFolders = data.folders || [];
    
    renderSidebar();
    
    // Auto sync view
    if (currentView === 'folder') {
      renderFolderManagement();
    } else if (currentFolder) {
      // Re-find current folder to handle deletes
      const exist = allFolders.find(f => f.folder_id === currentFolder.folder_id);
      if (exist) {
        renderProductManagement(exist);
      } else {
        renderFolderManagement();
      }
    } else {
      renderFolderManagement();
    }
  } catch(e) {
    toast('Gagal ambil data: ' + e.message, 'err');
    console.error(e);
    renderSidebar();
    if(currentView === 'folder') renderFolderManagement();
  } finally {
    setLoading(false);
  }
}

/* ── SIDEBAR ── */
function renderSidebar() {
  const nav = $('folderNav');
  
  // Manage Folders Nav Item Highlighting
  const navMF = $('navManageFolders');
  if (currentView === 'folder') {
    navMF.classList.add('active');
  } else {
    navMF.classList.remove('active');
  }

  // Bind manage folders click (only once, so we check if it has listener or just overwrite onclick)
  navMF.onclick = () => {
    currentView = 'folder';
    renderSidebar();
    renderFolderManagement();
  };

  // Folder Products List
  nav.innerHTML = allFolders.map(f => {
    // We use folder_id as the primary key
    const count = allProducts.filter(p => p.folder_id === f.folder_id).length;
    const active = (currentView === 'product' && currentFolder && currentFolder.folder_id === f.folder_id) ? 'active' : '';
    // Gunakan code dan nama di sidebar
    return `
      <div class="fnav-item ${active}" data-fid="${f.folder_id}">
        <span class="fnav-emoji">${f.emoji || '📁'}</span>
        <span class="fnav-name">${f.code}${f.name ? ' - ' + f.name : ''}</span>
        <span class="fnav-count">${count}</span>
      </div>`;
  }).join('');

  if (allFolders.length === 0) {
     nav.innerHTML = `<div style="padding: 10px; font-size: 11px; color: var(--muted); text-align: center;">Belum ada folder</div>`;
  }

  nav.querySelectorAll('.fnav-item').forEach(el => {
    el.addEventListener('click', () => {
      currentView = 'product';
      const folder = allFolders.find(f => f.folder_id === el.dataset.fid);
      if (folder) {
        renderSidebar();
        renderProductManagement(folder);
      }
    });
  });
}

/* ═══════════════════════════════════════
   FOLDER MANAGEMENT
═══════════════════════════════════════ */
function renderFolderManagement() {
  currentView = 'folder';
  
  $('mainContent').innerHTML = `
    <div class="folder-hd">
      <div class="folder-hd-left">
        <span class="folder-hd-emoji">⚙️</span>
        <div>
          <div class="folder-hd-name">Kelola Folder</div>
          <div class="folder-hd-sub">Buat folder baru dengan KODE untuk memudahkan pencarian</div>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Folder</div>
        <div class="stat-val">${allFolders.length}</div>
      </div>
    </div>

    <!-- Form Folder -->
    <div class="form-panel" id="formFolderPanel">
      <div class="form-panel-header">
        <div class="form-panel-title">
          <span class="dot" id="formFolderDot"></span>
          <span id="formFolderTitle">Tambah Folder Baru</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btnCancelFolderEdit" style="display:none">✕ Batal Edit</button>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Kode Folder * <small style="text-transform:none;letter-spacing:0">(contoh: 123)</small></label>
          <input type="text" id="foldCode" placeholder="Masukkan kode unik">
        </div>
        <div class="field">
          <label>Emoji <small style="text-transform:none;letter-spacing:0">(1 karakter)</small></label>
          <input type="text" id="foldEmoji" placeholder="👗" maxlength="2">
        </div>
        <div class="field span2">
          <label>Nama Folder <small style="text-transform:none;letter-spacing:0">(optional)</small></label>
          <input type="text" id="foldName" placeholder="contoh: Outfit Kece Cewe">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="btnFoldSubmit">+ Tambah Folder</button>
        <button class="btn btn-secondary" id="btnFoldReset">Bersihkan</button>
      </div>
    </div>

    <!-- Table Folder -->
    <div class="table-panel">
      <div class="table-hd">
        <div class="table-hd-title">Daftar Folder <span style="color:var(--muted);font-weight:400">(${allFolders.length})</span></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:50px; text-align:center;">Emoji</th>
              <th>Kode</th>
              <th>Nama Folder</th>
              <th>Total Produk</th>
              <th style="width:110px">Aksi</th>
            </tr>
          </thead>
          <tbody id="folderTbody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderFolderTable(allFolders);

  $('btnFoldSubmit').addEventListener('click', handleFolderSubmit);
  $('btnFoldReset').addEventListener('click', resetFolderForm);
  $('btnCancelFolderEdit').addEventListener('click', resetFolderForm);
}

function renderFolderTable(folders) {
  const tbody = $('folderTbody');
  if (!tbody) return;
  if (!folders.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state"><div class="icon">📁</div><p>Belum ada folder yang dibuat.</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = folders.map(f => {
    const count = allProducts.filter(p => p.folder_id === f.folder_id).length;
    return `<tr>
      <td style="text-align:center; font-size:18px;">${f.emoji || '📁'}</td>
      <td style="font-weight:700; color:var(--text);">${escHtml(f.code)}</td>
      <td>${f.name ? escHtml(f.name) : '<span style="color:var(--dim)">–</span>'}</td>
      <td style="color:var(--muted);">${count} produk</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" data-edit-f="${f.folder_id}">✎ Edit</button>
          <button class="btn btn-danger btn-sm" data-del-f="${f.folder_id}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit-f]').forEach(btn => {
    btn.addEventListener('click', () => startFolderEdit(btn.dataset.editF));
  });
  tbody.querySelectorAll('[data-del-f]').forEach(btn => {
    btn.addEventListener('click', () => startFolderDelete(btn.dataset.delF));
  });
}

function resetFolderForm() {
  editingFolderId = null;
  ['foldCode','foldEmoji','foldName'].forEach(id => { if ($(id)) $(id).value = ''; });
  const dot = $('formFolderDot'); if (dot) dot.className='dot';
  const title = $('formFolderTitle'); if (title) title.textContent = 'Tambah Folder Baru';
  const btnS = $('btnFoldSubmit'); if (btnS) { btnS.textContent = '+ Tambah Folder'; btnS.className='btn btn-primary'; }
  const btnC = $('btnCancelFolderEdit'); if (btnC) btnC.style.display='none';
}

function startFolderEdit(folderId) {
  const f = allFolders.find(x => x.folder_id === folderId);
  if (!f) return;
  editingFolderId = folderId;

  $('foldCode').value = f.code || '';
  $('foldEmoji').value = f.emoji || '';
  $('foldName').value = f.name || '';

  $('formFolderDot').className = 'dot edit';
  $('formFolderTitle').textContent = 'Edit Folder: ' + (f.code || '');
  $('btnFoldSubmit').textContent = '✓ Simpan Perubahan';
  $('btnFoldSubmit').className = 'btn btn-secondary';
  $('btnCancelFolderEdit').style.display = 'flex';

  qs('#formFolderPanel').scrollIntoView({behavior:'smooth', block:'start'});
}

function startFolderDelete(folderId) {
  const f = allFolders.find(x => x.folder_id === folderId);
  if (!f) return;
  const count = allProducts.filter(p => p.folder_id === folderId).length;
  if(count > 0) {
      toast(`Gagal: Kosongkan dulu ${count} produk di folder ini.`, 'err', 4000);
      return;
  }

  confirm(
    'Hapus Folder?',
    `Folder Kode "${f.code}" akan dihapus permanen dari Google Sheet. Pastikan folder ini sudah tidak dipakai.`,
    () => deleteFolder(folderId)
  );
}

function getFolderFormData() {
  const code = $('foldCode').value.trim();
  const emoji = $('foldEmoji').value.trim();
  const name = $('foldName').value.trim();

  if (!code) { toast('Kode folder wajib diisi!','err'); $('foldCode').focus(); return null; }

  return {code, emoji, name};
}

async function handleFolderSubmit() {
  if (!cfg.url) { toast('Set API URL dulu','err'); return; }
  const data = getFolderFormData();
  if (!data) return;

  setLoading(true);
  try {
    if (editingFolderId) {
      // UPDATE
      const res = await fetch(cfg.url, {
        method:'POST',
        body: JSON.stringify({action:'put_folder', folder_id:editingFolderId, token:cfg.token||'', ...data})
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error||'Gagal update folder');
      toast('Folder berhasil diupdate!','ok');
    } else {
      // ADD
      const folder_id = genId('f');
      const res = await fetch(cfg.url, {
        method:'POST',
        body: JSON.stringify({action:'post_folder', folder_id, token:cfg.token||'', ...data})
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error||'Gagal tambah folder');
      toast('Folder berhasil ditambahkan!','ok');
    }
    await fetchData();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    console.error(e);
  } finally {
    setLoading(false);
  }
}

async function deleteFolder(folderId) {
  if (!cfg.url) { toast('Set API URL dulu','err'); return; }
  setLoading(true);
  try {
    const res = await fetch(cfg.url, {
      method:'POST',
      body: JSON.stringify({action:'delete_folder', folder_id:folderId, token:cfg.token||''})
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error||'Gagal hapus folder');
    toast('Folder berhasil dihapus','ok');
    await fetchData();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    console.error(e);
  } finally {
    setLoading(false);
  }
}


/* ═══════════════════════════════════════
   PRODUCT MANAGEMENT
═══════════════════════════════════════ */
function renderProductManagement(folder) {
  currentFolder = folder;
  const products = allProducts.filter(p => p.folder_id === folder.folder_id);

  $('mainContent').innerHTML = `
    <!-- Stats -->
    <div class="folder-hd">
      <div class="folder-hd-left">
        <span class="folder-hd-emoji">${folder.emoji || '📁'}</span>
        <div>
          <div class="folder-hd-name">${folder.name || 'Folder ' + folder.code}</div>
          <div class="folder-hd-sub">Kode: ${folder.code}</div>
        </div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Produk</div>
        <div class="stat-val" id="sTotal">${products.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Diskon</div>
        <div class="stat-val" id="sDiskon">${products.filter(p=>(p.tags||'').includes('diskon')||p.old_price).length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Flash Sale</div>
        <div class="stat-val" id="sFlash">${products.filter(p=>(p.tags||'').includes('flash')).length}</div>
      </div>
    </div>

    <!-- Form -->
    <div class="form-panel" id="formPanel">
      <div class="form-panel-header">
        <div class="form-panel-title">
          <span class="dot" id="formDot"></span>
          <span id="formTitle">Tambah Produk Baru</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btnCancelEdit" style="display:none">✕ Batal Edit</button>
      </div>
      <div class="form-grid">
        <div class="field span2">
          <label>Nama Produk *</label>
          <input type="text" id="fName" placeholder="contoh: Kemeja Oversize Linen Premium">
        </div>
        <div class="field">
          <label>Harga * <small style="text-transform:none;letter-spacing:0">(angka saja)</small></label>
          <input type="text" id="fPrice" placeholder="89000" inputmode="numeric">
        </div>
        <div class="field">
          <label>Harga Coret <small style="text-transform:none;letter-spacing:0">(optional)</small></label>
          <input type="text" id="fOldPrice" placeholder="129000" inputmode="numeric">
        </div>
        <div class="field">
          <label>Tags</label>
          <input type="text" id="fTags" placeholder="best,flash,free">
          <div class="hint">Pilihan: ${VALID_TAGS.join(', ')}</div>
        </div>
        <div class="field">
          <label>Image URL</label>
          <input type="url" id="fImg" placeholder="https://images.unsplash.com/...">
        </div>
        <div class="field span2">
          <label>Affiliate Link *</label>
          <input type="url" id="fLink" placeholder="https://shopee.co.id/...">
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="btnSubmit">+ Tambah Produk</button>
        <button class="btn btn-secondary" id="btnReset">Bersihkan</button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-panel">
      <div class="table-hd">
        <div class="table-hd-title">Produk di folder ini <span style="color:var(--muted);font-weight:400">(${products.length})</span></div>
        <input type="text" class="table-search" id="tableSearch" placeholder="🔍 Cari nama...">
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gambar</th>
              <th>Nama Produk</th>
              <th>Harga</th>
              <th>Tags</th>
              <th>Link</th>
              <th style="width:110px">Aksi</th>
            </tr>
          </thead>
          <tbody id="productTbody"></tbody>
        </table>
      </div>
    </div>`;

  renderProductTable(products);
  bindProductFormEvents();
}

function renderProductTable(products) {
  const tbody = $('productTbody');
  if (!tbody) return;
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state"><div class="icon">📭</div><p>Belum ada produk di folder ini.</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const tags = (p.tags||'').split(',').filter(Boolean);
    const tagHtml = tags.map(t=>`<span class="tag-pill ${t.trim()}">${t.trim()}</span>`).join('');
    const priceFormatted = p.price ? 'Rp ' + fmt(p.price) : '-';
    const oldFormatted = p.old_price ? `<span class="td-price-old">Rp ${fmt(p.old_price)}</span>` : '';
    const imgEl = p.image_url
      ? `<img class="td-thumb" src="${escHtml(p.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="td-thumb-ph">🛍️</div>`;
    const shortLink = p.affiliate_link ? '✓ Ada' : '–';

    return `<tr>
      <td>${imgEl}</td>
      <td>
        <div class="td-name" title="${escHtml(p.product_name)}">${escHtml(p.product_name)}</div>
        <div class="td-id">${p.product_id}</div>
      </td>
      <td class="td-price">${priceFormatted}${oldFormatted}</td>
      <td>${tagHtml}</td>
      <td style="font-size:11px;color:${p.affiliate_link?'var(--green)':'var(--muted)'}">${shortLink}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm" data-edit="${p.product_id}">✎ Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${p.product_id}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startProductEdit(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => startProductDelete(btn.dataset.del));
  });
}

function bindProductFormEvents() {
  const searchEl = $('tableSearch');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.trim().toLowerCase();
      const base = allProducts.filter(p => p.folder_id === currentFolder.folder_id);
      const filtered = q ? base.filter(p => p.product_name.toLowerCase().includes(q)) : base;
      renderProductTable(filtered);
    });
  }

  $('btnSubmit').addEventListener('click', handleProductSubmit);
  $('btnReset').addEventListener('click', resetProductForm);
  $('btnCancelEdit').addEventListener('click', resetProductForm);
}

function resetProductForm() {
  editingId = null;
  ['fName','fPrice','fOldPrice','fTags','fImg','fLink'].forEach(id => { if ($(id)) $(id).value = ''; });
  const dot = $('formDot'); if (dot) { dot.className='dot'; }
  const title = $('formTitle'); if (title) title.textContent = 'Tambah Produk Baru';
  const btnS = $('btnSubmit'); if (btnS) { btnS.textContent = '+ Tambah Produk'; btnS.className='btn btn-primary'; }
  const btnC = $('btnCancelEdit'); if (btnC) btnC.style.display='none';
}

function startProductEdit(productId) {
  const p = allProducts.find(x => x.product_id === productId);
  if (!p) return;
  editingId = productId;

  $('fName').value = p.product_name || '';
  $('fPrice').value = p.price || '';
  $('fOldPrice').value = p.old_price || '';
  $('fTags').value = p.tags || '';
  $('fImg').value = p.image_url || '';
  $('fLink').value = p.affiliate_link || '';

  $('formDot').className = 'dot edit';
  $('formTitle').textContent = 'Edit Produk: ' + (p.product_name || '');
  $('btnSubmit').textContent = '✓ Simpan Perubahan';
  $('btnSubmit').className = 'btn btn-secondary';
  $('btnCancelEdit').style.display = 'flex';

  qs('#formPanel').scrollIntoView({behavior:'smooth', block:'start'});
}

function startProductDelete(productId) {
  const p = allProducts.find(x => x.product_id === productId);
  if (!p) return;
  confirm(
    'Hapus Produk?',
    `"${p.product_name}" akan dihapus permanen dari Google Sheet.`,
    () => deleteProduct(productId)
  );
}

function getProductFormData() {
  const name = $('fName').value.trim();
  const price = $('fPrice').value.trim().replace(/\./g,'');
  const oldPrice = $('fOldPrice').value.trim().replace(/\./g,'');
  const tags = $('fTags').value.trim();
  const img = $('fImg').value.trim();
  const link = $('fLink').value.trim();

  if (!name) { toast('Nama produk tidak boleh kosong!','err'); $('fName').focus(); return null; }
  if (!price || isNaN(Number(price))) { toast('Harga harus berupa angka!','err'); $('fPrice').focus(); return null; }
  if (!link) { toast('Affiliate link tidak boleh kosong!','err'); $('fLink').focus(); return null; }

  return {product_name:name, folder_id:currentFolder.folder_id, price, old_price:oldPrice, tags, image_url:img, affiliate_link:link};
}

async function handleProductSubmit() {
  if (!cfg.url) { toast('Set API URL dulu','err'); return; }
  const data = getProductFormData();
  if (!data) return;

  setLoading(true);
  try {
    if (editingId) {
      // UPDATE
      const res = await fetch(cfg.url, {
        method:'POST',
        body: JSON.stringify({action:'put', product_id:editingId, token:cfg.token||'', ...data})
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error||'Gagal update produk');
      toast('Produk berhasil diupdate!','ok');
    } else {
      // ADD
      const product_id = genId('p');
      const res = await fetch(cfg.url, {
        method:'POST',
        body: JSON.stringify({action:'post', product_id, token:cfg.token||'', ...data})
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error||'Gagal tambah produk');
      toast('Produk berhasil ditambahkan!','ok');
    }
    await fetchData();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    console.error(e);
  } finally {
    setLoading(false);
  }
}

async function deleteProduct(productId) {
  if (!cfg.url) { toast('Set API URL dulu','err'); return; }
  setLoading(true);
  try {
    const res = await fetch(cfg.url, {
      method:'POST',
      body: JSON.stringify({action:'delete', product_id:productId, token:cfg.token||''})
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error||'Gagal hapus');
    toast('Produk berhasil dihapus','ok');
    await fetchData();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    console.error(e);
  } finally {
    setLoading(false);
  }
}

/* ── REFRESH ── */
$('btnRefresh').addEventListener('click', () => {
  if (!cfg.url) { toast('Set API URL dulu','err'); return; }
  fetchData().then(() => toast('Data direfresh','info'));
});


/* ── INIT ── */
loadCfg();
// Awal, jika tidak ada API, render state kosong. 
// Jika ada URL, dia akan panggil fetch yang otomatis panggil renderFolderManagement jika berhasil.
if (!cfg.url) {
  $('mainContent').innerHTML = `
    <div class="empty-state">
      <div class="icon">🔧</div>
      <p>Masukkan URL Apps Script di atas<br>lalu simpan untuk memulai.</p>
    </div>
  `;
} else {
  fetchData();
}
