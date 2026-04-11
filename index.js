const fastify = require('fastify')({ logger: true })
const { createHash, randomBytes, createHmac } = require('crypto')
const Razorpay = require('razorpay')

const ADMIN_KEY = process.env.API_KEY || 'dev-key-change-me'

const razorpay = new Razorpay({
  key_id: (process.env.RAZORPAY_KEY_ID || '').trim(),
  key_secret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
})

const PLANS = {
  free:       { label: 'Free',       price: '$0/mo',   limit: 500,      amount_inr: 0 },
  pro:        { label: 'Pro',        price: '$29/mo',  limit: 10000,    amount_inr: 2400 * 100 },
  enterprise: { label: 'Enterprise', price: 'Custom',  limit: Infinity, amount_inr: null },
}

// apiKeys store: key -> { user, plan, created_at, usage_count, paid_order_id }
const apiKeys = new Map()

const logs = []
const authorizations = []

// Pending orders: razorpay_order_id -> { email, target_plan }
const pendingOrders = new Map()

// Helper: find the first API key record whose user matches an email
function findKeyByEmail(email) {
  for (const [key, record] of apiKeys) {
    if (record.user === email) return { key, record }
  }
  return null
}

// Helper: upgrade a key record to the target plan
function upgradeKey(key, record, targetPlan, orderId) {
  record.plan = targetPlan
  record.paid_order_id = orderId
  record.upgraded_at = new Date().toISOString()
  fastify.log.info({ key, email: record.user, plan: targetPlan, order_id: orderId }, 'Plan upgraded')
}

const PUBLIC_ROUTES = ['/', '/dashboard', '/apikey', '/plans', '/payment/create', '/payment/verify', '/payment/webhook', '/health']

// Global auth hook
fastify.addHook('onRequest', async (request, reply) => {
  const url = request.url.split('?')[0]
  if (PUBLIC_ROUTES.includes(url)) return

  const key = request.headers['x-api-key']
  if (!key) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing x-api-key header' })
  }

  // Admin key — full access, no usage tracking
  if (key === ADMIN_KEY) return

  // User-generated key
  const record = apiKeys.get(key)
  if (!record) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid API key' })
  }

  const plan = PLANS[record.plan]
  if (record.usage_count >= plan.limit) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: `${plan.label} plan limit of ${plan.limit} requests reached. Upgrade to continue.`,
      plan: record.plan,
      usage: record.usage_count,
      limit: plan.limit,
    })
  }

  record.usage_count++
  request.apiKeyRecord = record
})

