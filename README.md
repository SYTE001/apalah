# 🛍️ Novaa — Panduan Deploy Sistem Admin

## 📋 Struktur File

```
novaa/
├── novaa.html       ← Website utama (tidak berubah strukturnya)
├── style.css        ← CSS utama (tidak perlu diubah)
├── script.js        ← UPDATED: fetch dari API (ganti yang lama)
├── admin.html       ← Panel admin (file baru)
├── admin.js         ← Logic admin (file baru)
└── Code.gs          ← Google Apps Script backend
```

---

## 🗂️ STEP 1 — Setup Google Spreadsheet

### Buat Spreadsheet baru di Google Drive
1. Buka [sheets.google.com](https://sheets.google.com)
2. Buat spreadsheet baru, beri nama: **Novaa Products**
3. Rename tab bawah menjadi: `products` (huruf kecil, penting!)

### Struktur kolom (baris 1 = header, otomatis dibuat oleh `setupHeader`)
| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| product_id | folder_id | product_name | price | old_price | tags | image_url | affiliate_link | created_at |

**Contoh data:**
```
p_abc123  |  f1  |  Kemeja Oversize Linen  |  89000  |  129000  |  best,free  |  https://...  |  https://shopee...  |  2025-01-01
```

**Aturan kolom:**
- `product_id` → unik, format: `p_` + string random (dibuat otomatis oleh admin.js)
- `folder_id` → f1 s/d f12 (sesuai FOLDERS di script.js)
- `price` / `old_price` → angka saja, tanpa titik/koma (contoh: `89000`)
- `tags` → comma-separated tanpa spasi (contoh: `best,flash,free`)
- `old_price` → boleh kosong kalau tidak ada harga coret

---

## ⚙️ STEP 2 — Setup Google Apps Script

1. Di Google Spreadsheet kamu, klik menu: **Extensions → Apps Script**
2. Hapus semua kode default, paste seluruh isi `Code.gs`
3. Di baris paling atas, **WAJIB edit** 2 variabel:
   ```javascript
   const SECRET_TOKEN = 'ganti_dengan_token_pilihanmu'; // bebas, contoh: 'novaa2025secret'
   const SPREADSHEET_ID = ''; // kosongkan karena sudah dibuka dari sheet aktif
   ```
4. **Jalankan setupHeader sekali**: Klik dropdown fungsi → pilih `setupHeader` → klik ▶ Run
   - Ini akan membuat baris header di sheet secara otomatis
   - Izinkan akses Google Sheet saat diminta

### Deploy sebagai Web App
1. Klik **Deploy → New deployment**
2. Pilih type: **Web app**
3. Atur:
   - Description: `Novaa API v1`
   - Execute as: **Me**
   - Who has access: **Anyone** *(aman karena dilindungi token)*
4. Klik **Deploy**
5. **Copy URL** yang muncul — bentuknya seperti:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXX.../exec
   ```
   **Simpan URL ini, dibutuhkan di step berikutnya.**

> ⚠️ Setiap kali kamu ubah Code.gs, klik **Deploy → Manage deployments → Edit → New version → Deploy** agar perubahan aktif.

---

## 🌐 STEP 3 — Hubungkan Website Utama ke API

Buka `script.js` (yang sudah diupdate), edit 2 baris ini di atas:

```javascript
const API_URL   = 'https://script.google.com/macros/s/XXXXX/exec'; // ← URL deploy kamu
const API_TOKEN = 'novaa2025secret'; // ← sama dengan SECRET_TOKEN di Code.gs
```

---

## 🔧 STEP 4 — Setup Admin Panel

Buka `admin.html` di browser. Di bagian atas ada bar konfigurasi:
1. **API URL**: paste URL Apps Script deploy kamu
2. **Token**: isi token yang sama
3. Klik **Simpan**

Setelah itu admin panel akan otomatis load semua produk dari sheet.

### Cara pakai admin panel:
- **Pilih folder** di sidebar kiri (👗 f1, ✨ f2, dst)
- **Isi form** di atas: nama produk, harga, tags, image URL, affiliate link
- Klik **+ Tambah Produk**
- Produk langsung masuk ke Google Sheet dan tampil di list bawah
- Klik **✎ Edit** di baris produk untuk edit
- Klik **✕** untuk hapus (ada konfirmasi)

---

## 🚀 STEP 5 — Deploy ke Cloudflare Pages

1. Push semua file ke GitHub repo (atau upload langsung)
2. Buka [pages.cloudflare.com](https://pages.cloudflare.com)
3. Connect ke repo atau upload manual
4. Build settings: kosongkan (static HTML, tidak perlu build)
5. Deploy!

**File yang perlu di-deploy:**
```
novaa.html   → domain utama (/)
style.css
script.js    → VERSI BARU yang sudah di-update
admin.html   → /admin.html (akses manual, tidak dilink dari mana-mana)
admin.js
```

> 💡 **Tips keamanan admin**: Rename `admin.html` jadi nama random seperti `mgmt-7x2k.html` agar tidak mudah ditemukan orang lain. Tidak perlu sistem login jika URL-nya sudah obscure.

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---|---|
| API return error CORS | Normal di Apps Script, coba test dulu via curl atau Postman |
| `Unauthorized` error | Cek token di admin.js / script.js sudah sama dengan Code.gs |
| Produk tidak muncul di website | Pastikan `folder_id` di sheet sama persis dengan id di FOLDERS (f1, f2, dst) |
| Sheet tidak bisa diakses | Pastikan Apps Script di-deploy dengan "Who has access: Anyone" |
| Data lama masih muncul | Perlu re-deploy Apps Script (New version) setiap ada perubahan Code.gs |

---

## 📌 Tips Tags yang Valid

| Tag | Tampil sebagai |
|---|---|
| `best` | ⭐ Best Seller |
| `flash` | ⚡ Flash Sale |
| `diskon` | 🔥 Diskon |
| `baru` | ✨ Baru |
| `terlaris` | 📦 Terlaris |
| `mall` | 🏬 Mall |
| `free` | 🚚 Free Ongkir |

Format di kolom tags: `best,flash` (pisah koma, tanpa spasi)
