const express = require('express');
const pkg = require('../package.json');
const router = express.Router();

router.get('/version', (req, res) => {
  res.json({
    name: 'SIKERT',
    description: 'Sistem Keuangan RT',
    version: process.env.APP_VERSION || pkg.version || '1.0.0',
    build: process.env.APP_BUILD || 'starter-public',
    node_env: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;
