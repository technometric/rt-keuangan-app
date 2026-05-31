const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const IuranWajib = require('../models/IuranWajib');
const WajibIwk = require('../models/WajibIwk');
const ParameterIwk = require('../models/ParameterIwk');
const { requireRole } = require('../middleware/auth');
const { bagiIwk, statusIwk } = require('../utils/iwk');
const { buatTransaksiKas } = require('../utils/kas');
const { tulisAudit } = require('../utils/audit');
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

function tambahBulan(bulan, tahun, offset) {
  const d = new Date(Number(tahun), Number(bulan) - 1 + offset, 1);
  return { bulan: d.getMonth() + 1, tahun: d.getFullYear() };
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

  const nominalTotal = Number(req.body.nominal_bayar || 0);
  const totalIwk = Number(param.total_iwk || 0);
  const metode = req.body.metode_bayar || 'cash';
  const jumlahBulan = Math.max(1, Math.min(24, Number(req.body.jumlah_bulan || 1)));
  const bulanAwal = Number(req.body.bulan || (new Date().getMonth() + 1));
  const tahunAwal = Number(req.body.tahun || new Date().getFullYear());
  const tanggalInput = req.body.tanggal ? new Date(req.body.tanggal) : new Date();

  if (metode === 'cash' && param.wajib_foto_cash && !req.file) return res.status(400).json({ message: 'Foto cash wajib diupload' });
  if (nominalTotal < (totalIwk * jumlahBulan) && !req.body.catatan_petugas) return res.status(400).json({ message: 'Catatan wajib diisi jika belum bayar / bayar kurang' });

  let sisaBayar = nominalTotal;
  const grup = crypto.randomBytes(8).toString('hex');
  const hasilIuran = [];

  for (let i = 0; i < jumlahBulan; i++) {
    const periode = tambahBulan(bulanAwal, tahunAwal, i);
    const nominalPeriode = Math.min(sisaBayar, totalIwk);
    sisaBayar -= nominalPeriode;
    const rincian = bagiIwk(nominalPeriode, param);
    const tanggalPeriode = new Date(periode.tahun, periode.bulan - 1, tanggalInput.getDate(), tanggalInput.getHours(), tanggalInput.getMinutes());

    const iuran = await IuranWajib.create({
      warga: warga._id,
      petugas: req.session.user.id,
      nominal_bayar: nominalPeriode,
      metode_bayar: metode,
      foto_bayar: req.file ? '/uploads/' + req.file.filename : '',
      tanggal: tanggalPeriode,
      jam: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      bulan: periode.bulan,
      tahun: periode.tahun,
      status: statusIwk(nominalPeriode, totalIwk),
      catatan_petugas: req.body.catatan_petugas || '',
      grup_pembayaran: grup,
      bulan_ke: i + 1,
      total_bulan: jumlahBulan,
      rincian
    });

    for (const [jenis_kas, debet] of Object.entries(rincian)) {
      if (debet > 0) await buatTransaksiKas({ jenis_kas, sumber: 'iwk', ref_id: iuran._id, keterangan: `IWK ${warga.nama} - ${periode.bulan}/${periode.tahun}`, tanggal: tanggalPeriode, debet, kredit: 0, dibuat_oleh: req.session.user.id });
    }
    hasilIuran.push(iuran);
  }

  await tulisAudit(req, 'CREATE', 'Iuran IWK', `Input IWK ${warga.nama} nominal ${nominalTotal} untuk ${jumlahBulan} bulan`);
  res.json({ message: 'Pembayaran berhasil disimpan', jumlah_data: hasilIuran.length, data: hasilIuran });
});

router.delete('/:id', requireRole('admin'), async (req, res) => { await IuranWajib.findByIdAndDelete(req.params.id); await tulisAudit(req, 'DELETE', 'Iuran IWK', `Hapus iuran ${req.params.id}`); res.json({ message: 'Iuran dihapus. Catatan: transaksi kas otomatis belum dibalik di starter ini.' }); });
module.exports = router;
