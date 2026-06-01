# Patch v1.2.9 - Laporan Keuangan PDF/PNG

## Fitur baru
1. Halaman laporan keuangan khusus admin: `/admin/laporan-keuangan`
2. Export laporan keuangan ke PDF.
3. Export tampilan laporan keuangan ke PNG dari browser.
4. Pilihan periode transaksi: 1 bulan atau 3 bulan terakhir.
5. Ringkasan total saldo semua kas.
6. Ringkasan saldo setiap kas.
7. Tabel transaksi semua kas sesuai periode.
8. Opsi tampilkan/sembunyikan data warga yang belum bayar IWK bulan berjalan.

## File yang berubah/ditambah
- `server.js`
- `routes/pageRoutes.js`
- `routes/laporanKeuanganRoutes.js`
- `views/partials_nav.ejs`
- `views/admin/laporan-keuangan.ejs`
- `public/js/app.js`
- `public/css/style.css`
- `package.json`

## Cara pakai
1. Replace file sesuai struktur folder.
2. Restart aplikasi:

```bash
npm run dev
```

3. Buka:

```txt
http://localhost:3035/admin/laporan-keuangan
```

## Catatan PNG
Export PNG memakai `html2canvas` dari CDN pada halaman laporan. Jika server/laptop tidak terkoneksi internet, tombol PNG bisa gagal termuat. PDF tetap berjalan dari backend.
