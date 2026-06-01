# Patch v1.2.7

Isi patch:
1. Fix default Status Pembayaran IWK menjadi bulan berjalan, bukan All 1 Tahun.
2. Tambah info Pendapatan IWK Bulan Berjalan / Target IWK di halaman umum dan dashboard admin.
   Format: pendapatan / (nominal IWK aktif × jumlah warga aktif).
3. Tambah total nominal pendapatan penagihan IWK petugas khusus bulan berjalan.

Cara pasang:
- Extract isi ZIP ke root project dan replace file lama.
- Restart aplikasi: npm run dev atau pm2 restart rt-keuangan.
- Tidak perlu npm run seed.
