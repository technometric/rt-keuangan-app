const express = require('express');
const PDFDocument = require('pdfkit');
const { requireRole } = require('../middleware/auth');
const { saldoSemuaKas, buatTransaksiKas, hitungUlangSaldoKas } = require('../utils/kas');
const TransaksiKas = require('../models/TransaksiKas');
const WajibIwk = require('../models/WajibIwk');
const IuranWajib = require('../models/IuranWajib');
const router = express.Router();

const HIDDEN_REPORT_KAS = ['uang_sampah', 'uang_satpam', 'kas_rw'];
const VISIBLE_REPORT_KAS = ['kas_rt', 'kas_sosial', 'santunan_kematian', 'kas_donasi', 'tabungan_sampah', 'danus'];

const jenisLabel = {
  kas_rt: 'Kas RT',
  kas_sosial: 'Kas Sosial',
  santunan_kematian: 'Santunan Kematian',
  kas_donasi: 'Kas Donasi',
  tabungan_sampah: 'Tabungan Sampah',
  uang_sampah: 'Uang Sampah',
  uang_satpam: 'Uang Satpam',
  kas_rw: 'Kas RW',
  danus: 'Danus'
};
const bulanFull = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function rp(n){ return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function nice(k){ return jenisLabel[k] || String(k || '').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()); }
function naturalRumah(a,b){ return String(a.no_rumah||'').localeCompare(String(b.no_rumah||''),'id',{numeric:true,sensitivity:'base'}) || String(a.nama||'').localeCompare(String(b.nama||''),'id'); }
function normalizeStatus(s){ return s === 'lunas' ? 'bayar' : (s || 'belum_bayar'); }
function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function periodeRange({ bulan, tahun, periode }){
  // v1.3.0: pilihan 1/3 bulan selalu mengambil bulan sebelumnya dari bulan laporan.
  // Contoh laporan dibuat/dipilih Juni: 1 bulan = Mei, 3 bulan = Maret-Mei.
  const end = new Date(Number(tahun), Number(bulan) - 1, 1); // awal bulan laporan, exclusive
  const start = new Date(Number(tahun), Number(bulan) - 1 - Number(periode), 1);
  return { start, end };
}
function periodeLabel({ bulan, tahun, periode }){
  const { start, end } = periodeRange({ bulan, tahun, periode });
  const last = new Date(end.getFullYear(), end.getMonth(), 0);
  if (Number(periode) === 1) return `${bulanFull[last.getMonth()]} ${last.getFullYear()}`;
  return `${bulanFull[start.getMonth()]} ${start.getFullYear()} - ${bulanFull[last.getMonth()]} ${last.getFullYear()}`;
}
function filterVisibleSaldo(saldo = {}){
  const result = {};
  for (const k of VISIBLE_REPORT_KAS) result[k] = Number(saldo[k] || 0);
  return result;
}

async function hitungIuranRwGabungan(start, end){
  const rows = await TransaksiKas.find({
    jenis_kas: { $in: HIDDEN_REPORT_KAS },
    tanggal: { $gte: start, $lt: end },
    sumber: 'iwk'
  }).lean();
  return rows.reduce((sum, x) => sum + Number(x.debet || 0) - Number(x.kredit || 0), 0);
}

