const axios = require('axios');

const commonHeaders = {
  'Referer': 'https://y.qq.com/',
  'Origin': 'https://y.qq.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

module.exports = async function handler(req, res) {
  const { mid } = req.query;
  if (!mid) return res.status(400).json({ error: 'mid required' });

  try {
    const url = 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg';
    const response = await axios.get(url, {
      params: {
        songmid: mid, format: 'json', platform: 'yqq',
        g_tk: 5381, loginUin: 0, hostUin: 0,
        inCharset: 'utf-8', outCharset: 'utf-8',
        notice: 0, needNewCode: 0
      },
      headers: { ...commonHeaders, 'Accept': 'application/json' },
      timeout: 8000
    });

    const data = response.data;
    let lyricText = '';
    let transText = '';

    if (data && data.lyric) {
      const raw = data.lyric;
      // Detect base64 encoding
      if (/^[A-Za-z0-9+/=]+$/.test(raw.substring(0, Math.min(100, raw.length)))) {
        try {
          lyricText = Buffer.from(raw, 'base64').toString('utf-8');
        } catch (e) { lyricText = raw; }
      } else {
        lyricText = raw;
      }
    }

    if (data && data.trans && data.trans.trim()) {
      const rawTrans = data.trans;
      if (/^[A-Za-z0-9+/=]+$/.test(rawTrans.substring(0, Math.min(100, rawTrans.length)))) {
        try {
          transText = Buffer.from(rawTrans, 'base64').toString('utf-8');
        } catch (e) { transText = rawTrans; }
      } else {
        transText = rawTrans;
      }
    }

    // Set CDN cache for 1 hour to reduce function invocations
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.json({ lyric: lyricText, trans: transText });
  } catch (error) {
    res.json({ lyric: '', trans: '', error: error.message });
  }
};
