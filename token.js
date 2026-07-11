// api/token.js — Vercel Serverless Function
//
// ده الملف الوحيد اللي "يعرف" الـ API Key والـ Secret بتوع LiveKit،
// وهو شغال على السيرفر مش على المتصفح، فالسيرت مبيوصلش لأي حد بيفتح صفحتك.
//
// مهم جدًا: متحطش القيم دي هنا في الكود. حطها في:
// Vercel Dashboard → Project → Settings → Environment Variables
//   LIVEKIT_URL
//   LIVEKIT_API_KEY
//   LIVEKIT_API_SECRET

const { AccessToken } = require('livekit-server-sdk');

module.exports = async (req, res) => {
  // يسمح لصفحة الـ HTML تكلم الـ endpoint ده من أي دومين (عدّلها لو عايز تقفلها على دومينك بس)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { identity, room, name } = req.query || {};

  if (!identity || !room) {
    res.status(400).json({ error: 'identity و room مطلوبين' });
    return;
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    res.status(500).json({ error: 'السيرفر مش مظبوط لسه — لازم تضيف Environment Variables في Vercel' });
    return;
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      name: name ? String(name) : undefined,
      ttl: '10m', // التوكن صالح 10 دقايق بس، كفاية عشان يبدأ المكالمة
    });
    at.addGrant({ roomJoin: true, room: String(room) });

    const token = await at.toJwt();
    res.status(200).json({ token, url: livekitUrl });
  } catch (e) {
    res.status(500).json({ error: 'فشل توليد التوكن' });
  }
};
