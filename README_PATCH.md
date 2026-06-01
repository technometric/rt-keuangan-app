# Patch v1.2.1 - RT Keuangan App

## Isi patch
1. Import data warga wajib IWK RT02 sebanyak 88 data.
2. Menu publik diubah menjadi titik tiga kecil floating di kanan bawah.
3. Tulisan kredensial `Admin: admin / admin123` di halaman login dihapus.
4. Kotak tulisan `RT02` pada hero dashboard umum dihilangkan agar lebih hemat ruang.
5. Versi aplikasi dinaikkan ke `1.2.1`.

## Cara pasang
Copy/replace semua folder dan file di patch ini ke folder project.

Lalu jalankan:

```bash
npm install
npm run import:warga
npm run dev
```

Atau jika sudah pakai PM2:

```bash
npm run import:warga
pm2 restart rt-keuangan
```

## Catatan import warga
Script import memakai `no_rumah` sebagai kunci unik sederhana.
Jika `no_rumah` sudah ada, data akan di-update.
Jika belum ada, data akan ditambahkan.

Data warga berada di:

```txt
data/wajib-iwk-rt02.json
```
