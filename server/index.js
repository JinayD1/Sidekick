import { createServer } from 'node:http'
import { API_ORIGIN, PORT } from './config.js'
import { sendJson } from './lib/http.js'
import { route } from './routes.js'

const server = createServer(async (req, res) => {
  try {
    await route(req, res)
  } catch (error) {
    console.error(error)
    sendJson(res, 500, {
      ok: false,
      error: error.message || 'Unexpected server error',
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sidekick API listening on ${API_ORIGIN}`)
})
