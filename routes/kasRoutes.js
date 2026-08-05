const express = require('express');
const multer = require('multer');
const TransaksiKas = require('../models/TransaksiKas');
const { requireRole } = require('../middleware/auth');
const { buatTransaksiKas, hitungUlangSaldoKas, saldoSemuaKas } = require('../utils/kas');
const { tulisAudit } = require('../utils/audit');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const jenisKasValid = ['kas_rt','kas_sosial','kas_donasi','tabungan_sampah','danus','uang_satpam','uang_sampah','kas_pkk','santunan_kematian'];

function parseCsvRows(text) {
  const firstLine = String(text).split(/\r?\n/).find(l => l.trim());
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => String(c).trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (row.some(c => String(c).trim() !== '')) {
    row.push(cell);
    rows.push(row);
  }
  return { rows, delimiter };
}

function parseNominalCsv(value, delimiter) {
  let v = String(value || '').trim().replace(/\s+/g, '').replace(/^Rp\.?\s*/i, '');
  if (delimiter === ';') {
    v = v.replace(/\./g, '').replace(',', '.');
  } else {
    v = v.replace(/\./g, '');
  }
  const num = Number(v);
  return Number.isFinite(num) && num > 0 ? num : null;
}

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

router.get('/saldo', requireRole('admin','petugas','umum'), async (req, res) => {
  await perbaikiKasDanaSantunanLama();
  res.json(await saldoSemuaKas());
});

router.get('/', requireRole('admin','petugas','umum'), async (req, res) => {
  await perbaikiKasDanaSantunanLama();
  const filter = {};
  if (req.query.jenis_kas) filter.jenis_kas = req.query.jenis_kas;
  res.json(await TransaksiKas.find(filter).populate('dibuat_oleh','nama').sort({ tanggal: -1, createdAt: -1 }).limit(500));
});

router.post('/', requireRole('admin','petugas'), async (req, res) => {
  const { jenis_kas, keterangan, tanggal, tipe, nominal } = req.body;
  const debet = tipe === 'debet' ? Number(nominal || 0) : 0;
  const kredit = tipe === 'kredit' ? Number(nominal || 0) : 0;
  const trx = await buatTransaksiKas({
    jenis_kas,
    sumber: 'manual',
    keterangan,
    tanggal: tanggal ? new Date(tanggal) : new Date(),
    debet,
    kredit,
    dibuat_oleh: req.session.user.id
  });
  await tulisAudit(req, 'CREATE', 'Transaksi Kas', `${jenis_kas} ${tipe} ${nominal}`);
  res.json(trx);
});

router.post('/import-csv', requireRole('admin','petugas'), upload.single('file'), async (req, res) => {
  const { jenis_kas, tipe, tanggal } = req.body;
  if (!jenisKasValid.includes(jenis_kas)) return res.status(400).json({ message: 'Jenis kas tidak valid' });
  if (!['debet','kredit'].includes(tipe)) return res.status(400).json({ message: 'Tipe transaksi harus debet atau kredit' });
  if (!tanggal) return res.status(400).json({ message: 'Pilih tanggal transaksi' });
  if (!req.file) return res.status(400).json({ message: 'File CSV wajib diupload' });

  const text = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
  const { rows, delimiter } = parseCsvRows(text);
  if (!rows.length) return res.status(400).json({ message: 'File CSV kosong atau tidak terbaca' });

  const tanggalTransaksi = new Date(String(tanggal) + 'T12:00:00');
  if (isNaN(tanggalTransaksi)) return res.status(400).json({ message: 'Tanggal tidak valid' });

  const dibuatOleh = req.session.user.id;
  const errors = [];
  const hasilImport = [];
  let tersimpan = 0;
  let totalNominal = 0;
  let isHeader = true;

  rows.forEach((rawRow, idx) => {
    const row = rawRow.map(c => String(c).trim());
    if (!row.some(c => c !== '')) return;
    const nominal = parseNominalCsv(row[row.length - 1], delimiter);
    if (isHeader) {
      if (nominal === null) { isHeader = false; return; }
      isHeader = false;
    }
    let keterangan;
    if (row.length === 3) keterangan = row[1];
    else if (row.length === 2) keterangan = row[0];
    else {
      errors.push(`Baris ${idx + 1}: jumlah kolom ${row.length} tidak sesuai (harus No,Uraian,Jumlah atau Uraian,Jumlah). Koma hanya pemisah kolom, uraian tidak boleh mengandung koma.`);
      return;
    }
    if (!keterangan || nominal === null) {
      errors.push(`Baris ${idx + 1}: uraian atau jumlah tidak valid (${rawRow.join(delimiter)})`);
      return;
    }
    hasilImport.push({ keterangan, nominal });
  });

  for (const item of hasilImport) {
    await buatTransaksiKas({
      jenis_kas,
      sumber: 'manual',
      keterangan: item.keterangan,
      tanggal: tanggalTransaksi,
      debet: tipe === 'debet' ? item.nominal : 0,
      kredit: tipe === 'kredit' ? item.nominal : 0,
      dibuat_oleh: dibuatOleh
    });
    tersimpan += 1;
    totalNominal += item.nominal;
  }

  if (!tersimpan) {
    return res.status(400).json({ message: 'Tidak ada baris valid yang bisa diimport', errors });
  }
  await hitungUlangSaldoKas(jenis_kas);
  await tulisAudit(req, 'CREATE', 'Transaksi Kas', `Import CSV ${jenis_kas} ${tipe} ${tersimpan} baris total ${totalNominal}`);
  res.json({
    message: `Berhasil import ${tersimpan} transaksi ${tipe === 'kredit' ? 'pengeluaran' : 'pemasukan'} ${jenis_kas} total ${totalNominal.toLocaleString('id-ID')}`,
    jenis_kas,
    tipe,
    tanggal: tanggalTransaksi,
    delimiter,
    jumlah_data: tersimpan,
    total_nominal: totalNominal,
    errors
  });
});

