const express = require('express');
const { pageRole, requirePublicWarga } = require('../middleware/auth');
const router = express.Router();

router.get('/', (req, res) => res.redirect('/umum/login'));
router.get('/login', (req, res) => {
  delete req.session.user;
  res.render('login', { next: req.query.next || '' });
});
router.get('/umum/login', (req, res) => {
  delete req.session.publicWarga;
  res.render('umum/login', { next: req.query.next || '/umum/dashboard' });
});
router.get(['/admin', '/admin/'], (req, res) => {
  delete req.session.user;
  return res.render('login', { next: '/admin/dashboard', loginMode: 'admin' });
});

router.get(['/admin/login', '/admin/login/'], (req, res) => {
  delete req.session.user;
  return res.render('login', { next: '/admin/dashboard', loginMode: 'admin' });
});
router.get(['/petugas', '/petugas/'], (req, res) => {
  delete req.session.user;
  return res.render('login', { next: '/petugas/dashboard', loginMode: 'petugas' });
});
router.get('/admin/dashboard', pageRole('admin'), (req, res) => res.render('admin/dashboard', { user: req.session.user }));
router.get('/admin/master', pageRole('admin'), (req, res) => res.render('admin/master', { user: req.session.user }));
router.get('/admin/iuran', pageRole('admin'), (req, res) => res.render('admin/iuran', { user: req.session.user }));
router.get('/admin/kas', pageRole('admin'), (req, res) => res.render('admin/kas', { user: req.session.user }));
router.get('/admin/users', pageRole('admin'), (req, res) => res.render('admin/users', { user: req.session.user }));
router.get('/admin/maintenance', pageRole('admin'), (req, res) => res.render('admin/maintenance', { user: req.session.user }));
router.get('/admin/laporan-keuangan', pageRole('admin'), (req, res) => res.render('admin/laporan-keuangan', { user: req.session.user }));
router.get('/petugas/dashboard', pageRole('petugas'), (req, res) => res.render('petugas/dashboard', { user: req.session.user }));
router.get('/umum/dashboard', requirePublicWarga, (req, res) => res.render('umum/dashboard', { user: req.session.user || null, publicWarga: req.session.publicWarga, publicMode: true }));
module.exports = router;
