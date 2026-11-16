import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'POST' && req.body.action === 'login') {
    if (req.body.password === process.env.ADMIN_PASSWORD) {
      res.setHeader('Set-Cookie', 'admin_session=valid; Path=/; HttpOnly');
      return res.status(200).json({ ok: true });
    }
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const cookie = req.headers.cookie || '';
  if (!cookie.includes('admin_session=valid')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET' && req.query.action === 'conversations') {
    const keys = await kv.keys('conv:*');
    const convs = [];
    for (const key of keys) {
      const data = await kv.get(key);
      convs.push({ sessionId: key.replace('conv:', ''), ...JSON.parse(data) });
    }
    return res.status(200).json(convs.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
  }

  if (req.method === 'GET' && req.query.action === 'messages') {
    const msgs = await kv.lrange(`msgs:${req.query.sessionId}`, 0, -1);
    return res.status(200).json(msgs.map(m => JSON.parse(m)));
  }

  if (req.method === 'POST' && req.body.action === 'send') {
    await kv.lpush(`msgs:${req.body.sessionId}`, JSON.stringify({ role: 'assistant', text: req.body.text, byAdmin: true, createdAt: new Date().toISOString() }));
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST' && req.body.action === 'setMode') {
    await kv.set(`mode:${req.body.sessionId}`, req.body.mode);
    return res.status(200).json({ ok: true });
  }

  res.status(404).json({ error: 'Not found' });
}