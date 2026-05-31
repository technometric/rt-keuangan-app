# SIKERT - Sistem Keuangan RT

Starter project aplikasi keuangan RT berbasis Node.js, MongoDB, dan HTML/EJS.

## Fitur Starter

- Login multi role: admin, petugas, umum
- Area petugas: utara, tengah, selatan
- Master warga wajib IWK
- Parameter komponen IWK
- Kontrol wajib foto cash aktif/nonaktif
- Input IWK dengan pembagian otomatis ke pos kas
- Catatan petugas wajib jika pembayaran kurang/belum bayar
- Transaksi kas manual debet/kredit
- Dashboard saldo umum/admin
- Export ringkasan bulanan PDF
- Print halaman dashboard untuk PNG/manual screenshot

## Koneksi Default

```env
PORT=3035
MONGO_URI=mongodb://192.168.1.9:27017/rt_keuangan_app
SESSION_SECRET=ganti_secret_ini
```

## Cara Install

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

Buka:

```txt
http://localhost:3035
```

## Akun Default

```txt
Admin         : admin / admin123
Petugas Utara : utara / petugas123
Petugas Tengah: tengah / petugas123
Petugas Selatan: selatan / petugas123
Umum          : umum / umum123
```

## Catatan

Starter ini sudah menjadi pondasi awal. Fitur lanjutan yang masih bisa ditambah:

- Export PNG otomatis dari server
- Backup/import JSON database
- CRUD user lengkap dari UI
- Edit/hapus iuran dengan auto reversal transaksi kas
- Laporan detail per bulan dan per jenis kas
- PDF desain lebih premium
