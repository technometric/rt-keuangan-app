const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const kasLabels = {
  uang_satpam: 'Uang Satpam',
  uang_sampah: 'Uang Sampah',
  kas_pkk: 'Kas PKK',
  kas_rw: 'Kas PKK',
  kas_rt: 'Kas RT',
  kas_sosial: 'Kas Sosial',
  kas_donasi: 'Kas Donasi',
  tabungan_sampah: 'Tabungan Sampah',
  santunan_kematian: 'Dana Santunan',
  danus: 'Danus'
};
const nice = s => kasLabels[s] || String(s || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const isPublic = () => window.PUBLIC_DASHBOARD === true;
const apiBase = path => isPublic() ? `/api/public${path}` : path;
const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
let iwkYear = new Date().getFullYear();
let iwkFilter = 'belum_bayar';
let iwkPeriodMode = String(new Date().getMonth() + 1);
let iwkSortMode = 'status';
let iwkYearData = [];
let iwkStatusOptions = {};
let riwayatIwkRows = [];
let activePaymentTab = 'iwk';
let lastTotalIwk = 0;
let lastParamIwk = null;
let selectedIwkWarga = null;

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function normalizeSearchText(value = ''){
  return String(value).toLowerCase().replace(/\bno\b/g,'').replace(/[^a-z0-9]/g,'');
}
function isPaymentFormWarga(selectId){
  const el = document.getElementById(selectId);
  return !!(el && el.closest && el.closest('#formIwk'));
}
function selectedPaymentPeriod(){
  const checklist = document.getElementById('bulanChecklist');
  let months = checklist ? checkedIwkMonths() : [];
  if(!months.length) months = [new Date().getMonth() + 1];
  const tahun = Number(document.getElementById('tahunMulai')?.value || new Date().getFullYear());
  return { tahun, months: [...new Set(months)] };
}
async function filterWargaBelumBayarBulanBerjalan(data, selectId){
  if(!isPaymentFormWarga(selectId)) return data;
  const { tahun, months } = selectedPaymentPeriod();
  const paid = new Set();
  await Promise.all(months.map(m => api(`/api/iuran-wajib?bulan=${m}&tahun=${tahun}`).then(rows => {
    rows.forEach(x => paid.add(`${String(x.warga?._id || x.warga || '')}:${m}`));
  }).catch(() => {})));
  return data.filter(w => months.some(m => !paid.has(`${String(w._id)}:${m}`)));
}

function labelStatus(s){
  if(s === 'pratinjau') return 'Pratinjau';
  if(s === 'lunas' || s === 'bayar') return 'Bayar';
  if(s === 'kurang') return 'Kurang';
  return 'Blm Bayar';
}
function normStatus(s){ return s === 'lunas' ? 'bayar' : (s || 'belum_bayar'); }
function statusClass(s){ s = normStatus(s); return (s === 'bayar' || s === 'pratinjau') ? 'green' : s === 'kurang' ? 'orange' : 'red'; }
function nominalIwkCell(row = {}){
  return rupiah(row.nominal_bayar || 0);
}
function isOwnPublicWarga(warga = {}){
  const idMatch = String(warga?._id || '') && String(warga?._id || '') === String(window.PUBLIC_WARGA_ID || '');
  const rumahMatch = normalizeSearchText(warga?.no_rumah || '') && normalizeSearchText(warga?.no_rumah || '') === normalizeSearchText(window.PUBLIC_WARGA_NO_RUMAH || '');
  return idMatch || rumahMatch;
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

async function loadAppVersion(){
  try {
    const d = await api('/api/info/version');
    document.querySelectorAll('.app-version-text').forEach(el => { el.textContent = `${d.name} v${d.version}`; });
  } catch(e) {}
}

async function copyText(value, targetId){
  try {
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      const input = document.createElement('input');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    const note = document.getElementById(targetId);
    if(note) {
      note.textContent = 'No rekening disalin';
      setTimeout(() => { note.textContent = 'Tap nomor rekening untuk copy'; }, 1800);
    }
  } catch(e) {
    alert('Gagal menyalin nomor rekening.');
  }
}

function waLink(noWa = '', message = ''){
  const clean = String(noWa || '').replace(/\D/g,'');
  if(!clean) return '';
  return `https://wa.me/${clean}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

function copyRekeningIwk(){
  copyText(window.publicRekeningIwk?.no_rekening || '', 'rekeningCopyNote');
}

async function loadRekeningIwk(){
  const el = document.getElementById('rekeningIwkCard');
  if(!el) return;
  try{
    const data = await api('/api/public/rekening-iwk');
    if(!data.tampil) { el.classList.add('hide'); return; }
    window.publicRekeningIwk = data;
    const defaultMessage = `Assalamualaikum, saya ingin konfirmasi pembayaran IWK.\nNama: ${data.warga?.nama || '-'}\nNo Rumah: ${data.warga?.no_rumah || '-'}\nBank Tujuan: ${data.nama_bank}\nNo Rekening: ${data.no_rekening}\nSaya akan mengirim bukti transfer.`;
    const link = waLink(data.no_wa_konfirmasi, defaultMessage);
    el.innerHTML = `
      <div>
        <p class="transfer-eyebrow">Pembayaran IWK via Transfer</p>
        <h3>${esc(data.nama_bank)}</h3>
        <button class="rekening-copy-btn" type="button" onclick="copyRekeningIwk()" aria-label="Copy nomor rekening">
          <span>${esc(data.no_rekening)}</span>
          <i class="copy-icon" aria-hidden="true"></i>
        </button>
        <p id="rekeningCopyNote" class="transfer-note">Tap nomor rekening untuk copy</p>
        <p class="transfer-proof-note">Kirim bukti transfer saat konfirmasi pembayaran.</p>
      </div>
      <div class="transfer-owner">
        <span>Atas Nama</span>
        <strong>${esc(data.nama_pemilik)}</strong>
        ${link ? `<a class="mini-btn transfer-wa-btn" href="${link}" target="_blank" rel="noopener">Konfirmasi WA</a>` : ''}
      </div>
    `;
    el.classList.remove('hide');
  }catch(e){
    el.classList.add('hide');
  }
}

async function loadSaldo() {
  let saldo = await api(apiBase('/api/kas/saldo').replace('/api/public/api/kas/saldo','/api/public/saldo'));
  const el = document.getElementById('saldoGrid');
  if (!el) return;

  const cardClass = isPublic() ? 'public-money-card' : 'card';
  const saldoCards = Object.entries(saldo).map(([k,v]) => {
    if(isPublic() && k === 'kas_donasi') {
      return `<button class="${cardClass} clickable-money-card donation-card" type="button" onclick="showDonasiDetail()"><h3>Info Donasi</h3><div class="money">${rupiah(v)}</div><span>Klik untuk daftar penyumbang</span></button>`;
    }
    return `<div class="${cardClass}"><h3>${nice(k)}</h3><div class="money">${rupiah(v)}</div></div>`;
  });
  if(isPublic()) {
    try {
      const pengeluaran = await api('/api/public/pengeluaran-bulan-terakhir');
      saldoCards.push(`
        <button class="${cardClass} clickable-money-card expense-card" type="button" onclick="showPengeluaranDetail()">
          <h3>Pengeluaran 1 Bulan Terakhir</h3>
          <div class="money">${rupiah(pengeluaran.total || 0)}</div>
          <span>${Number(pengeluaran.rows?.length || 0).toLocaleString('id-ID')} transaksi · Klik untuk detail</span>
        </button>
      `);
      window.publicPengeluaranTerakhir = pengeluaran;
    } catch(e) {}
  }
  el.innerHTML = saldoCards.join('');
}

async function showPengeluaranDetail(){
  const modal = document.getElementById('pengeluaranModal');
  if(!modal) return;
  let data = window.publicPengeluaranTerakhir;
  if(!data) data = await api('/api/public/pengeluaran-bulan-terakhir');
  const rows = data.rows || [];
  const periode = `${new Date(data.start).toLocaleDateString('id-ID')} - ${new Date(data.end).toLocaleDateString('id-ID')}`;
  const detailRows = rows.length ? rows.map(x => `
    <tr>
      <td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td>
      <td>${nice(x.jenis_kas)}</td>
      <td>${esc(x.keterangan || '-')}</td>
      <td>${rupiah(x.kredit || 0)}</td>
    </tr>
  `).join('') : '<tr><td colspan="4" class="empty-cell">Belum ada pengeluaran dalam 1 bulan terakhir.</td></tr>';
  modal.innerHTML = `
    <div class="iwk-modal-backdrop" onclick="closePengeluaranDetail()"></div>
    <div class="iwk-modal-card expense-modal-card">
      <div class="modal-head">
        <div><h3>Detail Pengeluaran</h3><p>${periode} · Total ${rupiah(data.total || 0)}</p></div>
        <button type="button" class="mini-btn" onclick="closePengeluaranDetail()">Tutup</button>
      </div>
      <div class="report-table-wrap">
        <table class="report-table compact-table">
          <thead><tr><th>Tanggal</th><th>Kas</th><th>Keterangan</th><th>Nominal</th></tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>`;
  modal.classList.remove('hide');
}
function closePengeluaranDetail(){
  const modal = document.getElementById('pengeluaranModal');
  if(modal) modal.classList.add('hide');
}

async function showDonasiDetail(periode = 1){
  const modal = document.getElementById('donasiModal');
  if(!modal) return;
  const data = await api(`/api/public/donasi?periode=${periode}`);
  const rows = data.rows || [];
  const periodeText = `${new Date(data.start).toLocaleDateString('id-ID')} - ${new Date(data.end).toLocaleDateString('id-ID')}`;
  const detailRows = rows.length ? rows.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td>
      <td>${esc(x.keterangan || 'Donatur')}</td>
      <td>${rupiah(x.debet || 0)}</td>
    </tr>
  `).join('') : '<tr><td colspan="4" class="empty-cell">Belum ada donasi sukarela pada periode ini.</td></tr>';
  modal.innerHTML = `
    <div class="iwk-modal-backdrop" onclick="closeDonasiDetail()"></div>
    <div class="iwk-modal-card expense-modal-card">
      <div class="modal-head">
        <div><h3>Info Donasi</h3><p>${periodeText} · Total ${rupiah(data.total || 0)}</p></div>
        <button type="button" class="mini-btn" onclick="closeDonasiDetail()">Tutup</button>
      </div>
      <div class="modal-toolbar">
        <label class="compact-field">Periode
          <select class="select mini-select" onchange="showDonasiDetail(this.value)">
            <option value="1" ${Number(data.periode) === 1 ? 'selected' : ''}>1 bulan terakhir</option>
            <option value="3" ${Number(data.periode) === 3 ? 'selected' : ''}>3 bulan terakhir</option>
            <option value="12" ${Number(data.periode) === 12 ? 'selected' : ''}>12 bulan terakhir</option>
          </select>
        </label>
      </div>
      <div class="report-table-wrap">
        <table class="report-table compact-table">
          <thead><tr><th>No</th><th>Tanggal</th><th>Penyumbang</th><th>Nominal</th></tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>`;
  modal.classList.remove('hide');
}
function closeDonasiDetail(){
  const modal = document.getElementById('donasiModal');
  if(modal) modal.classList.add('hide');
}

async function loadIwkProgress(targetId = 'iwkProgressCard') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const now = new Date();
  const data = await api(`/api/public/iwk-progress?bulan=${now.getMonth()+1}&tahun=${now.getFullYear()}`);
  const rumus = `${rupiah(data.pendapatan)} / (${rupiah(data.total_iwk)} × ${data.total_warga})`;
  el.innerHTML = `
    <div class="progress-title">Pendapatan IWK Bulan Berjalan</div>
    <div class="progress-money">${rupiah(data.pendapatan)} <span>/ ${rupiah(data.target)}</span></div>
    <div class="progress-note">${rumus}</div>
    <div class="progress-bar"><i style="width:${Math.min(100, Number(data.persen||0))}%"></i></div>
    <div class="progress-note">${data.jumlah_bayar} warga sudah bayar · Target ${data.persen}%</div>
  `;
}

