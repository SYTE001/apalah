// ═══════════════════════════════════════════════════════════════
//  NOVAA — Google Apps Script Backend (Code.gs)
//  Deploy sebagai: Web App → Anyone can access → New deployment
// ═══════════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────────────
const SHEET_NAME = 'Novaa Products';           // nama tab di Google Sheet
const FOLDERS_SHEET_NAME = 'Folders';          // nama tab untuk folder
const SECRET_TOKEN = 'alifmm993';  // token rahasia (boleh dikosongkan '')
const SPREADSHEET_ID = '';               // kosongkan → pakai spreadsheet aktif
                                         // atau isi: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'

// ── KOLOM SHEET (urutan) ─────────────────────────────────────────
const COLS = {
  product_id:     0,   // A
  folder_id:      1,   // B
  product_name:   2,   // C
  price:          3,   // D
  old_price:      4,   // E
  tags:           5,   // F
  image_url:      6,   // G
  affiliate_link: 7,   // H
  created_at:     8,   // I  (auto-filled)
};

// ── HELPERS ─────────────────────────────────────────────────────
function getSheet(name = SHEET_NAME) {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
    
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function checkToken(token) {
  if (!SECRET_TOKEN) return true;          // token dinonaktifkan
  return token === SECRET_TOKEN;
}

function rowToObj(row) {
  return {
    product_id:     row[COLS.product_id],
    folder_id:      row[COLS.folder_id],
    product_name:   row[COLS.product_name],
    price:          row[COLS.price],
    old_price:      row[COLS.old_price],
    tags:           row[COLS.tags],
    image_url:      row[COLS.image_url],
    affiliate_link: row[COLS.affiliate_link],
    created_at:     row[COLS.created_at],
  };
}

function jsonResp(data, code=200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function corsResp(data) {
  // Apps Script tidak support custom headers untuk CORS,
  // tapi GET/POST dari browser modern ke Apps Script biasanya ok
  return jsonResp(data);
}

// ── GET ─────────────────────────────────────────────────────────
// GET ?action=get&token=xxx
// Mengembalikan semua produk
function doGet(e) {
  try {
    const sheet = getSheet();
    const rows = sheet.getDataRange().getValues();
    const products = [];

    // skip baris header (baris 1)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[COLS.product_id]) continue;   // skip baris kosong
      products.push(rowToObj(row));
    }

    // Ambil data folder
    const folderSheet = getSheet(FOLDERS_SHEET_NAME);
    const folderRows = folderSheet.getDataRange().getValues();
    const folders = [];
    
    for (let i = 1; i < folderRows.length; i++) {
        const row = folderRows[i];
        if (!row[0]) continue; // skip baris kosong
        folders.push({
            folder_id: row[0],
            code: row[1],
            emoji: row[2],
            name: row[3]
        });
    }

    return jsonResp({ok:true, count: products.length, products, folders});
  } catch(err) {
    return jsonResp({ok:false, error: err.toString()});
  }
}

// ── POST ─────────────────────────────────────────────────────────
// Semua mutasi (add/update/delete) dikirim via POST body JSON
// { action: 'post'|'put'|'delete', token: '...', ...fields }
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || '';
    const token = body.token || '';

    if (!checkToken(token)) return jsonResp({ok:false, error:'Unauthorized'});

    if (action === 'post')   return handleAdd(body);
    if (action === 'put')    return handleUpdate(body);
    if (action === 'delete') return handleDelete(body);

    // Folder Actions
    if (action === 'post_folder')   return handleAddFolder(body);
    if (action === 'put_folder')    return handleUpdateFolder(body);
    if (action === 'delete_folder') return handleDeleteFolder(body);

    return jsonResp({ok:false, error:'Unknown action: ' + action});
  } catch(err) {
    return jsonResp({ok:false, error: err.toString()});
  }
}

// ── ADD PRODUCT ─────────────────────────────────────────────────
function handleAdd(body) {
  const sheet = getSheet();
  const now = new Date().toISOString();
  const row = new Array(Object.keys(COLS).length).fill('');

  row[COLS.product_id]     = body.product_id || 'p_' + Date.now();
  row[COLS.folder_id]      = body.folder_id || '';
  row[COLS.product_name]   = body.product_name || '';
  row[COLS.price]          = body.price || '';
  row[COLS.old_price]      = body.old_price || '';
  row[COLS.tags]           = body.tags || '';
  row[COLS.image_url]      = body.image_url || '';
  row[COLS.affiliate_link] = body.affiliate_link || '';
  row[COLS.created_at]     = now;

  sheet.appendRow(row);
  return jsonResp({ok:true, message:'Product added', product_id: row[COLS.product_id]});
}