async function upsertPengeluaranIuranRw({ bulan, tahun, userId }){
  const { start, end } = periodeRange({ bulan, tahun, periode: 1 });
  const total = await hitungIuranRwGabungan(start, end);
  const periodeText = periodeLabel({ bulan, tahun, periode: 1 });
  const tanggal = new Date(end.getFullYear(), end.getMonth(), 0, 12, 0, 0);
  const keterangan = `Iuran sampah, satpam dan kas RW - ${periodeText}`;

  let row = await TransaksiKas.findOne({ sumber: 'auto_iuran_rw', jenis_kas: 'kas_rt', keterangan });
  if (total <= 0) {
    if (row) {
      await row.deleteOne();
      await hitungUlangSaldoKas('kas_rt');
    }
    return { message: 'Tidak ada nominal iuran sampah/satpam/kas RW pada periode ini.', total, periodeText };
  }

  if (row) {
    row.tanggal = tanggal;
    row.debet = 0;
    row.kredit = total;
    row.dibuat_oleh = userId;
    await row.save();
    await hitungUlangSaldoKas('kas_rt');
    return { message: 'Pengeluaran rutin Iuran sampah, satpam dan kas RW diperbarui.', total, periodeText };
  }

  await buatTransaksiKas({
    jenis_kas: 'kas_rt',
    sumber: 'auto_iuran_rw',
    ref_id: null,
    keterangan,
    tanggal,
    debet: 0,
    kredit: total,
    dibuat_oleh: userId
  });
  await hitungUlangSaldoKas('kas_rt');
  return { message: 'Pengeluaran rutin Iuran sampah, satpam dan kas RW dibuat.', total, periodeText };
}

async function buildReport(query = {}){
  const now = new Date();
  const bulan = Number(query.bulan || now.getMonth() + 1);
  const tahun = Number(query.tahun || now.getFullYear());
  const periode = Number(query.periode || 1) === 3 ? 3 : 1;
  const showBelumBayar = String(query.showBelumBayar || query.show_belum_bayar || 'false') === 'true';
  const { start, end } = periodeRange({ bulan, tahun, periode });

  const saldoAll = await saldoSemuaKas();
  const saldo = filterVisibleSaldo(saldoAll);
  const totalSaldo = Object.values(saldo).reduce((a,b)=>a + Number(b || 0), 0);
  const transaksi = await TransaksiKas.find({
    jenis_kas: { $nin: HIDDEN_REPORT_KAS },
    tanggal: { $gte: start, $lt: end }
  }).sort({ tanggal: -1, createdAt: -1 }).lean();
  const totalDebet = transaksi.reduce((a,x)=>a + Number(x.debet || 0), 0);
  const totalKredit = transaksi.reduce((a,x)=>a + Number(x.kredit || 0), 0);
  const iuranRwGabungan = await hitungIuranRwGabungan(start, end);

  let belumBayar = [];
  if (showBelumBayar) {
    // Data belum bayar mengikuti bulan terakhir periode laporan.
    const bulanCek = new Date(end.getFullYear(), end.getMonth(), 0);
    const warga = await WajibIwk.find({ aktif: { $ne: false } }).lean();
    warga.sort(naturalRumah);
    const iuran = await IuranWajib.find({ bulan: bulanCek.getMonth() + 1, tahun: bulanCek.getFullYear() }).populate('warga').lean();
    const paidMap = new Map();
    for (const x of iuran) {
      const wargaId = String(x.warga?._id || x.warga || '');
      const st = normalizeStatus(x.status);
      const nominal = Number(x.nominal_bayar || 0);
      if (st === 'bayar' || st === 'lunas' || nominal > 0) paidMap.set(wargaId, { status: st, nominal });
    }
    belumBayar = warga.filter(w => !paidMap.has(String(w._id))).map((w,i)=>({ no:i+1, nama:w.nama, no_rumah:w.no_rumah, area:w.area || w.blok || '-' }));
  }

  return {
    meta: {
      title: 'Laporan Keuangan RT02',
      bulan, tahun, periode, showBelumBayar,
      periodeLabel: periodeLabel({ bulan, tahun, periode }),
      periodeStart: ymd(start),
      periodeEndExclusive: ymd(end),
      generatedAt: new Date().toLocaleString('id-ID')
    },
    saldo, totalSaldo, transaksi, totalDebet, totalKredit, belumBayar, iuranRwGabungan
  };
}

router.get('/data', requireRole('admin'), async (req, res) => {
  try { res.json(await buildReport(req.query)); }
  catch (err) { res.status(500).json({ message: err.message || 'Gagal membuat laporan' }); }
});