router.get('/total-periode', requireRole('admin','petugas'), async (req, res) => {
  const { dari, sampai } = req.query;
  if (!dari || !sampai) return res.status(400).json({ message: 'Pilih tanggal dari dan sampai' });
  const start = new Date(String(dari) + 'T00:00:00');
  const end = new Date(String(sampai) + 'T23:59:59.999');
  if (isNaN(start) || isNaN(end) || start > end) return res.status(400).json({ message: 'Rentang tanggal tidak valid' });
  const agg = await TransaksiKas.aggregate([
    { $match: { tanggal: { $gte: start, $lte: end } } },
    { $group: { _id: null, total_debet: { $sum: '$debet' }, total_kredit: { $sum: '$kredit' }, jumlah_debet: { $sum: { $cond: [{ $gt: ['$debet', 0] }, 1, 0] } }, jumlah_kredit: { $sum: { $cond: [{ $gt: ['$kredit', 0] }, 1, 0] } } } }
  ]);
  res.json({
    dari: start,
    sampai: end,
    total_pengeluaran: Number(agg[0]?.total_kredit || 0),
    total_pemasukan: Number(agg[0]?.total_debet || 0),
    jumlah_pengeluaran: Number(agg[0]?.jumlah_kredit || 0),
    jumlah_pemasukan: Number(agg[0]?.jumlah_debet || 0)
  });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const trx = await TransaksiKas.findById(req.params.id);
  if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });

  const jenisLama = trx.jenis_kas;
  const { jenis_kas, keterangan, tanggal, tipe, nominal } = req.body;
  trx.jenis_kas = jenis_kas || trx.jenis_kas;
  trx.keterangan = keterangan || trx.keterangan;
  if (tanggal) trx.tanggal = new Date(tanggal);

  if (tipe && nominal !== undefined) {
    trx.debet = tipe === 'debet' ? Number(nominal || 0) : 0;
    trx.kredit = tipe === 'kredit' ? Number(nominal || 0) : 0;
  } else {
    if (req.body.debet !== undefined) trx.debet = Number(req.body.debet || 0);
    if (req.body.kredit !== undefined) trx.kredit = Number(req.body.kredit || 0);
  }

  await trx.save();
  await hitungUlangSaldoKas(jenisLama);
  if (jenisLama !== trx.jenis_kas) await hitungUlangSaldoKas(trx.jenis_kas);
  await tulisAudit(req, 'UPDATE', 'Transaksi Kas', `Edit transaksi ${trx._id}`);
  res.json({ message: 'Transaksi berhasil diupdate', trx });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const trx = await TransaksiKas.findByIdAndDelete(req.params.id);
  if (!trx) return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
  await hitungUlangSaldoKas(trx.jenis_kas);
  await tulisAudit(req, 'DELETE', 'Transaksi Kas', `Hapus transaksi ${trx._id}`);
  res.json({ message: 'Transaksi dihapus' });
});

module.exports = router;
