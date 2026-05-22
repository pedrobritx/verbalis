import { Jimp } from 'jimp'
import { mkdir } from 'fs/promises'

await mkdir('public/icons', { recursive: true })

for (const size of [192, 512]) {
  const img = new Jimp({ width: size, height: size, color: 0x00c2ccff })
  await img.write(`public/icons/icon-${size}.png`)
  console.log(`Generated public/icons/icon-${size}.png`)
}
