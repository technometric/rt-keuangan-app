const express = require('express');
const IuranWajib = require('../models/IuranWajib');
const { saldoSemuaKas } = require('../utils/kas');
const router = express.Router();

router.get('/saldo', async (req, res) => res.json(await saldoSemuaKas()));
router.get('/iuran-wajib', async (req, res) => {
  const { bulan, tahun } = req.query;
  const filter = {};
  if (bulan) filter.bulan = Number(bulan);
  if (tahun) filter.tahun = Number(tahun);
  const data = await IuranWajib.find(filter).populate('warga').populate('petugas','nama area').sort({ tanggal: -1 }).lean();
  res.json(data);
});

module.exports = router;