async function loadIwkProgressPeriode(targetId, bulan, tahun, label){
  const el = document.getElementById(targetId);
  if(!el) return;
  const data = await api(`/api/iuran-wajib/status-pendapatan?bulan=${bulan}&tahun=${tahun}`);
  const rumus = `${rupiah(data.pendapatan)} / (${rupiah(data.total_iwk)} × ${data.total_warga})`;
  el.innerHTML = `
    <div class="progress-title">Pendapatan IWK ${esc(label)}</div>
    <div class="progress-money">${rupiah(data.pendapatan)} <span>/ ${rupiah(data.target)}</span></div>
    <div class="progress-note">${rumus}</div>
    <div class="progress-bar"><i style="width:${Math.min(100, Number(data.persen||0))}%"></i></div>
    <div class="progress-note">Total warga: ${data.total_warga} · Bayar: ${data.bayar_warga} warga (${rupiah(data.bayar_total)}) · Kurang: ${data.kurang_warga} warga (${rupiah(data.kurang_total)})</div>
    <div class="progress-note"><span class="danger-text">Belum bayar: ${data.belum_warga} warga</span> · Total: ${rupiah(data.pendapatan)}</div>
  `;
}

function setupIwkStatusBulanLalu(){
  const bulanEl = document.getElementById('iwkStatusBulanLalu');
  const tahunEl = document.getElementById('iwkStatusTahunLalu');
  if(!bulanEl || !tahunEl) return;
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  if(!bulanEl.innerHTML.trim()){
    bulanEl.innerHTML = bulanNama.map((b,i)=>`<option value="${i+1}">${b}</option>`).join('');
    bulanEl.value = String(prev.getMonth() + 1);
    bulanEl.addEventListener('change', loadIwkProgressBulanSebelumnya);
  }
  if(!tahunEl.value){
    tahunEl.value = String(prev.getFullYear());
    tahunEl.addEventListener('input', loadIwkProgressBulanSebelumnya);
  }
}

async function loadIwkProgressBulanSebelumnya(){
  const bulanEl = document.getElementById('iwkStatusBulanLalu');
  const tahunEl = document.getElementById('iwkStatusTahunLalu');
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  if(!bulanEl || !tahunEl) {
    await loadIwkProgressPeriode('iwkProgressBulanSebelumnya', prev.getMonth() + 1, prev.getFullYear(), `${bulanNama[prev.getMonth()]} ${prev.getFullYear()}`);
    return;
  }
  const bulan = Number(bulanEl.value || prev.getMonth() + 1);
  const tahun = Number(tahunEl.value || prev.getFullYear());
  await loadIwkProgressPeriode('iwkProgressBulanSebelumnya', bulan, tahun, `${bulanNama[bulan - 1]} ${tahun}`);
}

function printIwkStatusBulananPdf(){
  const bulan = document.getElementById('iwkStatusBulanLalu')?.value || '';
  const tahun = document.getElementById('iwkStatusTahunLalu')?.value || new Date().getFullYear();
  if(!bulan) {
    alert('Pilih bulan terlebih dahulu untuk cetak PDF.');
    return;
  }
  location.href = `/api/iuran-wajib/status-bulanan/pdf?bulan=${bulan}&tahun=${tahun}`;
}

async function loadWarga(selectId = 'warga') {
  const includeInactive = selectId === 'warga' && !!document.getElementById('wargaRows');
  let data = await api(`/api/wajib-iwk${includeInactive ? '?semua=true' : ''}`);
  if(selectId === 'santunanWarga') data = data.filter(w => w.anggota_dana_santunan === true);
  data = await filterWargaBelumBayarBulanBerjalan(data, selectId);
  const el = document.getElementById(selectId);
  if (el && el.tagName === 'SELECT') el.innerHTML = data.map(w => `<option value="${w._id}">${esc(w.no_rumah)} - ${esc(w.nama)} (${esc(w.area)})</option>`).join('');
  if (el && el.tagName !== 'SELECT') renderCustomWargaSelect(data, selectId);
  const rows = document.getElementById('wargaRows');
  if (rows) rows.innerHTML = data.map((w,i) => `<tr><td>${i+1}</td><td>${esc(w.no_rumah)}</td><td>${esc(w.nama)}</td><td>${esc(w.area)}</td><td>${esc(w.hp || '-')}</td><td>${w.anggota_dana_santunan ? '<span class="success-text">Anggota</span>' : '<span class="sub">Tidak</span>'}</td><td>${w.aktif === false ? '<span class="danger-text">Nonaktif</span>' : '<span class="success-text">Aktif</span>'}</td><td class="actions-cell"><button class="mini-btn" onclick='editWarga(${JSON.stringify(w)})'>Edit</button> <button class="mini-btn danger" onclick="deleteWarga('${w._id}')">Hapus</button></td></tr>`).join('');
}

function totalIwkForWarga(warga = selectedIwkWarga, param = lastParamIwk){
  if(!param) return lastTotalIwk;
  const keys = ['uang_satpam','uang_sampah','kas_pkk','kas_rt','kas_sosial'];
  return keys.reduce((total, key) => total + Number((param[key] ?? (key === 'kas_pkk' ? param.kas_rw : 0)) || 0), 0);
}

function updateSelectedIwkWargaInfo(warga){
  selectedIwkWarga = warga || null;
  lastTotalIwk = totalIwkForWarga(selectedIwkWarga);
  updateNominalForCheckedMonths();
}

function renderCustomWargaSelect(data, inputId = 'warga'){
  const hidden = document.getElementById(inputId);
  const wrap = document.querySelector(`[data-custom-warga="${inputId}"]`);
  if(!hidden || !wrap) return;
  let filtered = [...data];
  const setSelected = warga => {
    hidden.value = warga?._id || '';
    const search = wrap.querySelector('.custom-warga-search');
    if(search) search.value = warga ? `${warga.no_rumah} - ${warga.nama}${warga.anggota_dana_santunan ? ' (Anggota Dana Santunan)' : ''}` : '';
    if(inputId === 'warga' && isPaymentFormWarga(inputId)) updateSelectedIwkWargaInfo(warga);
    wrap.classList.remove('open');
  };
  const renderOptions = rows => {
    const list = wrap.querySelector('.custom-warga-options');
    if(!list) return;
    list.innerHTML = rows.length ? rows.map(w => `
      <button type="button" class="custom-warga-option" data-id="${esc(w._id)}">
        <strong>${esc(w.nama)}</strong>
        <span>${esc(w.no_rumah)} · ${esc(w.area || '-')}${w.anggota_dana_santunan ? ' · Anggota Dana Santunan' : ''}</span>
      </button>
    `).join('') : '<div class="custom-warga-empty">Warga tidak ditemukan.</div>';
    list.querySelectorAll('.custom-warga-option').forEach(btn => {
      btn.addEventListener('click', () => setSelected(data.find(w => String(w._id) === btn.dataset.id)));
    });
  };
  renderOptions(filtered);
  setSelected(data[0]);
  const search = wrap.querySelector('.custom-warga-search');
  if(search && !search.dataset.bound){
    search.dataset.bound = 'true';
    search.addEventListener('focus', () => wrap.classList.add('open'));
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      const nq = normalizeSearchText(q);
      filtered = data.filter(w => {
        const raw = `${w.nama} ${w.no_rumah} ${w.area}`.toLowerCase();
        const normalized = normalizeSearchText(`${w.nama} ${w.no_rumah} ${w.area}`);
        return raw.includes(q) || normalized.includes(nq);
      });
      hidden.value = '';
      renderOptions(filtered);
      wrap.classList.add('open');
    });
  }
}

document.addEventListener('click', e => {
  document.querySelectorAll('.custom-warga-select.open').forEach(wrap => {
    if(!wrap.contains(e.target)) wrap.classList.remove('open');
  });
});

function editWarga(w){
  const form = document.getElementById('formWarga');
  if(!form) return;
  form.warga_id.value = w._id || '';
  form.nama.value = w.nama || '';
  form.nik.value = w.nik || '';
  form.hp.value = w.hp || '';
  form.no_rumah.value = w.no_rumah || '';
  form.area.value = w.area || 'utara';
  if(form.anggota_dana_santunan) form.anggota_dana_santunan.checked = w.anggota_dana_santunan === true;
  if(form.aktif) form.aktif.checked = w.aktif !== false;
  const title = document.getElementById('formWargaTitle');
  if(title) title.textContent = 'Edit Warga Wajib IWK';
  const btn = document.getElementById('btnWargaSubmit');
  if(btn) btn.textContent = 'Update Warga';
  form.scrollIntoView({behavior:'smooth', block:'center'});
}

function resetWargaForm(){
  const form = document.getElementById('formWarga');
  if(!form) return;
  form.reset();
  form.warga_id.value = '';
  if(form.anggota_dana_santunan) form.anggota_dana_santunan.checked = false;
  if(form.aktif) form.aktif.checked = true;
  const title = document.getElementById('formWargaTitle');
  if(title) title.textContent = 'Tambah Warga Wajib IWK';
  const btn = document.getElementById('btnWargaSubmit');
  if(btn) btn.textContent = 'Tambah Warga';
}

async function deleteWarga(id){
  if(!confirm('Hapus warga ini dari daftar wajib IWK?')) return;
  await api(`/api/wajib-iwk/${id}`, {method:'DELETE'});
  await loadWarga();
}

