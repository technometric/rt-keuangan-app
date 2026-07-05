const express = require('express');
const ParameterIwk = require('../models/ParameterIwk');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

const keys = ['uang_satpam','uang_sampah','kas_pkk','kas_rt','kas_sosial','santunan_kematian'];
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
  payload.jumlah_kk_iuran_rw = Number(body.jumlah_kk_iuran_rw ?? old.jumlah_kk_iuran_rw ?? 75);
  payload.iuran_ambulan_bulanan = Number(body.iuran_ambulan_bulanan ?? old.iuran_ambulan_bulanan ?? 50000);
  payload.tampil_tunggakan_umum = body.tampil_tunggakan_umum === true || body.tampil_tunggakan_umum === 'true' || body.tampil_tunggakan_umum === 'on';
  payload.tampil_tunggakan_iwk_lama = body.tampil_tunggakan_iwk_lama === undefined
    ? !!old.tampil_tunggakan_iwk_lama
    : body.tampil_tunggakan_iwk_lama === true || body.tampil_tunggakan_iwk_lama === 'true' || body.tampil_tunggakan_iwk_lama === 'on';
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
  if (!param.jumlah_kk_iuran_rw) param.jumlah_kk_iuran_rw = 75;
  if (!param.iuran_ambulan_bulanan) param.iuran_ambulan_bulanan = 50000;
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
