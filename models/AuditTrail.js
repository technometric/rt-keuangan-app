const mongoose = require('mongoose');

const AuditTrailSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  nama: { type: String, default: 'Sistem' },
  role: { type: String, default: '-' },
  aksi: { type: String, required: true },
  modul: { type: String, default: '-' },
  detail: { type: String, default: '' },
  ip: { type: String, default: '' },
  expiredAt: { type: Date, default: () => new Date(Date.now() + 1000 * 60 * 60 * 24 * 60), index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.model('AuditTrail', AuditTrailSchema);
