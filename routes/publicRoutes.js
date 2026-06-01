const express = require('express');
const IuranWajib = require('../models/IuranWajib');
const WajibIwk = require('../models/WajibIwk');
const ParameterIwk = require('../models/ParameterIwk');
const { saldoSemuaKas } = require('../utils/kas');
const router = express.Router();

function naturalRumah(a, b) {
  return String(a.no_rumah || '').localeCompare(String(b.no_rumah || ''), 'id', { numeric: true, sensitivity: 'base' }) || String(a.nama||'').localeCompare(String(b.nama||''), 'id');
}
function normalizeStatus(s){ return s === 'lunas' ? 'bayar' : (s || 'belum_bayar'); }

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
  data.forEach(x => x.status = normalizeStatus(x.status));
  res.json(data);
});

router.get('/iuran-tahun', async (req, res) => {
  const tahun = Number(req.query.tahun || new Date().getFullYear());
  const warga = await WajibIwk.find({ aktif: { $ne: false } }).lean();
  warga.sort(naturalRumah);
  const iuran = await IuranWajib.find({ tahun }).populate('warga').lean();
  const map = new Map();
  for (const item of iuran) {
    const id = String(item.warga?._id || item.warga);
    const key = `${id}-${item.bulan}`;
    const existing = map.get(key);
    if (!existing || Number(item.nominal_bayar || 0) > Number(existing.nominal_bayar || 0)) map.set(key, item);
  }
  const data = warga.map((w, idx) => {
    const bulan = {};
    for (let m = 1; m <= 12; m++) {
      const item = map.get(`${w._id}-${m}`);
      bulan[m] = item ? { status: normalizeStatus(item.status), nominal: item.nominal_bayar, catatan: item.catatan_petugas || '' } : { status: 'belum_bayar', nominal: 0, catatan: '' };
    }
    return { no: idx + 1, warga: w, bulan };
  });
  res.json({ tahun, data });
});


router.get('/iwk-progress', async (req, res) => {
  const now = new Date();
  const bulan = Number(req.query.bulan || now.getMonth() + 1);
  const tahun = Number(req.query.tahun || now.getFullYear());
  const param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 }).lean();
  const totalIwk = Number(param?.total_iwk || 0);
  const totalWarga = await WajibIwk.countDocuments({ aktif: { $ne: false } });
  const agg = await IuranWajib.aggregate([
    { $match: { bulan, tahun } },
    { $group: { _id: null, pendapatan: { $sum: '$nominal_bayar' }, jumlahBayar: { $sum: { $cond: [{ $gt: ['$nominal_bayar', 0] }, 1, 0] } } } }
  ]);
  const pendapatan = Number(agg[0]?.pendapatan || 0);
  const jumlahBayar = Number(agg[0]?.jumlahBayar || 0);
  const target = totalIwk * totalWarga;
  const persen = target > 0 ? Math.round((pendapatan / target) * 100) : 0;
  res.json({ bulan, tahun, total_iwk: totalIwk, total_warga: totalWarga, jumlah_bayar: jumlahBayar, pendapatan, target, persen });
});

module.exports = router;
