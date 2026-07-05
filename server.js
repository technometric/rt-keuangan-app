require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const pkg = require('./package.json');

const app = express();
const PORT = process.env.PORT || 3035;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://192.168.1.9:27017/rt_keuangan_app';
const APP_VERSION = process.env.APP_VERSION || pkg.version || '1.0.0';

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'rt-keuangan-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use((req, res, next) => {
  res.locals.appVersion = APP_VERSION;
  res.locals.assetVersion = APP_VERSION;
  if (req.accepts('html')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// Route halaman admin dibuat eksplisit agar tidak pernah ketabrak halaman umum/root.
// Penting: blok ini harus berada SEBELUM app.use('/', pageRoutes).
app.get(['/admin', '/admin/'], (req, res) => {
  delete req.session.user;
  return res.render('login', { next: '/admin/dashboard', loginMode: 'admin' });
});

app.get(['/admin/login', '/admin/login/'], (req, res) => {
  delete req.session.user;
  return res.render('login', { next: '/admin/dashboard', loginMode: 'admin' });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/', require('./routes/pageRoutes'));
app.use('/api/wajib-iwk', require('./routes/wajibIwkRoutes'));
app.use('/api/parameter-iwk', require('./routes/parameterRoutes'));
app.use('/api/iuran-wajib', require('./routes/iuranRoutes'));
app.use('/api/kas', require('./routes/kasRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/audit-trail', require('./routes/auditRoutes'));
app.use('/api/info', require('./routes/infoRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/laporan-keuangan', require('./routes/laporanKeuanganRoutes'));

app.listen(PORT, () => console.log(`SIKERT running on http://localhost:${PORT}`));
