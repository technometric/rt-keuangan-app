const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

router.get('/', requireRole('admin'), async (req, res) => {
  const users = await User.find().select('-password').sort({ role: 1, area: 1, nama: 1 }).lean();
  res.json(users);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { nama, username, password, jabatan, role, area, aktif } = req.body;
  if (!nama || !username || !password || !role) return res.status(400).json({ message: 'Nama, username, password, dan role wajib diisi' });
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ message: 'Username sudah digunakan' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ nama, username, password: hash, jabatan, role, area: role === 'petugas' ? area : '-', aktif: aktif !== false });
  await tulisAudit(req, 'CREATE', 'User Management', `Tambah user ${username}`);
  res.json({ message: 'User berhasil dibuat', user: { ...user.toObject(), password: undefined } });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { nama, username, password, jabatan, role, area, aktif } = req.body;
  const payload = { nama, username, jabatan, role, area: role === 'petugas' ? area : '-', aktif: aktif === true || aktif === 'true' };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (password) payload.password = await bcrypt.hash(password, 10);
  const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
  await tulisAudit(req, 'UPDATE', 'User Management', `Update user ${user.username}`);
  res.json({ message: 'User berhasil diupdate', user });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  if (String(req.session.user.id) === String(req.params.id)) return res.status(400).json({ message: 'Akun sendiri tidak bisa dihapus' });
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
  await tulisAudit(req, 'DELETE', 'User Management', `Hapus user ${user.username}`);
  res.json({ message: 'User berhasil dihapus' });
});

module.exports = router;
