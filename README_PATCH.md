# Patch v1.2.8 - Backup, Restore, Maintenance Reset Kas

## Isi patch
- Fitur backup data JSON khusus admin.
- Fitur restore data dari file backup JSON khusus admin.
- Fitur maintenance reset semua transaksi kas.
- Menu baru admin: Backup & Maintenance.
- Versi aplikasi naik ke 1.2.8.

## File yang berubah/ditambah
- server.js
- package.json
- routes/pageRoutes.js
- routes/maintenanceRoutes.js
- views/partials_nav.ejs
- views/admin/maintenance.ejs
- public/css/style.css

## Cara pasang
1. Replace file/folder dari patch ke project.
2. Jalankan:
   npm install
3. Restart aplikasi:
   npm run dev

## Cara akses
Login admin lalu buka:
/admin/maintenance

## Catatan penting
Restore akan mengganti data aplikasi sesuai isi backup. Sebelum restore atau reset kas, download backup dulu.

Reset kas hanya menghapus collection transaksi kas. Data warga, user, parameter IWK, dan riwayat IWK tidak ikut dihapus.
