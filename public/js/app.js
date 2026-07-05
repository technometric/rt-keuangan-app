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
  santunan_kematian: 'Santunan Kematian',
  danus: 'Danus'
};
const nice = s => kasLabels[s] || String(s || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const isPublic = () => window.PUBLIC_DASHBOARD === true;
const apiBase = path => isPublic() ? `/api/public${path}` : path;
const bulanNama = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
let iwkYear = new Date().getFullYear();
let iwkFilter = 'belum_bayar';
let iwkPeriodMode = String(new Date().getMonth() + 1);
let iwkYearData = [];
let lastTotalIwk = 0;

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
async function filterWargaBelumBayarBulanBerjalan(data, selectId){
  if(!isPaymentFormWarga(selectId)) return data;
  const now = new Date();
  const rows = await api(`/api/iuran-wajib?bulan=${now.getMonth()+1}&tahun=${now.getFullYear()}`);
  const paid = new Set(rows.filter(x => normStatus(x.status) === 'bayar').map(x => String(x.warga?._id || x.warga || '')));
  return data.filter(w => !paid.has(String(w._id)));
}

function labelStatus(s){
  if(s === 'lunas' || s === 'bayar') return 'Bayar';
  if(s === 'kurang') return 'Kurang';
  return 'Blm Bayar';
}
function normStatus(s){ return s === 'lunas' ? 'bayar' : (s || 'belum_bayar'); }
function statusClass(s){ s = normStatus(s); return s === 'bayar' ? 'green' : s === 'kurang' ? 'orange' : 'red'; }

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

async function loadSaldo() {
  let saldo = await api(apiBase('/api/kas/saldo').replace('/api/public/api/kas/saldo','/api/public/saldo'));
  const el = document.getElementById('saldoGrid');
  if (!el) return;

  const cardClass = isPublic() ? 'public-money-card' : 'card';
  el.innerHTML = Object.entries(saldo).map(([k,v]) => `<div class="${cardClass}"><h3>${nice(k)}</h3><div class="money">${rupiah(v)}</div></div>`).join('');
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

async function loadWarga(selectId = 'warga') {
  let data = await api('/api/wajib-iwk');
  data = await filterWargaBelumBayarBulanBerjalan(data, selectId);
  const el = document.getElementById(selectId);
  if (el && el.tagName === 'SELECT') el.innerHTML = data.map(w => `<option value="${w._id}">${esc(w.no_rumah)} - ${esc(w.nama)} (${esc(w.area)})</option>`).join('');
  if (el && el.tagName !== 'SELECT') renderCustomWargaSelect(data, selectId);
  const rows = document.getElementById('wargaRows');
  if (rows) rows.innerHTML = data.map((w,i) => `<tr><td>${i+1}</td><td>${esc(w.no_rumah)}</td><td>${esc(w.nama)}</td><td>${esc(w.area)}</td><td>${esc(w.hp || '-')}</td><td class="actions-cell"><button class="mini-btn" onclick='editWarga(${JSON.stringify(w)})'>Edit</button> <button class="mini-btn danger" onclick="deleteWarga('${w._id}')">Hapus</button></td></tr>`).join('');
}

function renderCustomWargaSelect(data, inputId = 'warga'){
  const hidden = document.getElementById(inputId);
  const wrap = document.querySelector(`[data-custom-warga="${inputId}"]`);
  if(!hidden || !wrap) return;
  let filtered = [...data];
  const setSelected = warga => {
    hidden.value = warga?._id || '';
    const search = wrap.querySelector('.custom-warga-search');
    if(search) search.value = warga ? `${warga.no_rumah} - ${warga.nama}` : '';
    wrap.classList.remove('open');
  };
  const renderOptions = rows => {
    const list = wrap.querySelector('.custom-warga-options');
    if(!list) return;
    list.innerHTML = rows.length ? rows.map(w => `
      <button type="button" class="custom-warga-option" data-id="${esc(w._id)}">
        <strong>${esc(w.nama)}</strong>
        <span>${esc(w.no_rumah)} · ${esc(w.area || '-')}</span>
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
  const bulan = document.getElementById('riwayatBulan')?.value || '';
  const tahun = document.getElementById('riwayatTahun')?.value || '';
  const qs = new URLSearchParams();
  if(bulan) qs.set('bulan', bulan);
  if(tahun) qs.set('tahun', tahun);
  let data = await api(`/api/iuran-wajib${qs.toString() ? '?' + qs.toString() : ''}`);
  const el = document.getElementById('riwayat');
  if (!el) return;
  const q = (document.getElementById('riwayatSearch')?.value || '').trim().toLowerCase();
  const nq = normalizeSearchText(q);
  if(q) {
    data = data.filter(x => {
      const raw = `${x.warga?.nama || ''} ${x.warga?.no_rumah || ''} ${x.petugas?.nama || ''} ${x.catatan_petugas || ''}`.toLowerCase();
      const normalized = normalizeSearchText(raw);
      return raw.includes(q) || normalized.includes(nq);
    });
  }
  const withDelete = el.dataset.actions === 'delete';
  const infoField = el.dataset.info === 'catatan' ? 'catatan' : 'petugas';
  el.innerHTML = data.length ? data.map(x => {
    const info = infoField === 'catatan' ? (x.catatan_petugas || '-') : (x.petugas?.nama || '-');
    return `<tr><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${esc(x.warga?.nama || '-')}<br><small>${esc(x.warga?.no_rumah || '-')}</small></td><td>${rupiah(x.nominal_bayar)}<br><small>${bulanNama[(x.bulan || 1)-1]} ${x.tahun || ''}</small></td><td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td><td>${esc(info)}</td>${withDelete ? `<td><button class="mini-btn danger" type="button" onclick="deleteIwkRiwayat('${x._id}')">Hapus</button></td>` : ''}</tr>`;
  }).join('') : `<tr><td colspan="${withDelete ? 6 : 5}" class="empty-cell">Riwayat tidak ditemukan.</td></tr>`;
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

async function loadIwkBulanIni() {
  const d = new Date();
  const url = isPublic() ? `/api/public/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}` : `/api/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}`;
  const data = await api(url);
  const el = document.getElementById('iwkRows');
  if (!el) return;
  el.innerHTML = data.map(x => `<tr><td>${x.warga?.nama || '-'}</td><td>${x.warga?.no_rumah || '-'}</td><td>${x.warga?.area || '-'}</td><td>${rupiah(x.nominal_bayar)}</td><td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td></tr>`).join('');
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
    }));
    updateNominalForCheckedMonths();
    return;
  }
  if(!bulan || !tahun) return;
  bulan.innerHTML = bulanNama.map((b,i)=>`<option value="${i+1}">${b}</option>`).join('');
  bulan.value = now.getMonth() + 1;
}

function checkedMonthCount(){
  const checklist = document.getElementById('bulanChecklist');
  if(!checklist) return Number(document.querySelector('[name="jumlah_bulan"]')?.value || 1);
  return Math.max(1, checklist.querySelectorAll('input:checked').length);
}

function updateNominalForCheckedMonths(){
  const nominal = document.getElementById('nominalBayar');
  if(nominal && lastTotalIwk > 0) {
    nominal.value = lastTotalIwk * checkedMonthCount();
    nominal.placeholder = `Nominal total bayar (${rupiah(lastTotalIwk)} x ${checkedMonthCount()} bulan)`;
  }
}

async function setDefaultNominalIwk(){
  const nominal = document.getElementById('nominalBayar');
  if(!nominal) return;
  try{
    const p = await api('/api/parameter-iwk');
    lastTotalIwk = Number(p.total_iwk || 0);
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
      const result = await fetch('/api/iuran-wajib', { method: 'POST', body: new FormData(form) }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
      form.reset(); setupBulanMulai(); await loadWarga(); await setDefaultNominalIwk(); msg.textContent = result.message || 'Pembayaran berhasil disimpan.'; await loadIwk(); await loadPetugasBulanIniTotal();
    } catch (err) { msg.textContent = err.message; }
  });
}

async function initPetugasIwk() { setupBulanMulai(); setupRiwayatFilters(); await setDefaultNominalIwk(); await loadWarga(); bindIwkForm(); await initRiwayatInputVisibility(); await initFotoInputVisibility(); await loadIwk(); await loadPetugasBulanIniTotal(); }

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
  if(rows) rows.innerHTML = data.rows?.length ? data.rows.map(x => `
    <tr>
      <td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td>
      <td>${esc(x.warga?.nama || '-')}</td>
      <td>${esc(x.warga?.no_rumah || '-')}</td>
      <td>${esc(x.petugas?.nama || '-')}</td>
      <td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td>
      <td>${rupiah(x.nominal_bayar || 0)}</td>
    </tr>
  `).join('') : `<tr><td colspan="6" class="empty-cell">Belum ada data pembayaran IWK pada periode ini.</td></tr>`;
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
  await loadKasRows();
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
  const keys = ['uang_satpam','uang_sampah','kas_pkk','kas_rt','kas_sosial','santunan_kematian'];
  const total = keys.reduce((t,k)=>t + Number(formParam.elements[k]?.value || 0),0);
  const totalEl = document.getElementById('paramTotalText');
  if(totalEl) totalEl.textContent = rupiah(total);
  const minEl = document.getElementById('paramMinimumText');
  if(minEl) minEl.textContent = rupiah(Number(formParam.elements.uang_satpam?.value || 0) + Number(formParam.elements.uang_sampah?.value || 0));
}

async function initMaster() {
  const p = await api('/api/parameter-iwk');
  for (const [k,v] of Object.entries(p)) if (formParam.elements[k]) formParam.elements[k].type === 'checkbox' ? formParam.elements[k].checked = !!v : formParam.elements[k].value = v;
  for (const [k,v] of Object.entries(p.public_kas_visible || {})) {
    const el = formParam.elements[`public_kas_${k}`];
    if(el) {
      const checkbox = Array.isArray(el) ? el.find?.(x => x.type === 'checkbox') : (el.length ? [...el].find(x => x.type === 'checkbox') : el);
      if(checkbox) checkbox.checked = v !== false;
    }
  }
  if(formParam.elements.kas_pkk && !formParam.elements.kas_pkk.value && p.kas_rw) formParam.elements.kas_pkk.value = p.kas_rw;
  syncParamTotal();
  ['uang_satpam','uang_sampah','kas_pkk','kas_rt','kas_sosial','santunan_kematian'].forEach(k=>formParam.elements[k]?.addEventListener('input', syncParamTotal));
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
    const body = Object.fromEntries(new FormData(e.target).entries());
    const id = body.warga_id;
    delete body.warga_id;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/wajib-iwk/${id}` : '/api/wajib-iwk';
    await api(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    resetWargaForm();
    await loadWarga();
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
    return `<tr><td>${new Date(p.createdAt).toLocaleDateString('id-ID')}</td><td>${rupiah(p.total_iwk)}</td><td>${rupiah(p.uang_satpam)}</td><td>${rupiah(p.uang_sampah)}</td><td>${rupiah(p.kas_pkk ?? p.kas_rw)}</td><td>${rupiah(p.kas_rt)}</td><td>${rupiah(p.kas_sosial)}</td><td>${rupiah(p.santunan_kematian)}</td><td>${p.jumlah_kk_iuran_rw || 75}</td><td>${p.tampil_tunggakan_umum ? 'Ya' : 'Tidak'}</td><td>${publicVisible}/6</td><td>${p.aktif ? '<span class="success-text">Aktif</span>' : `<button class="mini-btn" onclick="aktifkanParameter('${p._id}')">Aktifkan</button>`}</td></tr>`;
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
  document.querySelectorAll('.filter-pill').forEach(x=>x.classList.remove('active'));
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
  iwkFilter = res.public_iwk_status_filter || 'belum_bayar';
  if(text) text.textContent = res.periode || `${bulanNama[d.getMonth()]} ${d.getFullYear()}`;
  const note = document.getElementById('iwkStatusNote');
  if(note) note.textContent = res.tampil_tunggakan_lama ? 'Kartu merah bisa berarti belum bayar bulan berjalan atau masih ada tunggakan 12 bulan sebelumnya.' : 'Kartu mengikuti status pembayaran IWK bulan berjalan.';
  const filterWrap = document.getElementById('statusFilterWrap');
  if(filterWrap) filterWrap.classList.toggle('hide', iwkFilter === 'semua');
  document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.toggle('active', btn.dataset.status === iwkFilter));
  renderIwkYear();
}
function rowMatchesFilter(row){
  const current = normStatus(row.current?.status);
  const hasLama = row.has_tunggakan_lama === true;
  if(iwkFilter === 'semua') return true;
  if(iwkFilter === 'belum_bayar') return current === 'belum_bayar' || hasLama;
  if(iwkFilter === 'bayar') return current === 'bayar' && !hasLama;
  return current === iwkFilter;
}
function renderIwkYear(){
  const el = document.getElementById('iwkYearGrid');
  if(!el) return;
  const filtered = iwkYearData.filter(rowMatchesFilter);
  if(!filtered.length){ el.innerHTML = '<div class="empty-state">Data tidak ditemukan untuk filter ini.</div>'; return; }
  el.innerHTML = filtered.map(row => {
    const current = normStatus(row.current?.status);
    const cls = row.has_tunggakan_lama ? 'unpaid' : current === 'bayar' ? 'paid' : current === 'kurang' ? 'partial' : 'unpaid';
    const reason = row.has_tunggakan_lama ? 'Ada tunggakan lama' : labelStatus(current);
    return `<button class="iwk-status-card ${cls}" type="button" onclick="showIwkStatusDetail('${row.warga?._id || ''}')">
      <strong>${row.warga?.nama || '-'}</strong>
      <span>${row.warga?.no_rumah || '-'}</span>
      <small>${reason}</small>
    </button>`;
  }).join('');
}
function showIwkStatusDetail(wargaId){
  const row = iwkYearData.find(x => String(x.warga?._id || '') === String(wargaId));
  const modal = document.getElementById('iwkStatusModal');
  if(!row || !modal) return;
  const current = row.current || {};
  const previous = row.previous || [];
  const detailRows = [current].concat(previous).filter(Boolean).map(item => {
    const cls = statusClass(item.status);
    return `<tr><td>${item.label || '-'}</td><td><span class="badge outline ${cls}">${labelStatus(item.status)}</span></td><td>${rupiah(item.nominal || 0)}</td></tr>`;
  }).join('');
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
    </div>`;
  modal.classList.remove('hide');
}
function closeIwkStatusDetail(){
  const modal = document.getElementById('iwkStatusModal');
  if(modal) modal.classList.add('hide');
}

async function initIwkLegacySetting(){
  const toggle = document.getElementById('settingTunggakanIwkLama');
  const riwayatToggle = document.getElementById('settingRiwayatIwkInput');
  const fotoToggle = document.getElementById('settingFotoIwkInput');
  const statusSelect = document.getElementById('settingStatusIwkUmum');
  const msg = document.getElementById('settingTunggakanIwkLamaMsg');
  const riwayatMsg = document.getElementById('settingRiwayatIwkInputMsg');
  const fotoMsg = document.getElementById('settingFotoIwkInputMsg');
  const statusMsg = document.getElementById('settingStatusIwkUmumMsg');
  if(!toggle && !riwayatToggle && !fotoToggle && !statusSelect) return;
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
  const d = new Date();
  const data = await api(`/api/laporan-keuangan/data?periode=${periode}&bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}&showBelumBayar=${showBelum}`);
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
  const d = new Date();
  return `periode=${periode}&bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}&showBelumBayar=${showBelum}`;
}
async function generateIuranRwBulanan(){
  if(!confirm('Buat/perbarui transaksi pengeluaran Kas RT untuk iuran sampah+satpam ke RW dan ambulan bulan sebelumnya?')) return;
  const d = new Date();
  const data = await api(`/api/laporan-keuangan/generate-iuran-rw?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}`, {method:'POST'});
  alert(`Otomatisasi laporan bulanan diperbarui.\nIuran RW: ${rupiah(data.iuranRw?.total || 0)}\nAmbulan: ${rupiah(data.ambulan?.total || 0)}\nPeriode: ${data.iuranRw?.periodeText || data.ambulan?.periodeText || '-'}`);
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
