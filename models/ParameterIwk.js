const mongoose = require('mongoose');

const ParameterIwkSchema = new mongoose.Schema({
  uang_satpam: { type: Number, default: 11000 },
  uang_sampah: { type: Number, default: 6000 },
  kas_rw: { type: Number, default: 2000 },
  kas_rt: { type: Number, default: 5000 },
  kas_sosial: { type: Number, default: 3000 },
  santunan_kematian: { type: Number, default: 3000 },
  total_iwk: { type: Number, default: 30000 },
  wajib_foto_cash: { type: Boolean, default: false },
  aktif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ParameterIwk', ParameterIwkSchema);
