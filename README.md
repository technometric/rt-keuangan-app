# SIKERT - Sistem Keuangan RT

Aplikasi keuangan RT berbasis Node.js, MongoDB, dan HTML/EJS.

## Versi

```txt
v1.1.0
```

## Fitur

- Login multi role: admin, petugas, umum
- Halaman umum langsung di root `/`
- Admin masuk melalui `/admin`
- Petugas masuk dari tombol Login Petugas di halaman umum
- Management user admin/petugas/umum
- Area petugas: utara, tengah, selatan
- Master warga wajib IWK
- Parameter komponen IWK
- Kontrol wajib foto cash aktif/nonaktif
- Input IWK dengan pembagian otomatis ke pos kas
- Catatan petugas wajib jika pembayaran kurang/belum bayar
- Transaksi kas manual debet/kredit
- Dashboard saldo umum/admin
- Audit trail khusus admin, bisa hide/show
- Audit trail otomatis expire 2 bulan
- Info versi aplikasi
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

## Akses Halaman

```txt
Umum   : http://localhost:3035/
Admin  : http://localhost:3035/admin
Petugas: tombol Login Petugas dari halaman umum
```

## Akun Default

```txt
Admin          : admin / admin123
Petugas Utara : utara / petugas123
Petugas Tengah: tengah / petugas123
Petugas Selatan: selatan / petugas123
Umum           : umum / umum123
```

## Catatan Update v1.1.0

Untuk update dari v1.0.0, jalankan ulang aplikasi saja. Tidak wajib seed ulang. Kalau ingin akun default baru muncul, baru jalankan `npm run seed`.
