const express = require('express');
const IuranWajib = require('../models/IuranWajib');
const WajibIwk = require('../models/WajibIwk');
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

router.get('/iuran-tahun', async (req, res) => {
  const tahun = Number(req.query.tahun || new Date().getFullYear());
  const warga = await WajibIwk.find({ aktif: { $ne: false } }).sort({ area: 1, no_rumah: 1, nama: 1 }).lean();
  const iuran = await IuranWajib.find({ tahun }).populate('warga').lean();
  const map = new Map();
  for (const item of iuran) {
    const id = String(item.warga?._id || item.warga);
    const key = `${id}-${item.bulan}`;
    const existing = map.get(key);
    if (!existing || Number(item.nominal_bayar || 0) > Number(existing.nominal_bayar || 0)) map.set(key, item);
  }
  const data = warga.map(w => {
    const bulan = {};
    for (let m = 1; m <= 12; m++) {
      const item = map.get(`${w._id}-${m}`);
      bulan[m] = item ? { status: item.status, nominal: item.nominal_bayar, catatan: item.catatan_petugas || '' } : { status: 'belum_bayar', nominal: 0, catatan: '' };
    }
    return { warga: w, bulan };
  });
  res.json({ tahun, data });
});

module.exports = router;
