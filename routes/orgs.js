const express = require('express');
const router = express.Router();
const db = require('../services/db');
const { requireApiKey } = require('../middleware/auth');
const { uid } = require('../utils/helpers');

// GET /org/me
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

// POST /org
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const orgId = uid('org_');
    const apiKey = uid('ak_');
    const org = await db.createOrg(orgId, name, apiKey);
    return res.status(201).json({
      message: 'Organization created',
      orgId: org.id,
      apiKey: org.api_key,
      warning: 'Store this API key securely.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create organization' });
  }
});

module.exports = router;
