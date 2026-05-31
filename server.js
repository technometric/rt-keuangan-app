require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3035;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://192.168.1.9:27017/rt_keuangan_app';

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'rt-keuangan-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/', require('./routes/pageRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/wajib-iwk', require('./routes/wajibIwkRoutes'));
app.use('/api/parameter-iwk', require('./routes/parameterRoutes'));
app.use('/api/iuran-wajib', require('./routes/iuranRoutes'));
app.use('/api/kas', require('./routes/kasRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/audit-trail', require('./routes/auditRoutes'));
app.use('/api/info', require('./routes/infoRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));

app.listen(PORT, () => console.log(`SIKERT running on http://localhost:${PORT}`));
