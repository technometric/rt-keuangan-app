const AuditTrail = require('../models/AuditTrail');

async function tulisAudit(req, aksi, modul, detail = '') {
  try {
    const u = req.session?.user;
    await AuditTrail.create({
      user: u?.id || null,
      nama: u?.nama || 'Sistem',
      role: u?.role || '-',
      aksi,
      modul,
      detail,
      ip: req.ip || req.headers['x-forwarded-for'] || ''
    });
  } catch (error) {
    console.error('Audit error:', error.message);
  }
}

module.exports = { tulisAudit };
