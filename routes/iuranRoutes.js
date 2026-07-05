const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const IuranWajib = require('../models/IuranWajib');
const WajibIwk = require('../models/WajibIwk');
const ParameterIwk = require('../models/ParameterIwk');
const TunggakanIwk = require('../models/TunggakanIwk');
const { requireRole } = require('../middleware/auth');
const { bagiIwk, minimumBayarIwk, statusIwk } = require('../utils/iwk');
const { hitungUlangSaldoKas } = require('../utils/kas');
const TransaksiKas = require('../models/TransaksiKas');
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
const bulanFull = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function rp(n){ return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function normalizeBulanList(body = {}) {
  const raw = body.bulan_list ?? body['bulan_list[]'];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const months = [...new Set(values.map(Number).filter(x => x >= 1 && x <= 12))].sort((a,b)=>a-b);
  if (months.length) return months.map(bulan => ({ bulan, tahun: Number(body.tahun || new Date().getFullYear()) }));

  const jumlahBulan = Math.max(1, Math.min(24, Number(body.jumlah_bulan || 1)));
  const bulanAwal = Number(body.bulan || (new Date().getMonth() + 1));
  const tahunAwal = Number(body.tahun || new Date().getFullYear());
  return Array.from({ length: jumlahBulan }, (_, i) => tambahBulan(bulanAwal, tahunAwal, i));
}
function legacyPeriods(date = new Date()) {
  const nowMonth = date.getMonth() + 1;
  const nowYear = date.getFullYear();
  return Array.from({ length: 12 }, (_, i) => tambahBulan(nowMonth, nowYear, -(i + 1)));
}

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const { bulan, tahun } = req.query;
  const filter = {};
  if (bulan) filter.bulan = Number(bulan);
  if (tahun) filter.tahun = Number(tahun);
  let data = await IuranWajib.find(filter).populate('warga').populate('petugas','nama area').sort({ tanggal: -1 });
  res.json(data);
});

router.get('/laporan-bulanan', requireRole('admin'), async (req, res) => {
  const now = new Date();
  const bulan = Number(req.query.bulan || now.getMonth() + 1);
  const tahun = Number(req.query.tahun || now.getFullYear());
  const rows = await IuranWajib.find({ bulan, tahun }).populate('warga').populate('petugas','nama area').sort({ tanggal: 1, createdAt: 1 }).lean();
  const total = rows.reduce((sum, x) => sum + Number(x.nominal_bayar || 0), 0);
  const jumlahBayar = rows.filter(x => Number(x.nominal_bayar || 0) > 0).length;
  const perPetugas = {};
  for (const row of rows) {
    const nama = row.petugas?.nama || '-';
    if (!perPetugas[nama]) perPetugas[nama] = { nama, jumlah: 0, total: 0 };
    perPetugas[nama].jumlah += 1;
    perPetugas[nama].total += Number(row.nominal_bayar || 0);
  }
  res.json({ bulan, tahun, periode: `${bulanFull[bulan - 1]} ${tahun}`, total, jumlah_bayar: jumlahBayar, jumlah_data: rows.length, per_petugas: Object.values(perPetugas), rows });
});

