# Patch v1.2.3 - IWK Petugas & Bugfix Admin

## Perubahan
1. Bugfix akses admin dari `/admin/` dan `/admin`.
2. Dashboard petugas punya filter riwayat IWK bulan/tahun.
3. Dashboard petugas punya tombol Print/Share PDF riwayat pembayaran IWK.
4. Tabel riwayat IWK bisa edit kolom nominal dan catatan.
5. Saat nominal IWK diedit, rincian komponen IWK dan transaksi kas IWK lama dibuat ulang, lalu saldo kas terkait dihitung ulang.
6. Default tampilan Status Pembayaran IWK umum sekarang bulan berjalan, bukan All 1 Tahun.
7. Versi aplikasi naik ke `1.2.3`.

## Cara pasang
Copy semua folder/file patch ini ke root project, replace file lama.

Lalu restart aplikasi:

```bash
npm run dev
```

atau jika pakai PM2:

```bash
pm2 restart rt-keuangan
```

## Catatan
Tidak perlu `npm run seed` ulang.
