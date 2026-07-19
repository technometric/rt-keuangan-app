const express = require('express');
const IuranWajib = require('../models/IuranWajib');
const TransaksiKas = require('../models/TransaksiKas');
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
function periodValue(bulan, tahun) {
  return Number(tahun) * 12 + Number(bulan);
}
function cutoffPeriod(param = {}) {
  return {
    bulan: Number(param.iwk_cutoff_bulan || 7),
    tahun: Number(param.iwk_cutoff_tahun || 2026)
  };
}
function clampPeriodToCutoff(bulan, tahun, param = {}) {
  const cutoff = cutoffPeriod(param);
  return periodValue(bulan, tahun) < periodValue(cutoff.bulan, cutoff.tahun) ? cutoff : { bulan: Number(bulan), tahun: Number(tahun) };
}
function periodeKey(bulan, tahun) {
  return `${tahun}-${String(bulan).padStart(2, '0')}`;
}
function periodeLabel(bulan, tahun) {
  const nama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${nama[Number(bulan) - 1]} ${tahun}`;
}
function bulanTerakhirRange(periode = 1) {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - periode);
  return { start, end };
}
async function publicKasKeys() {
  const param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 }).lean();
  const visible = param?.public_kas_visible || {};
  const tampilUmum = ['kas_rt','kas_sosial','kas_donasi','tabungan_sampah','santunan_kematian','danus'];
  return tampilUmum.filter(k => visible[k] !== false);
}

router.get('/saldo', async (req, res) => {
  const saldo = await saldoSemuaKas();
  const tampilUmum = await publicKasKeys();
  const filtered = {};
  tampilUmum.forEach(k => filtered[k] = saldo[k] || 0);
  res.json(filtered);
});

router.get('/rekening-iwk', async (req, res) => {
  const param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 }).lean();
  const rekening = param?.rekening_iwk || {};
  const tampil = !!(rekening.no_rekening && rekening.nama_bank && rekening.nama_pemilik);
  res.json({
    tampil,
    no_rekening: rekening.no_rekening || '',
    nama_bank: rekening.nama_bank || '',
    nama_pemilik: rekening.nama_pemilik || '',
    no_wa_konfirmasi: rekening.no_wa_konfirmasi || ''
  });
});

router.get('/pengeluaran-bulan-terakhir', async (req, res) => {
  const { start, end } = bulanTerakhirRange(1);
  const jenisKas = await publicKasKeys();
  const rows = await TransaksiKas.find({
    jenis_kas: { $in: jenisKas },
    kredit: { $gt: 0 },
    tanggal: { $gte: start, $lte: end }
  }).sort({ tanggal: -1, createdAt: -1 }).limit(300).lean();
  const total = rows.reduce((sum, row) => sum + Number(row.kredit || 0), 0);
  res.json({ total, start, end, rows });
});

router.get('/donasi', async (req, res) => {
  const jenisKas = await publicKasKeys();
  if (!jenisKas.includes('kas_donasi')) return res.status(404).json({ message: 'Info donasi tidak ditampilkan untuk umum' });
  const periode = [1, 3, 12].includes(Number(req.query.periode)) ? Number(req.query.periode) : 1;
  const { start, end } = bulanTerakhirRange(periode);
  const rows = await TransaksiKas.find({
    jenis_kas: 'kas_donasi',
    debet: { $gt: 0 },
    tanggal: { $gte: start, $lte: end }
  }).sort({ tanggal: -1, createdAt: -1 }).limit(300).lean();
  const total = rows.reduce((sum, row) => sum + Number(row.debet || 0), 0);
  res.json({ periode, total, start, end, rows });
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
  const param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 }).lean();
  const requested = clampPeriodToCutoff(Number(req.query.bulan || now.getMonth() + 1), Number(req.query.tahun || now.getFullYear()), param);
  const bulan = requested.bulan;
  const tahun = requested.tahun;
  const cutoff = cutoffPeriod(param);
  const tampilTunggakanLama = !!param?.tampil_tunggakan_iwk_lama;
  const statusFilter = ['bayar', 'kurang', 'belum_bayar', 'semua'].includes(param?.public_iwk_status_filter) ? param.public_iwk_status_filter : 'belum_bayar';

  const periods = [{ ...tambahBulan(bulan, tahun, 0), jenis: 'berjalan' }];
  for (let i = 1; i <= 12; i++) {
    const period = tambahBulan(bulan, tahun, -i);
    if (periodValue(period.bulan, period.tahun) >= periodValue(cutoff.bulan, cutoff.tahun)) periods.push({ ...period, jenis: 'lama' });
  }
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
    cutoff,
    tampil_tunggakan_lama: tampilTunggakanLama,
    public_iwk_status_filter: statusFilter,
    previous_range: periods.length > 1 ? `${periodeLabel(periods[1].bulan, periods[1].tahun)} - ${periodeLabel(periods[periods.length - 1].bulan, periods[periods.length - 1].tahun)}` : '',
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
