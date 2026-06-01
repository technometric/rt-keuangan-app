const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const { tulisAudit } = require('../utils/audit');

const User = require('../models/User');
const WajibIwk = require('../models/WajibIwk');
const ParameterIwk = require('../models/ParameterIwk');
const IuranWajib = require('../models/IuranWajib');
const TransaksiKas = require('../models/TransaksiKas');
const AuditTrail = require('../models/AuditTrail');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const collections = [
  { key: 'users', model: User },
  { key: 'wajib_iwk', model: WajibIwk },
  { key: 'parameter_iwk', model: ParameterIwk },
  { key: 'iuran_wajib', model: IuranWajib },
  { key: 'transaksi_kas', model: TransaksiKas },
  { key: 'audit_trail', model: AuditTrail }
];

async function makeBackup() {
  const data = {};
  for (const c of collections) data[c.key] = await c.model.find({}).lean();
  return {
    app: 'SIKERT RT02',
    version: '1.2.8',
    type: 'full-backup',
    generated_at: new Date().toISOString(),
    data
  };
}

router.get('/backup', requireRole('admin'), async (req, res) => {
  const backup = await makeBackup();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  await tulisAudit(req, 'BACKUP', 'Maintenance', `Backup data ${stamp}`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="backup-rt02-${stamp}.json"`);
  res.send(JSON.stringify(backup, null, 2));
});

router.post('/restore', requireRole('admin'), upload.single('backup'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File backup JSON belum dipilih' });
  if (req.body.confirm !== 'RESTORE') return res.status(400).json({ message: 'Ketik RESTORE untuk melanjutkan restore data' });

  let parsed;
  try {
    parsed = JSON.parse(req.file.buffer.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ message: 'File backup tidak valid. Pastikan file berformat JSON.' });
  }

  const data = parsed.data || parsed;
  const restored = {};

  for (const c of collections) {
    if (!Array.isArray(data[c.key])) continue;
    await c.model.deleteMany({});
    if (data[c.key].length) await c.model.insertMany(data[c.key], { ordered: false });
    restored[c.key] = data[c.key].length;
  }

  await tulisAudit(req, 'RESTORE', 'Maintenance', `Restore data: ${Object.entries(restored).map(([k,v]) => `${k}=${v}`).join(', ')}`);
  res.json({ message: 'Restore data berhasil. Silakan logout lalu login ulang agar session sinkron.', restored });
});

router.post('/reset-kas', requireRole('admin'), async (req, res) => {
  if (req.body.confirm !== 'RESET KAS') return res.status(400).json({ message: 'Ketik RESET KAS untuk melanjutkan reset semua transaksi kas' });
  const result = await TransaksiKas.deleteMany({});
  await tulisAudit(req, 'RESET', 'Maintenance', `Reset semua data transaksi kas. Terhapus ${result.deletedCount} data.`);
  res.json({ message: `Reset data kas berhasil. ${result.deletedCount} transaksi kas dihapus.`, deleted: result.deletedCount });
});

module.exports = router;
