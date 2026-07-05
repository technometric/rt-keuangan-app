const mongoose = require('mongoose');

const TunggakanIwkSchema = new mongoose.Schema({
  warga: { type: mongoose.Schema.Types.ObjectId, ref: 'WajibIwk', required: true },
  bulan: { type: Number, required: true },
  tahun: { type: Number, required: true },
  aktif: { type: Boolean, default: true },
  dibuat_oleh: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

TunggakanIwkSchema.index({ warga: 1, bulan: 1, tahun: 1 }, { unique: true });

module.exports = mongoose.model('TunggakanIwk', TunggakanIwkSchema);
