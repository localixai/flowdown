const express = require('express')
const { z } = require('zod')

const app = express()
app.use(express.json({ limit: '1mb' }))

const User = z.object({ name: z.string().min(1), email: z.string().email() })
const users = new Map()

app.post('/users', async (req, res) => {
  const parsed = User.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }
  const id = users.size + 1
  users.set(id, { id, ...parsed.data, createdAt: new Date().toISOString() })
  res.status(201).json(users.get(id))
})

app.get('/users/:id', (req, res) => {
  const user = users.get(Number(req.params.id))
  if (user === undefined) return res.sendStatus(404)
  res.json(user)
})

// Start the server unless this file is imported by a test.
if (require.main === module) {
  const port = process.env.PORT || 3000
  app.listen(port, () => console.log(`listening on http://localhost:${port}`))
}

module.exports = { app }
