const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../middleware/auth');

// GET /org/me — return current org details
router.get('/me', requireApiKey, async (req, res) => {
  return res.json({
    org: {
      id: req.org.id,
      name: req.org.name,
      plan: req.org.plan || 'free',
      createdAt: req.org.created_at,
    }
  });
});

module.exports = router;
