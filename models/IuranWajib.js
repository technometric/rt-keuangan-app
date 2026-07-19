const mongoose = require('mongoose');

const IuranWajibSchema = new mongoose.Schema({
  warga: { type: mongoose.Schema.Types.ObjectId, ref: 'WajibIwk', required: true },
  petugas: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nominal_bayar: { type: Number, required: true, min: 0 },
  metode_bayar: { type: String, enum: ['cash', 'transfer'], default: 'cash' },
  foto_bayar: { type: String, default: '' },
  bukti_transfer_iwk: { type: mongoose.Schema.Types.ObjectId, ref: 'BuktiTransferIwk', default: null },
  tanggal: { type: Date, default: Date.now },
  jam: { type: String, default: '' },
  bulan: { type: Number, required: true },
  tahun: { type: Number, required: true },
  status: { type: String, enum: ['bayar', 'lunas', 'kurang', 'belum_bayar', 'pratinjau'], required: true },
  catatan_petugas: { type: String, default: '' },
  grup_pembayaran: { type: String, default: '' },
  bulan_ke: { type: Number, default: 1 },
  total_bulan: { type: Number, default: 1 },
  rincian: {
    uang_satpam: { type: Number, default: 0 },
    uang_sampah: { type: Number, default: 0 },
    kas_pkk: { type: Number, default: 0 },
    kas_rw: { type: Number, default: 0 },
    kas_rt: { type: Number, default: 0 },
    kas_sosial: { type: Number, default: 0 },
    santunan_kematian: { type: Number, default: 0 }
  }
}, { timestamps: true });

IuranWajibSchema.index({ warga: 1, bulan: 1, tahun: 1 });

module.exports = mongoose.model('IuranWajib', IuranWajibSchema);
