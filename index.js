const fastify = require('fastify')({ logger: true })

const logs = []

fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
})

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' }
})

fastify.post('/log', async (request, reply) => {
  const { agent_name, action, input, output } = request.body
  const entry = {
    agent_name,
    action,
    input,
    output,
    timestamp: new Date().toISOString()
  }
  logs.push(entry)
  return reply.status(201).send(entry)
})

fastify.listen({ port: Number(process.env.PORT), host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})