// ── UPDATE PRODUCT ───────────────────────────────────────────────
function handleUpdate(body) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const targetId = body.product_id;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COLS.product_id] === targetId) {
      const rowNum = i + 1; // 1-indexed
      // Update kolom yang dikirim (skip product_id, folder_id, created_at)
      if (body.product_name   !== undefined) sheet.getRange(rowNum, COLS.product_name+1).setValue(body.product_name);
      if (body.folder_id      !== undefined) sheet.getRange(rowNum, COLS.folder_id+1).setValue(body.folder_id);
      if (body.price          !== undefined) sheet.getRange(rowNum, COLS.price+1).setValue(body.price);
      if (body.old_price      !== undefined) sheet.getRange(rowNum, COLS.old_price+1).setValue(body.old_price);
      if (body.tags           !== undefined) sheet.getRange(rowNum, COLS.tags+1).setValue(body.tags);
      if (body.image_url      !== undefined) sheet.getRange(rowNum, COLS.image_url+1).setValue(body.image_url);
      if (body.affiliate_link !== undefined) sheet.getRange(rowNum, COLS.affiliate_link+1).setValue(body.affiliate_link);
      return jsonResp({ok:true, message:'Product updated'});
    }
  }
  return jsonResp({ok:false, error:'Product not found: ' + targetId});
}

// ── DELETE PRODUCT ───────────────────────────────────────────────
function handleDelete(body) {
  const sheet = getSheet();
  const rows = sheet.getDataRange().getValues();
  const targetId = body.product_id;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COLS.product_id] === targetId) {
      sheet.deleteRow(i + 1);
      return jsonResp({ok:true, message:'Product deleted'});
    }
  }
  return jsonResp({ok:false, error:'Product not found: ' + targetId});
}

// ── FOLDER CRUD ───────────────────────────────────────────────
function handleAddFolder(body) {
  const sheet = getSheet(FOLDERS_SHEET_NAME);
  const row = [
    body.folder_id || 'f_' + Date.now(),
    body.code || '',
    body.emoji || '',
    body.name || ''
  ];
  sheet.appendRow(row);
  return jsonResp({ok:true, message:'Folder added', folder_id: row[0]});
}

function handleUpdateFolder(body) {
  const sheet = getSheet(FOLDERS_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const targetId = body.folder_id;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === targetId) {
      const rowNum = i + 1; // 1-indexed
      if (body.code !== undefined) sheet.getRange(rowNum, 2).setValue(body.code);
      if (body.emoji !== undefined) sheet.getRange(rowNum, 3).setValue(body.emoji);
      if (body.name !== undefined) sheet.getRange(rowNum, 4).setValue(body.name);
      return jsonResp({ok:true, message:'Folder updated'});
    }
  }
  return jsonResp({ok:false, error:'Folder not found: ' + targetId});
}

function handleDeleteFolder(body) {
  const sheet = getSheet(FOLDERS_SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const targetId = body.folder_id;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === targetId) {
      sheet.deleteRow(i + 1);
      return jsonResp({ok:true, message:'Folder deleted'});
    }
  }
  return jsonResp({ok:false, error:'Folder not found: ' + targetId});
}

// ── SETUP HEADER (jalankan sekali manual dari editor) ────────────
// Jalankan fungsi ini sekali dari Apps Script Editor → Run → setupHeader
function setupHeader() {
  const sheet = getSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'product_id', 'folder_id', 'product_name',
      'price', 'old_price', 'tags',
      'image_url', 'affiliate_link', 'created_at'
    ]);
    // Style header
    const headerRange = sheet.getRange(1, 1, 1, 9);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    // Lebar kolom
    sheet.setColumnWidth(3, 250); // product_name
    sheet.setColumnWidth(7, 300); // image_url
    sheet.setColumnWidth(8, 300); // affiliate_link
  }

  // Setup Folders Header
  const folderSheet = getSheet(FOLDERS_SHEET_NAME);
  if (folderSheet.getLastRow() === 0) {
      folderSheet.appendRow(['folder_id', 'code', 'emoji', 'name']);
      const fHeaderRange = folderSheet.getRange(1, 1, 1, 4);
      fHeaderRange.setFontWeight('bold');
      fHeaderRange.setBackground('#1a1a2e');
      fHeaderRange.setFontColor('#ffffff');
      folderSheet.setFrozenRows(1);
  }
}
