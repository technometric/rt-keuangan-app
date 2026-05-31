const express = require('express');
const WajibIwk = require('../models/WajibIwk');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const filter = {};
  if (req.session.user.role === 'petugas') filter.area = req.session.user.area;
  const data = await WajibIwk.find(filter).sort({ area: 1, no_rumah: 1, nama: 1 });
  res.json(data);
});
router.post('/', requireRole('admin'), async (req, res) => res.json(await WajibIwk.create(req.body)));
router.put('/:id', requireRole('admin'), async (req, res) => res.json(await WajibIwk.findByIdAndUpdate(req.params.id, req.body, { new: true })));
router.delete('/:id', requireRole('admin'), async (req, res) => { await WajibIwk.findByIdAndDelete(req.params.id); res.json({ message: 'Data warga dihapus' }); });
module.exports = router;
