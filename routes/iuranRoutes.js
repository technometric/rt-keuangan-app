const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const IuranWajib = require('../models/IuranWajib');
const WajibIwk = require('../models/WajibIwk');
const ParameterIwk = require('../models/ParameterIwk');
const TunggakanIwk = require('../models/TunggakanIwk');
const BuktiTransferIwk = require('../models/BuktiTransferIwk');
const { requireRole } = require('../middleware/auth');
const { bagiIwk, minimumBayarIwk, batasStatusBayarIwk, statusIwk, totalIwkWarga } = require('../utils/iwk');
const { buatTransaksiKas, hitungUlangSaldoKas } = require('../utils/kas');
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
function periodValue(bulan, tahun) {
  return Number(tahun) * 12 + Number(bulan);
}
const bulanFull = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function rp(n){ return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }

async function perbaikiKasDanaSantunanLama() {
  const res = await TransaksiKas.updateMany(
    { sumber: 'dana_santunan', jenis_kas: 'kas_sosial' },
    { $set: { jenis_kas: 'santunan_kematian' } }
  );
  if (res.modifiedCount > 0) {
    await hitungUlangSaldoKas('kas_sosial');
    await hitungUlangSaldoKas('santunan_kematian');
  }
}

function bolehKelolaTransaksi(req, trx) {
  return req.session.user.role === 'admin' || String(trx.dibuat_oleh) === String(req.session.user.id);
}

function normalizeRawArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function normalizeBulanList(body = {}) {
  const values = [
    ...normalizeRawArray(body.bulan_list),
    ...normalizeRawArray(body['bulan_list[]'])
  ];
  const jsonRaw = body.bulan_list_json || body.bulan_list_csv;
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw);
      values.push(...normalizeRawArray(parsed));
    } catch (_) {
      values.push(...String(jsonRaw).split(','));
    }
  }
  const months = [...new Set(values.flatMap(value => String(value).split(',')).map(Number).filter(x => x >= 1 && x <= 12))].sort((a,b)=>a-b);
  if (months.length) return months.map(bulan => ({ bulan, tahun: Number(body.tahun || new Date().getFullYear()) }));

  const jumlahBulan = Math.max(1, Math.min(24, Number(body.jumlah_bulan || 1)));
  const bulanAwal = Number(body.bulan || (new Date().getMonth() + 1));
  const tahunAwal = Number(body.tahun || new Date().getFullYear());
  return Array.from({ length: jumlahBulan }, (_, i) => tambahBulan(bulanAwal, tahunAwal, i));
}
async function legacyPeriods(date = new Date()) {
  const param = await getParam();
  const cutoffBulan = Number(param.iwk_cutoff_bulan || 7);
  const cutoffTahun = Number(param.iwk_cutoff_tahun || 2026);
  const cutoffValue = periodValue(cutoffBulan, cutoffTahun);
  const nowMonth = date.getMonth() + 1;
  const nowYear = date.getFullYear();
  return Array.from({ length: 12 }, (_, i) => tambahBulan(nowMonth, nowYear, -(i + 1)))
    .filter(p => periodValue(p.bulan, p.tahun) >= cutoffValue);
}

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  const { bulan, tahun } = req.query;
  const filter = {};
  if (bulan) filter.bulan = Number(bulan);
  if (tahun) filter.tahun = Number(tahun);
  let data = await IuranWajib.find(filter).populate('warga').populate('petugas','nama area').populate('bukti_transfer_iwk').sort({ tanggal: -1 });
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
  doc.font('Helvetica-Bold').fontSize(12).text(`Total pemasukan IWK: ${rp(total)}`);
  doc.font('Helvetica').fontSize(10).text(`Jumlah data pembayaran: ${rows.length}`);
  doc.moveDown();

  const tableX = 36;
  const widths = [62, 146, 58, 86, 64, 84];
  const rowHeight = 24;
  const headerHeight = 22;
  const pageBottom = 790;
  let y = doc.y;

  const fitText = (value, width) => {
    let text = String(value || '-');
    const maxWidth = width - 8;
    while (text.length > 3 && doc.widthOfString(text) > maxWidth) text = text.slice(0, -2);
    return text.length < String(value || '-').length ? text.slice(0, -3) + '...' : text;
  };
  const drawHeader = () => {
    let x = tableX;
    doc.rect(tableX, y, widths.reduce((a,b)=>a+b,0), headerHeight).fill('#f1f5f9');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
    ['Tanggal','Warga','Rumah','Petugas','Status','Nominal'].forEach((text, i) => {
      doc.text(text, x + 4, y + 7, { width: widths[i] - 8, height: 10 });
      x += widths[i];
    });
    doc.rect(tableX, y, widths.reduce((a,b)=>a+b,0), headerHeight).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
    y += headerHeight;
  };
  const addPageIfNeeded = () => {
    if (y + rowHeight <= pageBottom) return;
    doc.addPage();
    y = 36;
    drawHeader();
  };
  const drawRow = (arr) => {
    addPageIfNeeded();
    let x = tableX;
    doc.rect(tableX, y, widths.reduce((a,b)=>a+b,0), rowHeight).strokeColor('#e2e8f0').lineWidth(0.45).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    arr.forEach((value, i) => {
      const align = i === 5 ? 'right' : 'left';
      doc.text(fitText(value, widths[i]), x + 4, y + 7, { width: widths[i] - 8, height: 10, align });
      x += widths[i];
    });
    y += rowHeight;
  };

  drawHeader();
  rows.forEach(row => drawRow([
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
  const periods = await legacyPeriods();
  const wargaId = req.query.warga;
  if (!periods.length) return res.json({ periods: [], data: [] });
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
  const periods = await legacyPeriods();
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
  if (warga.aktif === false) return res.status(400).json({ message: 'Warga nonaktif tidak bisa diinput pembayaran IWK' });

  const nominalTotal = Number(req.body.nominal_bayar || 0);
  const totalIwk = totalIwkWarga(param, warga);
  const minimalIwk = minimumBayarIwk(param);
  const batasStatusBayar = batasStatusBayarIwk(param);
  const metode = req.body.metode_bayar || 'cash';
  const periods = normalizeBulanList(req.body);
  const jumlahBulan = periods.length;
  const tanggalInput = req.body.tanggal ? new Date(req.body.tanggal) : new Date();

  if (metode === 'cash' && param.wajib_foto_cash && param.tampil_foto_iwk_input !== false && !req.file) return res.status(400).json({ message: 'Foto cash wajib diupload' });
  if (nominalTotal < (minimalIwk * jumlahBulan)) return res.status(400).json({ message: `Minimal bayar IWK adalah ${minimalIwk.toLocaleString('id-ID')} per bulan sesuai setting minimal nominal IWK.` });
  if (nominalTotal < (batasStatusBayar * jumlahBulan) && !req.body.catatan_petugas) return res.status(400).json({ message: 'Catatan wajib diisi jika belum bayar / bayar kurang' });

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
      status: statusIwk(nominalPeriode, batasStatusBayar),
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

router.post('/donasi', requireRole('admin','petugas'), async (req, res) => {
  const nama = String(req.body.nama || '').trim();
  const noRumah = String(req.body.no_rumah || '').trim();
  const nominal = Number(req.body.nominal || 0);
  if (!nama) return res.status(400).json({ message: 'Nama penyumbang wajib diisi' });
  if (!noRumah) return res.status(400).json({ message: 'Nomor rumah wajib diisi' });
  if (nominal <= 0) return res.status(400).json({ message: 'Nominal donasi wajib lebih dari 0' });
  const tanggal = req.body.tanggal ? new Date(req.body.tanggal) : new Date();
  const trx = await buatTransaksiKas({
    jenis_kas: 'kas_donasi',
    sumber: 'donasi',
    ref_id: null,
    keterangan: `${nama} - No ${noRumah}`,
    tanggal,
    debet: nominal,
    kredit: 0,
    dibuat_oleh: req.session.user.id
  });
  await tulisAudit(req, 'CREATE', 'Donasi', `Input donasi ${nama} ${nominal}`);
  res.json({ message: 'Donasi berhasil disimpan', data: trx });
});

router.get('/donasi/riwayat', requireRole('admin','petugas'), async (req, res) => {
  const now = new Date();
  const bulan = Number(req.query.bulan || now.getMonth() + 1);
  const tahun = Number(req.query.tahun || now.getFullYear());
  const start = new Date(tahun, bulan - 1, 1);
  const end = new Date(tahun, bulan, 1);
  const rows = await TransaksiKas.find({
    jenis_kas: 'kas_donasi',
    sumber: 'donasi',
    tanggal: { $gte: start, $lt: end }
  }).populate('dibuat_oleh', 'nama').sort({ tanggal: -1, createdAt: -1 }).lean();
  res.json({ bulan, tahun, rows });
});

router.put('/donasi/:id', requireRole('admin','petugas'), async (req, res) => {
  const trx = await TransaksiKas.findOne({ _id: req.params.id, sumber: 'donasi', jenis_kas: 'kas_donasi' });
  if (!trx) return res.status(404).json({ message: 'Riwayat donasi tidak ditemukan' });
  if (!bolehKelolaTransaksi(req, trx)) return res.status(403).json({ message: 'Petugas hanya bisa edit riwayat yang dibuat sendiri' });
  const nominal = Number(req.body.nominal ?? req.body.debet ?? trx.debet);
  if (nominal <= 0) return res.status(400).json({ message: 'Nominal donasi wajib lebih dari 0' });
  const nama = String(req.body.nama || '').trim();
  const noRumah = String(req.body.no_rumah || '').trim();
  if (nama && noRumah) trx.keterangan = `${nama} - No ${noRumah}`;
  else if (req.body.keterangan) trx.keterangan = String(req.body.keterangan).trim();
  if (req.body.tanggal) trx.tanggal = new Date(req.body.tanggal);
  trx.debet = nominal;
  trx.kredit = 0;
  await trx.save();
  await hitungUlangSaldoKas('kas_donasi');
  await tulisAudit(req, 'UPDATE', 'Donasi', `Edit donasi ${trx._id}`);
  res.json({ message: 'Riwayat donasi berhasil diperbarui', data: trx });
});

router.delete('/donasi/:id', requireRole('admin','petugas'), async (req, res) => {
  const confirmText = String(req.body.confirm || req.query.confirm || '').toLowerCase();
  if (confirmText !== 'hapus') return res.status(400).json({ message: 'Ketik hapus untuk konfirmasi' });
  const trx = await TransaksiKas.findOne({ _id: req.params.id, sumber: 'donasi', jenis_kas: 'kas_donasi' });
  if (!trx) return res.status(404).json({ message: 'Riwayat donasi tidak ditemukan' });
  if (!bolehKelolaTransaksi(req, trx)) return res.status(403).json({ message: 'Petugas hanya bisa hapus riwayat yang dibuat sendiri' });
  await trx.deleteOne();
  await hitungUlangSaldoKas('kas_donasi');
  await tulisAudit(req, 'DELETE', 'Donasi', `Hapus donasi ${req.params.id}`);
  res.json({ message: 'Riwayat donasi berhasil dihapus' });
});

router.post('/dana-santunan', requireRole('admin','petugas'), upload.none(), async (req, res) => {
  const warga = await WajibIwk.findById(req.body.warga);
  if (!warga) return res.status(404).json({ message: 'Warga tidak ditemukan' });
  if (warga.aktif === false) return res.status(400).json({ message: 'Warga nonaktif tidak bisa input Dana Santunan' });
  if (warga.anggota_dana_santunan !== true) return res.status(400).json({ message: 'Warga ini bukan anggota Dana Santunan' });

  const param = await getParam();
  const nominalTotal = Number(req.body.nominal || 0);
  const defaultNominal = Number(param.dana_santunan_bulanan || param.santunan_kematian || 0);
  const periods = normalizeBulanList(req.body);
  const jumlahBulan = periods.length;
  if (!jumlahBulan) return res.status(400).json({ message: 'Pilih minimal 1 bulan Dana Santunan' });
  if (nominalTotal <= 0) return res.status(400).json({ message: 'Nominal Dana Santunan wajib lebih dari 0' });
  if (defaultNominal > 0 && nominalTotal < defaultNominal * jumlahBulan) return res.status(400).json({ message: `Nominal Dana Santunan minimal ${defaultNominal.toLocaleString('id-ID')} per bulan.` });

  let sisa = nominalTotal;
  const tanggalInput = req.body.tanggal ? new Date(req.body.tanggal) : new Date();
  const rows = [];
  for (let i = 0; i < periods.length; i++) {
    const periode = periods[i];
    const nominalPeriode = Math.min(sisa, defaultNominal > 0 ? defaultNominal : sisa);
    sisa -= nominalPeriode;
    const tanggal = new Date(periode.tahun, periode.bulan - 1, tanggalInput.getDate(), tanggalInput.getHours(), tanggalInput.getMinutes());
    const trx = await buatTransaksiKas({
      jenis_kas: 'santunan_kematian',
      sumber: 'dana_santunan',
      ref_id: warga._id,
      keterangan: `Dana Santunan ${warga.nama} (${warga.no_rumah}) - ${bulanFull[periode.bulan - 1]} ${periode.tahun}`,
      tanggal,
      debet: nominalPeriode,
      kredit: 0,
      dibuat_oleh: req.session.user.id
    });
    rows.push({ ...trx.toObject(), bulan: periode.bulan, tahun: periode.tahun });
  }

  await tulisAudit(req, 'CREATE', 'Dana Santunan', `Input Dana Santunan ${warga.nama} nominal ${nominalTotal} untuk ${jumlahBulan} bulan`);
  res.json({ message: 'Dana Santunan berhasil disimpan ke Kas Dana Santunan', jumlah_data: rows.length, data: rows });
});

router.get('/dana-santunan/riwayat', requireRole('admin','petugas'), async (req, res) => {
  await perbaikiKasDanaSantunanLama();
  const now = new Date();
  const bulan = Number(req.query.bulan || now.getMonth() + 1);
  const tahun = Number(req.query.tahun || now.getFullYear());
  const start = new Date(tahun, bulan - 1, 1);
  const end = new Date(tahun, bulan, 1);
  const rows = await TransaksiKas.find({
    jenis_kas: 'santunan_kematian',
    sumber: 'dana_santunan',
    tanggal: { $gte: start, $lt: end }
  }).populate('dibuat_oleh', 'nama').sort({ tanggal: -1, createdAt: -1 }).lean();
  res.json({ bulan, tahun, rows });
});

router.put('/dana-santunan/:id', requireRole('admin','petugas'), async (req, res) => {
  await perbaikiKasDanaSantunanLama();
  const trx = await TransaksiKas.findOne({ _id: req.params.id, sumber: 'dana_santunan' });
  if (!trx) return res.status(404).json({ message: 'Riwayat Dana Santunan tidak ditemukan' });
  if (!bolehKelolaTransaksi(req, trx)) return res.status(403).json({ message: 'Petugas hanya bisa edit riwayat yang dibuat sendiri' });
  const nominal = Number(req.body.nominal ?? req.body.debet ?? trx.debet);
  if (nominal <= 0) return res.status(400).json({ message: 'Nominal Dana Santunan wajib lebih dari 0' });
  if (req.body.tanggal) trx.tanggal = new Date(req.body.tanggal);
  if (req.body.keterangan) trx.keterangan = String(req.body.keterangan).trim();
  trx.jenis_kas = 'santunan_kematian';
  trx.debet = nominal;
  trx.kredit = 0;
  await trx.save();
  await hitungUlangSaldoKas('kas_sosial');
  await hitungUlangSaldoKas('santunan_kematian');
  await tulisAudit(req, 'UPDATE', 'Dana Santunan', `Edit Dana Santunan ${trx._id}`);
  res.json({ message: 'Riwayat Dana Santunan berhasil diperbarui', data: trx });
});

router.delete('/dana-santunan/:id', requireRole('admin','petugas'), async (req, res) => {
  await perbaikiKasDanaSantunanLama();
  const confirmText = String(req.body.confirm || req.query.confirm || '').toLowerCase();
  if (confirmText !== 'hapus') return res.status(400).json({ message: 'Ketik hapus untuk konfirmasi' });
  const trx = await TransaksiKas.findOne({ _id: req.params.id, sumber: 'dana_santunan' });
  if (!trx) return res.status(404).json({ message: 'Riwayat Dana Santunan tidak ditemukan' });
  if (!bolehKelolaTransaksi(req, trx)) return res.status(403).json({ message: 'Petugas hanya bisa hapus riwayat yang dibuat sendiri' });
  await trx.deleteOne();
  await hitungUlangSaldoKas('santunan_kematian');
  await tulisAudit(req, 'DELETE', 'Dana Santunan', `Hapus Dana Santunan ${req.params.id}`);
  res.json({ message: 'Riwayat Dana Santunan berhasil dihapus' });
});


router.put('/:id/konfirmasi-transfer', requireRole('admin','petugas'), async (req, res) => {
  const iuran = await IuranWajib.findById(req.params.id).populate('warga');
  if (!iuran) return res.status(404).json({ message: 'Riwayat IWK tidak ditemukan' });
  if (iuran.status !== 'pratinjau') return res.status(400).json({ message: 'Riwayat ini bukan status pratinjau' });
  if (iuran.metode_bayar !== 'transfer') return res.status(400).json({ message: 'Konfirmasi ini hanya untuk pembayaran transfer' });

  const param = await getParam();
  const batasStatusBayar = batasStatusBayarIwk(param);
  const nominal = Number(iuran.nominal_bayar || 0);
  if (nominal < batasStatusBayar) return res.status(400).json({ message: 'Nominal transfer belum memenuhi batas status bayar' });

  iuran.status = 'bayar';
  iuran.catatan_petugas = String(iuran.catatan_petugas || '').replace(/^Pratinjau bukti transfer warga\.\s*/i, '').trim();
  if (!iuran.catatan_petugas) iuran.catatan_petugas = 'Transfer dikonfirmasi petugas.';
  iuran.rincian = bagiIwk(nominal, param);
  await iuran.save();

  await tulisAudit(req, 'UPDATE', 'Iuran IWK', `Konfirmasi pratinjau transfer ${iuran.warga?.nama || req.params.id}`);
  res.json({ message: 'Status pratinjau berhasil diubah menjadi bayar.', data: iuran });
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
  const minimalIwk = minimumBayarIwk(param);
  const batasStatusBayar = batasStatusBayarIwk(param);

  if (nominalBaru < minimalIwk) {
    return res.status(400).json({ message: `Minimal bayar IWK adalah ${minimalIwk.toLocaleString('id-ID')} per bulan sesuai setting minimal nominal IWK.` });
  }
  if (nominalBaru < batasStatusBayar && !catatanBaru) {
    return res.status(400).json({ message: 'Catatan wajib diisi jika bayar kurang / belum bayar' });
  }

  const rincianBaru = bagiIwk(nominalBaru, param);
  const jenisTerdampak = new Set(Object.keys(iuran.rincian?.toObject?.() || iuran.rincian || {}).concat(Object.keys(rincianBaru)));

  await TransaksiKas.deleteMany({ sumber: 'iwk', ref_id: iuran._id });

  iuran.nominal_bayar = nominalBaru;
  iuran.catatan_petugas = catatanBaru;
  iuran.status = statusIwk(nominalBaru, batasStatusBayar);
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
  const buktiTransferWarga = iuran.metode_bayar === 'transfer' && (
    !!iuran.bukti_transfer_iwk ||
    String(iuran.grup_pembayaran || '').startsWith('bukti-') ||
    /\/uploads\/bukti-iwk-/i.test(String(iuran.foto_bayar || ''))
  );
  if (req.session.user.role === 'petugas' && String(iuran.petugas) !== String(req.session.user.id) && !buktiTransferWarga) {
    return res.status(403).json({ message: 'Petugas hanya bisa hapus riwayat yang dibuat sendiri' });
  }
  const trx = await TransaksiKas.find({ sumber: 'iwk', ref_id: req.params.id }).lean();
  const jenisTerdampak = [...new Set(trx.map(x => x.jenis_kas))];
  await TransaksiKas.deleteMany({ sumber: 'iwk', ref_id: req.params.id });
  if (iuran.bukti_transfer_iwk) await BuktiTransferIwk.deleteOne({ _id: iuran.bukti_transfer_iwk });
  else await BuktiTransferIwk.updateMany({ iuran_wajib: iuran._id }, { $set: { iuran_wajib: null } });
  await iuran.deleteOne();
  for (const jenis of jenisTerdampak) await hitungUlangSaldoKas(jenis);
  await tulisAudit(req, 'DELETE', 'Iuran IWK', `Hapus iuran ${req.params.id}`);
  res.json({ message: 'Iuran dihapus dan transaksi kas otomatis lama dibersihkan jika ada.' });
});
module.exports = router;
