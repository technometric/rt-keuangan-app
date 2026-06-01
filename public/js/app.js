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
  const data = await api('/api/wajib-iwk');
  const el = document.getElementById(selectId);
  if (el) el.innerHTML = data.map(w => `<option value="${w._id}">${w.no_rumah} - ${w.nama} (${w.area})</option>`).join('');
  const rows = document.getElementById('wargaRows');
  if (rows) rows.innerHTML = data.map((w,i) => `<tr><td>${i+1}</td><td>${w.no_rumah}</td><td>${w.nama}</td><td>${w.area}</td><td>${w.hp || '-'}</td><td class="actions-cell"><button class="mini-btn" onclick='editWarga(${JSON.stringify(w)})'>Edit</button> <button class="mini-btn danger" onclick="deleteWarga('${w._id}')">Hapus</button></td></tr>`).join('');
}

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
  const data = await api('/api/iuran-wajib');
  const el = document.getElementById('riwayat');
  if (!el) return;
  el.innerHTML = data.map(x => `<tr><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${x.warga?.nama || '-'}</td><td>${rupiah(x.nominal_bayar)}<br><small>${bulanNama[(x.bulan || 1)-1]} ${x.tahun || ''}</small></td><td><span class="badge outline ${statusClass(x.status)}">${labelStatus(x.status)}</span></td><td>${x.petugas?.nama || x.catatan_petugas || '-'}</td></tr>`).join('');
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
      form.reset(); setupBulanMulai(); await setDefaultNominalIwk(); msg.textContent = result.message || 'Pembayaran berhasil disimpan.'; await loadIwk(); await loadPetugasBulanIniTotal();
    } catch (err) { msg.textContent = err.message; }
  });
}

async function initPetugasIwk() { setupBulanMulai(); await setDefaultNominalIwk(); await loadWarga(); bindIwkForm(); await loadIwk(); await loadPetugasBulanIniTotal(); }


async function loadPetugasBulanIniTotal(){
  const el = document.getElementById('petugasIwkTotalBulanIni');
  if(!el) return;
  const d = new Date();
  const data = await api(`/api/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}`);
  const total = data.reduce((sum,x)=>sum + Number(x.nominal_bayar || 0),0);
  const count = data.filter(x => Number(x.nominal_bayar || 0) > 0).length;
  el.innerHTML = `<div class="progress-title">Total Penagihan Bulan Ini</div><div class="progress-money">${rupiah(total)}</div><div class="progress-note">${count} pembayaran tercatat pada ${bulanNama[d.getMonth()]} ${d.getFullYear()}</div>`;
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
  if(form.tanggal && x.tanggal) form.tanggal.value = new Date(x.tanggal).toISOString().slice(0,10);
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
  iwkPeriodMode = String(new Date().getMonth() + 1);
  if(sel) sel.value = iwkPeriodMode;
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

// v1.2.9 Laporan Keuangan PDF/PNG
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
  document.getElementById('reportTransaksiNote').textContent = `Menampilkan transaksi periode ${data.meta?.periodeLabel || ''}`;

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
