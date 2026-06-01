const express = require('express');
const TransaksiKas = require('../models/TransaksiKas');
const { requireRole } = require('../middleware/auth');
const { buatTransaksiKas, hitungUlangSaldoKas, saldoSemuaKas } = require('../utils/kas');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

router.get('/saldo', requireRole('admin','petugas','umum'), async (req, res) => res.json(await saldoSemuaKas()));

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const filter = {};
  if (req.query.jenis_kas) filter.jenis_kas = req.query.jenis_kas;
  res.json(await TransaksiKas.find(filter).populate('dibuat_oleh','nama').sort({ tanggal: -1, createdAt: -1 }).limit(500));
});

router.post('/', requireRole('admin','petugas'), async (req, res) => {
  const { jenis_kas, keterangan, tanggal, tipe, nominal } = req.body;
  const debet = tipe === 'debet' ? Number(nominal || 0) : 0;
  const kredit = tipe === 'kredit' ? Number(nominal || 0) : 0;
  const trx = await buatTransaksiKas({
    jenis_kas,
    sumber: 'manual',
    keterangan,
    tanggal: tanggal ? new Date(tanggal) : new Date(),
    debet,
    kredit,
    dibuat_oleh: req.session.user.id
  });
  await tulisAudit(req, 'CREATE', 'Transaksi Kas', `${jenis_kas} ${tipe} ${nominal}`);
  res.json(trx);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const trx = await TransaksiKas.findById(req.params.id);
  if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  const jenisLama = trx.jenis_kas;
  const { jenis_kas, keterangan, tanggal, tipe, nominal } = req.body;
  trx.jenis_kas = jenis_kas || trx.jenis_kas;
  trx.keterangan = keterangan || trx.keterangan;
  if (tanggal) trx.tanggal = new Date(tanggal);

  if (tipe && nominal !== undefined) {
    trx.debet = tipe === 'debet' ? Number(nominal || 0) : 0;
    trx.kredit = tipe === 'kredit' ? Number(nominal || 0) : 0;
  } else {
    if (req.body.debet !== undefined) trx.debet = Number(req.body.debet || 0);
    if (req.body.kredit !== undefined) trx.kredit = Number(req.body.kredit || 0);
  }

  await trx.save();
  await hitungUlangSaldoKas(jenisLama);
  if (jenisLama !== trx.jenis_kas) await hitungUlangSaldoKas(trx.jenis_kas);
  await tulisAudit(req, 'UPDATE', 'Transaksi Kas', `Edit transaksi ${trx._id}`);
  res.json({ message: 'Transaksi berhasil diupdate', trx });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const trx = await TransaksiKas.findByIdAndDelete(req.params.id);
  if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
  await hitungUlangSaldoKas(trx.jenis_kas);
  await tulisAudit(req, 'DELETE', 'Transaksi Kas', `Hapus transaksi ${trx._id}`);
  res.json({ message: 'Transaksi dihapus' });
});

module.exports = router;
