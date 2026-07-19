const express = require('express');
const ParameterIwk = require('../models/ParameterIwk');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

const keys = ['uang_satpam','uang_sampah','kas_pkk','kas_rt','kas_sosial','santunan_kematian'];
const publicKasKeys = ['kas_rt','kas_sosial','kas_donasi','tabungan_sampah','santunan_kematian','danus'];
const publicIwkStatusFilters = ['bayar', 'kurang', 'belum_bayar', 'semua'];
function boolFromBody(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === 'true' || value === 'on' || value === '1';
}
function hitungTotal(payload = {}) {
  return keys.reduce((t,k)=>{
    const value = payload[k] ?? (k === 'kas_pkk' ? payload.kas_rw : 0);
    return t + Number(value || 0);
  },0);
}
function normalizePayload(body = {}, old = {}) {
  const payload = {};
  for (const k of keys) payload[k] = Number(body[k] ?? (k === 'kas_pkk' ? body.kas_rw : undefined) ?? old[k] ?? (k === 'kas_pkk' ? old.kas_rw : undefined) ?? 0);
  payload.kas_rw = 0;
  payload.total_iwk = hitungTotal(payload);
  payload.minimal_nominal_iwk = Number(body.minimal_nominal_iwk ?? old.minimal_nominal_iwk ?? (Number(payload.uang_satpam || 0) + Number(payload.uang_sampah || 0)));
  payload.iwk_cutoff_bulan = Math.min(12, Math.max(1, Number(body.iwk_cutoff_bulan ?? old.iwk_cutoff_bulan ?? 7)));
  payload.iwk_cutoff_tahun = Number(body.iwk_cutoff_tahun ?? old.iwk_cutoff_tahun ?? 2026);
  payload.rekening_iwk = {
    no_rekening: String(body.rekening_iwk_no_rekening ?? old.rekening_iwk?.no_rekening ?? '').trim(),
    nama_bank: String(body.rekening_iwk_nama_bank ?? old.rekening_iwk?.nama_bank ?? '').trim(),
    nama_pemilik: String(body.rekening_iwk_nama_pemilik ?? old.rekening_iwk?.nama_pemilik ?? '').trim(),
    no_wa_konfirmasi: String(body.rekening_iwk_no_wa_konfirmasi ?? old.rekening_iwk?.no_wa_konfirmasi ?? '').trim()
  };
  payload.jumlah_kk_iuran_rw = Number(body.jumlah_kk_iuran_rw ?? old.jumlah_kk_iuran_rw ?? 75);
  payload.iuran_ambulan_bulanan = Number(body.iuran_ambulan_bulanan ?? old.iuran_ambulan_bulanan ?? 50000);
  payload.tampil_tunggakan_umum = body.tampil_tunggakan_umum === true || body.tampil_tunggakan_umum === 'true' || body.tampil_tunggakan_umum === 'on';
  payload.tampil_tunggakan_iwk_lama = body.tampil_tunggakan_iwk_lama === undefined
    ? !!old.tampil_tunggakan_iwk_lama
    : body.tampil_tunggakan_iwk_lama === true || body.tampil_tunggakan_iwk_lama === 'true' || body.tampil_tunggakan_iwk_lama === 'on';
  payload.tampil_riwayat_iwk_input = boolFromBody(body.tampil_riwayat_iwk_input, old.tampil_riwayat_iwk_input !== false);
  payload.tampil_foto_iwk_input = boolFromBody(body.tampil_foto_iwk_input, old.tampil_foto_iwk_input !== false);
  payload.validasi_catatan_transfer = boolFromBody(body.validasi_catatan_transfer, old.validasi_catatan_transfer !== false);
  payload.public_iwk_status_filter = publicIwkStatusFilters.includes(body.public_iwk_status_filter) ? body.public_iwk_status_filter : (old.public_iwk_status_filter || 'belum_bayar');
  payload.public_kas_visible = {};
  for (const key of publicKasKeys) {
    payload.public_kas_visible[key] = boolFromBody(body[`public_kas_${key}`], old.public_kas_visible?.[key] !== false);
  }
  payload.wajib_foto_cash = body.wajib_foto_cash === true || body.wajib_foto_cash === 'true' || body.wajib_foto_cash === 'on';
  payload.aktif = body.aktif === false ? false : true;
  return payload;
}
async function getParam() {
  let param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 });
  if (!param) param = await ParameterIwk.create({ aktif: true, total_iwk: 30000 });
  if (!Number(param.kas_pkk || 0) && Number(param.kas_rw || 0) > 0) {
    param.kas_pkk = Number(param.kas_rw || 0);
    param.kas_rw = 0;
  }
  if (Number(param.total_iwk || 0) !== hitungTotal(param)) {
    param.total_iwk = hitungTotal(param);
  }
  if (!Number(param.minimal_nominal_iwk || 0)) param.minimal_nominal_iwk = Number(param.uang_satpam || 0) + Number(param.uang_sampah || 0);
  if (!param.iwk_cutoff_bulan) param.iwk_cutoff_bulan = 7;
  if (!param.iwk_cutoff_tahun) param.iwk_cutoff_tahun = 2026;
  if (!param.rekening_iwk) param.rekening_iwk = {};
  if (!param.jumlah_kk_iuran_rw) param.jumlah_kk_iuran_rw = 75;
  if (!param.iuran_ambulan_bulanan) param.iuran_ambulan_bulanan = 50000;
  if (!param.public_kas_visible) param.public_kas_visible = {};
  let changedPublicKas = false;
  for (const key of publicKasKeys) {
    if (param.public_kas_visible[key] === undefined) {
      param.public_kas_visible[key] = true;
      changedPublicKas = true;
    }
  }
  if (param.tampil_riwayat_iwk_input === undefined) param.tampil_riwayat_iwk_input = true;
  if (param.tampil_foto_iwk_input === undefined) param.tampil_foto_iwk_input = true;
  if (param.validasi_catatan_transfer === undefined) param.validasi_catatan_transfer = true;
  if (!publicIwkStatusFilters.includes(param.public_iwk_status_filter)) param.public_iwk_status_filter = 'belum_bayar';
  if (changedPublicKas) param.markModified('public_kas_visible');
  await param.save();
  return param;
}