router.get('/laporan-bulanan/pdf', requireRole('admin'), async (req, res) => {
  const now = new Date();
  const bulan = Number(req.query.bulan || now.getMonth() + 1);
  const tahun = Number(req.query.tahun || now.getFullYear());
  const rows = await IuranWajib.find({ bulan, tahun }).populate('warga').populate('petugas','nama area').sort({ tanggal: 1, createdAt: 1 }).lean();
  const total = rows.reduce((sum, x) => sum + Number(x.nominal_bayar || 0), 0);
  const periode = `${bulanFull[bulan - 1]} ${tahun}`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-pemasukan-iwk-${bulan}-${tahun}.pdf"`);
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(18).text('Laporan Bulanan Pemasukan IWK', { align: 'center' });
  doc.font('Helvetica').fontSize(11).text(`Periode: ${periode}`, { align: 'center' });
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(12).text(`Total pemasukan: ${rp(total)}`);
  doc.font('Helvetica').fontSize(10).text(`Jumlah data pembayaran: ${rows.length}`);
  doc.moveDown();

  const widths = [64, 142, 64, 82, 82, 82];
  const draw = (arr, bold=false) => {
    if (doc.y > 760) doc.addPage();
    let x = 36;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    arr.forEach((v,i) => { doc.text(String(v || '-'), x, doc.y, { width: widths[i] - 4 }); x += widths[i]; });
    doc.moveDown(1.1);
  };
  draw(['Tanggal','Warga','Rumah','Petugas','Status','Nominal'], true);
  rows.forEach(row => draw([
    new Date(row.tanggal).toLocaleDateString('id-ID'),
    row.warga?.nama || '-',
    row.warga?.no_rumah || '-',
    row.petugas?.nama || '-',
    row.status || '-',
    rp(row.nominal_bayar)
  ]));
  doc.end();
});

router.get('/tunggakan-lama', requireRole('admin'), async (req, res) => {
  const periods = legacyPeriods();
  const wargaId = req.query.warga;
  const filter = { $or: periods.map(p => ({ bulan: p.bulan, tahun: p.tahun })) };
  if (wargaId) filter.warga = wargaId;
  const rows = await TunggakanIwk.find(filter).lean();
  res.json({ periods: periods.map(p => ({ ...p, label: `${bulanFull[p.bulan - 1]} ${p.tahun}` })), data: rows });
});

