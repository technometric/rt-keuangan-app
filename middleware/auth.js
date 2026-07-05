function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: 'Belum login' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ message: 'Akses ditolak' });
    next();
  };
}

function pageRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) return res.redirect('/');
    next();
  };
}

function requirePublicWarga(req, res, next) {
  if (req.session.publicWarga) return next();
  return res.redirect('/umum/login');
}

module.exports = { requireLogin, requireRole, pageRole, requirePublicWarga };