router.put('/tunggakan-iwk-lama', requireRole('admin'), async (req, res) => {
  const param = await getParam();
  param.tampil_tunggakan_iwk_lama = req.body.tampil_tunggakan_iwk_lama === true || req.body.tampil_tunggakan_iwk_lama === 'true' || req.body.tampil_tunggakan_iwk_lama === 'on';
  await param.save();
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Tunggakan IWK lama ${param.tampil_tunggakan_iwk_lama ? 'ditampilkan' : 'disembunyikan'}`);
  res.json({ message: 'Setting tunggakan IWK lama tersimpan', tampil_tunggakan_iwk_lama: param.tampil_tunggakan_iwk_lama });
});

router.put('/riwayat-iwk-input', requireRole('admin'), async (req, res) => {
  const param = await getParam();
  param.tampil_riwayat_iwk_input = boolFromBody(req.body.tampil_riwayat_iwk_input);
  await param.save();
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Riwayat IWK input ${param.tampil_riwayat_iwk_input ? 'ditampilkan' : 'disembunyikan'}`);
  res.json({ message: 'Setting riwayat IWK tersimpan', tampil_riwayat_iwk_input: param.tampil_riwayat_iwk_input });
});

router.put('/foto-iwk-input', requireRole('admin'), async (req, res) => {
  const param = await getParam();
  param.tampil_foto_iwk_input = boolFromBody(req.body.tampil_foto_iwk_input);
  await param.save();
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Input foto IWK ${param.tampil_foto_iwk_input ? 'ditampilkan' : 'disembunyikan'}`);
  res.json({ message: 'Setting input foto IWK tersimpan', tampil_foto_iwk_input: param.tampil_foto_iwk_input });
});

router.put('/validasi-catatan-transfer', requireRole('admin'), async (req, res) => {
  const param = await getParam();
  param.validasi_catatan_transfer = boolFromBody(req.body.validasi_catatan_transfer);
  await param.save();
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Validasi catatan transfer ${param.validasi_catatan_transfer ? 'diaktifkan' : 'dinonaktifkan'}`);
  res.json({ message: 'Setting validasi catatan transfer tersimpan', validasi_catatan_transfer: param.validasi_catatan_transfer });
});

router.put('/status-iwk-umum', requireRole('admin'), async (req, res) => {
  const param = await getParam();
  const value = publicIwkStatusFilters.includes(req.body.public_iwk_status_filter) ? req.body.public_iwk_status_filter : 'belum_bayar';
  param.public_iwk_status_filter = value;
  await param.save();
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Filter status IWK umum ${value}`);
  res.json({ message: 'Setting status IWK umum tersimpan', public_iwk_status_filter: value });
});

router.get('/', requireRole('admin','petugas'), async (req, res) => res.json(await getParam()));
router.get('/list', requireRole('admin'), async (req, res) => {
  const data = await ParameterIwk.find().sort({ aktif: -1, createdAt: -1 }).lean();
  res.json(data);
});
router.post('/', requireRole('admin'), async (req, res) => {
  await ParameterIwk.updateMany({}, { aktif: false });
  const created = await ParameterIwk.create(normalizePayload(req.body));
  await tulisAudit(req, 'CREATE', 'Parameter IWK', `Tambah parameter IWK total ${created.total_iwk}`);
  res.json(created);
});
router.put('/', requireRole('admin'), async (req, res) => {
  const param = await getParam();
  const updated = await ParameterIwk.findByIdAndUpdate(param._id, normalizePayload(req.body, param), { new: true });
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Update total IWK ${updated.total_iwk}`);
  res.json(updated);
});
router.put('/:id/aktif', requireRole('admin'), async (req, res) => {
  await ParameterIwk.updateMany({}, { aktif: false });
  const updated = await ParameterIwk.findByIdAndUpdate(req.params.id, { aktif: true }, { new: true });
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Aktifkan parameter IWK ${updated?.total_iwk || ''}`);
  res.json(updated);
});
module.exports = router;
