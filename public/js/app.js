const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const nice = s => String(s || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());
const isPublic = () => window.PUBLIC_DASHBOARD === true;
const apiBase = path => isPublic() ? `/api/public${path}` : path;

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
  if (rows) rows.innerHTML = data.map(w => `<tr><td>${w.nama}</td><td>${w.no_rumah}</td><td>${w.area}</td><td>${w.hp || '-'}</td></tr>`).join('');
}

async function loadIwk() {
  const data = await api('/api/iuran-wajib');
  const el = document.getElementById('riwayat');
  if (!el) return;
  el.innerHTML = data.map(x => `<tr><td>${new Date(x.tanggal).toLocaleDateString('id-ID')}</td><td>${x.warga?.nama || '-'}</td><td>${rupiah(x.nominal_bayar)}</td><td><span class="badge ${x.status === 'lunas' ? 'green' : x.status === 'kurang' ? 'orange' : 'red'}">${x.status}</span></td><td>${x.petugas?.nama || x.catatan_petugas || '-'}</td></tr>`).join('');
}

async function loadIwkBulanIni() {
  const d = new Date();
  const url = isPublic() ? `/api/public/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}` : `/api/iuran-wajib?bulan=${d.getMonth()+1}&tahun=${d.getFullYear()}`;
  const data = await api(url);
  const el = document.getElementById('iwkRows');
  if (!el) return;
  el.innerHTML = data.map(x => `<tr><td>${x.warga?.nama || '-'}</td><td>${x.warga?.no_rumah || '-'}</td><td>${x.warga?.area || '-'}</td><td>${rupiah(x.nominal_bayar)}</td><td><span class="badge ${x.status === 'lunas' ? 'green' : x.status === 'kurang' ? 'orange' : 'red'}">${x.status}</span></td></tr>`).join('');
}

function bindIwkForm() {
  const form = document.getElementById('formIwk');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('msg');
    try {
      await fetch('/api/iuran-wajib', { method: 'POST', body: new FormData(form) }).then(async r => { const d = await r.json(); if(!r.ok) throw new Error(d.message); return d; });
      form.reset(); msg.textContent = 'Pembayaran berhasil disimpan.'; await loadIwk();
    } catch (err) { msg.textContent = err.message; }
  });
}

async function initPetugasIwk() { await loadWarga(); bindIwkForm(); await loadIwk(); }

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

async function initMaster() {
  const p = await api('/api/parameter-iwk');
  for (const [k,v] of Object.entries(p)) if (formParam.elements[k]) formParam.elements[k].type === 'checkbox' ? formParam.elements[k].checked = !!v : formParam.elements[k].value = v;
  formParam.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    body.wajib_foto_cash = e.target.wajib_foto_cash.checked;
    await api('/api/parameter-iwk', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    alert('Parameter tersimpan');
  });
  formWarga.addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    await api('/api/wajib-iwk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    e.target.reset(); await loadWarga();
  });
  await loadWarga();
}

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
  const menu = document.getElementById('publicMenu');
  const btn = document.querySelector('.hamburger');
  if(menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hide');
});
