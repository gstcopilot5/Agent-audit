const fastify = require('fastify')({ logger: true })
const { createHash } = require('crypto')

const API_KEY = process.env.API_KEY || 'dev-key-change-me'

const logs = []
const authorizations = []

// Global API key guard — all routes except /dashboard
fastify.addHook('onRequest', async (request, reply) => {
  if (request.url === '/' || request.url === '/dashboard') return
  const key = request.headers['x-api-key']
  if (!key || key !== API_KEY) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing or invalid x-api-key header' })
  }
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
    .cta { display: inline-block; background: #1d4ed8; color: #fff; padding: 0.6rem 1.4rem; border-radius: 6px; font-weight: 600; font-size: 0.95rem; }
    .cta:hover { background: #2563eb; text-decoration: none; }

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
    <div class="badge">v0.0.0</div>
    <h1>Agent<span>Audit</span></h1>
    <p class="tagline">A lightweight API for auditing AI agent activity — authorization records, tamper-proof logs, and hash chain integrity verification.</p>
    <a class="cta" href="/dashboard">View Dashboard</a>
  </header>

  <section>
    <h2>Features</h2>
    <div class="features">
      <div class="feature"><strong>Authorization Control</strong><p>Register which agents are permitted to log activity and who approved them.</p></div>
      <div class="feature"><strong>Tamper-Proof Logs</strong><p>Every log entry is SHA-256 hashed and chained to the previous entry.</p></div>
      <div class="feature"><strong>Chain Verification</strong><p>Validate the entire log chain in one request to detect any tampering.</p></div>
      <div class="feature"><strong>JSON Export</strong><p>Download all logs and authorizations as a timestamped JSON file.</p></div>
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
      <div class="endpoint"><span class="method get">GET</span><span class="path">/dashboard</span><span class="desc">Browser UI for viewing logs</span></div>
    </div>
  </section>

  <section>
    <h2>Usage Examples</h2>
    <div class="examples">
      <div class="example">
        <h3># 1. Authorize an agent</h3>
        <pre><span class="k">curl</span> -X POST http://localhost:3000/authorize \
  -H <span class="s">"x-api-key: your-key"</span> \
  -H <span class="s">"Content-Type: application/json"</span> \
  -d <span class="s">'{"agent_name":"gpt-4","authorized_by":"alice","permissions":["read","write"]}'</span></pre>
      </div>
      <div class="example">
        <h3># 2. Log an agent action</h3>
        <pre><span class="k">curl</span> -X POST http://localhost:3000/log \
  -H <span class="s">"x-api-key: your-key"</span> \
  -H <span class="s">"Content-Type: application/json"</span> \
  -d <span class="s">'{"agent_name":"gpt-4","action":"summarize","input":"...","output":"..."}'</span></pre>
      </div>
      <div class="example">
        <h3># 3. Verify chain integrity</h3>
        <pre><span class="k">curl</span> -H <span class="s">"x-api-key: your-key"</span> http://localhost:3000/verify
<span class="c">{"status":"valid","entries":12}</span></pre>
      </div>
      <div class="example">
        <h3># 4. Get full agent history</h3>
        <pre><span class="k">curl</span> -H <span class="s">"x-api-key: your-key"</span> http://localhost:3000/agent/gpt-4</pre>
      </div>
    </div>
  </section>

  <footer>All API endpoints require an <code>x-api-key</code> header. Set your key via the <code>API_KEY</code> environment variable.</footer>
</body>
</html>`
})

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' }
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
    const API_KEY = '${API_KEY}'
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
  fastify.log.info(`API key: ${API_KEY}`)
})
