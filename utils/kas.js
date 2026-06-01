const TransaksiKas = require('../models/TransaksiKas');

async function saldoTerakhir(jenis_kas) {
  const last = await TransaksiKas.findOne({ jenis_kas }).sort({ tanggal: -1, createdAt: -1, _id: -1 });
  return last ? Number(last.saldo || 0) : 0;
}

async function buatTransaksiKas({ jenis_kas, sumber, ref_id, keterangan, tanggal, debet = 0, kredit = 0, dibuat_oleh }) {
  const lastSaldo = await saldoTerakhir(jenis_kas);
  const saldo = lastSaldo + Number(debet || 0) - Number(kredit || 0);
  return TransaksiKas.create({ jenis_kas, sumber, ref_id, keterangan, tanggal, debet, kredit, saldo, dibuat_oleh });
}

async function hitungUlangSaldoKas(jenis_kas) {
  const rows = await TransaksiKas.find({ jenis_kas }).sort({ tanggal: 1, createdAt: 1, _id: 1 });
  let saldo = 0;
  for (const row of rows) {
    saldo += Number(row.debet || 0) - Number(row.kredit || 0);
    if (Number(row.saldo || 0) !== saldo) {
      row.saldo = saldo;
      await row.save();
    }
  }
  return saldo;
}

async function saldoSemuaKas() {
  const jenisList = ['uang_satpam','uang_sampah','kas_rw','kas_rt','kas_sosial','santunan_kematian','kas_donasi','tabungan_sampah','danus'];
  const result = {};
  for (const jenis of jenisList) result[jenis] = await saldoTerakhir(jenis);
  return result;
}

module.exports = { saldoTerakhir, buatTransaksiKas, hitungUlangSaldoKas, saldoSemuaKas };
