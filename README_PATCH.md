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
15. admin bisa hide/show info kas RT, kas Sosial, kas donasi, Tabungan sampah, santunan kematian dan danus d web umum
16. nama bulan full name saja
16. menambahkan label kolom input data pada web input pembayaran IWK, untuk dropdown warga apakah bisa d buat jgn menggunakan default web tp custom cupay bisa mudah d cari dan d scroll tdk menutupi halaman
17. admin bisa hide/show web Riwayat IWK di web input pembayaran iwk 
18. pembayaran iwk web petugas pilih bulan ingin mode ceklis dan ada 12 ceklisan 1-12 kl bulan berjalan otomatis yg terceklis lsg angka bln tersebut, kalau bayar 3 bulan sekaligus tinggal ceklis 7-8-9
19. untuk bulan sebelum juli (12 bulan sebelumnya) itu ada settingan centangan saja d masing2 data iwk warga, jd nti saya akan ceklis utnuk bulan juni 2026-juli 2025 yg d ceklis itu belum bayar dan akan tetap merah status nya
20. Data yang masuk dari web input pembayaran iwk petugas itu masuk dl ke tabel iwk bulanan di dashboard admin
dan akan ada laporan bulanan pemasukan iwk format pdf yg bisa d export untuk d share, input kas RT itu manual ketika sudah terima setor dari petugas
21. akase halaman umum harus login user dan pswd nomor rumah misal k2.31, huruf bisa huruf besar/kecil
22. kolom riwayat pembayaran iwk d web petugas ada aksi hapus dg konfirmasi input hapus jika terjadi kesalahan input
23. kolom pencarian warga iwk bisa nama atw nomor rumah tdk caseinsensitif, format nomor rumah misal k2.31 ataw k2 31 atau k2 no 31
24. yang sdh bayar iwk bulan berjalan tdk muncul lagi dalam kolom warga iwk ya biar mengerucut
25. card login untuk hanya menampilkan info SIKERT02, user name dan pasword saja yang lain hapus untuk menghindari spaming, dan ada input cacpcha sederhana utk menghindari bot
26. di halaman umum tdk ada lagi akses masuk petugas dan admin dan setiap kali masuk halaman ini wajib login
27. masuk petugas itu url/petugas
28. input file photo d halaman input pembayaram iwk bisa d hid/show admin
27. bug hasil export pdf pembayaran iwknya barisnya ga rapi
28. admin bisa mengatur pilihan tampilan status pembayaran iwk d web umum, bayr, kurang, belum bayar dan semuanya, kalau d pilih semuanya maka tdak ada pilihan tampilan jadi nampil semua yg bayar, kurang dan blm bayar
29. selektror bulan masih statis blm bisa pilih bulan d tampilan status pembayaran

Patch v1.3.4
1. saya ingin handle cache browser kalau ada update baru berdasarkan versi
2. saya ingin setiap masuk halaman wajib login dulu jangan lsg masuk d semua portal umum, petugas atw admin