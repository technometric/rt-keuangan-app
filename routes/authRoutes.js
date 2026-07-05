const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const WajibIwk = require('../models/WajibIwk');
const router = express.Router();

function normalizeRumah(value = '') {
  return String(value).toLowerCase().replace(/\bno\b/g, '').replace(/[^a-z0-9]/g, '');
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, aktif: true });
  if (!user) return res.status(401).json({ message: 'Username tidak ditemukan / nonaktif' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Password salah' });
  req.session.user = { id: user._id, nama: user.nama, role: user.role, area: user.area };

  let redirect = '/';
  if (user.role === 'admin') redirect = '/admin/dashboard';
  if (user.role === 'petugas') redirect = '/petugas/dashboard';

  req.session.save(() => {
    res.json({ message: 'Login berhasil', user: req.session.user, redirect });
  });
});

router.post('/logout', (req, res) => req.session.destroy(() => res.json({ message: 'Logout berhasil' })));
router.get('/me', (req, res) => res.json({ user: req.session.user || null }));

router.post('/public-login', async (req, res) => {
  const username = normalizeRumah(req.body.username);
  const password = normalizeRumah(req.body.password);
  if (!username || !password || username !== password) return res.status(401).json({ message: 'Nomor rumah tidak sesuai' });
  const rows = await WajibIwk.find({ aktif: { $ne: false } }).lean();
  const warga = rows.find(w => normalizeRumah(w.no_rumah) === username);
  if (!warga) return res.status(401).json({ message: 'Nomor rumah tidak ditemukan' });
  req.session.publicWarga = { id: warga._id, nama: warga.nama, no_rumah: warga.no_rumah };
  req.session.save(() => res.json({ message: 'Login umum berhasil', redirect: '/', warga: req.session.publicWarga }));
});

router.post('/public-logout', (req, res) => {
  delete req.session.publicWarga;
  req.session.save(() => res.json({ message: 'Logout umum berhasil' }));
});
module.exports = router;
