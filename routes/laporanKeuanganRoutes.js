const express = require('express');
const PDFDocument = require('pdfkit');
const { requireRole } = require('../middleware/auth');
const { saldoSemuaKas } = require('../utils/kas');
const TransaksiKas = require('../models/TransaksiKas');
const WajibIwk = require('../models/WajibIwk');
const IuranWajib = require('../models/IuranWajib');
const router = express.Router();

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
function periodeRange({ bulan, tahun, periode }){
  const end = new Date(Number(tahun), Number(bulan), 1); // first day next month
  const start = new Date(Number(tahun), Number(bulan) - Number(periode), 1);
  return { start, end };
}
function normalizeStatus(s){ return s === 'lunas' ? 'bayar' : (s || 'belum_bayar'); }

async function buildReport(query = {}){
  const now = new Date();
  const bulan = Number(query.bulan || now.getMonth() + 1);
  const tahun = Number(query.tahun || now.getFullYear());
  const periode = Number(query.periode || 1) === 3 ? 3 : 1;
  const showBelumBayar = String(query.showBelumBayar || query.show_belum_bayar || 'false') === 'true';
  const { start, end } = periodeRange({ bulan, tahun, periode });

  const saldo = await saldoSemuaKas();
  const totalSaldo = Object.values(saldo).reduce((a,b)=>a + Number(b || 0), 0);
  const transaksi = await TransaksiKas.find({ tanggal: { $gte: start, $lt: end } }).sort({ tanggal: -1, createdAt: -1 }).lean();
  const totalDebet = transaksi.reduce((a,x)=>a + Number(x.debet || 0), 0);
  const totalKredit = transaksi.reduce((a,x)=>a + Number(x.kredit || 0), 0);

  let belumBayar = [];
  if (showBelumBayar) {
    const warga = await WajibIwk.find({ aktif: { $ne: false } }).lean();
    warga.sort(naturalRumah);
    const iuran = await IuranWajib.find({ bulan, tahun }).populate('warga').lean();
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
      periodeLabel: periode === 3 ? `3 Bulan Terakhir s.d. ${bulanFull[bulan-1]} ${tahun}` : `${bulanFull[bulan-1]} ${tahun}`,
      generatedAt: new Date().toLocaleString('id-ID')
    },
    saldo, totalSaldo, transaksi, totalDebet, totalKredit, belumBayar
  };
}

router.get('/data', requireRole('admin'), async (req, res) => {
  try { res.json(await buildReport(req.query)); }
  catch (err) { res.status(500).json({ message: err.message || 'Gagal membuat laporan' }); }
});

router.get('/pdf', requireRole('admin'), async (req, res) => {
  try {
    const data = await buildReport(req.query);
    const { meta, saldo, totalSaldo, transaksi, totalDebet, totalKredit, belumBayar } = data;
    const fileName = `laporan-keuangan-rt02-${meta.bulan}-${meta.tahun}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
    doc.pipe(res);

    doc.rect(0,0,595,105).fill('#173f91');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('Laporan Keuangan RT02', 36, 26, { width: 520 });
    doc.font('Helvetica').fontSize(10).fillColor('#dbeafe').text(`Periode: ${meta.periodeLabel}  |  Dicetak: ${meta.generatedAt}`, 36, 55);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#fff7ed').text(`Total Saldo: ${rp(totalSaldo)}`, 36, 76);

    let y = 126;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text('Ringkasan Saldo Semua Kas', 36, y); y += 22;
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

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text('Transaksi Semua Kas', 36, y); y += 17;
    doc.font('Helvetica').fontSize(9).fillColor('#475569').text(`Total pemasukan: ${rp(totalDebet)}   |   Total pengeluaran: ${rp(totalKredit)}`, 36, y); y += 18;

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
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(`Warga Belum Bayar IWK ${bulanFull[meta.bulan-1]} ${meta.tahun}`, 36, y); y += 20;
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
