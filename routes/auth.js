const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, orgName } = req.body;
  if (!email || !password || !orgName)
    return res.status(400).json({ error: 'email, password, orgName required' });

  try {
    const { data: user, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (error) return res.status(400).json({ error: error.message });

    const rawKey = 'ak_' + crypto.randomBytes(20).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { data: org, error: orgErr } = await supabase
      .from('orgs')
      .insert({
        name: orgName,
        api_key: hashedKey,
        raw_key_preview: rawKey.slice(0, 12) + '...',
        plan: 'free',
        user_id: user.user.id
      })
      .select().single();

    if (orgErr) return res.status(500).json({ error: orgErr.message });

    res.json({ message: 'Account created', apiKey: rawKey, orgId: org.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password required' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: 'Invalid credentials' });

    const { data: org } = await supabase
      .from('orgs')
      .select('id, name, plan, raw_key_preview, created_at')
      .eq('user_id', data.user.id)
      .single();

    res.json({ token: data.session.access_token, user: data.user, org });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /auth/me (protected)
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data: org } = await supabase
      .from('orgs')
      .select('id, name, plan, raw_key_preview, created_at')
      .eq('user_id', user.id)
      .single();

    res.json({ user, org });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
