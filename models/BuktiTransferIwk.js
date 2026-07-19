const mongoose = require('mongoose');

const BuktiTransferIwkSchema = new mongoose.Schema({
  warga: { type: mongoose.Schema.Types.ObjectId, ref: 'WajibIwk', required: true },
  bulan: { type: Number, required: true },
  tahun: { type: Number, required: true },
  foto_bukti: { type: String, required: true },
  status_analisa: { type: String, enum: ['menunggu', 'berhasil', 'gagal', 'tanpa_ai'], default: 'menunggu' },
  no_rekening_tujuan: { type: String, default: '' },
  nominal_transfer: { type: Number, default: 0 },
  tanggal_transfer: { type: String, default: '' },
  catatan: { type: String, default: '' },
  raw_text: { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  error_analisa: { type: String, default: '' },
  dikonfirmasi_warga: { type: Boolean, default: false },
  dikonfirmasi_pada: { type: Date, default: null }
}, { timestamps: true });

BuktiTransferIwkSchema.index({ warga: 1, bulan: 1, tahun: 1, createdAt: -1 });

module.exports = mongoose.model('BuktiTransferIwk', BuktiTransferIwkSchema);
