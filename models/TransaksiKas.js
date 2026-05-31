const mongoose = require('mongoose');

const TransaksiKasSchema = new mongoose.Schema({
  jenis_kas: { type: String, required: true },
  sumber: { type: String, default: 'manual' },
  ref_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  keterangan: { type: String, required: true },
  tanggal: { type: Date, default: Date.now },
  debet: { type: Number, default: 0 },
  kredit: { type: Number, default: 0 },
  saldo: { type: Number, default: 0 },
  dibuat_oleh: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('TransaksiKas', TransaksiKasSchema);
