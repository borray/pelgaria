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
    phase: 'sonar-alpha',
    message: 'СОНАР нового цикла разворачивается для Пельграда.',
    timestamp: new Date().toISOString(),
  })
})

app.all('/api/*', (_req, res) => {
  res.status(410).json({
    error: 'СОНАР пересобирается с чистого листа. Старые модули выведены из работы.',
    phase: 'sonar-alpha',
  })
})

app.listen(port, () => {
  console.log(`Pelgaria SONAR alpha server is listening on ${port}`)
})
