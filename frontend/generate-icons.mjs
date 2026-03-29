// Generates PNG icons for the PWA without external dependencies
import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

// CRC32 table
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  crcTable[n] = c
}
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf])
}

function makePNG(size) {
  // Brand red #bc0120 = 188, 1, 32
  // White letter "L" drawn manually on a grid
  const R = 188, G = 1, B = 32
  const WR = 255, WG = 255, WB = 255

  const pixels = new Uint8Array(size * size * 3)

  // Fill with brand red
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3]     = R
    pixels[i * 3 + 1] = G
    pixels[i * 3 + 2] = B
  }

  // Draw a simple white car shape (scaled to icon size)
  // Use a proportional grid: icon is divided into 10x10 logical units
  const u = size / 10
  function fillRect(lx, ly, lw, lh) {
    const x0 = Math.round(lx * u), y0 = Math.round(ly * u)
    const x1 = Math.round((lx + lw) * u), y1 = Math.round((ly + lh) * u)
    for (let y = y0; y < y1 && y < size; y++) {
      for (let x = x0; x < x1 && x < size; x++) {
        const i = (y * size + x) * 3
        pixels[i] = WR; pixels[i+1] = WG; pixels[i+2] = WB
      }
    }
  }

  // Car silhouette (centered, white)
  // Body
  fillRect(1, 5, 8, 2.5)
  // Roof / cabin
  fillRect(2.5, 3, 5, 2.2)
  // Wheels (dark circles approximated as rounded rectangles)
  // Left wheel
  fillRect(1.5, 7.2, 2, 1.8)
  // Right wheel
  fillRect(6.5, 7.2, 2, 1.8)
  // Window cutout (brand red back into cabin)
  const rR = R, rG = G, rB = B
  function fillRed(lx, ly, lw, lh) {
    const x0 = Math.round(lx * u), y0 = Math.round(ly * u)
    const x1 = Math.round((lx + lw) * u), y1 = Math.round((ly + lh) * u)
    for (let y = y0; y < y1 && y < size; y++) {
      for (let x = x0; x < x1 && x < size; x++) {
        const i = (y * size + x) * 3
        pixels[i] = rR; pixels[i+1] = rG; pixels[i+2] = rB
      }
    }
  }
  fillRed(3, 3.4, 1.8, 1.5)   // left window
  fillRed(5.2, 3.4, 1.8, 1.5) // right window
  // Wheel holes (red circles inside white wheels)
  fillRed(2, 7.5, 1, 1)
  fillRed(7, 7.5, 1, 1)

  // Build raw scanlines (filter byte 0 per row)
  const raw = Buffer.allocUnsafe(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3
      const dst = y * (1 + size * 3) + 1 + x * 3
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1]; raw[dst+2] = pixels[src+2]
    }
  }

  const sig = Buffer.from([137,80,78,71,13,10,26,10])

  const ihdrData = Buffer.allocUnsafe(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8   // bit depth
  ihdrData[9] = 2   // RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0

  const idatData = deflateSync(raw, { level: 6 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/pwa-192x192.png',    makePNG(192))
writeFileSync('public/pwa-512x512.png',    makePNG(512))
writeFileSync('public/apple-touch-icon.png', makePNG(180))

console.log('Icons generated: pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png')
