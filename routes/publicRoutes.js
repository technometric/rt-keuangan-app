const express = require('express');
const IuranWajib = require('../models/IuranWajib');
const WajibIwk = require('../models/WajibIwk');
const ParameterIwk = require('../models/ParameterIwk');
const TunggakanIwk = require('../models/TunggakanIwk');
const { saldoSemuaKas } = require('../utils/kas');
const { requirePublicWarga } = require('../middleware/auth');
const router = express.Router();

router.use(requirePublicWarga);

function naturalRumah(a, b) {
  return String(a.no_rumah || '').localeCompare(String(b.no_rumah || ''), 'id', { numeric: true, sensitivity: 'base' }) || String(a.nama||'').localeCompare(String(b.nama||''), 'id');
}
function normalizeStatus(s){ return s === 'lunas' ? 'bayar' : (s || 'belum_bayar'); }
function bulanSebelumnya(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return { bulan: d.getMonth() + 1, tahun: d.getFullYear() };
}
function tambahBulan(bulan, tahun, offset) {
  const d = new Date(Number(tahun), Number(bulan) - 1 + offset, 1);
  return { bulan: d.getMonth() + 1, tahun: d.getFullYear() };
}
function periodeKey(bulan, tahun) {
  return `${tahun}-${String(bulan).padStart(2, '0')}`;
}
function periodeLabel(bulan, tahun) {
  const nama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${nama[Number(bulan) - 1]} ${tahun}`;
}

router.get('/saldo', async (req, res) => {
  const saldo = await saldoSemuaKas();
  const param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 }).lean();
  const visible = param?.public_kas_visible || {};
  const tampilUmum = ['kas_rt','kas_sosial','kas_donasi','tabungan_sampah','santunan_kematian','danus'];
  const filtered = {};
  tampilUmum.forEach(k => {
    if (visible[k] !== false) filtered[k] = saldo[k] || 0;
  });
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

router.get('/iwk-status-cards', async (req, res) => {
  const now = new Date();
  const bulan = Number(req.query.bulan || now.getMonth() + 1);
  const tahun = Number(req.query.tahun || now.getFullYear());
  const param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 }).lean();
  const tampilTunggakanLama = !!param?.tampil_tunggakan_iwk_lama;

  const periods = [{ ...tambahBulan(bulan, tahun, 0), jenis: 'berjalan' }];
  for (let i = 1; i <= 12; i++) periods.push({ ...tambahBulan(bulan, tahun, -i), jenis: 'lama' });
  const years = [...new Set(periods.map(p => p.tahun))];

  const warga = await WajibIwk.find({ aktif: { $ne: false } }).lean();
  warga.sort(naturalRumah);
  const iuran = await IuranWajib.find({ tahun: { $in: years } }).populate('warga').lean();
  const legacyRows = tampilTunggakanLama ? await TunggakanIwk.find({
    aktif: true,
    tahun: { $in: years }
  }).lean() : [];
  const periodSet = new Set(periods.map(p => periodeKey(p.bulan, p.tahun)));
  const map = new Map();
  for (const item of iuran) {
    const key = periodeKey(item.bulan, item.tahun);
    if (!periodSet.has(key)) continue;
    const wargaId = String(item.warga?._id || item.warga);
    const mapKey = `${wargaId}-${key}`;
    const existing = map.get(mapKey);
    if (!existing || Number(item.nominal_bayar || 0) > Number(existing.nominal_bayar || 0)) map.set(mapKey, item);
  }
  const legacySet = new Set();
  for (const item of legacyRows) {
    const key = periodeKey(item.bulan, item.tahun);
    if (periodSet.has(key)) legacySet.add(`${String(item.warga)}-${key}`);
  }

  const data = warga.map((w, idx) => {
    const bulanRows = periods.map(p => {
      const item = map.get(`${w._id}-${periodeKey(p.bulan, p.tahun)}`);
      const legacyUnpaid = p.jenis === 'lama' && legacySet.has(`${String(w._id)}-${periodeKey(p.bulan, p.tahun)}`);
      const status = legacyUnpaid ? 'belum_bayar' : item ? normalizeStatus(item.status) : (p.jenis === 'lama' ? 'bayar' : 'belum_bayar');
      const nominal = Number(item?.nominal_bayar || 0);
      return {
        bulan: p.bulan,
        tahun: p.tahun,
        label: periodeLabel(p.bulan, p.tahun),
        jenis: p.jenis,
        status,
        nominal,
        catatan: legacyUnpaid ? 'Ditandai tunggakan lama' : item?.catatan_petugas || ''
      };
    });
    const current = bulanRows[0];
    const previous = tampilTunggakanLama ? bulanRows.slice(1) : [];
    const hasTunggakanLama = previous.some(x => normalizeStatus(x.status) === 'belum_bayar');
    return {
      no: idx + 1,
      warga: w,
      current,
      previous,
      tampil_tunggakan_lama: tampilTunggakanLama,
      has_tunggakan_lama: hasTunggakanLama
    };
  });

  res.json({
    bulan,
    tahun,
    periode: periodeLabel(bulan, tahun),
    tampil_tunggakan_lama: tampilTunggakanLama,
    previous_range: periods.length > 1 ? `${periods[1].label || periodeLabel(periods[1].bulan, periods[1].tahun)} - ${periods[12].label || periodeLabel(periods[12].bulan, periods[12].tahun)}` : '',
    data
  });
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

router.get('/tunggakan-sebelumnya', async (req, res) => {
  const param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 }).lean();
  if (!param?.tampil_tunggakan_umum) {
    return res.json({ tampil: false, data: [] });
  }
  const periode = bulanSebelumnya();
  const warga = await WajibIwk.find({ aktif: { $ne: false } }).lean();
  warga.sort(naturalRumah);
  const iuran = await IuranWajib.find({ bulan: periode.bulan, tahun: periode.tahun }).populate('warga').lean();
  const paidMap = new Map();
  for (const item of iuran) {
    const id = String(item.warga?._id || item.warga || '');
    if (normalizeStatus(item.status) === 'bayar' || Number(item.nominal_bayar || 0) > 0) paidMap.set(id, item);
  }
  const data = warga
    .filter(w => !paidMap.has(String(w._id)))
    .map((w, idx) => ({ no: idx + 1, nama: w.nama, no_rumah: w.no_rumah, area: w.area || '-' }));
  res.json({ tampil: true, bulan: periode.bulan, tahun: periode.tahun, data });
});

module.exports = router;