router.post('/tunggakan-lama', requireRole('admin'), async (req, res) => {
  const warga = await WajibIwk.findById(req.body.warga);
  if (!warga) return res.status(404).json({ message: 'Warga tidak ditemukan' });
  const selectedRaw = req.body.periode || req.body['periode[]'] || [];
  const selected = new Set((Array.isArray(selectedRaw) ? selectedRaw : [selectedRaw]).filter(Boolean));
  const periods = legacyPeriods();
  for (const p of periods) {
    const key = `${p.tahun}-${String(p.bulan).padStart(2, '0')}`;
    const aktif = selected.has(key);
    await TunggakanIwk.findOneAndUpdate(
      { warga: warga._id, bulan: p.bulan, tahun: p.tahun },
      { aktif, dibuat_oleh: req.session.user.id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  await tulisAudit(req, 'UPDATE', 'Tunggakan IWK', `Update tunggakan lama ${warga.nama}`);
  res.json({ message: 'Tunggakan lama warga tersimpan' });
});

router.post('/', requireRole('admin','petugas'), upload.single('foto_bayar'), async (req, res) => {
  const param = await getParam();
  const warga = await WajibIwk.findById(req.body.warga);
  if (!warga) return res.status(404).json({ message: 'Warga tidak ditemukan' });

  const nominalTotal = Number(req.body.nominal_bayar || 0);
  const totalIwk = Number(param.total_iwk || 0);
  const minimalIwk = minimumBayarIwk(param);
  const metode = req.body.metode_bayar || 'cash';
  const periods = normalizeBulanList(req.body);
  const jumlahBulan = periods.length;
  const tanggalInput = req.body.tanggal ? new Date(req.body.tanggal) : new Date();

  if (metode === 'cash' && param.wajib_foto_cash && param.tampil_foto_iwk_input !== false && !req.file) return res.status(400).json({ message: 'Foto cash wajib diupload' });
  if (nominalTotal < (minimalIwk * jumlahBulan)) return res.status(400).json({ message: `Minimal bayar IWK adalah ${minimalIwk.toLocaleString('id-ID')} per bulan (satpam/keamanan + sampah).` });
  if (nominalTotal < (totalIwk * jumlahBulan) && !req.body.catatan_petugas) return res.status(400).json({ message: 'Catatan wajib diisi jika belum bayar / bayar kurang' });

  let sisaBayar = nominalTotal;
  const grup = crypto.randomBytes(8).toString('hex');
  const hasilIuran = [];

  for (let i = 0; i < periods.length; i++) {
    const periode = periods[i];
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
    hasilIuran.push(iuran);
  }

  await tulisAudit(req, 'CREATE', 'Iuran IWK', `Input IWK ${warga.nama} nominal ${nominalTotal} untuk ${jumlahBulan} bulan`);
  res.json({ message: 'Pembayaran berhasil disimpan', jumlah_data: hasilIuran.length, data: hasilIuran });
});



router.put('/:id', requireRole('admin','petugas'), async (req, res) => {
  const iuran = await IuranWajib.findById(req.params.id).populate('warga');
  if (!iuran) return res.status(404).json({ message: 'Riwayat IWK tidak ditemukan' });
  if (req.session.user.role === 'petugas' && String(iuran.petugas) !== String(req.session.user.id)) {
    return res.status(403).json({ message: 'Petugas hanya bisa edit riwayat yang dibuat sendiri' });
  }

  const param = await getParam();
  const nominalBaru = Number(req.body.nominal_bayar ?? iuran.nominal_bayar);
  const catatanBaru = req.body.catatan_petugas ?? iuran.catatan_petugas;
  const totalIwk = Number(param.total_iwk || 0);
  const minimalIwk = minimumBayarIwk(param);

  if (nominalBaru < minimalIwk) {
    return res.status(400).json({ message: `Minimal bayar IWK adalah ${minimalIwk.toLocaleString('id-ID')} per bulan (satpam/keamanan + sampah).` });
  }
  if (nominalBaru < totalIwk && !catatanBaru) {
    return res.status(400).json({ message: 'Catatan wajib diisi jika bayar kurang / belum bayar' });
  }

  const rincianBaru = bagiIwk(nominalBaru, param);
  const jenisTerdampak = new Set(Object.keys(iuran.rincian?.toObject?.() || iuran.rincian || {}).concat(Object.keys(rincianBaru)));

  await TransaksiKas.deleteMany({ sumber: 'iwk', ref_id: iuran._id });

  iuran.nominal_bayar = nominalBaru;
  iuran.catatan_petugas = catatanBaru;
  iuran.status = statusIwk(nominalBaru, totalIwk);
  iuran.rincian = rincianBaru;
  await iuran.save();

  for (const jenis of jenisTerdampak) await hitungUlangSaldoKas(jenis);
  await tulisAudit(req, 'UPDATE', 'Iuran IWK', `Edit nominal/catatan IWK ${iuran.warga?.nama || req.params.id}`);
  res.json({ message: 'Riwayat IWK berhasil diperbarui', data: iuran });
});

router.delete('/:id', requireRole('admin','petugas'), async (req, res) => {
  const confirmText = String(req.body.confirm || req.query.confirm || '').toLowerCase();
  if (confirmText !== 'hapus') return res.status(400).json({ message: 'Ketik hapus untuk konfirmasi' });
  const iuran = await IuranWajib.findById(req.params.id);
  if (!iuran) return res.status(404).json({ message: 'Riwayat IWK tidak ditemukan' });
  if (req.session.user.role === 'petugas' && String(iuran.petugas) !== String(req.session.user.id)) {
    return res.status(403).json({ message: 'Petugas hanya bisa hapus riwayat yang dibuat sendiri' });
  }
  const trx = await TransaksiKas.find({ sumber: 'iwk', ref_id: req.params.id }).lean();
  const jenisTerdampak = [...new Set(trx.map(x => x.jenis_kas))];
  await TransaksiKas.deleteMany({ sumber: 'iwk', ref_id: req.params.id });
  await iuran.deleteOne();
  for (const jenis of jenisTerdampak) await hitungUlangSaldoKas(jenis);
  await tulisAudit(req, 'DELETE', 'Iuran IWK', `Hapus iuran ${req.params.id}`);
  res.json({ message: 'Iuran dihapus dan transaksi kas otomatis lama dibersihkan jika ada.' });
});
module.exports = router;
