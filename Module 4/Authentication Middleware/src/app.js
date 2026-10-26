require('dotenv').config();
const express = require('express');
const requireAuth = require('./middleware/requireAuth');
const { signToken } = require('./utils/jwt');

const app = express();
app.use(express.json());

// ─── Public routes ───────────────────────────────────────────────────────────
// POST /auth/login — signs a test token; no real credential check in this LU
app.post('/auth/login', (req, res) => {
  const sub = req.body.sub || 'user-1';
  const token = signToken({ sub });
  return res.status(200).json({ token });
});

// ─── Protected routes ─────────────────────────────────────────────────────────
// TODO: requireAuth is applied here but currently does nothing.
// Once you implement it, these routes will only respond to authenticated requests.

app.get('/profile', requireAuth, (req, res) => {
  return res.status(200).json({ userId: req.user.sub, message: 'Profile data' });
});

app.get('/posts/my', requireAuth, (req, res) => {
  return res.status(200).json({ userId: req.user.sub, posts: [] });
});

app.post('/posts', requireAuth, (req, res) => {
  return res.status(201).json({ userId: req.user.sub, message: 'Post created' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((error, req, res, next) => {
  console.error(error.message);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Auth middleware starter listening on ${port}`));
}

module.exports = app;
