const axios = require('axios');

const commonHeaders = {
  'Referer': 'https://y.qq.com/',
  'Origin': 'https://y.qq.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

module.exports = async function handler(req, res) {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });

    const url = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg';
    const response = await axios.get(url, {
      params: {
        key: keyword,
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        platform: 'yqq'
      },
      headers: commonHeaders
    });

    const data = response.data;
    const songs = [];

    if (data && data.data && data.data.song && data.data.song.itemlist) {
      data.data.song.itemlist.forEach(item => {
        songs.push({
          id: item.id,
          mid: item.mid,
          name: item.name,
          singer: item.singer,
          album: item.album || '',
          albumMid: item.albummid || '',
          interval: item.interval || 0
        });
      });
    }

    res.json({ songs });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', detail: error.message });
  }
};
