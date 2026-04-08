const fastify = require('fastify')({ logger: true })
const { createHash } = require('crypto')

const logs = []
const authorizations = []

fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
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
    async function load() {
      const res = await fetch('/logs')
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
})
