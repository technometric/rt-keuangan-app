const express = require('express');
const WajibIwk = require('../models/WajibIwk');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const filter = {};
  if (req.session.user.role === 'petugas') filter.area = req.session.user.area;
  const data = await WajibIwk.find(filter).sort({ area: 1, no_rumah: 1, nama: 1 });
  res.json(data);
});
router.post('/', requireRole('admin'), async (req, res) => { const warga = await WajibIwk.create(req.body); await tulisAudit(req, 'CREATE', 'Wajib IWK', `Tambah warga ${warga.nama}`); res.json(warga); });
router.put('/:id', requireRole('admin'), async (req, res) => { const warga = await WajibIwk.findByIdAndUpdate(req.params.id, req.body, { new: true }); await tulisAudit(req, 'UPDATE', 'Wajib IWK', `Update warga ${warga?.nama || req.params.id}`); res.json(warga); });
router.delete('/:id', requireRole('admin'), async (req, res) => { const warga = await WajibIwk.findByIdAndDelete(req.params.id); await tulisAudit(req, 'DELETE', 'Wajib IWK', `Hapus warga ${warga?.nama || req.params.id}`); res.json({ message: 'Data warga dihapus' }); });
module.exports = router;