async function loadIwk() {
  if(activePaymentTab === 'donasi') return loadDonasiRiwayat();
  if(activePaymentTab === 'dana_santunan') return loadDanaSantunanRiwayat();
  const bulan = document.getElementById('riwayatBulan')?.value || '';
  const tahun = document.getElementById('riwayatTahun')?.value || '';
  const qs = new URLSearchParams();
  if(bulan) qs.set('bulan', bulan);
  if(tahun) qs.set('tahun', tahun);
  let data = await api(`/api/iuran-wajib${qs.toString() ? '?' + qs.toString() : ''}`);
  const el = document.getElementById('riwayat');
  if (!el) return;
  setRiwayatPanelMode('iwk');
  const q = (document.getElementById('riwayatSearch')?.value || '').trim().toLowerCase();
  const nq = normalizeSearchText(q);
  if(q) {
    data = data.filter(x => {
      const raw = `${x.warga?.nama || ''} ${x.warga?.no_rumah || ''} ${x.petugas?.nama || ''} ${x.catatan_petugas || ''}`.toLowerCase();
      const normalized = normalizeSearchText(raw);
      return raw.includes(q) || normalized.includes(nq);
    });
  }
  riwayatIwkRows = data;
  const withDelete = el.dataset.actions === 'delete';
  const infoField = el.dataset.info === 'catatan' ? 'catatan' : 'petugas';
  el.innerHTML = data.length ? data.map((x, idx) => {
    const metode = x.metode_bayar === 'transfer' ? 'Transfer' : 'Cash';
    const info = infoField === 'catatan' ? (x.catatan_petugas || '-') : (x.petugas?.nama || '-');
    const actionButtons = withDelete ? `<td>${x.status === 'pratinjau' ? `<button class="mini-btn" type="button" onclick="showKonfirmasiIwkPratinjau('${x._id}')">Jadikan Bayar</button> ` : ''}<button class="mini-btn danger" type="button" onclick="deleteIwkRiwayat('${x._id}')">Hapus</button></td>` : '';
    return `<tr><td>${idx + 1}</td><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${esc(x.warga?.nama || '-')}<br><small>${esc(x.warga?.no_rumah || '-')}</small></td><td>${nominalIwkCell(x)}<br><small>${bulanNama[(x.bulan || 1)-1]} ${x.tahun || ''} · ${metode}</small></td><td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td><td>${esc(info)}</td>${actionButtons}</tr>`;
  }).join('') : `<tr><td colspan="${withDelete ? 7 : 6}" class="empty-cell">Riwayat tidak ditemukan.</td></tr>`;
}

function setRiwayatPanelMode(mode = 'iwk'){
  const title = document.getElementById('riwayatPanelTitle');
  const desc = document.getElementById('riwayatPanelDesc');
  const toolbar = document.querySelector('#riwayatIwkInputPanel .toolbar-actions');
  const thead = document.querySelector('#riwayatIwkInputPanel table thead');
  if(mode === 'donasi'){
    if(title) title.textContent = 'Riwayat Donasi';
    if(desc) desc.textContent = 'Donasi sukarela bulan berjalan.';
    if(toolbar) toolbar.classList.add('hide');
    if(thead) thead.innerHTML = '<tr><th>No</th><th>Tanggal</th><th>Penyumbang</th><th>Nominal</th><th>Petugas</th><th>Catatan</th><th>Aksi</th></tr>';
    return;
  }
  if(title) title.textContent = 'Riwayat IWK';
  if(desc) desc.textContent = title.closest('body')?.querySelector('#formTunggakanIwk') ? 'Filter bulan/tahun atau cari baris yang akan dihapus.' : 'Bisa dicetak PDF sebagai bukti penagihan ke bendahara.';
  if(toolbar) toolbar.classList.remove('hide');
  const infoLabel = document.getElementById('riwayat')?.dataset.info === 'petugas' ? 'Petugas' : 'Catatan';
  if(thead) thead.innerHTML = `<tr><th>No</th><th>Tanggal</th><th>Warga</th><th>Nominal</th><th>Status</th><th>${infoLabel}</th><th>Aksi</th></tr>`;
}

