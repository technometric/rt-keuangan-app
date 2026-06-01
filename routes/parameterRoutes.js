const express = require('express');
const ParameterIwk = require('../models/ParameterIwk');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

const keys = ['uang_satpam','uang_sampah','kas_rw','kas_rt','kas_sosial','santunan_kematian'];
function hitungTotal(payload = {}) {
  return keys.reduce((t,k)=>t+Number(payload[k] || 0),0);
}
function normalizePayload(body = {}, old = {}) {
  const payload = {};
  for (const k of keys) payload[k] = Number(body[k] ?? old[k] ?? 0);
  payload.total_iwk = hitungTotal(payload);
  payload.wajib_foto_cash = body.wajib_foto_cash === true || body.wajib_foto_cash === 'true' || body.wajib_foto_cash === 'on';
  payload.aktif = body.aktif === false ? false : true;
  return payload;
}
async function getParam() {
  let param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 });
  if (!param) param = await ParameterIwk.create({ aktif: true, total_iwk: 30000 });
  if (Number(param.total_iwk || 0) !== hitungTotal(param)) {
    param.total_iwk = hitungTotal(param);
    await param.save();
  }
  return param;
}

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
