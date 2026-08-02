const mongoose = require('mongoose');

const WajibIwkSchema = new mongoose.Schema({
  nama: { type: String, required: true },
  nik: { type: String, default: '' },
  hp: { type: String, default: '' },
  no_rumah: { type: String, required: true },
  area: { type: String, enum: ['utara', 'tengah', 'selatan'], required: true },
  anggota_dana_santunan: { type: Boolean, default: false },
  aktif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WajibIwk', WajibIwkSchema);