async function loadDonasiRiwayat(){
  const el = document.getElementById('riwayat');
  if(!el) return;
  setRiwayatPanelMode('donasi');
  const now = new Date();
  const res = await api(`/api/iuran-wajib/donasi/riwayat?bulan=${now.getMonth()+1}&tahun=${now.getFullYear()}`);
  const rows = res.rows || [];
  el.innerHTML = rows.length ? rows.map((x, idx) => {
    const [nama, rumah] = String(x.keterangan || '-').split(' - No ');
    return `<tr><td>${idx + 1}</td><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${esc(nama || '-')}<br><small>${esc(rumah || '-')}</small></td><td>${rupiah(x.debet || 0)}</td><td>${esc(x.dibuat_oleh?.nama || '-')}</td><td>${esc(x.keterangan || '-')}</td><td><button class="mini-btn" type="button" onclick="editDonasiRiwayat('${x._id}', ${Number(x.debet || 0)}, '${encodeURIComponent(x.keterangan || '')}')">Edit</button> <button class="mini-btn danger" type="button" onclick="deleteDonasiRiwayat('${x._id}')">Hapus</button></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty-cell">Belum ada donasi bulan berjalan.</td></tr>';
}

async function editDonasiRiwayat(id, currentNominal, currentKeterangan){
  const nominal = prompt('Edit nominal donasi:', currentNominal || 0);
  if(nominal === null) return;
  const keterangan = prompt('Edit keterangan donasi:', decodeURIComponent(currentKeterangan || ''));
  if(keterangan === null) return;
  await api(`/api/iuran-wajib/donasi/${id}`, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ nominal, keterangan })
  });
  await loadDonasiRiwayat();
}

async function deleteDonasiRiwayat(id){
  const text = prompt('Ketik hapus untuk konfirmasi hapus riwayat donasi ini.');
  if(String(text || '').toLowerCase() !== 'hapus') return;
  await api(`/api/iuran-wajib/donasi/${id}`, {
    method:'DELETE',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ confirm: 'hapus' })
  });
  await loadDonasiRiwayat();
}

function setupRiwayatFilters(){
  const bulan = document.getElementById('riwayatBulan');
  const tahun = document.getElementById('riwayatTahun');
  const search = document.getElementById('riwayatSearch');
  if(!bulan && !tahun && !search) return;
  const now = new Date();
  if(bulan && !bulan.innerHTML.trim()){
    bulan.innerHTML = `<option value="">Semua Bulan</option>` + bulanNama.map((b,i)=>`<option value="${i+1}">${b}</option>`).join('');
    bulan.value = now.getMonth() + 1;
    bulan.addEventListener('change', loadIwk);
  }
  if(tahun && !tahun.value){
    tahun.value = now.getFullYear();
    tahun.addEventListener('input', loadIwk);
  }
  if(search && !search.dataset.bound){
    search.dataset.bound = 'true';
    search.addEventListener('input', loadIwk);
  }
}

async function deleteIwkRiwayat(id){
  const text = prompt('Ketik hapus untuk konfirmasi hapus riwayat IWK ini.');
  if(String(text || '').toLowerCase() !== 'hapus') return;
  await api(`/api/iuran-wajib/${id}`, {
    method: 'DELETE',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ confirm: 'hapus' })
  });
  await loadIwk();
  await loadWarga();
  await loadPetugasBulanIniTotal();
}
async function konfirmasiIwkPratinjau(id){
  await api(`/api/iuran-wajib/${id}/konfirmasi-transfer`, { method:'PUT' });
  closeRiwayatProofModal();
  await loadIwk();
  await loadWarga();
  await loadPetugasBulanIniTotal();
}
function showKonfirmasiIwkPratinjau(id){
  const row = riwayatIwkRows.find(x => String(x._id) === String(id));
  let modal = document.getElementById('riwayatProofModal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'riwayatProofModal';
    modal.className = 'iwk-status-modal hide';
    document.body.appendChild(modal);
  }
  const foto = row?.bukti_transfer_iwk?.foto_bukti || row?.foto_bayar || '';
  const fotoUrl = foto ? `${foto}${foto.includes('?') ? '&' : '?'}v=${encodeURIComponent(row?.updatedAt || row?.createdAt || Date.now())}` : '';
  modal.innerHTML = `
    <div class="iwk-modal-backdrop" onclick="closeRiwayatProofModal()"></div>
    <div class="iwk-modal-card proof-preview-modal">
      <div class="modal-head">
        <div><h3>Pratinjau Bukti Transfer</h3><p>${esc(row?.warga?.nama || '-')} · ${esc(row?.warga?.no_rumah || '-')} · ${rupiah(row?.nominal_bayar || 0)}</p></div>
        <button type="button" class="mini-btn" onclick="closeRiwayatProofModal()">Tutup</button>
      </div>
      ${fotoUrl ? `<img class="proof-preview-img" src="${esc(fotoUrl)}" alt="Bukti transfer"><a class="mini-btn proof-preview-link" href="${esc(fotoUrl)}" target="_blank" rel="noopener">Buka Gambar</a>` : '<div class="empty-state">Gambar bukti tidak tersedia.</div>'}
      <div class="proof-preview-actions">
        <button class="btn secondary" type="button" onclick="closeRiwayatProofModal()">Batal</button>
        <button class="btn" type="button" onclick="konfirmasiIwkPratinjau('${id}')">Jadikan Bayar</button>
      </div>
    </div>`;
  modal.classList.remove('hide');
}
function closeRiwayatProofModal(){
  const modal = document.getElementById('riwayatProofModal');
  if(modal) modal.classList.add('hide');
}

async function loadIwkBulanIni() {
  const d = new Date();
  const url = isPublic() ? `/api/public/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}` : `/api/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}`;
  const data = await api(url);
  const el = document.getElementById('iwkRows');
  if (!el) return;
  el.innerHTML = data.map(x => `<tr><td>${x.warga?.nama || '-'}</td><td>${x.warga?.no_rumah || '-'}</td><td>${x.warga?.area || '-'}</td><td>${nominalIwkCell(x)}</td><td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td></tr>`).join('');
}

function setupBulanMulai(){
  const bulan = document.getElementById('bulanMulai');
  const tahun = document.getElementById('tahunMulai');
  const now = new Date();
  if(tahun) tahun.value = now.getFullYear();
  const checklist = document.getElementById('bulanChecklist');
  if(checklist){
    checklist.innerHTML = bulanNama.map((b,i)=>{
      const val = i + 1;
      return `<label class="month-check ${val === now.getMonth() + 1 ? 'active' : ''}"><input type="checkbox" name="bulan_list" value="${val}" ${val === now.getMonth() + 1 ? 'checked' : ''}> <span>${val}</span><small>${b}</small></label>`;
    }).join('');
    checklist.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      input.closest('.month-check')?.classList.toggle('active', input.checked);
      updateNominalForCheckedMonths();
      scheduleWargaReload();
      syncRiwayatToPaymentPeriod();
    }));
    updateNominalForCheckedMonths();
  }
  if(tahun && !tahun.dataset.periodBound){
    tahun.dataset.periodBound = 'true';
    tahun.addEventListener('input', () => {
      scheduleWargaReload();
      syncRiwayatToPaymentPeriod();
    });
  }
  if(!bulan || !tahun) return;
  bulan.innerHTML = bulanNama.map((b,i)=>`<option value="${i+1}">${b}</option>`).join('');
  bulan.value = now.getMonth() + 1;
}

let wargaReloadTimer = null;
function scheduleWargaReload(){
  clearTimeout(wargaReloadTimer);
  wargaReloadTimer = setTimeout(() => loadWarga().catch(() => {}), 250);
}

function syncRiwayatToPaymentPeriod(){
  const checklist = document.getElementById('bulanChecklist');
  const tahunInput = document.getElementById('tahunMulai');
  const riwayatBulan = document.getElementById('riwayatBulan');
  const riwayatTahun = document.getElementById('riwayatTahun');
  const months = checklist ? checkedIwkMonths() : [];
  let changed = false;
  if(riwayatBulan && months.length){
    const first = String(months[0]);
    if(String(riwayatBulan.value) !== first) { riwayatBulan.value = first; changed = true; }
  }
  if(riwayatTahun && tahunInput && tahunInput.value){
    if(String(riwayatTahun.value) !== String(tahunInput.value)) { riwayatTahun.value = tahunInput.value; changed = true; }
  }
  if(changed) loadIwk();
}

function checkedMonthCount(){
  const checklist = document.getElementById('bulanChecklist');
  if(!checklist) return Number(document.querySelector('[name="jumlah_bulan"]')?.value || 1);
  return Math.max(1, checklist.querySelectorAll('input:checked').length);
}

function checkedIwkMonths(){
  const checklist = document.getElementById('bulanChecklist');
  if(!checklist) return [];
  return [...checklist.querySelectorAll('input[name="bulan_list"]:checked:not(:disabled)')].map(input => Number(input.value)).filter(Boolean);
}

function updateNominalForCheckedMonths(){
  const nominal = document.getElementById('nominalBayar');
  if(nominal && lastTotalIwk > 0) {
    nominal.value = lastTotalIwk * checkedMonthCount();
    if(Number(nominal.dataset.minPerBulan || 0) > 0) nominal.min = Number(nominal.dataset.minPerBulan || 0) * checkedMonthCount();
    nominal.placeholder = `Nominal total bayar (${rupiah(lastTotalIwk)} x ${checkedMonthCount()} bulan)`;
  }
}

function applyIwkCutoffToChecklist(cutoffBulan = 7, cutoffTahun = 2026){
  const checklist = document.getElementById('bulanChecklist');
  const tahun = document.getElementById('tahunMulai');
  if(!checklist || !tahun) return;
  const refresh = () => {
    const y = Number(tahun.value || new Date().getFullYear());
    checklist.querySelectorAll('input[name="bulan_list"]').forEach(input => {
      const disabled = y < cutoffTahun || (y === cutoffTahun && Number(input.value) < cutoffBulan);
      input.disabled = disabled;
      if(disabled) {
        input.checked = false;
        input.closest('.month-check')?.classList.remove('active');
      }
      input.closest('.month-check')?.classList.toggle('disabled', disabled);
    });
    updateNominalForCheckedMonths();
  };
  tahun.min = cutoffTahun;
  tahun.addEventListener('input', refresh);
  refresh();
}

async function setDefaultNominalIwk(){
  const nominal = document.getElementById('nominalBayar');
  if(!nominal) return;
  try{
    const p = await api('/api/parameter-iwk');
    lastParamIwk = p;
    lastTotalIwk = totalIwkForWarga(selectedIwkWarga, p);
    const minimal = Number(p.minimal_nominal_iwk || 0);
    if(minimal > 0) {
      nominal.min = minimal * checkedMonthCount();
      nominal.dataset.minPerBulan = minimal;
    }
    applyIwkCutoffToChecklist(Number(p.iwk_cutoff_bulan || 7), Number(p.iwk_cutoff_tahun || 2026));
    updateSelectedIwkWargaInfo(selectedIwkWarga);
    updateNominalForCheckedMonths();
  }catch(e){}
}

function bindIwkForm() {
  const form = document.getElementById('formIwk');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    try {
      const formData = new FormData(form);
      const months = checkedIwkMonths();
      if(document.getElementById('bulanChecklist') && !months.length) throw new Error('Pilih minimal 1 bulan pembayaran IWK.');
      if(months.length) formData.set('bulan_list_json', JSON.stringify(months));
      const submitButton = form.querySelector('button[type="submit"], button:not([type])');
      if(submitButton) submitButton.disabled = true;
      const result = await fetch('/api/iuran-wajib', { method: 'POST', body: formData }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
      form.reset(); setupBulanMulai(); await loadWarga(); await setDefaultNominalIwk(); msg.textContent = result.message || 'Pembayaran berhasil disimpan.';
      if(Number(result.jumlah_diabaikan || 0) > 0 || Number(result.jumlah_data || 0) === 0) alert(result.message || 'Pembayaran sudah pernah dicatat, jadi tidak disimpan ulang.');
      await loadIwk(); await loadPetugasBulanIniTotal();
    } catch (err) { msg.textContent = err.message; }
    finally {
      const submitButton = form.querySelector('button[type="submit"], button:not([type])');
      if(submitButton) submitButton.disabled = false;
    }
  });
}

function setPaymentTab(tab = 'iwk'){
  activePaymentTab = tab;
  document.querySelectorAll('.payment-tabs .tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.getElementById('iwkPaymentPanel')?.classList.toggle('hide', tab !== 'iwk');
  document.getElementById('donasiPaymentPanel')?.classList.toggle('hide', tab !== 'donasi');
  document.getElementById('danaSantunanPaymentPanel')?.classList.toggle('hide', tab !== 'dana_santunan');
  document.getElementById('riwayatIwkInputPanel')?.classList.toggle('hide', tab === 'dana_santunan');
  if(tab === 'dana_santunan') loadDanaSantunanRiwayat();
  if(tab === 'donasi') loadDonasiRiwayat();
  else if(tab === 'iwk') loadIwk();
}

function bindDonasiForm(){
  const form = document.getElementById('formDonasi');
  if(!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  const tanggal = form.elements.tanggal;
  if(tanggal && !tanggal.value) tanggal.value = new Date().toISOString().slice(0,16);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('donasiMsg');
    try{
      const body = Object.fromEntries(new FormData(form).entries());
      const result = await api('/api/iuran-wajib/donasi', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      form.reset();
      if(tanggal) tanggal.value = new Date().toISOString().slice(0,16);
      if(msg) msg.textContent = result.message || 'Donasi berhasil disimpan.';
      await loadDonasiRiwayat();
    }catch(err){
      if(msg) msg.textContent = err.message;
    }
  });
}

function setupDanaSantunanBulan(){
  const tahun = document.getElementById('santunanTahun');
  const checklist = document.getElementById('santunanBulanChecklist');
  const now = new Date();
  if(tahun) tahun.value = now.getFullYear();
  if(!checklist) return;
  checklist.innerHTML = bulanNama.map((b,i)=>{
    const val = i + 1;
    return `<label class="month-check ${val === now.getMonth() + 1 ? 'active' : ''}"><input type="checkbox" name="bulan_list" value="${val}" ${val === now.getMonth() + 1 ? 'checked' : ''}> <span>${val}</span><small>${b}</small></label>`;
  }).join('');
  checklist.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
    input.closest('.month-check')?.classList.toggle('active', input.checked);
    updateDanaSantunanNominal();
  }));
}

function checkedDanaSantunanMonths(){
  const checklist = document.getElementById('santunanBulanChecklist');
  if(!checklist) return [];
  return [...checklist.querySelectorAll('input[name="bulan_list"]:checked')].map(input => Number(input.value)).filter(Boolean);
}

function updateDanaSantunanNominal(){
  const nominal = document.getElementById('santunanNominal');
  const perBulan = Number(nominal?.dataset.perBulan || 0);
  if(nominal && perBulan > 0) {
    const count = Math.max(1, checkedDanaSantunanMonths().length);
    nominal.value = perBulan * count;
    nominal.placeholder = `Nominal Dana Santunan (${rupiah(perBulan)} x ${count} bulan)`;
  }
}

async function setDefaultDanaSantunan(){
  const nominal = document.getElementById('santunanNominal');
  if(!nominal) return;
  try{
    const p = await api('/api/parameter-iwk');
    const perBulan = Number(p.dana_santunan_bulanan || p.santunan_kematian || 0);
    nominal.dataset.perBulan = perBulan;
    if(perBulan > 0) nominal.min = perBulan;
    updateDanaSantunanNominal();
  }catch(e){}
}

function bindDanaSantunanForm(){
  const form = document.getElementById('formDanaSantunan');
  if(!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('santunanMsg');
    try{
      const formData = new FormData(form);
      const months = checkedDanaSantunanMonths();
      if(!months.length) throw new Error('Pilih minimal 1 bulan Dana Santunan.');
      formData.set('bulan_list_json', JSON.stringify(months));
      const result = await fetch('/api/iuran-wajib/dana-santunan', { method:'POST', body: formData }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
      form.reset();
      setupDanaSantunanBulan();
      await loadWarga('santunanWarga');
      await setDefaultDanaSantunan();
      if(msg) msg.textContent = result.message || 'Dana Santunan berhasil disimpan.';
      await loadDanaSantunanRiwayat();
    }catch(err){
      if(msg) msg.textContent = err.message;
    }
  });
}

async function loadDanaSantunanRiwayat(){
  const el = document.getElementById('santunanRows');
  if(!el) return;
  const now = new Date();
  const data = await api(`/api/iuran-wajib/dana-santunan/riwayat?bulan=${now.getMonth()+1}&tahun=${now.getFullYear()}`);
  el.innerHTML = (data.rows || []).length ? data.rows.map(x => `<tr><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${esc(x.keterangan || '-')}</td><td>${rupiah(x.debet || 0)}</td><td>${esc(x.dibuat_oleh?.nama || '-')}</td><td><button class="mini-btn" type="button" onclick="editDanaSantunanRiwayat('${x._id}', ${Number(x.debet || 0)}, '${encodeURIComponent(x.keterangan || '')}')">Edit</button> <button class="mini-btn danger" type="button" onclick="deleteDanaSantunanRiwayat('${x._id}')">Hapus</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-cell">Belum ada Dana Santunan bulan berjalan.</td></tr>';
}

async function editDanaSantunanRiwayat(id, currentNominal, currentKeterangan){
  const nominal = prompt('Edit nominal Dana Santunan:', currentNominal || 0);
  if(nominal === null) return;
  const keterangan = prompt('Edit keterangan Dana Santunan:', decodeURIComponent(currentKeterangan || ''));
  if(keterangan === null) return;
  await api(`/api/iuran-wajib/dana-santunan/${id}`, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ nominal, keterangan })
  });
  await loadDanaSantunanRiwayat();
}

async function deleteDanaSantunanRiwayat(id){
  const text = prompt('Ketik hapus untuk konfirmasi hapus riwayat Dana Santunan ini.');
  if(String(text || '').toLowerCase() !== 'hapus') return;
  await api(`/api/iuran-wajib/dana-santunan/${id}`, {
    method:'DELETE',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ confirm: 'hapus' })
  });
  await loadDanaSantunanRiwayat();
}

async function initPetugasIwk() { setupBulanMulai(); setupDanaSantunanBulan(); setupRiwayatFilters(); await setDefaultNominalIwk(); await setDefaultDanaSantunan(); await loadWarga(); await loadWarga('santunanWarga'); bindIwkForm(); bindDonasiForm(); bindDanaSantunanForm(); await initRiwayatInputVisibility(); await initFotoInputVisibility(); await loadIwk(); await loadPetugasBulanIniTotal(); }

async function initRiwayatInputVisibility(){
  const panel = document.getElementById('riwayatIwkInputPanel');
  if(!panel) return true;
  try{
    const p = await api('/api/parameter-iwk');
    const show = p.tampil_riwayat_iwk_input !== false;
    panel.classList.toggle('hide', !show);
    return show;
  }catch(e){
    return true;
  }
}

