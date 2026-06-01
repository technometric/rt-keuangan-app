# Patch v1.3.0 - Revisi Laporan Keuangan

Isi patch:
- Uang sampah, uang satpam, dan kas RW disembunyikan dari laporan keuangan warga.
- Saldo laporan hanya menampilkan kas yang relevan untuk warga: Kas RT, Kas Sosial, Santunan Kematian, Kas Donasi, Tabungan Sampah, dan Danus.
- Transaksi laporan juga menyembunyikan pos uang sampah, uang satpam, dan kas RW.
- Tambah tombol **Buat Pengeluaran Iuran RW** untuk membuat/memperbarui 1 transaksi kredit Kas RT dengan keterangan `Iuran sampah, satpam dan kas RW`.
- Periode laporan 1 bulan/3 bulan sekarang selalu mengambil bulan sebelumnya dari bulan laporan. Contoh dibuat bulan Juni: 1 bulan = Mei, 3 bulan = Maret-Mei.
- Export PDF/PNG mengikuti aturan laporan baru.

Cara pakai:
1. Replace file patch ke project.
2. Restart aplikasi.
3. Buka `/admin/laporan-keuangan`.
4. Klik **Buat Pengeluaran Iuran RW** sebelum export laporan bulanan jika ingin mencatat pengeluaran rutin gabungan ke Kas RT.
