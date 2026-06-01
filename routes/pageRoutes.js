const express = require('express');
const { pageRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', (req, res) => res.render('umum/dashboard', { user: req.session.user || null, publicMode: true }));
router.get('/login', (req, res) => res.render('login', { next: req.query.next || '' }));
router.get(['/admin', '/admin/'], (req, res) => {
  if (!req.session.user) return res.render('login', { next: '/admin/dashboard', loginMode: 'admin' });
  if (req.session.user.role !== 'admin') return res.redirect('/');
  return res.redirect('/admin/dashboard');
});

router.get(['/admin/login', '/admin/login/'], (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') return res.redirect('/admin/dashboard');
  return res.render('login', { next: '/admin/dashboard', loginMode: 'admin' });
});
router.get(['/petugas', '/petugas/'], (req, res) => {
  if (!req.session.user) return res.redirect('/login?next=/petugas/dashboard');
  if (req.session.user.role !== 'petugas') return res.redirect('/');
  return res.redirect('/petugas/dashboard');
});
router.get('/admin/dashboard', pageRole('admin'), (req, res) => res.render('admin/dashboard', { user: req.session.user }));
router.get('/admin/master', pageRole('admin'), (req, res) => res.render('admin/master', { user: req.session.user }));
router.get('/admin/iuran', pageRole('admin'), (req, res) => res.render('admin/iuran', { user: req.session.user }));
router.get('/admin/kas', pageRole('admin'), (req, res) => res.render('admin/kas', { user: req.session.user }));
router.get('/admin/users', pageRole('admin'), (req, res) => res.render('admin/users', { user: req.session.user }));
router.get('/admin/maintenance', pageRole('admin'), (req, res) => res.render('admin/maintenance', { user: req.session.user }));
router.get('/petugas/dashboard', pageRole('petugas'), (req, res) => res.render('petugas/dashboard', { user: req.session.user }));
router.get('/umum/dashboard', (req, res) => res.redirect('/'));
module.exports = router;