async function initFotoInputVisibility(){
  const wrap = document.getElementById('fotoIwkInputWrap');
  if(!wrap) return true;
  try{
    const p = await api('/api/parameter-iwk');
    const show = p.tampil_foto_iwk_input !== false;
    wrap.classList.toggle('hide', !show);
    const fileInput = wrap.querySelector('input[type="file"]');
    if(!show && fileInput) fileInput.value = '';
    return show;
  }catch(e){
    return true;
  }
}


async function loadPetugasBulanIniTotal(){
  const el = document.getElementById('petugasIwkTotalBulanIni');
  if(!el) return;
  const d = new Date();
  const data = await api(`/api/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}`);
  const total = data.reduce((sum,x)=>sum + Number(x.nominal_bayar || 0),0);
  const count = data.filter(x => Number(x.nominal_bayar || 0) > 0).length;
  el.innerHTML = `<div class="progress-title">Total Penagihan Bulan Ini</div><div class="progress-money">${rupiah(total)}</div><div class="progress-note">${count} pembayaran tercatat pada ${bulanNama[d.getMonth()]} ${d.getFullYear()}</div>`;
}

function setupMonthYearControls(monthId, yearId){
  const bulan = document.getElementById(monthId);
  const tahun = document.getElementById(yearId);
  const now = new Date();
  if(bulan) {
    bulan.innerHTML = bulanNama.map((b,i)=>`<option value="${i+1}">${b}</option>`).join('');
    bulan.value = now.getMonth() + 1;
  }
  if(tahun) tahun.value = now.getFullYear();
}

function applyIwkCutoffToMonthControl(monthId, yearId, cutoffBulan = 7, cutoffTahun = 2026){
  const bulan = document.getElementById(monthId);
  const tahun = document.getElementById(yearId);
  if(!bulan || !tahun) return;
  const refresh = () => {
    const y = Number(tahun.value || new Date().getFullYear());
    [...bulan.options].forEach(opt => { opt.disabled = y < cutoffTahun || (y === cutoffTahun && Number(opt.value) < cutoffBulan); });
    if(y < cutoffTahun) tahun.value = cutoffTahun;
    if(Number(tahun.value) === cutoffTahun && Number(bulan.value) < cutoffBulan) bulan.value = cutoffBulan;
  };
  tahun.min = cutoffTahun;
  tahun.addEventListener('input', refresh);
  bulan.addEventListener('change', refresh);
  refresh();
}

async function initAdminIwkMonthlyReport(){
  setupMonthYearControls('adminIwkReportBulan', 'adminIwkReportTahun');
  await loadAdminIwkMonthlyReport();
}

