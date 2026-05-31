const express = require('express');
const multer = require('multer');
const path = require('path');
const IuranWajib = require('../models/IuranWajib');
const WajibIwk = require('../models/WajibIwk');
const ParameterIwk = require('../models/ParameterIwk');
const { requireRole } = require('../middleware/auth');
const { bagiIwk, statusIwk } = require('../utils/iwk');
const { buatTransaksiKas } = require('../utils/kas');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename: (_, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage });

async function getParam() {
  let param = await ParameterIwk.findOne({ aktif: true }).sort({ createdAt: -1 });
  if (!param) param = await ParameterIwk.create({ aktif: true });
  return param;
}

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const { bulan, tahun } = req.query;
  const filter = {};
  if (bulan) filter.bulan = Number(bulan);
  if (tahun) filter.tahun = Number(tahun);
  let data = await IuranWajib.find(filter).populate('warga').populate('petugas','nama area').sort({ tanggal: -1 });
  if (req.session.user.role === 'petugas') data = data.filter(x => x.warga?.area === req.session.user.area);
  res.json(data);
});

router.post('/', requireRole('admin','petugas'), upload.single('foto_bayar'), async (req, res) => {
  const param = await getParam();
  const warga = await WajibIwk.findById(req.body.warga);
  if (!warga) return res.status(404).json({ message: 'Warga tidak ditemukan' });
  if (req.session.user.role === 'petugas' && warga.area !== req.session.user.area) return res.status(403).json({ message: 'Warga bukan area petugas ini' });

  const nominal = Number(req.body.nominal_bayar || 0);
  const metode = req.body.metode_bayar || 'cash';
  if (metode === 'cash' && param.wajib_foto_cash && !req.file) return res.status(400).json({ message: 'Foto cash wajib diupload' });
  if (nominal < Number(param.total_iwk) && !req.body.catatan_petugas) return res.status(400).json({ message: 'Catatan wajib diisi jika belum bayar / bayar kurang' });

  const tanggal = req.body.tanggal ? new Date(req.body.tanggal) : new Date();
  const rincian = bagiIwk(nominal, param);
  const iuran = await IuranWajib.create({
    warga: warga._id,
    petugas: req.session.user.id,
    nominal_bayar: nominal,
    metode_bayar: metode,
    foto_bayar: req.file ? '/uploads/' + req.file.filename : '',
    tanggal,
    jam: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    bulan: Number(req.body.bulan || (tanggal.getMonth() + 1)),
    tahun: Number(req.body.tahun || tanggal.getFullYear()),
    status: statusIwk(nominal, param.total_iwk),
    catatan_petugas: req.body.catatan_petugas || '',
    rincian
  });

  for (const [jenis_kas, debet] of Object.entries(rincian)) {
    if (debet > 0) await buatTransaksiKas({ jenis_kas, sumber: 'iwk', ref_id: iuran._id, keterangan: `IWK ${warga.nama} - ${iuran.bulan}/${iuran.tahun}`, tanggal, debet, kredit: 0, dibuat_oleh: req.session.user.id });
  }
  res.json(iuran);
});

router.delete('/:id', requireRole('admin'), async (req, res) => { await IuranWajib.findByIdAndDelete(req.params.id); res.json({ message: 'Iuran dihapus. Catatan: transaksi kas otomatis belum dibalik di starter ini.' }); });
module.exports = router;
