const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

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
module.exports = router;
