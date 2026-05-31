const express = require('express');
const AuditTrail = require('../models/AuditTrail');
const { requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireRole('admin'), async (req, res) => {
  const data = await AuditTrail.find().sort({ createdAt: -1 }).limit(120).lean();
  res.json(data);
});

module.exports = router;