fastify.get('/', async (request, reply) => {
  reply.type('text/html')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentAudit</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e8e8e8; line-height: 1.6; }
    a { color: #7dd3fc; text-decoration: none; }
    a:hover { text-decoration: underline; }

    header { padding: 3rem 2rem 2rem; max-width: 860px; margin: 0 auto; }
    .badge { display: inline-block; background: #1a3a2a; color: #4ade80; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 999px; border: 1px solid #166534; margin-bottom: 1.5rem; letter-spacing: 0.05em; text-transform: uppercase; }
    h1 { font-size: 2.6rem; font-weight: 700; letter-spacing: -0.03em; color: #fff; margin-bottom: 1rem; }
    h1 span { color: #7dd3fc; }
    .tagline { font-size: 1.1rem; color: #aaa; max-width: 540px; margin-bottom: 2rem; }
    .cta { display: inline-block; background: #1d4ed8; color: #fff; padding: 0.6rem 1.4rem; border-radius: 6px; font-weight: 600; font-size: 0.95rem; margin-right: 0.75rem; }
    .cta:hover { background: #2563eb; text-decoration: none; }
    .cta-outline { display: inline-block; border: 1px solid #333; color: #aaa; padding: 0.6rem 1.4rem; border-radius: 6px; font-weight: 600; font-size: 0.95rem; }
    .cta-outline:hover { border-color: #555; color: #fff; text-decoration: none; }

    section { max-width: 860px; margin: 0 auto; padding: 1.5rem 2rem; }
    h2 { font-size: 1rem; font-weight: 600; color: #7dd3fc; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1.25rem; }

    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
    .feature { background: #161616; border: 1px solid #222; border-radius: 8px; padding: 1.25rem; }
    .feature strong { display: block; color: #fff; margin-bottom: 0.35rem; font-size: 0.95rem; }
    .feature p { font-size: 0.88rem; color: #888; }

    .endpoints { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 3rem; }
    .endpoint { display: flex; align-items: baseline; gap: 0.75rem; background: #161616; border: 1px solid #222; border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.88rem; }
    .method { font-weight: 700; font-size: 0.78rem; min-width: 44px; text-align: center; padding: 0.15rem 0.4rem; border-radius: 4px; }
    .get  { background: #0c2a1a; color: #4ade80; border: 1px solid #166534; }
    .post { background: #1a1a00; color: #facc15; border: 1px solid #713f12; }
    .path { color: #e2e8f0; font-family: 'SF Mono', 'Fira Code', monospace; }
    .desc { color: #666; margin-left: auto; font-size: 0.82rem; }

    .examples { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 3rem; }
    .example h3 { font-size: 0.82rem; color: #666; margin-bottom: 0.5rem; font-family: monospace; }
    pre { background: #111; border: 1px solid #222; border-radius: 6px; padding: 1rem 1.25rem; overflow-x: auto; font-size: 0.82rem; font-family: 'SF Mono', 'Fira Code', monospace; color: #d4d4d4; line-height: 1.7; }
    .k { color: #7dd3fc; }
    .s { color: #a3e635; }
    .c { color: #555; }

    footer { max-width: 860px; margin: 0 auto; padding: 1.5rem 2rem 3rem; border-top: 1px solid #1a1a1a; font-size: 0.82rem; color: #444; }
  </style>
</head>
<body>
  <header>
    <div class="badge">v1.0.0</div>
    <h1>Agent<span>Audit</span></h1>
    <p class="tagline">A lightweight API for auditing AI agent activity — authorization records, tamper-proof logs, and hash chain integrity verification.</p>
    <a class="cta" href="/dashboard">View Dashboard</a>
    <a class="cta-outline" href="/plans">View Plans &amp; Pricing</a>
  </header>

  <section>
    <h2>Features</h2>
    <div class="features">
      <div class="feature"><strong>Authorization Control</strong><p>Register which agents are permitted to log activity and who approved them.</p></div>
      <div class="feature"><strong>Tamper-Proof Logs</strong><p>Every log entry is SHA-256 hashed and chained to the previous entry.</p></div>
      <div class="feature"><strong>Chain Verification</strong><p>Validate the entire log chain in one request to detect any tampering.</p></div>
      <div class="feature"><strong>JSON Export</strong><p>Download all logs and authorizations as a timestamped JSON file.</p></div>
      <div class="feature"><strong>API Key Management</strong><p>Create per-user API keys with plan-based rate limits.</p></div>
      <div class="feature"><strong>Plan Upgrades</strong><p>Upgrade to Pro via Razorpay — instant activation after payment.</p></div>
    </div>
  </section>

  <section>
    <h2>Endpoints</h2>
    <div class="endpoints">
      <div class="endpoint"><span class="method post">POST</span><span class="path">/authorize</span><span class="desc">Register an agent authorization</span></div>
      <div class="endpoint"><span class="method post">POST</span><span class="path">/log</span><span class="desc">Record an agent action (agent must be authorized)</span></div>
      <div class="endpoint"><span class="method get">GET</span><span class="path">/logs</span><span class="desc">Retrieve all log entries</span></div>
      <div class="endpoint"><span class="method get">GET</span><span class="path">/authorizations</span><span class="desc">Retrieve all authorization records</span></div>
      <div class="endpoint"><span class="method get">GET</span><span class="path">/agent/:name</span><span class="desc">Full history for a specific agent</span></div>
      <div class="endpoint"><span class="method get">GET</span><span class="path">/verify</span><span class="desc">Validate hash chain integrity</span></div>
      <div class="endpoint"><span class="method get">GET</span><span class="path">/export</span><span class="desc">Download all data as JSON</span></div>
      <div class="endpoint"><span class="method post">POST</span><span class="path">/payment/create</span><span class="desc">Create a Razorpay order to upgrade plan</span></div>
      <div class="endpoint"><span class="method post">POST</span><span class="path">/payment/webhook</span><span class="desc">Razorpay webhook — auto-upgrades plan on payment</span></div>
      <div class="endpoint"><span class="method get">GET</span><span class="path">/dashboard</span><span class="desc">Browser UI for viewing logs</span></div>
      <div class="endpoint"><span class="method get">GET</span><span class="path">/plans</span><span class="desc">View plans &amp; upgrade via Razorpay</span></div>
    </div>
  </section>

  <section>
    <h2>Usage Examples</h2>
    <div class="examples">
      <div class="example">
        <h3># 1. Authorize an agent</h3>
        <pre><span class="k">curl</span> -X POST /authorize \\
  -H <span class="s">"x-api-key: your-key"</span> \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"agent_name":"gpt-4","authorized_by":"alice","permissions":["read","write"]}'</span></pre>
      </div>
      <div class="example">
        <h3># 2. Log an agent action</h3>
        <pre><span class="k">curl</span> -X POST /log \\
  -H <span class="s">"x-api-key: your-key"</span> \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"agent_name":"gpt-4","action":"summarize","input":"...","output":"..."}'</span></pre>
      </div>
      <div class="example">
        <h3># 3. Verify chain integrity</h3>
        <pre><span class="k">curl</span> -H <span class="s">"x-api-key: your-key"</span> /verify
<span class="c">{"status":"valid","entries":12}</span></pre>
      </div>
      <div class="example">
        <h3># 4. Create payment order to upgrade to Pro</h3>
        <pre><span class="k">curl</span> -X POST /payment/create \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -d <span class="s">'{"api_key":"aa_...","plan":"pro"}'</span></pre>
      </div>
    </div>
  </section>

  <footer>All API endpoints require an <code>x-api-key</code> header. Set your admin key via the <code>API_KEY</code> environment variable.</footer>
</body>
</html>`
})

fastify.get('/health', async (request, reply) => {
  return { status: 'ok', razorpay_configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) }
})

fastify.get('/logs', async (request, reply) => {
  return logs
})

fastify.get('/dashboard', async (request, reply) => {
  reply.type('text/html')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Audit Dashboard</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; background: #f9f9f9; color: #222; }
    h1 { font-size: 1.4rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    th { background: #1a1a1a; color: #fff; text-align: left; padding: 0.75rem 1rem; font-size: 0.85rem; }
    td { padding: 0.7rem 1rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f5f5f5; }
    .empty { text-align: center; padding: 2rem; color: #888; }
  </style>
</head>
<body>
  <h1>Agent Audit Logs</h1>
  <table>
    <thead>
      <tr>
        <th>Agent Name</th>
        <th>Action</th>
        <th>Timestamp</th>
      </tr>
    </thead>
    <tbody id="tbody">
      <tr><td colspan="3" class="empty">Loading...</td></tr>
    </tbody>
  </table>
  <script>
    const API_KEY = '${ADMIN_KEY}'
    async function load() {
      const res = await fetch('/logs', { headers: { 'x-api-key': API_KEY } })
      const logs = await res.json()
      const tbody = document.getElementById('tbody')
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty">No logs yet.</td></tr>'
        return
      }
      tbody.innerHTML = logs.map(l => \`<tr>
        <td>\${l.agent_name ?? ''}</td>
        <td>\${l.action ?? ''}</td>
        <td>\${l.timestamp ?? ''}</td>
      </tr>\`).join('')
    }
    load()
    setInterval(load, 5000)
  </script>
</body>
</html>`
})

fastify.get('/plans', async (request, reply) => {
  reply.type('text/html')
  const rzpKeyId = process.env.RAZORPAY_KEY_ID || ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentAudit Plans</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e8e8e8; line-height: 1.6; }
    a { color: #7dd3fc; text-decoration: none; }
    header { padding: 3rem 2rem 2rem; max-width: 860px; margin: 0 auto; }
    h1 { font-size: 2rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
    h1 span { color: #7dd3fc; }
    .subtitle { color: #888; font-size: 1rem; margin-bottom: 2rem; }
    .plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; max-width: 860px; margin: 0 auto 3rem; padding: 0 2rem; }
    .plan { background: #161616; border: 1px solid #222; border-radius: 12px; padding: 2rem; position: relative; }
    .plan.featured { border-color: #1d4ed8; background: #0d1a35; }
    .plan-badge { position: absolute; top: -0.6rem; left: 50%; transform: translateX(-50%); background: #1d4ed8; color: #fff; font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.9rem; border-radius: 999px; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
    .plan-name { font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 0.35rem; }
    .plan-price { font-size: 2rem; font-weight: 800; color: #fff; margin-bottom: 0.15rem; }
    .plan-price span { font-size: 1rem; font-weight: 400; color: #888; }
    .plan-limit { font-size: 0.85rem; color: #888; margin-bottom: 1.5rem; }
    .plan-limit strong { color: #e2e8f0; }
    .plan-features { list-style: none; margin-bottom: 1.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .plan-features li { font-size: 0.88rem; color: #aaa; display: flex; gap: 0.5rem; }
    .plan-features li::before { content: '✓'; color: #4ade80; font-weight: 700; flex-shrink: 0; }
    .btn { display: block; text-align: center; padding: 0.65rem 1.25rem; border-radius: 7px; font-size: 0.95rem; font-weight: 600; cursor: pointer; border: none; width: 100%; }
    .btn-primary { background: #1d4ed8; color: #fff; }
    .btn-primary:hover { background: #2563eb; }
    .btn-outline { background: transparent; border: 1px solid #333; color: #aaa; }
    .btn-outline:hover { border-color: #555; color: #fff; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .upgrade-form { max-width: 480px; margin: 0 auto 3rem; padding: 0 2rem; }
    .upgrade-form h2 { font-size: 1rem; font-weight: 600; color: #7dd3fc; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1.25rem; }
    label { display: block; font-size: 0.85rem; color: #888; margin-bottom: 0.4rem; }
    input { width: 100%; background: #161616; border: 1px solid #333; border-radius: 6px; color: #e8e8e8; padding: 0.55rem 0.85rem; font-size: 0.95rem; margin-bottom: 1rem; }
    input:focus { outline: none; border-color: #1d4ed8; }
    .msg { margin-top: 1rem; font-size: 0.88rem; padding: 0.6rem 0.9rem; border-radius: 6px; display: none; }
    .msg.error { background: #2a0a0a; border: 1px solid #7f1d1d; color: #fca5a5; display: block; }
    .msg.success { background: #0a1f0a; border: 1px solid #166534; color: #86efac; display: block; }
    .key-reveal { display: none; margin-top: 1.25rem; background: #0d1a0d; border: 1px solid #166534; border-radius: 8px; padding: 1.1rem 1.25rem; }
    .key-reveal.show { display: block; }
    .key-reveal p { font-size: 0.82rem; color: #86efac; margin-bottom: 0.6rem; }
    .key-reveal strong { display: block; font-size: 0.82rem; color: #aaa; margin-bottom: 0.35rem; letter-spacing: 0.04em; text-transform: uppercase; }
    .key-code { display: flex; align-items: center; gap: 0.5rem; background: #0a120a; border: 1px solid #1a3a1a; border-radius: 5px; padding: 0.5rem 0.75rem; font-family: 'SF Mono','Fira Code',monospace; font-size: 0.82rem; color: #4ade80; word-break: break-all; }
    .copy-btn { flex-shrink: 0; background: #1a3a1a; border: none; color: #4ade80; padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
    .copy-btn:hover { background: #166534; }
    .continue-btn { margin-top: 1rem; display: block; width: 100%; text-align: center; padding: 0.65rem; background: #1d4ed8; color: #fff; border: none; border-radius: 7px; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
    .continue-btn:hover { background: #2563eb; }

    footer { max-width: 860px; margin: 0 auto; padding: 1.5rem 2rem 3rem; border-top: 1px solid #1a1a1a; font-size: 0.82rem; color: #444; }
  </style>
</head>
<body>
  <header>
    <div style="margin-bottom:1rem"><a href="/">&larr; Back to AgentAudit</a></div>
    <h1>Agent<span>Audit</span> Plans</h1>
    <p class="subtitle">Start free, upgrade when you need more.</p>
  </header>

  <div class="plans">
    <div class="plan">
      <div class="plan-name">Free</div>
      <div class="plan-price">$0 <span>/ mo</span></div>
      <div class="plan-limit"><strong>500 requests</strong> / month</div>
      <ul class="plan-features">
        <li>Hash-chained audit logs</li>
        <li>Chain integrity verification</li>
        <li>Agent authorization control</li>
        <li>JSON export</li>
      </ul>
      <button class="btn btn-outline" disabled>Current default</button>
    </div>
    <div class="plan featured">
      <div class="plan-badge">Most Popular</div>
      <div class="plan-name">Pro</div>
      <div class="plan-price">&#8377;2,400 <span>/ mo</span></div>
      <div class="plan-limit"><strong>10,000 requests</strong> / month</div>
      <ul class="plan-features">
        <li>Everything in Free</li>
        <li>10× higher request limit</li>
        <li>Priority support</li>
        <li>Instant activation via Razorpay</li>
      </ul>
      <button class="btn btn-primary" id="upgrade-pro-btn" onclick="startUpgrade('pro')">Upgrade to Pro</button>
    </div>
    <div class="plan">
      <div class="plan-name">Enterprise</div>
      <div class="plan-price" style="font-size:1.4rem;padding-top:0.35rem">Custom</div>
      <div class="plan-limit"><strong>Unlimited</strong> requests</div>
      <ul class="plan-features">
        <li>Everything in Pro</li>
        <li>Unlimited API calls</li>
        <li>Custom SLA</li>
        <li>Dedicated support</li>
      </ul>
      <a class="btn btn-outline" href="mailto:sales@agentaudit.io" style="display:block;text-align:center;padding:0.65rem">Contact Sales</a>
    </div>
  </div>

  <div class="upgrade-form">
    <h2>Upgrade Your Plan</h2>
    <label for="email-input">Your account email</label>
    <input id="email-input" type="email" placeholder="you@example.com" />
    <div class="msg" id="msg"></div>
    <div class="key-reveal" id="key-reveal">
      <p>&#127881; Account created! Your API key has been generated — <strong>copy it now, it won't be shown again.</strong></p>
      <strong>Your API Key</strong>
      <div class="key-code">
        <span id="key-value"></span>
        <button class="copy-btn" onclick="copyKey()">Copy</button>
      </div>
      <button class="continue-btn" id="continue-btn">Continue to Checkout &rarr;</button>
    </div>
  </div>

  <footer>&copy; 2026 AgentAudit &mdash; <a href="/">Home</a> &middot; <a href="/dashboard">Dashboard</a></footer>

  <script>
    const RZP_KEY = '${rzpKeyId}';

    function copyKey() {
      const val = document.getElementById('key-value').textContent;
      navigator.clipboard.writeText(val).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    }

    function buildRazorpayOptions(data, email, msg, upgradeBtn) {
      return {
        key: RZP_KEY,
        amount: data.amount,
        currency: data.currency,
        name: 'AgentAudit',
        description: 'Pro Plan — 10,000 requests/month',
        order_id: data.razorpay_order_id,
        handler: async function(response) {
          const verifyRes = await fetch('/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          document.getElementById('key-reveal').className = 'key-reveal';
          if (verifyRes.ok) {
            msg.className = 'msg success';
            msg.textContent = \`✓ Payment verified! \${email} has been upgraded to Pro (10,000 requests/month).\`;
            upgradeBtn.textContent = 'Upgraded!';
          } else {
            msg.className = 'msg error';
            msg.textContent = verifyData.message || 'Payment verification failed.';
            upgradeBtn.disabled = false;
            upgradeBtn.textContent = 'Upgrade to Pro';
          }
        },
        prefill: { email },
        theme: { color: '#1d4ed8' },
        modal: {
          ondismiss: function() {
            upgradeBtn.disabled = false;
            upgradeBtn.textContent = 'Upgrade to Pro';
          }
        }
      };
    }

    async function startUpgrade(plan) {
      const email = document.getElementById('email-input').value.trim();
      const msg = document.getElementById('msg');
      msg.className = 'msg';
      msg.textContent = '';
      document.getElementById('key-reveal').className = 'key-reveal';

      if (!email || !email.includes('@')) {
        msg.className = 'msg error';
        msg.textContent = 'Please enter the email address associated with your account.';
        document.getElementById('email-input').focus();
        return;
      }

      const upgradeBtn = document.getElementById('upgrade-pro-btn');
      upgradeBtn.disabled = true;
      upgradeBtn.textContent = 'Setting up...';

      try {
        const res = await fetch('/payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, plan }),
        });
        const data = await res.json();

        if (!res.ok) {
          msg.className = 'msg error';
          msg.textContent = data.message || 'Failed to create payment order.';
          upgradeBtn.disabled = false;
          upgradeBtn.textContent = 'Upgrade to Pro';
          return;
        }

        const rzpOptions = buildRazorpayOptions(data, email, msg, upgradeBtn);
        const rzp = new Razorpay(rzpOptions);

        if (data.auto_created && data.api_key) {
          // New user: show key first, open checkout on explicit click
          document.getElementById('key-value').textContent = data.api_key;
          document.getElementById('key-reveal').className = 'key-reveal show';
          upgradeBtn.disabled = false;
          upgradeBtn.textContent = 'Upgrade to Pro';

          document.getElementById('continue-btn').onclick = function() {
            document.getElementById('key-reveal').className = 'key-reveal';
            rzp.open();
          };
        } else {
          // Existing user: go straight to checkout
          rzp.open();
        }
      } catch(e) {
        msg.className = 'msg error';
        msg.textContent = 'Network error. Please try again.';
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = 'Upgrade to Pro';
      }
    }
  </script>
</body>
</html>`
})

fastify.post('/apikey', async (request, reply) => {
  const { user, plan = 'free' } = request.body ?? {}
  if (!user) {
    return reply.status(400).send({ error: 'Bad Request', message: '"user" is required' })
  }
  if (!PLANS[plan]) {
    return reply.status(400).send({ error: 'Bad Request', message: `Invalid plan. Choose: ${Object.keys(PLANS).join(', ')}` })
  }
  const key = 'aa_' + randomBytes(24).toString('hex')
  const record = { user, plan, created_at: new Date().toISOString(), usage_count: 0, paid_order_id: null }
  apiKeys.set(key, record)
  return reply.status(201).send({
    key,
    user,
    plan,
    limit: PLANS[plan].limit,
    price: PLANS[plan].price,
    created_at: record.created_at,
  })
})

// Admin-only: list all keys with usage stats
fastify.get('/apikeys', async (request, reply) => {
  const result = []
  for (const [key, record] of apiKeys) {
    const plan = PLANS[record.plan]
    result.push({
      key,
      user: record.user,
      plan: record.plan,
      price: plan.price,
      usage_count: record.usage_count,
      limit: plan.limit,
      usage_pct: plan.limit === Infinity ? null : Math.round((record.usage_count / plan.limit) * 100),
      created_at: record.created_at,
      paid_order_id: record.paid_order_id || null,
    })
  }
  return result
})

// Create a Razorpay order for plan upgrade (identified by user email)
fastify.post('/payment/create', async (request, reply) => {
  const { email, plan } = request.body ?? {}

  if (!email || !plan) {
    return reply.status(400).send({ error: 'Bad Request', message: '"email" and "plan" are required' })
  }

  let found = findKeyByEmail(email)
  let autoCreated = false
  if (!found) {
    const newKey = 'aa_' + randomBytes(24).toString('hex')
    const newRecord = { user: email, plan: 'free', created_at: new Date().toISOString(), usage_count: 0, paid_order_id: null }
    apiKeys.set(newKey, newRecord)
    found = { key: newKey, record: newRecord }
    autoCreated = true
    fastify.log.info({ email, key: newKey }, 'Auto-created API key for new user during upgrade')
  }
  const { key: api_key, record } = found

  const targetPlan = PLANS[plan]
  if (!targetPlan) {
    return reply.status(400).send({ error: 'Bad Request', message: `Invalid plan. Upgradeable plans: pro` })
  }

  if (!targetPlan.amount_inr) {
    return reply.status(400).send({ error: 'Bad Request', message: 'This plan cannot be purchased directly. Contact sales.' })
  }

  if (record.plan === plan) {
    return reply.status(400).send({ error: 'Bad Request', message: `"${email}" is already on the ${targetPlan.label} plan` })
  }

  try {
    const order = await razorpay.orders.create({
      amount: targetPlan.amount_inr,
      currency: 'INR',
      receipt: `upgrade_${email.split('@')[0].slice(0, 12)}_${Date.now()}`,
      notes: {
        email,
        target_plan: plan,
      },
    })

    pendingOrders.set(order.id, { email, target_plan: plan })

    return reply.status(201).send({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      plan_label: targetPlan.label,
      email,
      api_key: autoCreated ? api_key : undefined,
      auto_created: autoCreated,
    })
  } catch (err) {
    const rzpError = err?.error || err
    fastify.log.error({ razorpay_error: rzpError }, 'Razorpay order creation failed')
    const detail = rzpError?.description || rzpError?.message || 'Failed to create Razorpay order'
    return reply.status(502).send({ error: 'Bad Gateway', message: detail })
  }
})

// Client-side payment verification (called after Razorpay checkout success)
fastify.post('/payment/verify', async (request, reply) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body ?? {}

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Missing payment fields' })
  }

  const expectedSig = createHmac('sha256', (process.env.RAZORPAY_KEY_SECRET || '').trim())
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSig !== razorpay_signature) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Invalid payment signature' })
  }

  const pending = pendingOrders.get(razorpay_order_id)
  if (!pending) {
    return reply.status(404).send({ error: 'Not Found', message: 'Order not found or already processed' })
  }

  const found = findKeyByEmail(pending.email)
  if (!found) {
    return reply.status(404).send({ error: 'Not Found', message: `No API key found for email "${pending.email}"` })
  }
  const { key, record } = found

  upgradeKey(key, record, pending.target_plan, razorpay_order_id)
  pendingOrders.delete(razorpay_order_id)

  return {
    success: true,
    message: `Plan upgraded to ${PLANS[pending.target_plan].label}`,
    email: pending.email,
    api_key: key,
    plan: pending.target_plan,
    new_limit: PLANS[pending.target_plan].limit,
  }
})

// Razorpay webhook (server-side verification fallback)
fastify.post('/payment/webhook', {
  config: { rawBody: true }
}, async (request, reply) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (webhookSecret) {
    const signature = request.headers['x-razorpay-signature']
    const body = request.rawBody || JSON.stringify(request.body)
    const expectedSig = createHmac('sha256', webhookSecret).update(body).digest('hex')
    if (signature !== expectedSig) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid webhook signature' })
    }
  }

  const event = request.body
  if (event?.event === 'payment.captured') {
    const entity = event?.payload?.payment?.entity ?? {}
    const notes = entity.notes ?? {}
    const { email, target_plan } = notes
    const orderId = entity.order_id || null

    if (email && target_plan && PLANS[target_plan]) {
      const found = findKeyByEmail(email)
      if (found && found.record.plan !== target_plan) {
        upgradeKey(found.key, found.record, target_plan, orderId)
        fastify.log.info({ email, plan: target_plan, order_id: orderId }, 'Webhook: plan upgraded via payment.captured')
      } else if (!found) {
        fastify.log.warn({ email }, 'Webhook: no API key found for email')
      }
    }
  }

  return reply.status(200).send({ status: 'ok' })
})

fastify.get('/agent/:name', async (request, reply) => {
  const { name } = request.params
  const agentAuthorizations = authorizations.filter(a => a.agent_name === name)
  const agentLogs = logs.filter(l => l.agent_name === name)
  if (agentAuthorizations.length === 0 && agentLogs.length === 0) {
    return reply.status(404).send({ error: 'Not Found', message: `No records found for agent "${name}"` })
  }
  return { agent_name: name, authorizations: agentAuthorizations, logs: agentLogs }
})

fastify.post('/authorize', async (request, reply) => {
  const { agent_name, authorized_by, permissions } = request.body
  const entry = {
    agent_name,
    authorized_by,
    permissions,
    timestamp: new Date().toISOString()
  }
  authorizations.push(entry)
  return reply.status(201).send(entry)
})

fastify.get('/authorizations', async (request, reply) => {
  return authorizations
})

fastify.get('/export', async (request, reply) => {
  const filename = `agentaudit-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const data = JSON.stringify({ exported_at: new Date().toISOString(), authorizations, logs }, null, 2)
  reply
    .header('Content-Type', 'application/json')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
  return data
})

fastify.get('/verify', async (request, reply) => {
  if (logs.length === 0) {
    return { status: 'valid', message: 'No logs to verify', entries: 0 }
  }
  for (let i = 0; i < logs.length; i++) {
    const { agent_name, action, input, output, timestamp, prev_hash, hash } = logs[i]
    const expectedPrevHash = i === 0 ? '0'.repeat(64) : logs[i - 1].hash
    if (prev_hash !== expectedPrevHash) {
      return reply.status(200).send({ status: 'compromised', at_index: i, reason: 'prev_hash mismatch' })
    }
    const payload = JSON.stringify({ agent_name, action, input, output, timestamp, prev_hash })
    const expectedHash = createHash('sha256').update(payload).digest('hex')
    if (hash !== expectedHash) {
      return reply.status(200).send({ status: 'compromised', at_index: i, reason: 'hash mismatch' })
    }
  }
  return { status: 'valid', entries: logs.length }
})

fastify.post('/log', async (request, reply) => {
  const { agent_name, action, input, output } = request.body
  const authorized = authorizations.some(a => a.agent_name === agent_name)
  if (!authorized) {
    return reply.status(403).send({ error: 'Forbidden', message: `Agent "${agent_name}" is not authorized` })
  }
  const timestamp = new Date().toISOString()
  const prev_hash = logs.length > 0 ? logs[logs.length - 1].hash : '0'.repeat(64)
  const payload = JSON.stringify({ agent_name, action, input, output, timestamp, prev_hash })
  const hash = createHash('sha256').update(payload).digest('hex')
  const entry = { agent_name, action, input, output, timestamp, prev_hash, hash }
  logs.push(entry)
  return reply.status(201).send(entry)
})

fastify.listen({ port: Number(process.env.PORT), host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  fastify.log.info(`Admin key: ${ADMIN_KEY}`)
  fastify.log.info(`Razorpay configured: ${!!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)}`)
})
