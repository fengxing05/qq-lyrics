const axios = require('axios');

const commonHeaders = {
  'Referer': 'https://y.qq.com/',
  'Origin': 'https://y.qq.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

module.exports = async function handler(req, res) {
  try {
    const { mid } = req.query;
    if (!mid) return res.status(400).json({ error: 'mid required' });

    const url = 'https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg';
    const response = await axios.get(url, {
      params: {
        songmid: mid,
        format: 'json',
        platform: 'yqq'
      },
      headers: commonHeaders
    });
    res.json(response.data);
  } catch (error) {
    console.error('Song detail error:', error.message);
    res.status(500).json({ error: 'Failed to get song detail' });
  }
};
