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

Patch v1.3.2 Revisi KAs RW menjadi Kas PKK
1. Merubah kolom parameter IWK Kas RW menjadi kas PKK
2. Menambahakan label pada inputan parameter IWK aktif
3. Minimal bayar IWK adalah jumlan iuran satpan/keamanan di tambah sampah
4. urutan pengisian otomatis ke kas itu dari urutan
   1. satpam, 
   2. sampah,
   3. kas PKK,
   4. kas RT
5. iuran ke RW adalah satpam dan sampah itu masuk laporan utama kas RT otomatis setiap bulan
6. iuran ambulan 50.000 setiap bulan otomatis masuk pengeluaran kas RT
7. iuran ke kas RW adalah 75 KK * (Satpam + Sampah), nilai jumlah KK bisa d ubah2 d menu master data
8. data laporan kas RT bulanan d buat otomatis setiap bulan nya
9. ada Inputan manual kas RT selain yang otomatis dari IWK, input nominal dan dan ketrangan, tanggal dan jam
10. ada fitur menampilkan KK / warga yg blm bayar IKW periode sebelumnya dan nampil d web umum kalau status nya d tampilkan
11. role petugas penarikan IWK bisa handle semua wilayah, awalnya di bagi 3 petugas utara, tengah dan selatan
12. kasih versi aplikasi d header web admin, petugas dan umum
13. buatkan branch reponya utk patch ini
14. untuk tampilan Status pembayaran iwk d buat menyamping saja misal jadi 10 kolom, d buat tombol card saja nama KK bawahnya no. Rumah 
    kl d klik/tap muncul bulan kebelakang dan skrg yg blm bayar, ini kan periode baru saya jd bendahara maka akan d tampilkan yg masih belum bayar 12 sebelumnya saja dr juli 2025, kl yg juli skrg d lihat dari status bayar iwk saja kl yang bulan juni 2026 - juni 2025 itu ada settingan centangan d menu Iuran wajib IWK khusus admin saya sj kolomnya tunggakan iwk bulan sebelumnya juni 2026 -juni 2025
    jd kl yg merah itu bisa kmungkinan blm bayar bulan sebelumnya