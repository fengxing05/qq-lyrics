module.exports = async function handler(req, res) {
  const { albumMid } = req.query;
  if (!albumMid) return res.status(400).json({ error: 'albumMid required' });

  const url = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`;
  res.json({ url });
};
