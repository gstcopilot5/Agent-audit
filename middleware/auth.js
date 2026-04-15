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

// JWT expiry handler - add to any route using Supabase token
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token', code: 'AUTH_REQUIRED' });
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Session expired', code: 'TOKEN_EXPIRED' });
    req.user = user;
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Auth failed', code: 'TOKEN_EXPIRED' });
  }
}

module.exports = { requireApiKey, requireAuth };
