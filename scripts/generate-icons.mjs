// Rasterizes the Verbalis brand mark (public/icons/icon.svg) into the PNG /
// ICO assets the app and PWA manifest reference. Run with `pnpm generate-icons`.
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const ICONS_DIR = 'public/icons'
const PUBLIC_DIR = 'public'

await mkdir(ICONS_DIR, { recursive: true })

const standard = await readFile(`${ICONS_DIR}/icon.svg`)
const maskable = await readFile(`${ICONS_DIR}/icon-maskable.svg`)

// PWA + standard app icons (transparent rounded tile from icon.svg)
const standardTargets = [
  { size: 192, out: `${ICONS_DIR}/icon-192.png` },
  { size: 512, out: `${ICONS_DIR}/icon-512.png` },
  { size: 180, out: `${ICONS_DIR}/apple-touch-icon.png` },
  { size: 32, out: `${ICONS_DIR}/favicon-32.png` },
  { size: 16, out: `${ICONS_DIR}/favicon-16.png` },
]

for (const { size, out } of standardTargets) {
  await sharp(standard).resize(size, size).png().toFile(out)
  console.log(`Generated ${out} (${size}×${size})`)
}

// Maskable icons (full-bleed background, content in safe zone)
for (const size of [192, 512]) {
  const out = `${ICONS_DIR}/icon-maskable-${size}.png`
  await sharp(maskable).resize(size, size).png().toFile(out)
  console.log(`Generated ${out} (${size}×${size})`)
}

// favicon.ico — wrap PNGs (16/32/48) into a single ICO container.
// PNG-in-ICO is supported by all modern browsers, so we skip BMP encoding.
const icoSizes = [16, 32, 48]
const pngs = await Promise.all(
  icoSizes.map((size) => sharp(standard).resize(size, size).png().toBuffer()),
)
await writeFile(`${PUBLIC_DIR}/favicon.ico`, buildIco(icoSizes, pngs))
console.log(`Generated ${PUBLIC_DIR}/favicon.ico (${icoSizes.join('/')})`)

function buildIco(sizes, buffers) {
  const count = sizes.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(count, 4)

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  buffers.forEach((buf, i) => {
    const size = sizes[i]
    const base = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, base + 0) // width
    dir.writeUInt8(size >= 256 ? 0 : size, base + 1) // height
    dir.writeUInt8(0, base + 2) // palette
    dir.writeUInt8(0, base + 3) // reserved
    dir.writeUInt16LE(1, base + 4) // color planes
    dir.writeUInt16LE(32, base + 6) // bits per pixel
    dir.writeUInt32LE(buf.length, base + 8) // data size
    dir.writeUInt32LE(offset, base + 12) // data offset
    offset += buf.length
  })

  return Buffer.concat([header, dir, ...buffers])
}
