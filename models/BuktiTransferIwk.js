const mongoose = require('mongoose');

const BuktiTransferIwkSchema = new mongoose.Schema({
  warga: { type: mongoose.Schema.Types.ObjectId, ref: 'WajibIwk', required: true },
  bulan: { type: Number, required: true },
  tahun: { type: Number, required: true },
  foto_bukti: { type: String, required: true },
  status_analisa: { type: String, enum: ['menunggu', 'berhasil', 'gagal', 'tanpa_ai'], default: 'menunggu' },
  status_transaksi: { type: String, default: '' },
  bank_pengirim: { type: String, default: '' },
  validasi_bank_pengirim: { type: Boolean, default: null },
  no_rekening_tujuan: { type: String, default: '' },
  rekening_tujuan_setting: { type: String, default: '' },
  nominal_transfer: { type: Number, default: 0 },
  tanggal_transfer: { type: String, default: '' },
  cek_text_berhasil: { type: Boolean, default: false },
  cek_rekening_sesuai: { type: Boolean, default: false },
  cek_periode_sesuai: { type: Boolean, default: false },
  catatan: { type: String, default: '' },
  raw_text: { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  error_analisa: { type: String, default: '' },
  dikonfirmasi_warga: { type: Boolean, default: false },
  dikonfirmasi_pada: { type: Date, default: null }
}, { timestamps: true });

BuktiTransferIwkSchema.index({ warga: 1, bulan: 1, tahun: 1, createdAt: -1 });

module.exports = mongoose.model('BuktiTransferIwk', BuktiTransferIwkSchema);
