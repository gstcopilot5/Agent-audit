const db = require('../services/db');
async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing x-api-key header' });
  try {
    const org = await db.getOrgByApiKey(key);
    if (!org) return res.status(401).json({ error: 'Invalid API key' });
    req.org = org;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Auth check failed' });
  }
}
module.exports = { requireApiKey };
