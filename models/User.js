const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  nama: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  jabatan: { type: String, default: '-' },
  role: { type: String, enum: ['admin', 'petugas', 'umum'], required: true },
  area: { type: String, enum: ['utara', 'tengah', 'selatan', '-'], default: '-' },
  aktif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
