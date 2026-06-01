# Patch v1.2.2 - RT Keuangan App

Perubahan:
1. Menu admin di titik tiga halaman umum dihapus. Admin tetap masuk via `/admin`.
2. Sidebar admin dan petugas diganti menu titik tiga floating bawah.
3. Nominal IWK default otomatis mengikuti total penjumlahan parameter komponen IWK.
4. Master Data bisa membuat parameter IWK baru dan mengaktifkan parameter lama.
5. Daftar warga diurutkan natural berdasarkan no rumah dan ditambah nomor urut.
6. Status Pembayaran IWK bisa tampil All 1 Tahun atau per bulan.
7. Status tampilan menjadi Bayar / Kurang / Blm Bayar.
8. Indikator status berubah menjadi border saja, bukan warna penuh.
9. Default filter status publik adalah Blm Bayar.

Cara pakai:
- Extract ke root project, replace file yang sama.
- Jalankan `npm install` jika package berubah.
- Restart aplikasi.

Tidak perlu menjalankan import warga lagi kecuali database warga masih kosong.
