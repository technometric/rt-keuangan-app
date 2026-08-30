const express = require('express');
const PDFDocument = require('pdfkit');
const { saldoSemuaKas } = require('../utils/kas');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

function naturalRumah(a, b) {
  return String(a.no_rumah || '').localeCompare(String(b.no_rumah || ''), 'id', { numeric: true, sensitivity: 'base' }) ||
    String(a.nama || '').localeCompare(String(b.nama || ''), 'id', { sensitivity: 'base' });
}

function drawManualTable(doc, { x, y, widths, headers, rowHeight, rows, pageBottom = 548, headerHeight = rowHeight }) {
  const tableWidth = widths.reduce((total, width) => total + width, 0);
  const drawHeader = () => {
    doc.rect(x, y, tableWidth, headerHeight).fillAndStroke('#f1f5f9', '#94a3b8');
    let colX = x;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
    headers.forEach((header, i) => {
      doc.text(header, colX + 4, y + 7, { width: widths[i] - 8, align: 'center' });
      colX += widths[i];
      if (i < widths.length - 1) doc.moveTo(colX, y).lineTo(colX, y + headerHeight).strokeColor('#94a3b8').stroke();
    });
    y += headerHeight;
  };
  drawHeader();

  rows.forEach((items) => {
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = 36;
      drawHeader();
    }
    let colX = x;
    doc.rect(x, y, tableWidth, rowHeight).strokeColor('#94a3b8').lineWidth(0.7).stroke();
    doc.fillColor('#111827').font('Helvetica').fontSize(8);
    items.forEach((item, i) => {
      const align = i === 0 || i === 3 ? 'center' : 'left';
      doc.text(String(item || ''), colX + 4, y + 7, { width: widths[i] - 8, align });
      colX += widths[i];
      if (i < widths.length - 1) doc.moveTo(colX, y).lineTo(colX, y + rowHeight).strokeColor('#94a3b8').stroke();
    });
    y += rowHeight;
  });
  return y;
}

router.get('/form-iwk-manual/pdf', requireRole('admin'), async (req, res) => {
  const WajibIwk = require('../models/WajibIwk');
  const area = String(req.query.area || '').trim();
  const filter = { aktif: { $ne: false } };
  if (['utara', 'tengah', 'selatan'].includes(area)) filter.area = area;
  const warga = await WajibIwk.find(filter).lean();
  warga.sort(naturalRumah);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="form-penarikan-iwk-rt02.pdf"');
  const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
  doc.pipe(res);

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text('FORM PENARIKAN IWK RT02', 36, 30, { align: 'center', width: 523 });
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text('Periode:', 36, 58);
  doc.moveTo(84, 69).lineTo(250, 69).strokeColor('#111827').lineWidth(0.8).stroke();

  drawManualTable(doc, {
    x: 36,
    y: 82,
    widths: [28, 58, 128, 52, 66, 78, 113],
    headers: ['No', 'Tanggal', 'Nama Warga', 'No Rumah', 'Nominal', 'Mode Bayar', 'Keterangan'],
    rowHeight: 21,
    pageBottom: 806,
    rows: warga.map((w, i) => [i + 1, '', w.nama, w.no_rumah, '', 'Cash / Transfer', ''])
  });
  doc.end();
});

router.get('/form-pengeluaran-manual/pdf', requireRole('admin'), async (req, res) => {
  const rowsCount = Math.min(12, Math.max(3, Number(req.query.rows || 6)));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="form-pengeluaran-kas-rt.pdf"');
  const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
  doc.pipe(res);

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text('FORM PENGELUARAN KAS RT02', 36, 30, { align: 'center', width: 523 });
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text('Periode:', 36, 58);
  doc.moveTo(84, 69).lineTo(250, 69).strokeColor('#111827').lineWidth(0.8).stroke();

  const y = drawManualTable(doc, {
    x: 36,
    y: 84,
    widths: [32, 78, 222, 94, 97],
    headers: ['No', 'Tanggal', 'Detil Pengeluaran', 'Nominal', 'Keterangan'],
    headerHeight: 24,
    rowHeight: 81,
    pageBottom: 680,
    rows: Array.from({ length: rowsCount }, (_, i) => [i + 1, '', '', '', ''])
  });

  const signY = Math.min(Math.max(y + 30, 700), 720);
  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  doc.text('Mengetahui,', 74, signY, { width: 160, align: 'center' });
  doc.text('Menyetujui,', 360, signY, { width: 160, align: 'center' });
  doc.text('Sekretaris RT', 74, signY + 16, { width: 160, align: 'center' });
  doc.text('Ketua RT', 360, signY + 16, { width: 160, align: 'center' });
  doc.moveTo(84, signY + 88).lineTo(224, signY + 88).strokeColor('#111827').stroke();
  doc.moveTo(370, signY + 88).lineTo(510, signY + 88).strokeColor('#111827').stroke();
  doc.end();
});

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
