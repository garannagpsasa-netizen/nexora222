import { kv } from '@vercel/kv';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" 
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, text } = req.body;
  if (!sessionId || !text) return res.status(400).json({ error: 'Bad request' });

  await kv.lpush(`msgs:${sessionId}`, JSON.stringify({ role: 'user', text, createdAt: new Date().toISOString() }));
  await kv.set(`conv:${sessionId}`, JSON.stringify({ lastMessageAt: new Date().toISOString(), lastMessagePreview: text }));

  const mode = await kv.get(`mode:${sessionId}`);
  if (mode === 'admin') return res.status(200).json({ ok: true, aiDisabled: true });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Ты — Олег, ИИ-консультант Nexora AI. Отвечай кратко и по делу.' },
        { role: 'user', content: text }
      ]
    });
    const reply = completion.choices[0].message.content;
    await kv.lpush(`msgs:${sessionId}`, JSON.stringify({ role: 'assistant', text: reply, createdAt: new Date().toISOString() }));
    res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Олег временно недоступен' });
  }
}