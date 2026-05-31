require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const ParameterIwk = require('./models/ParameterIwk');

(async () => {
  await connectDB();
  const adminExists = await User.findOne({ username: 'admin' });
  if (!adminExists) {
    await User.create({ nama: 'Administrator RT', username: 'admin', password: await bcrypt.hash('admin123', 10), jabatan: 'Bendahara/Admin', role: 'admin', area: '-' });
    await User.create({ nama: 'Petugas Utara', username: 'utara', password: await bcrypt.hash('petugas123', 10), jabatan: 'Petugas IWK', role: 'petugas', area: 'utara' });
    await User.create({ nama: 'Petugas Tengah', username: 'tengah', password: await bcrypt.hash('petugas123', 10), jabatan: 'Petugas IWK', role: 'petugas', area: 'tengah' });
    await User.create({ nama: 'Petugas Selatan', username: 'selatan', password: await bcrypt.hash('petugas123', 10), jabatan: 'Petugas IWK', role: 'petugas', area: 'selatan' });
    await User.create({ nama: 'Warga Umum', username: 'umum', password: await bcrypt.hash('umum123', 10), jabatan: 'Warga', role: 'umum', area: '-' });
  }
  if (!await ParameterIwk.findOne({ aktif: true })) await ParameterIwk.create({ aktif: true });
  console.log('Seed selesai. Login admin: admin / admin123');
  process.exit(0);
})();