router.post('/generate-iuran-rw', requireRole('admin'), async (req, res) => {
  try {
    const now = new Date();
    const bulan = Number(req.body.bulan || req.query.bulan || now.getMonth() + 1);
    const tahun = Number(req.body.tahun || req.query.tahun || now.getFullYear());
    const result = await upsertPengeluaranIuranRw({ bulan, tahun, userId: req.session.user.id });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Gagal membuat pengeluaran rutin Iuran RW' });
  }
});

router.get('/pdf', requireRole('admin'), async (req, res) => {
  try {
    const data = await buildReport(req.query);
    const { meta, saldo, totalSaldo, transaksi, totalDebet, totalKredit, belumBayar, iuranRwGabungan } = data;
    const fileName = `laporan-keuangan-rt02-${meta.periode}-${meta.bulan}-${meta.tahun}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
    doc.pipe(res);

    doc.rect(0,0,595,105).fill('#173f91');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Laporan Keuangan RT02', 36, 26, { width: 520 });
    doc.font('Helvetica').fontSize(10).fillColor('#dbeafe').text(`Periode: ${meta.periodeLabel}  |  Dicetak: ${meta.generatedAt}`, 36, 55);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#fff7ed').text(`Total Saldo: ${rp(totalSaldo)}`, 36, 76);

    let y = 126;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text('Ringkasan Saldo Kas', 36, y); y += 22;
    const keys = Object.keys(saldo);
    keys.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 36 + col * 262;
      const yy = y + row * 46;
      doc.roundedRect(x, yy, 246, 34, 8).strokeColor('#dbe3ef').lineWidth(1).stroke();
      doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(nice(k).toUpperCase(), x + 10, yy + 7, { width: 226 });
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text(rp(saldo[k]), x + 10, yy + 19, { width: 226 });
    });
    y += Math.ceil(keys.length / 2) * 46 + 12;

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text('Transaksi Kas', 36, y); y += 17;
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`Total pemasukan: ${rp(totalDebet)}   |   Total pengeluaran: ${rp(totalKredit)}   |   Iuran RW gabungan: ${rp(iuranRwGabungan)}`, 36, y); y += 18;

    const headers = ['Tanggal','Kas','Keterangan','Debet','Kredit'];
    const widths = [66, 86, 210, 74, 74];
    const drawRow = (arr, bold=false) => {
      if (y > 760) { doc.addPage(); y = 36; }
      let x = 36;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(bold ? '#0f172a' : '#334155');
      arr.forEach((v,i)=>{ doc.text(String(v || '-'), x, y, { width: widths[i] - 4 }); x += widths[i]; });
      y += bold ? 18 : 24;
      doc.moveTo(36,y-5).lineTo(558,y-5).strokeColor('#e5e7eb').lineWidth(.6).stroke();
    };
    drawRow(headers, true);
    transaksi.slice(0, 90).forEach(t => drawRow([
      new Date(t.tanggal).toLocaleDateString('id-ID'), nice(t.jenis_kas), t.keterangan || '-', rp(t.debet), rp(t.kredit)
    ]));
    if (transaksi.length > 90) { doc.fontSize(8).fillColor('#64748b').text(`+ ${transaksi.length - 90} transaksi lain tidak ditampilkan di PDF ringkas.`, 36, y); y += 15; }

    if (meta.showBelumBayar) {
      if (y > 690) { doc.addPage(); y = 36; }
      y += 8;
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(`Warga Belum Bayar IWK`, 36, y); y += 20;
      drawRow(['No','Nama','No Rumah','Area',''], true);
      belumBayar.forEach((w,i)=> drawRow([i+1, w.nama, w.no_rumah, w.area, '']));
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#94a3b8').text(`SIKERT RT02 · Halaman ${i + 1}`, 36, 812, { align: 'center', width: 520 });
    }
    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message || 'Gagal export PDF' });
  }
});

module.exports = router;
