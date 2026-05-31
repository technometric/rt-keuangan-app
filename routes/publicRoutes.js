const express = require('express');
const IuranWajib = require('../models/IuranWajib');
const { saldoSemuaKas } = require('../utils/kas');
const router = express.Router();

router.get('/saldo', async (req, res) => {
  const saldo = await saldoSemuaKas();
  const tampilUmum = ['kas_rt','kas_sosial','kas_donasi','tabungan_sampah','santunan_kematian','danus'];
  const filtered = {};
  tampilUmum.forEach(k => filtered[k] = saldo[k] || 0);
  res.json(filtered);
});
router.get('/iuran-wajib', async (req, res) => {
  const { bulan, tahun } = req.query;
  const filter = {};
  if (bulan) filter.bulan = Number(bulan);
  if (tahun) filter.tahun = Number(tahun);
  const data = await IuranWajib.find(filter).populate('warga').populate('petugas','nama area').sort({ tanggal: -1 }).lean();
  res.json(data);
});

module.exports = router;