async function loadAdminIwkMonthlyReport(){
  const bulan = document.getElementById('adminIwkReportBulan')?.value || new Date().getMonth() + 1;
  const tahun = document.getElementById('adminIwkReportTahun')?.value || new Date().getFullYear();
  const data = await api(`/api/iuran-wajib/laporan-bulanan?bulan=${bulan}&tahun=${tahun}`);
  const summary = document.getElementById('adminIwkMonthlySummary');
  if(summary) summary.innerHTML = `
    <div class="summary-mini income"><span>Total Pemasukan IWK</span><strong>${rupiah(data.total || 0)}</strong></div>
    <div class="summary-mini"><span>Periode</span><strong>${esc(data.periode || '-')}</strong></div>
    <div class="summary-mini"><span>Jumlah Pembayaran</span><strong>${Number(data.jumlah_data || 0).toLocaleString('id-ID')}</strong></div>
  `;
  const rows = document.getElementById('adminIwkMonthlyRows');
  if(rows) rows.innerHTML = data.rows?.length ? data.rows.map((x, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td>
      <td>${esc(x.warga?.nama || '-')}</td>
      <td>${esc(x.warga?.no_rumah || '-')}</td>
      <td>${esc(x.petugas?.nama || '-')}</td>
      <td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td>
      <td>${nominalIwkCell(x)}</td>
    </tr>
  `).join('') : `<tr><td colspan="7" class="empty-cell">Belum ada data pembayaran IWK pada periode ini.</td></tr>`;
}

function downloadAdminIwkMonthlyPdf(){
  const bulan = document.getElementById('adminIwkReportBulan')?.value || new Date().getMonth() + 1;
  const tahun = document.getElementById('adminIwkReportTahun')?.value || new Date().getFullYear();
  location.href = `/api/iuran-wajib/laporan-bulanan/pdf?bulan=${bulan}&tahun=${tahun}`;
}

function printRiwayatPetugas(){
  const bulan = document.getElementById('riwayatBulan')?.value || '';
  const tahun = document.getElementById('riwayatTahun')?.value || new Date().getFullYear();
  if(!bulan) {
    alert('Pilih bulan terlebih dahulu untuk cetak PDF riwayat IWK.');
    return;
  }
  location.href = `/api/export/riwayat-iwk-petugas/pdf?bulan=${bulan}&tahun=${tahun}`;
}

async function initKas() {
  const form = document.getElementById('formKas');
  if(!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    const id = body.kas_id;
    delete body.kas_id;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/kas/${id}` : '/api/kas';
    await api(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    resetKasForm();
    await loadKasRows();
  });
  bindKasImportCsv();
  setupKasTotalPeriode();
  await loadKasRows();
}

async function bindKasImportCsv() {
  const form = document.getElementById('formKasImportCsv');
  if(!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  const tanggal = form.elements.tanggal;
  if(tanggal && !tanggal.value) tanggal.value = new Date().toISOString().slice(0,10);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('kasImportMsg');
    if(msg) msg.textContent = 'Mengimport CSV...';
    try{
      const result = await fetch('/api/kas/import-csv', { method: 'POST', body: new FormData(form) }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
      form.reset();
      if(tanggal) tanggal.value = new Date().toISOString().slice(0,10);
      if(msg) msg.textContent = `${result.message}.${result.errors?.length ? ' Baris gagal: ' + result.errors.join('; ') : ''}`;
      await loadKasRows();
    }catch(err){
      if(msg) msg.textContent = err.message;
    }
  });
}

function setupKasTotalPeriode() {
  const dari = document.getElementById('kasDari');
  const sampai = document.getElementById('kasSampai');
  if(!dari || !sampai) return;
  const today = new Date().toISOString().slice(0,10);
  if(!dari.value) dari.value = today;
  if(!sampai.value) sampai.value = today;
}

async function loadKasTotalPeriode() {
  const dari = document.getElementById('kasDari')?.value;
  const sampai = document.getElementById('kasSampai')?.value;
  const el = document.getElementById('kasTotalPeriode');
  if(!dari || !sampai || !el) return;
  try{
    const data = await api(`/api/kas/total-periode?dari=${dari}&sampai=${sampai}`);
    el.innerHTML = `
      <div class="summary-mini income"><span>Total Pengeluaran</span><strong>${rupiah(data.total_pengeluaran)}</strong></div>
      <div class="summary-mini"><span>Total Pemasukan</span><strong>${rupiah(data.total_pemasukan)}</strong></div>
      <div class="summary-mini"><span>Jumlah Transaksi</span><strong>${Number(data.jumlah_pengeluaran || 0).toLocaleString('id-ID')} keluar · ${Number(data.jumlah_pemasukan || 0).toLocaleString('id-ID')} masuk</strong></div>
    `;
  }catch(err){
    el.innerHTML = `<div class="summary-mini"><span>Keterangan</span><strong>${esc(err.message)}</strong></div>`;
  }
}

async function loadKasRows() {
  const data = await api('/api/kas');
  kasRows.innerHTML = data.map(x => {
    const tipe = Number(x.debet || 0) > 0 ? 'debet' : 'kredit';
    const nominal = Number(x.debet || 0) > 0 ? x.debet : x.kredit;
    return `<tr><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${nice(x.jenis_kas)}</td><td>${x.keterangan}</td><td>${rupiah(x.debet)}</td><td>${rupiah(x.kredit)}</td><td>${rupiah(x.saldo)}</td><td class="actions-cell"><button class="mini-btn" onclick='editKas(${JSON.stringify({...x, tipe, nominal})})'>Edit</button> <button class="mini-btn danger" onclick="deleteKas('${x._id}')">Hapus</button></td></tr>`;
  }).join('');
}

function editKas(x){
  const form = document.getElementById('formKas');
  if(!form) return;
  form.kas_id.value = x._id || '';
  form.jenis_kas.value = x.jenis_kas || 'kas_rt';
  form.tipe.value = x.tipe || 'debet';
  form.nominal.value = Number(x.nominal || 0);
  form.keterangan.value = x.keterangan || '';
  if(form.tanggal && x.tanggal) form.tanggal.value = new Date(x.tanggal).toISOString().slice(0,16);
  const title = document.getElementById('formKasTitle');
  if(title) title.textContent = 'Edit Transaksi Kas';
  const btn = document.getElementById('btnKasSubmit');
  if(btn) btn.textContent = 'Update Transaksi';
  form.scrollIntoView({behavior:'smooth', block:'center'});
}
function resetKasForm(){
  const form = document.getElementById('formKas');
  if(!form) return;
  form.reset();
  form.kas_id.value = '';
  const title = document.getElementById('formKasTitle');
  if(title) title.textContent = 'Input Transaksi Kas Manual';
  const btn = document.getElementById('btnKasSubmit');
  if(btn) btn.textContent = 'Simpan Transaksi';
}
async function deleteKas(id){
  if(!confirm('Hapus transaksi kas ini? Saldo akan dihitung ulang otomatis.')) return;
  await api(`/api/kas/${id}`, {method:'DELETE'});
  await loadKasRows();
}

function syncParamTotal(){
  if(!window.formParam) return;
  const keys = ['uang_satpam','uang_sampah','kas_pkk','kas_rt','kas_sosial'];
  const total = keys.reduce((t,k)=>t + Number(formParam.elements[k]?.value || 0),0);
  const totalEl = document.getElementById('paramTotalText');
  if(totalEl) totalEl.textContent = rupiah(total);
  const minEl = document.getElementById('paramMinimumText');
  const fallbackMin = Number(formParam.elements.uang_satpam?.value || 0) + Number(formParam.elements.uang_sampah?.value || 0);
  const customMin = Number(formParam.elements.minimal_nominal_iwk?.value || 0);
  if(minEl) minEl.textContent = rupiah(customMin > 0 ? customMin : fallbackMin);
}

async function initMaster() {
  const p = await api('/api/parameter-iwk');
  for (const [k,v] of Object.entries(p)) if (formParam.elements[k]) formParam.elements[k].type === 'checkbox' ? formParam.elements[k].checked = !!v : formParam.elements[k].value = v;
  for (const [k,v] of Object.entries(p.rekening_iwk || {})) {
    const el = formParam.elements[`rekening_iwk_${k}`];
    if(el) el.value = v || '';
  }
  for (const [k,v] of Object.entries(p.public_kas_visible || {})) {
    const el = formParam.elements[`public_kas_${k}`];
    if(el) {
      const checkbox = Array.isArray(el) ? el.find?.(x => x.type === 'checkbox') : (el.length ? [...el].find(x => x.type === 'checkbox') : el);
      if(checkbox) checkbox.checked = v !== false;
    }
  }
  if(formParam.elements.kas_pkk && !formParam.elements.kas_pkk.value && p.kas_rw) formParam.elements.kas_pkk.value = p.kas_rw;
  syncParamTotal();
  ['uang_satpam','uang_sampah','kas_pkk','kas_rt','kas_sosial','minimal_nominal_iwk'].forEach(k=>formParam.elements[k]?.addEventListener('input', syncParamTotal));
  formParam.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.wajib_foto_cash = e.target.wajib_foto_cash.checked;
    body.tampil_tunggakan_umum = e.target.tampil_tunggakan_umum.checked;
    await api('/api/parameter-iwk', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    alert('Parameter tersimpan'); await loadParameterList();
  });
  const btnNew = document.getElementById('btnParamBaru');
  if(btnNew) btnNew.addEventListener('click', async () => {
    const body = Object.fromEntries(new FormData(formParam).entries());
    body.wajib_foto_cash = formParam.wajib_foto_cash.checked;
    body.tampil_tunggakan_umum = formParam.tampil_tunggakan_umum.checked;
    await api('/api/parameter-iwk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    alert('Parameter baru dibuat dan diaktifkan'); await loadParameterList();
  });
  formWarga.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('wargaMsg');
    if(msg) msg.textContent = '';
    try {
      const session = await api('/api/auth/me');
      if(session.user?.role !== 'admin') throw new Error('Sesi admin sudah tidak aktif. Silakan login ulang sebagai admin.');
      const body = Object.fromEntries(new FormData(e.target).entries());
      const id = body.warga_id;
      delete body.warga_id;
      body.aktif = e.target.aktif?.checked === true;
      body.anggota_dana_santunan = e.target.anggota_dana_santunan?.checked === true;
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/wajib-iwk/${id}` : '/api/wajib-iwk';
      await api(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      resetWargaForm();
      if(msg) msg.textContent = 'Data warga berhasil tersimpan.';
      await loadWarga();
    } catch (err) {
      if(msg) msg.textContent = err.message === 'Akses ditolak' ? 'Akses ditolak. Silakan login ulang sebagai admin.' : err.message;
    }
  });
  await loadWarga();
  await loadParameterList();
}

async function loadParameterList(){
  const rows = document.getElementById('parameterRows');
  if(!rows) return;
  const data = await api('/api/parameter-iwk/list');
  rows.innerHTML = data.map(p => {
    const publicValues = Object.keys(p.public_kas_visible || {}).length ? Object.values(p.public_kas_visible || {}) : [true,true,true,true,true,true];
    const publicVisible = publicValues.filter(x => x !== false).length;
    return `<tr><td>${new Date(p.createdAt).toLocaleDateString('id-ID')}</td><td>${rupiah(p.total_iwk)}</td><td>${rupiah(p.uang_satpam)}</td><td>${rupiah(p.uang_sampah)}</td><td>${rupiah(p.kas_pkk ?? p.kas_rw)}</td><td>${rupiah(p.kas_rt)}</td><td>${rupiah(p.kas_sosial)}</td><td>${rupiah(p.dana_santunan_bulanan ?? p.santunan_kematian)}</td><td>${p.jumlah_kk_iuran_rw || 75}</td><td>${p.tampil_tunggakan_umum ? 'Ya' : 'Tidak'}</td><td>${publicVisible}/6</td><td>${p.aktif ? '<span class="success-text">Aktif</span>' : `<button class="mini-btn" onclick="aktifkanParameter('${p._id}')">Aktifkan</button>`}</td></tr>`;
  }).join('');
}
async function aktifkanParameter(id){ await api(`/api/parameter-iwk/${id}/aktif`, {method:'PUT'}); await loadParameterList(); location.reload(); }

function toggleAudit(){ document.getElementById('auditWrap')?.classList.toggle('hide'); }
async function loadAudit(){
  const el = document.getElementById('auditRows');
  if(!el) return;
  const data = await api('/api/audit-trail');
  el.innerHTML = data.map(x => `<tr><td>${new Date(x.createdAt).toLocaleString('id-ID')}</td><td>${x.nama}<br><small>${x.role}</small></td><td>${x.aksi}</td><td>${x.modul}</td><td>${x.detail || '-'}</td></tr>`).join('');
}

async function initUsers(){
  const form = document.getElementById('formUser');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.aktif = e.target.aktif.checked;
    const method = body.id ? 'PUT' : 'POST';
    const url = body.id ? `/api/users/${body.id}` : '/api/users';
    if(!body.password) delete body.password;
    delete body.id;
    await api(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    e.target.reset(); e.target.aktif.checked = true; document.getElementById('userId').value=''; await loadUsers();
  });
  role.addEventListener('change', () => areaWrap.classList.toggle('hide', role.value !== 'petugas'));
  await loadUsers();
}

async function loadUsers(){
  const data = await api('/api/users');
  userRows.innerHTML = data.map(u => `<tr><td>${u.nama}<br><small>${u.jabatan || '-'}</small></td><td>${u.username}</td><td>${u.role}</td><td>${u.area || '-'}</td><td>${u.aktif ? '<span class="success-text">Aktif</span>' : '<span class="danger-text">Nonaktif</span>'}</td><td><button class="mini-btn" onclick='editUser(${JSON.stringify(u)})'>Edit</button> <button class="mini-btn" onclick="deleteUser('${u._id}')">Hapus</button></td></tr>`).join('');
}
function editUser(u){
  userId.value = u._id; formUser.nama.value=u.nama; formUser.username.value=u.username; formUser.password.value=''; formUser.jabatan.value=u.jabatan||''; formUser.role.value=u.role; formUser.area.value=u.area||'-'; formUser.aktif.checked=!!u.aktif; areaWrap.classList.toggle('hide', u.role !== 'petugas');
}
async function deleteUser(id){ if(confirm('Hapus user ini?')){ await api(`/api/users/${id}`,{method:'DELETE'}); await loadUsers(); } }

function togglePublicMenu(){ document.getElementById('publicMenu')?.classList.toggle('hide'); }
document.addEventListener('click', e => {
  const pubMenu = document.getElementById('publicMenu');
  const pubBtn = document.querySelector('.floating-kebab');
  if(pubMenu && pubBtn && !pubMenu.contains(e.target) && !pubBtn.contains(e.target)) pubMenu.classList.add('hide');
  const prvMenu = document.getElementById('privateMenu');
  const prvBtn = document.querySelector('.private-kebab');
  if(prvMenu && prvBtn && !prvMenu.contains(e.target) && !prvBtn.contains(e.target)) prvMenu.classList.add('hide');
});

async function initIwkYearView(){
  setupMonthYearControls('iwkStatusBulan', 'iwkStatusTahun');
  await loadIwkYear();
}
function setIwkPeriodMode(value){ iwkPeriodMode = value; renderIwkYear(); }
function setIwkFilter(status, btn){
  iwkFilter = status;
  document.querySelectorAll('[data-status]').forEach(x=>x.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderIwkYear();
}
function setIwkSortMode(mode = 'status', btn){
  iwkSortMode = mode === 'rumah' ? 'rumah' : 'status';
  document.querySelectorAll('[data-sort]').forEach(x => x.classList.toggle('active', x.dataset.sort === iwkSortMode));
  if(btn) btn.classList.add('active');
  renderIwkYear();
}

async function loadTunggakanSebelumnya(){
  const section = document.getElementById('tunggakanSebelumnyaSection');
  const rows = document.getElementById('tunggakanSebelumnyaRows');
  const title = document.getElementById('tunggakanSebelumnyaTitle');
  if(!section || !rows) return;
  const res = await api('/api/public/tunggakan-sebelumnya');
  if(!res.tampil){ section.classList.add('hide'); return; }
  section.classList.remove('hide');
  if(title) title.textContent = `Tunggakan IWK ${bulanNama[(res.bulan || 1)-1]} ${res.tahun || ''}`;
  rows.innerHTML = res.data?.length ? res.data.map((w,i)=>`<tr><td>${i+1}</td><td>${w.nama}</td><td>${w.no_rumah}</td><td>${w.area || '-'}</td></tr>`).join('') : `<tr><td colspan="4" class="empty-cell">Tidak ada tunggakan periode sebelumnya.</td></tr>`;
}
async function loadIwkYear(){
  const text = document.getElementById('iwkYearText');
  const d = new Date();
  const bulan = document.getElementById('iwkStatusBulan')?.value || d.getMonth() + 1;
  const tahun = document.getElementById('iwkStatusTahun')?.value || d.getFullYear();
  const res = await api(`/api/public/iwk-status-cards?bulan=${bulan}&tahun=${tahun}`);
  iwkYearData = res.data || [];
  iwkStatusOptions = res || {};
  iwkFilter = res.public_iwk_status_filter || 'belum_bayar';
  if(res.cutoff) applyIwkCutoffToMonthControl('iwkStatusBulan', 'iwkStatusTahun', Number(res.cutoff.bulan || 7), Number(res.cutoff.tahun || 2026));
  if(text) text.textContent = res.periode || `${bulanNama[d.getMonth()]} ${d.getFullYear()}`;
  const note = document.getElementById('iwkStatusNote');
  if(note) note.textContent = res.tampil_tunggakan_lama ? 'Kartu merah bisa berarti belum bayar bulan berjalan atau masih ada tunggakan 12 bulan sebelumnya.' : 'Kartu mengikuti status pembayaran IWK bulan berjalan.';
  const filterWrap = document.getElementById('statusFilterWrap');
  if(filterWrap) filterWrap.classList.toggle('hide', iwkFilter === 'semua');
  document.querySelectorAll('[data-status]').forEach(btn => btn.classList.toggle('active', btn.dataset.status === iwkFilter));
  document.querySelectorAll('[data-sort]').forEach(btn => btn.classList.toggle('active', btn.dataset.sort === iwkSortMode));
  renderIwkYear();
}
function rowMatchesFilter(row){
  const current = normStatus(row.current?.status);
  const hasLama = row.has_tunggakan_lama === true;
  if(iwkFilter === 'semua') return true;
  if(iwkFilter === 'belum_bayar') return current === 'belum_bayar' || hasLama;
  if(iwkFilter === 'bayar') return (current === 'bayar' || current === 'pratinjau') && !hasLama;
  return current === iwkFilter;
}
function rowStatusRank(row){
  const current = normStatus(row.current?.status);
  if(row.has_tunggakan_lama || current === 'belum_bayar') return 0;
  if(current === 'kurang') return 1;
  if(current === 'pratinjau') return 2;
  return 3;
}
function compareRumahRow(a, b){
  return String(a.warga?.no_rumah || '').localeCompare(String(b.warga?.no_rumah || ''), 'id', { numeric:true, sensitivity:'base' }) ||
    String(a.warga?.nama || '').localeCompare(String(b.warga?.nama || ''), 'id', { sensitivity:'base' });
}
function sortIwkRows(rows = []){
  const sorted = [...rows];
  if(iwkSortMode === 'rumah') return sorted.sort(compareRumahRow);
  return sorted.sort((a,b) => rowStatusRank(a) - rowStatusRank(b) || compareRumahRow(a,b));
}
function renderIwkYear(){
  const el = document.getElementById('iwkYearGrid');
  if(!el) return;
  const ownRow = iwkYearData.find(row => isOwnPublicWarga(row.warga));
  const filtered = sortIwkRows(iwkYearData.filter(row => row !== ownRow).filter(rowMatchesFilter));
  const rows = ownRow ? [ownRow, ...filtered] : filtered;
  if(!rows.length){ el.innerHTML = '<div class="empty-state">Data tidak ditemukan untuk filter ini.</div>'; return; }
  el.innerHTML = rows.map(row => {
    const current = normStatus(row.current?.status);
    const cls = row.has_tunggakan_lama ? 'unpaid' : (current === 'bayar' || current === 'pratinjau') ? 'paid' : current === 'kurang' ? 'partial' : 'unpaid';
    const reason = row.has_tunggakan_lama ? 'Ada tunggakan lama' : current === 'pratinjau' ? 'Bayar · Transfer · Pratinjau' : labelStatus(current);
    const content = `
      <strong>${row.warga?.nama || '-'}</strong>
      <span>${row.warga?.no_rumah || '-'}</span>
      <small>${reason}</small>`;
    if(!isOwnPublicWarga(row.warga)) return `<div class="iwk-status-card ${cls} locked-card" aria-disabled="true">${content}</div>`;
    return `<button class="iwk-status-card ${cls}" type="button" onclick="showIwkStatusDetail('${row.warga?._id || ''}')">${content}</button>`;
  }).join('');
}
function renderKartuIuranTable(rows = []){
  const body = rows.map(row => {
    const emptyPeriod = !row.iwk && !row.dana_santunan && Number(row.donasi || 0) <= 0;
    if(emptyPeriod) {
      return `<tr><td>${esc(row.label || '-')}</td><td></td><td></td><td></td></tr>`;
    }
    const iwkStatus = String(row.iwk || 'Belum Bayar').toLowerCase().replace(/\s+/g, '_');
    const santunanStatus = String(row.dana_santunan || 'Belum Bayar').toLowerCase().replace(/\s+/g, '_');
    return `<tr>
      <td>${esc(row.label || '-')}</td>
      <td><span class="badge outline ${statusClass(iwkStatus)}">${esc(row.iwk || '-')}</span></td>
      <td><span class="badge outline ${row.dana_santunan === 'Bayar' ? 'green' : 'red'}">${esc(row.dana_santunan || '-')}</span></td>
      <td>${rupiah(row.donasi || 0)}</td>
    </tr>`;
  }).join('');
  return `
    <div class="report-table-wrap">
      <table class="report-table compact-table">
        <thead><tr><th>Bulan</th><th>IWK</th><th>Dana Santunan</th><th>Donasi</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

async function showIwkStatusDetail(wargaId){
  const row = iwkYearData.find(x => String(x.warga?._id || '') === String(wargaId));
  const modal = document.getElementById('iwkStatusModal');
  if(!row || !modal) return;
  if(!isOwnPublicWarga(row.warga)) return;
  const current = row.current || {};
  const previous = row.previous || [];
  const detailRows = [current].concat(previous).filter(Boolean).map(item => {
    const cls = statusClass(item.status);
    return `<tr><td>${item.label || '-'}</td><td><span class="badge outline ${cls}">${labelStatus(item.status)}</span></td><td>${rupiah(item.nominal || 0)}</td></tr>`;
  }).join('');
  const canUploadBukti = iwkStatusOptions.tampil_bukti_transfer !== false && normStatus(current.status) === 'belum_bayar' && isOwnPublicWarga(row.warga);
  const uploadForm = canUploadBukti ? `
    <form id="formBuktiIwk" class="proof-upload-form" onsubmit="analisaBuktiIwk(event)">
      <input type="hidden" name="bulan" value="${current.bulan || ''}">
      <input type="hidden" name="tahun" value="${current.tahun || ''}">
      <label class="field-label">Upload Bukti Transfer
        <input class="input" type="file" name="foto_bukti" accept="image/*" required>
      </label>
      <p class="proof-info">Untuk sementara sistem hanya dapat menerima bukti transfer dari BRI dan BCA.</p>
      <button class="btn" type="submit">Analisa Bukti</button>
      <p id="buktiIwkMsg" class="sub"></p>
    </form>
    <div id="buktiIwkResult"></div>
  ` : '';
  let kartuIuran = '<div class="empty-state">Info kartu iuran belum bisa dimuat.</div>';
  try {
    const info = await api(`/api/public/kartu-iuran?tahun=${current.tahun || new Date().getFullYear()}`);
    kartuIuran = renderKartuIuranTable(info.rows || []);
  } catch(e) {}
  modal.innerHTML = `
    <div class="iwk-modal-backdrop" onclick="closeIwkStatusDetail()"></div>
    <div class="iwk-modal-card">
      <div class="modal-head">
        <div><h3>${row.warga?.nama || '-'}</h3><p>${row.warga?.no_rumah || '-'} · ${row.warga?.area || '-'}</p></div>
        <button type="button" class="mini-btn" onclick="closeIwkStatusDetail()">Tutup</button>
      </div>
      <div class="report-table-wrap">
        <table class="report-table compact-table">
          <thead><tr><th>Periode</th><th>Status</th><th>Nominal</th></tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
      ${uploadForm}
      ${kartuIuran}
    </div>`;
  modal.classList.remove('hide');
}
let pendingBuktiIwkFormData = null;
let pendingBuktiIwkChecksOk = false;
function buktiCheckRow(ok, text){
  return `<li class="${ok ? 'ok' : 'bad'}"><span class="proof-check-mark">${ok ? '✓' : '!'}</span><span>${esc(text)}</span></li>`;
}
async function analisaBuktiIwk(event){
  event.preventDefault();
  const form = event.target;
  const msg = document.getElementById('buktiIwkMsg');
  const resultEl = document.getElementById('buktiIwkResult');
  const formData = new FormData(form);
  formData.set('mode', 'analisa');
  if(msg) msg.textContent = 'Menganalisa bukti...';
  if(resultEl) resultEl.innerHTML = '';
  pendingBuktiIwkChecksOk = false;
  try{
    const result = await fetch('/api/public/bukti-iwk', { method:'POST', body: formData }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
    const data = result.data || {};
    if(data.validasi_bank_pengirim !== true) {
      pendingBuktiIwkFormData = null;
      pendingBuktiIwkChecksOk = false;
      if(msg) msg.textContent = 'Bukti transfer tidak memenuhi syarat. Bank pengirim harus BRI/BCA.';
      return;
    }
    pendingBuktiIwkFormData = new FormData(form);
    const bankCheckOk = data.validasi_bank_pengirim !== false;
    pendingBuktiIwkChecksOk = data.cek_text_berhasil === true && data.cek_rekening_sesuai === true && data.cek_periode_sesuai === true && data.cek_no_rumah_sesuai === true && bankCheckOk;
    if(msg) msg.textContent = result.message || 'Analisa bukti selesai.';
    if(resultEl) resultEl.innerHTML = `
      <div class="proof-result-card">
        <h4>Hasil Analisa Bukti</h4>
        <div><span>Status</span><strong>${esc(data.status_analisa || '-')}</strong></div>
        <div><span>Status Transaksi</span><strong>${esc(data.status_transaksi || '-')}</strong></div>
        <div><span>Bank Pengirim</span><strong>${esc(data.bank_pengirim || '-')}</strong></div>
        <div><span>No Rek Tujuan</span><strong>${esc(data.no_rekening_tujuan || '-')}</strong></div>
        <div><span>No Rek Setting</span><strong>${esc(data.rekening_tujuan_setting || '-')}</strong></div>
        <div><span>Nominal Transfer</span><strong>${rupiah(data.nominal_transfer || 0)}</strong></div>
        <div><span>Tanggal Transfer</span><strong>${esc(data.tanggal_transfer || '-')}</strong></div>
        <div><span>Catatan Transfer</span><strong>${esc(data.catatan_transfer || '-')}</strong></div>
        <ul class="proof-check-list">
          ${buktiCheckRow(data.cek_text_berhasil === true, 'Ada teks berhasil / sukses')}
          ${buktiCheckRow(data.cek_rekening_sesuai === true, 'No rekening tujuan sesuai setting')}
          ${buktiCheckRow(data.cek_periode_sesuai === true, 'Bulan dan tahun transfer sesuai periode IWK')}
          ${buktiCheckRow(data.cek_no_rumah_sesuai === true, data.validasi_catatan_transfer === false ? 'Validasi catatan transfer dinonaktifkan admin' : 'Catatan transfer memuat no rumah login')}
          ${typeof data.validasi_bank_pengirim === 'boolean' ? buktiCheckRow(data.validasi_bank_pengirim === true, 'Bank pengirim didukung sementara: BRI/BCA') : ''}
        </ul>
        <p>${esc(data.catatan || data.error_analisa || 'Bukti tersimpan untuk verifikasi.')}</p>
        <label class="check-pill proof-confirm-check">
          <input id="buktiIwkConfirm" type="checkbox" onchange="toggleKirimBuktiIwk()" ${pendingBuktiIwkChecksOk ? '' : 'disabled'}> Data hasil analisa sudah sesuai/benar
        </label>
        ${pendingBuktiIwkChecksOk ? '' : `<p class="proof-warning">${data.validasi_bank_pengirim === false ? 'Bank pengirim bukan BRI/BCA, proses tidak bisa dilanjutkan.' : (data.validasi_catatan_transfer !== false && data.cek_no_rumah_sesuai !== true) ? 'Catatan transfer belum memuat nomor rumah login.' : 'Bukti belum bisa dikirim karena hasil cek otomatis belum lengkap/sesuai.'}</p>`}
        <button id="btnKirimBuktiIwk" class="btn" type="button" onclick="kirimBuktiIwk()" disabled>Kirim Bukti Bayar</button>
      </div>
    `;
  }catch(err){
    if(msg) msg.textContent = err.message;
  }
}
function toggleKirimBuktiIwk(){
  const checked = document.getElementById('buktiIwkConfirm')?.checked === true;
  const btn = document.getElementById('btnKirimBuktiIwk');
  if(btn) btn.disabled = !checked || !pendingBuktiIwkChecksOk;
}
async function kirimBuktiIwk(){
  const msg = document.getElementById('buktiIwkMsg');
  if(!pendingBuktiIwkFormData) {
    if(msg) msg.textContent = 'Analisa bukti terlebih dahulu.';
    return;
  }
  if(document.getElementById('buktiIwkConfirm')?.checked !== true) {
    if(msg) msg.textContent = 'Centang konfirmasi data sudah sesuai/benar terlebih dahulu.';
    return;
  }
  if(!pendingBuktiIwkChecksOk) {
    if(msg) msg.textContent = 'Hasil cek otomatis belum lengkap/sesuai.';
    return;
  }
  pendingBuktiIwkFormData.set('konfirmasi', 'true');
  if(msg) msg.textContent = 'Mengirim bukti bayar...';
  try{
    const result = await fetch('/api/public/bukti-iwk', { method:'POST', body: pendingBuktiIwkFormData }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
    if(msg) msg.textContent = result.message || 'Bukti bayar berhasil dikirim.';
    document.getElementById('btnKirimBuktiIwk')?.setAttribute('disabled', 'disabled');
    pendingBuktiIwkFormData = null;
    document.getElementById('formBuktiIwk')?.reset();
    if(typeof loadIwkYear === 'function') await loadIwkYear();
  }catch(err){
    if(msg) msg.textContent = err.message;
  }
}
function closeIwkStatusDetail(){
  const modal = document.getElementById('iwkStatusModal');
  if(modal) modal.classList.add('hide');
}

async function initIwkLegacySetting(){
  const toggle = document.getElementById('settingTunggakanIwkLama');
  const riwayatToggle = document.getElementById('settingRiwayatIwkInput');
  const fotoToggle = document.getElementById('settingFotoIwkInput');
  const catatanTransferToggle = document.getElementById('settingValidasiCatatanTransfer');
  const statusSelect = document.getElementById('settingStatusIwkUmum');
  const msg = document.getElementById('settingTunggakanIwkLamaMsg');
  const riwayatMsg = document.getElementById('settingRiwayatIwkInputMsg');
  const fotoMsg = document.getElementById('settingFotoIwkInputMsg');
  const catatanTransferMsg = document.getElementById('settingValidasiCatatanTransferMsg');
  const statusMsg = document.getElementById('settingStatusIwkUmumMsg');
  if(!toggle && !riwayatToggle && !fotoToggle && !catatanTransferToggle && !statusSelect) return;
  const p = await api('/api/parameter-iwk');
  if(toggle){
    toggle.checked = !!p.tampil_tunggakan_iwk_lama;
    toggle.addEventListener('change', async () => {
      const data = await api('/api/parameter-iwk/tunggakan-iwk-lama', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tampil_tunggakan_iwk_lama: toggle.checked })
      });
      if(msg) msg.textContent = data.message || 'Setting tersimpan';
    });
  }
  if(riwayatToggle){
    riwayatToggle.checked = p.tampil_riwayat_iwk_input !== false;
    riwayatToggle.addEventListener('change', async () => {
      const data = await api('/api/parameter-iwk/riwayat-iwk-input', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tampil_riwayat_iwk_input: riwayatToggle.checked })
      });
      if(riwayatMsg) riwayatMsg.textContent = data.message || 'Setting tersimpan';
    });
  }
  if(fotoToggle){
    fotoToggle.checked = p.tampil_foto_iwk_input !== false;
    fotoToggle.addEventListener('change', async () => {
      const data = await api('/api/parameter-iwk/foto-iwk-input', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ tampil_foto_iwk_input: fotoToggle.checked })
      });
      if(fotoMsg) fotoMsg.textContent = data.message || 'Setting tersimpan';
      await initFotoInputVisibility();
    });
  }
  if(catatanTransferToggle){
    catatanTransferToggle.checked = p.validasi_catatan_transfer !== false;
    catatanTransferToggle.addEventListener('change', async () => {
      const data = await api('/api/parameter-iwk/validasi-catatan-transfer', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ validasi_catatan_transfer: catatanTransferToggle.checked })
      });
      if(catatanTransferMsg) catatanTransferMsg.textContent = data.message || 'Setting tersimpan';
    });
  }
  if(statusSelect){
    statusSelect.value = p.public_iwk_status_filter || 'belum_bayar';
    statusSelect.addEventListener('change', async () => {
      const data = await api('/api/parameter-iwk/status-iwk-umum', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ public_iwk_status_filter: statusSelect.value })
      });
      if(statusMsg) statusMsg.textContent = data.message || 'Setting tersimpan';
    });
  }
}

