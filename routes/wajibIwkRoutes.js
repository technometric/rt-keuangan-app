const express = require('express');
const WajibIwk = require('../models/WajibIwk');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

function naturalRumah(a, b) {
  return String(a.no_rumah || '').localeCompare(String(b.no_rumah || ''), 'id', { numeric: true, sensitivity: 'base' }) || String(a.nama||'').localeCompare(String(b.nama||''), 'id');
}

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const filter = req.session.user?.role === 'admin' && String(req.query.semua || '') === 'true' ? {} : { aktif: { $ne: false } };
  const data = await WajibIwk.find(filter).lean();
  data.sort(naturalRumah);
  res.json(data);
});
function normalizeWargaBody(body = {}) {
  return {
    ...body,
    anggota_dana_santunan: body.anggota_dana_santunan === true || body.anggota_dana_santunan === 'true' || body.anggota_dana_santunan === 'on' || body.anggota_dana_santunan === '1',
    aktif: body.aktif === undefined ? true : body.aktif === true || body.aktif === 'true' || body.aktif === 'on' || body.aktif === '1'
  };
}
router.post('/', requireRole('admin'), async (req, res) => { const warga = await WajibIwk.create(normalizeWargaBody(req.body)); await tulisAudit(req, 'CREATE', 'Wajib IWK', `Tambah warga ${warga.nama}`); res.json(warga); });
router.put('/:id', requireRole('admin'), async (req, res) => { const warga = await WajibIwk.findByIdAndUpdate(req.params.id, normalizeWargaBody(req.body), { new: true }); await tulisAudit(req, 'UPDATE', 'Wajib IWK', `Update warga ${warga?.nama || req.params.id}`); res.json(warga); });
router.delete('/:id', requireRole('admin'), async (req, res) => { const warga = await WajibIwk.findByIdAndDelete(req.params.id); await tulisAudit(req, 'DELETE', 'Wajib IWK', `Hapus warga ${warga?.nama || req.params.id}`); res.json({ message: 'Data warga dihapus' }); });
module.exports = router;
