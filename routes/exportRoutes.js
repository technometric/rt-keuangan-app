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
module.exports = router;
