// Generate simple PWA icons as valid PNG files
const zlib = require('zlib');
const fs = require('fs');

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT - raw image data with filter byte 0 per scanline
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 3);
    rawData[offset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 3;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);

  // IEND
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  // CRC32
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([len, typeBuffer, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const publicDir = __dirname + '/public';

// Simple dark icon with accent stripe
function createQQIcon(size) {
  const png = createPNG(size, size, 0, 0, 0);

  // Overwrite with a simple design using raw approach
  // Draw a subtle gradient-like pattern
  const rawData = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const offset = y * (1 + size * 3);
    rawData[offset] = 0;
    for (let x = 0; x < size; x++) {
      const px = offset + 1 + x * 3;
      // Dark background with subtle cyan accent
      const distFromCenter = Math.sqrt(
        Math.pow((x - size/2) / (size/2), 2) +
        Math.pow((y - size/2) / (size/2), 2)
      );
      const accent = 1 - Math.min(distFromCenter * 2, 1);
      rawData[px] = Math.floor(10 + accent * 15);
      rawData[px + 1] = Math.floor(10 + accent * 20);
      rawData[px + 2] = Math.floor(20 + accent * 80);
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = createChunk('IHDR', createIHDRData(size, size));
  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDRData(w, h) {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(w, 0);
  d.writeUInt32BE(h, 4);
  d[8] = 8; d[9] = 2; d[10] = 0; d[11] = 0; d[12] = 0;
  return d;
}

fs.writeFileSync(publicDir + '/icon-192.png', createQQIcon(192));
fs.writeFileSync(publicDir + '/icon-512.png', createQQIcon(512));
console.log('Icons generated: icon-192.png, icon-512.png');
