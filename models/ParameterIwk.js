const mongoose = require('mongoose');

const ParameterIwkSchema = new mongoose.Schema({
  uang_satpam: { type: Number, default: 11000 },
  uang_sampah: { type: Number, default: 6000 },
  kas_pkk: { type: Number, default: 2000 },
  kas_rw: { type: Number, default: 0 },
  kas_rt: { type: Number, default: 5000 },
  kas_sosial: { type: Number, default: 3000 },
  santunan_kematian: { type: Number, default: 3000 },
  total_iwk: { type: Number, default: 30000 },
  jumlah_kk_iuran_rw: { type: Number, default: 75 },
  iuran_ambulan_bulanan: { type: Number, default: 50000 },
  tampil_tunggakan_umum: { type: Boolean, default: false },
  tampil_tunggakan_iwk_lama: { type: Boolean, default: false },
  tampil_riwayat_iwk_input: { type: Boolean, default: true },
  public_kas_visible: {
    kas_rt: { type: Boolean, default: true },
    kas_sosial: { type: Boolean, default: true },
    kas_donasi: { type: Boolean, default: true },
    tabungan_sampah: { type: Boolean, default: true },
    santunan_kematian: { type: Boolean, default: true },
    danus: { type: Boolean, default: true }
  },
  wajib_foto_cash: { type: Boolean, default: false },
  aktif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ParameterIwk', ParameterIwkSchema);