async function initTunggakanIwkForm(){
  const form = document.getElementById('formTunggakanIwk');
  const checklist = document.getElementById('tunggakanLegacyChecklist');
  if(!form || !checklist) return;
  await loadWarga('tunggakanWarga');
  const res = await api('/api/iuran-wajib/tunggakan-lama');
  const periods = res.periods || [];
  checklist.innerHTML = periods.map(p => {
    const key = `${p.tahun}-${String(p.bulan).padStart(2,'0')}`;
    return `<label class="month-check legacy-check"><input type="checkbox" name="periode" value="${key}"> <span>${p.bulan}</span><small>${esc(p.label)}</small></label>`;
  }).join('');
  const refreshChecked = async () => {
    const wargaId = document.getElementById('tunggakanWarga')?.value;
    if(!wargaId) return;
    const data = await api(`/api/iuran-wajib/tunggakan-lama?warga=${wargaId}`);
    const active = new Set((data.data || []).filter(x => x.aktif).map(x => `${x.tahun}-${String(x.bulan).padStart(2,'0')}`));
    checklist.querySelectorAll('input').forEach(input => {
      input.checked = active.has(input.value);
      input.closest('.month-check')?.classList.toggle('active', input.checked);
    });
  };
  checklist.querySelectorAll('input').forEach(input => input.addEventListener('change', () => input.closest('.month-check')?.classList.toggle('active', input.checked)));
  document.querySelector('[data-custom-warga="tunggakanWarga"] .custom-warga-options')?.addEventListener('click', () => setTimeout(refreshChecked, 50));
  await refreshChecked();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('tunggakanLegacyMsg');
    const result = await fetch('/api/iuran-wajib/tunggakan-lama', { method: 'POST', body: new FormData(form) }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
    if(msg) msg.textContent = result.message || 'Tunggakan tersimpan';
  });
}

