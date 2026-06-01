const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const nice = s => String(s || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const isPublic = () => window.PUBLIC_DASHBOARD === true;
const apiBase = path => isPublic() ? `/api/public${path}` : path;
const bulanNama = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
let iwkYear = new Date().getFullYear();
let iwkFilter = 'belum_bayar';
let iwkPeriodMode = String(new Date().getMonth() + 1);
let iwkYearData = [];

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

async function loadSaldo() {
  let saldo = await api(apiBase('/api/kas/saldo').replace('/api/public/api/kas/saldo','/api/public/saldo'));
  const el = document.getElementById('saldoGrid');
  if (!el) return;

  if (isPublic() && Array.isArray(window.PUBLIC_SALDO_KEYS)) {
    saldo = Object.fromEntries(window.PUBLIC_SALDO_KEYS.map(k => [k, saldo[k] || 0]));
  }

  const cardClass = isPublic() ? 'public-money-card' : 'card';
  el.innerHTML = Object.entries(saldo).map(([k,v]) => `<div class="${cardClass}"><h3>${nice(k)}</h3><div class="money">${rupiah(v)}</div></div>`).join('');
}

async function loadWarga(selectId = 'warga') {
  const data = await api('/api/wajib-iwk');
  const el = document.getElementById(selectId);
  if (el) el.innerHTML = data.map(w => `<option value="${w._id}">${w.no_rumah} - ${w.nama} (${w.area})</option>`).join('');
  const rows = document.getElementById('wargaRows');
  if (rows) rows.innerHTML = data.map((w,i) => `<tr><td>${i+1}</td><td>${w.no_rumah}</td><td>${w.nama}</td><td>${w.area}</td><td>${w.hp || '-'}</td></tr>`).join('');
}

async function loadIwk() {
  const m = document.getElementById('riwayatBulan')?.value || (new Date().getMonth()+1);
  const y = document.getElementById('riwayatTahun')?.value || new Date().getFullYear();
  const data = await api(`/api/iuran-wajib?bulan=${m}&tahun=${y}`);
  const el = document.getElementById('riwayat');
  if (!el) return;
  el.innerHTML = data.map(x => `<tr><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${x.warga?.nama || '-'}</td><td>${rupiah(x.nominal_bayar)}<br><small>${bulanNama[(x.bulan || 1)-1]} ${x.tahun || ''}</small></td><td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td><td>${x.catatan_petugas || '-'}</td><td><button class="mini-btn" onclick="editIwkRiwayat('${x._id}', ${Number(x.nominal_bayar || 0)}, decodeURIComponent('${encodeURIComponent(x.catatan_petugas || '-')}'))">Edit</button></td></tr>`).join('');
}

async function editIwkRiwayat(id, nominal, catatan){
  const nominalBaru = prompt('Nominal pembayaran:', nominal);
  if(nominalBaru === null) return;
  const catatanBaru = prompt('Catatan petugas:', catatan === '-' ? '' : catatan);
  if(catatanBaru === null) return;
  await api(`/api/iuran-wajib/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nominal_bayar: Number(nominalBaru || 0), catatan_petugas: catatanBaru }) });
  await loadIwk();
  alert('Riwayat berhasil diperbarui');
}

function printRiwayatPetugas(){
  const m = document.getElementById('riwayatBulan')?.value || (new Date().getMonth()+1);
  const y = document.getElementById('riwayatTahun')?.value || new Date().getFullYear();
  window.open(`/api/export/riwayat-iwk-petugas/pdf?bulan=${m}&tahun=${y}`, '_blank');
}

function setupRiwayatFilter(){
  const b = document.getElementById('riwayatBulan');
  const t = document.getElementById('riwayatTahun');
  if(!b || !t) return;
  const now = new Date();
  b.innerHTML = bulanNama.map((x,i)=>`<option value="${i+1}">${x}</option>`).join('');
  b.value = now.getMonth()+1;
  t.value = now.getFullYear();
  b.addEventListener('change', loadIwk);
  t.addEventListener('change', loadIwk);
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
  if(!bulan || !tahun) return;
  const now = new Date();
  bulan.innerHTML = bulanNama.map((b,i)=>`<option value="${i+1}">${b}</option>`).join('');
  bulan.value = now.getMonth() + 1;
  tahun.value = now.getFullYear();
}

async function setDefaultNominalIwk(){
  const nominal = document.getElementById('nominalBayar');
  if(!nominal) return;
  try{
    const p = await api('/api/parameter-iwk');
    nominal.value = Number(p.total_iwk || 0);
    nominal.placeholder = `Nominal total bayar (${rupiah(p.total_iwk || 0)})`;
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
      form.reset(); setupBulanMulai(); await setDefaultNominalIwk(); msg.textContent = result.message || 'Pembayaran berhasil disimpan.'; await loadIwk();
    } catch (err) { msg.textContent = err.message; }
  });
}

async function initPetugasIwk() { setupBulanMulai(); setupRiwayatFilter(); await setDefaultNominalIwk(); await loadWarga(); bindIwkForm(); await loadIwk(); }

async function initKas() {
  document.getElementById('formKas').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await api('/api/kas', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    e.target.reset(); await loadKasRows();
  });
  await loadKasRows();
}

async function loadKasRows() {
  const data = await api('/api/kas');
  kasRows.innerHTML = data.map(x => `<tr><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${nice(x.jenis_kas)}</td><td>${x.keterangan}</td><td>${rupiah(x.debet)}</td><td>${rupiah(x.kredit)}</td><td>${rupiah(x.saldo)}</td></tr>`).join('');
}

function syncParamTotal(){
  if(!window.formParam) return;
  const keys = ['uang_satpam','uang_sampah','kas_rw','kas_rt','kas_sosial','santunan_kematian'];
  const total = keys.reduce((t,k)=>t + Number(formParam.elements[k]?.value || 0),0);
  const totalEl = document.getElementById('paramTotalText');
  if(totalEl) totalEl.textContent = rupiah(total);
}

async function initMaster() {
  const p = await api('/api/parameter-iwk');
  for (const [k,v] of Object.entries(p)) if (formParam.elements[k]) formParam.elements[k].type === 'checkbox' ? formParam.elements[k].checked = !!v : formParam.elements[k].value = v;
  syncParamTotal();
  ['uang_satpam','uang_sampah','kas_rw','kas_rt','kas_sosial','santunan_kematian'].forEach(k=>formParam.elements[k]?.addEventListener('input', syncParamTotal));
  formParam.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.wajib_foto_cash = e.target.wajib_foto_cash.checked;
    await api('/api/parameter-iwk', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    alert('Parameter tersimpan'); await loadParameterList();
  });
  const btnNew = document.getElementById('btnParamBaru');
  if(btnNew) btnNew.addEventListener('click', async () => {
    const body = Object.fromEntries(new FormData(formParam).entries());
    body.wajib_foto_cash = formParam.wajib_foto_cash.checked;
    await api('/api/parameter-iwk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    alert('Parameter baru dibuat dan diaktifkan'); await loadParameterList();
  });
  formWarga.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await api('/api/wajib-iwk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    e.target.reset(); await loadWarga();
  });
  await loadWarga();
  await loadParameterList();
}

async function loadParameterList(){
  const rows = document.getElementById('parameterRows');
  if(!rows) return;
  const data = await api('/api/parameter-iwk/list');
  rows.innerHTML = data.map(p => `<tr><td>${new Date(p.createdAt).toLocaleDateString('id-ID')}</td><td>${rupiah(p.total_iwk)}</td><td>${rupiah(p.uang_satpam)}</td><td>${rupiah(p.uang_sampah)}</td><td>${rupiah(p.kas_rw)}</td><td>${rupiah(p.kas_rt)}</td><td>${rupiah(p.kas_sosial)}</td><td>${rupiah(p.santunan_kematian)}</td><td>${p.aktif ? '<span class="success-text">Aktif</span>' : `<button class="mini-btn" onclick="aktifkanParameter('${p._id}')">Aktifkan</button>`}</td></tr>`).join('');
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
  const sel = document.getElementById('iwkPeriodMode');
  if(sel) sel.value = String(new Date().getMonth() + 1);
  await loadIwkYear();
}
function setIwkPeriodMode(value){ iwkPeriodMode = value; renderIwkYear(); }
function setIwkFilter(status, btn){
  iwkFilter = status;
  document.querySelectorAll('.filter-pill').forEach(x=>x.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderIwkYear();
}
async function loadIwkYear(){
  const text = document.getElementById('iwkYearText');
  if(text) text.textContent = iwkYear;
  const res = await api(`/api/public/iuran-tahun?tahun=${iwkYear}`);
  iwkYearData = res.data || [];
  renderIwkYear();
}
function rowMatchesFilter(row){
  if(iwkFilter === 'semua') return true;
  if(iwkPeriodMode !== 'all') return normStatus(row.bulan?.[Number(iwkPeriodMode)]?.status) === iwkFilter;
  return Object.values(row.bulan || {}).some(x => normStatus(x.status) === iwkFilter);
}
function renderIwkYear(){
  const el = document.getElementById('iwkYearGrid');
  if(!el) return;
  const filtered = iwkYearData.filter(rowMatchesFilter);
  if(!filtered.length){ el.innerHTML = '<div class="empty-state">Data tidak ditemukan untuk filter ini.</div>'; return; }
  el.innerHTML = filtered.map(row => {
    const months = iwkPeriodMode === 'all' ? bulanNama.map((_,i)=>i+1) : [Number(iwkPeriodMode)];
    const cells = months.map(m=>{
      const item = row.bulan?.[m] || {status:'belum_bayar', nominal:0};
      const cls = normStatus(item.status) === 'bayar' ? 'paid' : normStatus(item.status) === 'kurang' ? 'partial' : 'unpaid';
      const title = `${bulanNama[m-1]}: ${labelStatus(item.status)} - ${rupiah(item.nominal || 0)}`;
      return `<span class="month-dot ${cls}" title="${title}"><b>${bulanNama[m-1]}</b><small>${labelStatus(item.status)}</small></span>`;
    }).join('');
    return `<div class="iwk-year-card"><div class="iwk-person"><strong>${row.no || ''}. ${row.warga?.nama || '-'}</strong><span>${row.warga?.no_rumah || '-'} · ${row.warga?.area || '-'}</span></div><div class="month-row ${iwkPeriodMode !== 'all' ? 'single-month' : ''}">${cells}</div></div>`;
  }).join('');
}
