const mongoose = require('mongoose');

const IuranWajibSchema = new mongoose.Schema({
  warga: { type: mongoose.Schema.Types.ObjectId, ref: 'WajibIwk', required: true },
  petugas: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nominal_bayar: { type: Number, required: true, min: 0 },
  metode_bayar: { type: String, enum: ['cash', 'transfer'], default: 'cash' },
  foto_bayar: { type: String, default: '' },
  tanggal: { type: Date, default: Date.now },
  jam: { type: String, default: '' },
  bulan: { type: Number, required: true },
  tahun: { type: Number, required: true },
  status: { type: String, enum: ['lunas', 'kurang', 'belum_bayar'], required: true },
  catatan_petugas: { type: String, default: '' },
  rincian: {
    uang_satpam: { type: Number, default: 0 },
    uang_sampah: { type: Number, default: 0 },
    kas_rw: { type: Number, default: 0 },
    kas_rt: { type: Number, default: 0 },
    kas_sosial: { type: Number, default: 0 },
    santunan_kematian: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('IuranWajib', IuranWajibSchema);
