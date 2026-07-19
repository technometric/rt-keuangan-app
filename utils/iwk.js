function bagiIwk(nominalBayar, parameter) {
  let sisa = Number(nominalBayar || 0);
  const hasil = {
    uang_satpam: 0,
    uang_sampah: 0,
    kas_pkk: 0,
    kas_rt: 0,
    kas_sosial: 0,
    santunan_kematian: 0
  };
  const urutan = Object.keys(hasil);
  for (const key of urutan) {
    const value = parameter[key] ?? (key === 'kas_pkk' ? parameter.kas_rw : 0);
    const target = Number(value || 0);
    const masuk = Math.min(sisa, target);
    hasil[key] = masuk;
    sisa -= masuk;
    if (sisa <= 0) break;
  }
  return hasil;
}

function minimumBayarIwk(parameter) {
  const customMinimum = Number(parameter?.minimal_nominal_iwk || 0);
  if (customMinimum > 0) return customMinimum;
  return Number(parameter?.uang_satpam || 0) + Number(parameter?.uang_sampah || 0);
}

function batasStatusBayarIwk(parameter) {
  return Number(parameter?.uang_satpam || 0) + Number(parameter?.uang_sampah || 0);
}

function statusIwk(nominalBayar, batasBayar) {
  const bayar = Number(nominalBayar || 0);
  if (bayar >= Number(batasBayar || 0)) return 'bayar';
  if (bayar > 0) return 'kurang';
  return 'belum_bayar';
}

module.exports = { bagiIwk, minimumBayarIwk, batasStatusBayarIwk, statusIwk };
