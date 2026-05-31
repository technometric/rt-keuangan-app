const express = require('express');
const { requireLogin, pageRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireLogin, (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') return res.redirect('/admin/dashboard');
  if (role === 'petugas') return res.redirect('/petugas/dashboard');
  return res.redirect('/umum/dashboard');
});
router.get('/login', (req, res) => res.render('login'));
router.get('/admin/dashboard', pageRole('admin'), (req, res) => res.render('admin/dashboard', { user: req.session.user }));
router.get('/admin/master', pageRole('admin'), (req, res) => res.render('admin/master', { user: req.session.user }));
router.get('/admin/iuran', pageRole('admin'), (req, res) => res.render('admin/iuran', { user: req.session.user }));
router.get('/admin/kas', pageRole('admin'), (req, res) => res.render('admin/kas', { user: req.session.user }));
router.get('/petugas/dashboard', pageRole('petugas'), (req, res) => res.render('petugas/dashboard', { user: req.session.user }));
router.get('/umum/dashboard', pageRole('umum','admin','petugas'), (req, res) => res.render('umum/dashboard', { user: req.session.user }));
module.exports = router;
