import 'dotenv/config'
import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 3001)
const clientUrl = process.env.CLIENT_URL ?? '*'

app.disable('x-powered-by')
app.use(cors({ origin: clientUrl === '*' ? true : clientUrl }))

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    phase: 'foundation',
    message: 'СОНАР пересобирается по концепции Пельгарии и Пельграда.',
    timestamp: new Date().toISOString(),
  })
})

app.all('/api/*', (_req, res) => {
  res.status(410).json({
    error: 'СОНАР пересобирается с чистого листа. Старые модули выведены из работы.',
    phase: 'foundation',
  })
})

app.listen(port, () => {
  console.log(`Pelgaria foundation server is listening on ${port}`)
})
