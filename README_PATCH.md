# Patch v1.2.0 - IWK Multi Bulan + Tampilan Umum Ringkas

## Isi patch
1. Input IWK bisa untuk 1 bulan atau beberapa bulan sekaligus.
2. Nominal otomatis dibagi per periode bulan.
   - Contoh bayar 60.000 untuk 2 bulan: bulan pertama 30.000, bulan kedua 30.000.
   - Contoh bayar 45.000 untuk 2 bulan: bulan pertama 30.000, bulan kedua 15.000.
3. Setiap periode otomatis membuat transaksi kas sesuai komponen IWK.
4. Halaman umum tanpa header atas.
5. Menu garis tiga dibuat floating di kanan atas.
6. Status pembayaran IWK full 1 tahun mode ringkas warna.
7. Filter tampilan: semua, lunas, kurang, belum lunas.
8. Tampilan umum lebih nyaman untuk HP.
9. Versi aplikasi naik ke 1.2.0.

## Cara pasang
Copy semua folder/file dalam patch ini ke root project `rt-keuangan-app`, replace file lama.

Lalu restart aplikasi:

```bash
pm2 restart rt-keuangan
```

atau jika masih mode dev:

```bash
npm run dev
```

## Catatan
Tidak perlu menjalankan `npm run seed` ulang.
