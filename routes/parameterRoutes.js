const express = require('express');
const ParameterIwk = require('../models/ParameterIwk');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

async function getParam() {
  let param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 });
  if (!param) param = await ParameterIwk.create({ aktif: true });
  return param;
}

router.get('/', requireRole('admin','petugas'), async (req, res) => res.json(await getParam()));
router.put('/', requireRole('admin'), async (req, res) => {
  const param = await getParam();
  const payload = req.body;
  payload.total_iwk = ['uang_satpam','uang_sampah','kas_rw','kas_rt','kas_sosial','santunan_kematian'].reduce((t,k)=>t+Number(payload[k] ?? param[k] ?? 0),0);
  const updated = await ParameterIwk.findByIdAndUpdate(param._id, payload, { new: true });
  await tulisAudit(req, 'UPDATE', 'Parameter IWK', `Update total IWK ${updated.total_iwk}`);
  res.json(updated);
});
module.exports = router;