// v1.3.0 Laporan Keuangan PDF/PNG
async function loadLaporanKeuangan(){
  const card = document.getElementById('laporanKeuanganCard');
  if(!card) return;
  const periode = document.getElementById('reportPeriode')?.value || '1';
  const showBelum = document.getElementById('showBelumBayar')?.checked ? 'true' : 'false';
  const autoIuranRw = document.getElementById('autoIuranRw')?.checked ? 'true' : 'false';
  const autoAmbulan = document.getElementById('autoAmbulan')?.checked ? 'true' : 'false';
  const d = new Date();
  const data = await api(`/api/laporan-keuangan/data?periode=${periode}&bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}&showBelumBayar=${showBelum}&autoIuranRw=${autoIuranRw}&autoAmbulan=${autoAmbulan}`);
  document.getElementById('reportPeriodText').textContent = data.meta?.periodeLabel || '-';
  document.getElementById('reportGeneratedAt').textContent = data.meta?.generatedAt || new Date().toLocaleString('id-ID');
  document.getElementById('reportTotalSaldo').textContent = rupiah(data.totalSaldo || 0);
  document.getElementById('reportTotalDebet').textContent = rupiah(data.totalDebet || 0);
  document.getElementById('reportTotalKredit').textContent = rupiah(data.totalKredit || 0);
  document.getElementById('reportTotalTransaksi').textContent = Number(data.transaksi?.length || 0).toLocaleString('id-ID');
  const rwEl = document.getElementById('reportIuranRwGabungan');
  if (rwEl) rwEl.textContent = rupiah(data.iuranRwGabungan || 0);
  document.getElementById('reportTransaksiNote').textContent = `Menampilkan transaksi periode ${data.meta?.periodeLabel || ''}.`;

  const saldoGrid = document.getElementById('reportSaldoGrid');
  saldoGrid.innerHTML = Object.entries(data.saldo || {}).map(([k,v]) => `
    <div class="report-saldo-card"><span>${nice(k)}</span><strong>${rupiah(v)}</strong></div>
  `).join('');

  const rows = document.getElementById('reportTransaksiRows');
  const tx = data.transaksi || [];
  rows.innerHTML = tx.length ? tx.map(x => `
    <tr>
      <td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td>
      <td>${nice(x.jenis_kas)}</td>
      <td>${x.keterangan || '-'}</td>
      <td>${rupiah(x.debet)}</td>
      <td>${rupiah(x.kredit)}</td>
    </tr>
  `).join('') : `<tr><td colspan="5" class="empty-cell">Belum ada transaksi pada periode ini.</td></tr>`;

  const belumSection = document.getElementById('reportBelumBayarSection');
  const belumRows = document.getElementById('reportBelumBayarRows');
  if(showBelum === 'true'){
    belumSection.classList.remove('hide');
    const belum = data.belumBayar || [];
    belumRows.innerHTML = belum.length ? belum.map((w,i)=>`<tr><td>${i+1}</td><td>${w.nama}</td><td>${w.no_rumah}</td><td>${w.area || '-'}</td></tr>`).join('') : `<tr><td colspan="4" class="empty-cell">Semua warga sudah ada catatan pembayaran bulan ini.</td></tr>`;
  }else{
    belumSection.classList.add('hide');
    belumRows.innerHTML = '';
  }
}

function laporanQueryString(){
  const periode = document.getElementById('reportPeriode')?.value || '1';
  const showBelum = document.getElementById('showBelumBayar')?.checked ? 'true' : 'false';
  const autoIuranRw = document.getElementById('autoIuranRw')?.checked ? 'true' : 'false';
  const autoAmbulan = document.getElementById('autoAmbulan')?.checked ? 'true' : 'false';
  const d = new Date();
  return `periode=${periode}&bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}&showBelumBayar=${showBelum}&autoIuranRw=${autoIuranRw}&autoAmbulan=${autoAmbulan}`;
}
async function generateIuranRwBulanan(){
  const autoIuranRw = document.getElementById('autoIuranRw')?.checked ? 'true' : 'false';
  const autoAmbulan = document.getElementById('autoAmbulan')?.checked ? 'true' : 'false';
  if(autoIuranRw !== 'true' && autoAmbulan !== 'true') {
    alert('Centang Kredit Iuran RW atau Kredit Ambulan terlebih dahulu.');
    return;
  }
  if(!confirm('Buat/perbarui transaksi pengeluaran Kas RT sesuai kredit otomatis yang dicentang?')) return;
  const d = new Date();
  const data = await api(`/api/laporan-keuangan/generate-iuran-rw?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}&autoIuranRw=${autoIuranRw}&autoAmbulan=${autoAmbulan}`, {method:'POST'});
  alert(`Otomatisasi laporan bulanan diperbarui.\nIuran RW: ${data.iuranRw ? rupiah(data.iuranRw.total || 0) : 'Nonaktif'}\nAmbulan: ${data.ambulan ? rupiah(data.ambulan.total || 0) : 'Nonaktif'}\nPeriode: ${data.iuranRw?.periodeText || data.ambulan?.periodeText || '-'}`);
  await loadLaporanKeuangan();
}
function downloadLaporanPdf(){
  location.href = `/api/laporan-keuangan/pdf?${laporanQueryString()}`;
}
async function downloadLaporanPng(){
  const target = document.getElementById('laporanKeuanganCard');
  if(!target) return;
  if(typeof html2canvas === 'undefined'){
    alert('Library PNG belum termuat. Pastikan koneksi internet aktif, lalu refresh halaman. Alternatif sementara gunakan PDF.');
    return;
  }
  const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const a = document.createElement('a');
  a.download = `laporan-keuangan-rt02-${new Date().toISOString().slice(0,10)}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
