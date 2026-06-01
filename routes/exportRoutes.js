const express = require('express');
const PDFDocument = require('pdfkit');
const { saldoSemuaKas } = require('../utils/kas');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/laporan-bulanan/pdf', requireRole('admin'), async (req, res) => {
  const saldo = await saldoSemuaKas();
  const bulan = req.query.bulan || new Date().getMonth() + 1;
  const tahun = req.query.tahun || new Date().getFullYear();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=laporan-keuangan-${bulan}-${tahun}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);
  doc.fontSize(18).text('Ringkasan Keuangan Bulanan RT', { align: 'center' });
  doc.moveDown().fontSize(11).text(`Periode: ${bulan}/${tahun}`, { align: 'center' });
  doc.moveDown(2);
  Object.entries(saldo).forEach(([key, val]) => doc.fontSize(12).text(`${key.replace(/_/g,' ').toUpperCase()} : Rp ${Number(val).toLocaleString('id-ID')}`));
  const total = Object.values(saldo).reduce((a,b)=>a+Number(b||0),0);
  doc.moveDown().fontSize(14).text(`TOTAL SALDO: Rp ${total.toLocaleString('id-ID')}`);
  doc.end();
});

router.get('/riwayat-iwk-petugas/pdf', requireRole('admin','petugas'), async (req, res) => {
  const IuranWajib = require('../models/IuranWajib');
  const bulan = Number(req.query.bulan || new Date().getMonth() + 1);
  const tahun = Number(req.query.tahun || new Date().getFullYear());
  const filter = { bulan, tahun };
  if (req.session.user.role === 'petugas') filter.petugas = req.session.user.id;

  let data = await IuranWajib.find(filter).populate('warga').populate('petugas','nama area').sort({ tanggal: 1, createdAt: 1 }).lean();
  if (req.session.user.role === 'admin' && req.query.petugas) data = data.filter(x => String(x.petugas?._id || x.petugas) === String(req.query.petugas));
  const namaPetugas = req.session.user.role === 'petugas' ? req.session.user.nama : (data[0]?.petugas?.nama || 'Semua Petugas');
  const total = data.reduce((t, x) => t + Number(x.nominal_bayar || 0), 0);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=riwayat-iwk-${bulan}-${tahun}.pdf`);
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  doc.pipe(res);
  doc.fontSize(16).text('Bukti Riwayat Penagihan IWK RT02', { align: 'center' });
  doc.moveDown(0.4).fontSize(10).text(`Petugas: ${namaPetugas} | Periode: ${bulan}/${tahun}`, { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10).text(`Total transaksi: ${data.length}`);
  doc.text(`Total nominal: Rp ${total.toLocaleString('id-ID')}`);
  doc.moveDown(1);

  const startX = 36;
  let y = doc.y;
  const cols = [28, 118, 78, 76, 72, 130];
  const headers = ['No', 'Warga', 'No Rumah', 'Nominal', 'Status', 'Catatan'];
  const drawRow = (items, bold = false) => {
    if (y > 760) { doc.addPage(); y = 36; }
    let x = startX;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    items.forEach((txt, i) => { doc.text(String(txt || '-'), x, y, { width: cols[i] - 4 }); x += cols[i]; });
    y += 25;
    doc.moveTo(startX, y - 5).lineTo(560, y - 5).strokeColor('#e5e7eb').stroke();
  };
  drawRow(headers, true);
  data.forEach((x, i) => drawRow([
    i + 1,
    x.warga?.nama || '-',
    x.warga?.no_rumah || '-',
    `Rp ${Number(x.nominal_bayar || 0).toLocaleString('id-ID')}`,
    x.status === 'bayar' || x.status === 'lunas' ? 'Bayar' : x.status === 'kurang' ? 'Kurang' : 'Blm Bayar',
    x.catatan_petugas || '-'
  ]));
  doc.moveDown(2);
  doc.fontSize(9).text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'right' });
  doc.end();
});

module.exports = router;
