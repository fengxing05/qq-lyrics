const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = 3456;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Helper: decode base64 lyrics from QQ Music new API
function decodeBase64(str) {
  if (!str || !str.trim()) return '';
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch (e) {
    return str; // return as-is if not valid base64
  }
}

// QQ Music API proxy helpers
const QQ_API_BASE = 'https://c.y.qq.com';
const QQ_MUSIC_BASE = 'https://u.y.qq.com';

// Common headers for QQ Music API
const commonHeaders = {
  'Referer': 'https://y.qq.com/',
  'Origin': 'https://y.qq.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Search songs
app.get('/api/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });

    const url = `${QQ_API_BASE}/splcloud/fcgi-bin/smartbox_new.fcg`;
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

    // Parse response
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
});

// Get song detail (for album art URL)
app.get('/api/song/:mid', async (req, res) => {
  try {
    const { mid } = req.params;
    const url = `${QQ_API_BASE}/v8/fcg-bin/fcg_play_single_song.fcg`;
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
});

// Get lyrics (Chinese + translation) using QQ Music API
app.get('/api/lyrics/:mid', async (req, res) => {
  try {
    const { mid } = req.params;

    // Try the newer u.y.qq.com API first (more reliable from overseas)
    const url = `https://u.y.qq.com/cgi-bin/musicu.fcg`;
    const response = await axios.post(url, {
      comm: {
        cv: 4747474,
        ct: 24,
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        notice: 0,
        platform: 'yqq.json',
        needNewCode: 1,
        uin: 0,
        g_tk_new_20200403: 5381,
        g_tk: 5381
      },
      req_1: {
        module: 'music.musichallSong.SongLyricInter',
        method: 'GetPlayLyricInfo',
        param: {
          songMID: mid,
          lyricsType: 0,    // 0 = original + translation
          lyricsQrc: 1,
          isBuy: false,
          romAt: 0,
          qrc: 1,
          qrc_t: 0,
          isFormat: 1,
          ver: 0,
          ts: Date.now() / 1000
        }
      }
    }, {
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    let lyricText = '';
    let transText = '';

    // Parse the new API response format
    if (data && data.req_1 && data.req_1.data) {
      const lyricData = data.req_1.data;
      // New API returns base64-encoded lyrics
      lyricText = decodeBase64(lyricData.lyric || '');
      transText = decodeBase64(lyricData.trans || '');
    }

    // If new API returns empty, fallback to old API
    if (!lyricText && !transText) {
      const oldUrl = `${QQ_API_BASE}/lyric/fcgi-bin/fcg_query_lyric_new.fcg`;
      const oldResponse = await axios.get(oldUrl, {
        params: {
          songmid: mid,
          format: 'json',
          platform: 'yqq',
          g_tk: 5381,
          loginUin: 0,
          hostUin: 0,
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: 0,
          needNewCode: 0
        },
        headers: {
          ...commonHeaders,
          'Accept': 'application/json'
        }
      });

      const oldData = oldResponse.data;
      if (oldData && oldData.lyric) lyricText = oldData.lyric;
      if (oldData && oldData.trans) transText = oldData.trans;
    }

    res.json({
      lyric: lyricText || '',
      trans: transText || ''
    });
  } catch (error) {
    console.error('Lyrics error:', error.message);
    // Return empty rather than 500 so the UI can show "no lyrics" gracefully
    res.json({
      lyric: '',
      trans: '',
      error: error.message
    });
  }
});

// Get album art URL
app.get('/api/album-art/:albumMid', async (req, res) => {
  const { albumMid } = req.params;
  if (!albumMid) return res.status(400).json({ error: 'albumMid required' });
  
  // QQ Music album art format: https://y.gtimg.cn/music/photo_new/T002R300x300M000{albumMid}.jpg
  const url = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`;
  res.json({ url });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`QQ Lyrics server running at http://localhost:${PORT}`);
  console.log(`Open on phone: http://YOUR_COMPUTER_IP:${PORT}`);
});
