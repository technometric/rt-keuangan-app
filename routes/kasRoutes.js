const express = require('express');
const TransaksiKas = require('../models/TransaksiKas');
const { requireRole } = require('../middleware/auth');
const { buatTransaksiKas, saldoSemuaKas } = require('../utils/kas');
const router = express.Router();

router.get('/saldo', requireRole('admin','petugas','umum'), async (req, res) => res.json(await saldoSemuaKas()));
router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const filter = {};
  if (req.query.jenis_kas) filter.jenis_kas = req.query.jenis_kas;
  res.json(await TransaksiKas.find(filter).populate('dibuat_oleh','nama').sort({ tanggal: -1, createdAt: -1 }).limit(300));
});
router.post('/', requireRole('admin','petugas'), async (req, res) => {
  const { jenis_kas, keterangan, tanggal, tipe, nominal } = req.body;
  const debet = tipe === 'debet' ? Number(nominal || 0) : 0;
  const kredit = tipe === 'kredit' ? Number(nominal || 0) : 0;
  res.json(await buatTransaksiKas({ jenis_kas, sumber: 'manual', keterangan, tanggal: tanggal ? new Date(tanggal) : new Date(), debet, kredit, dibuat_oleh: req.session.user.id }));
});
router.delete('/:id', requireRole('admin'), async (req, res) => { await TransaksiKas.findByIdAndDelete(req.params.id); res.json({ message: 'Transaksi dihapus' }); });
module.exports = router;
