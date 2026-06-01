function bagiIwk(nominalBayar, parameter) {
  let sisa = Number(nominalBayar || 0);
  const hasil = {
    uang_satpam: 0,
    uang_sampah: 0,
    kas_rw: 0,
    kas_rt: 0,
    kas_sosial: 0,
    santunan_kematian: 0
  };
  const urutan = Object.keys(hasil);
  for (const key of urutan) {
    const target = Number(parameter[key] || 0);
    const masuk = Math.min(sisa, target);
    hasil[key] = masuk;
    sisa -= masuk;
    if (sisa <= 0) break;
  }
  return hasil;
}

function statusIwk(nominalBayar, totalIwk) {
  const bayar = Number(nominalBayar || 0);
  if (bayar >= Number(totalIwk || 0)) return 'bayar';
  if (bayar > 0) return 'kurang';
  return 'belum_bayar';
}

module.exports = { bagiIwk, statusIwk };
