export interface ScanFilterOptions {
  contrast?:       number
  brightness?:     number
  sharpen?:        boolean
  threshold?:      boolean
  thresholdValue?: number
}

export async function applyScanFilter(dataUrl: string, options: ScanFilterOptions = {}): Promise<string> {
  const {
    contrast:       contrastLevel   = 1.8,
    brightness:     brightnessLevel = 1.15,
    sharpen:        doSharpen       = true,
    threshold:      useThreshold    = false,
    thresholdValue                  = 180,
  } = options

  const img    = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  const ctx    = canvas.getContext('2d')!
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels    = imageData.data

  // Graustufen
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray
  }
  // Helligkeit
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i]     = Math.min(255, pixels[i]     * brightnessLevel)
    pixels[i + 1] = Math.min(255, pixels[i + 1] * brightnessLevel)
    pixels[i + 2] = Math.min(255, pixels[i + 2] * brightnessLevel)
  }
  // Kontrast
  const factor = (259 * (contrastLevel * 100 + 255)) / (255 * (259 - contrastLevel * 100))
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i]     = clamp(factor * (pixels[i]     - 128) + 128)
    pixels[i + 1] = clamp(factor * (pixels[i + 1] - 128) + 128)
    pixels[i + 2] = clamp(factor * (pixels[i + 2] - 128) + 128)
  }
  // Threshold
  if (useThreshold) {
    for (let i = 0; i < pixels.length; i += 4) {
      const val = pixels[i] > thresholdValue ? 255 : 0
      pixels[i] = pixels[i + 1] = pixels[i + 2] = val
    }
  }
  ctx.putImageData(imageData, 0, 0)

  if (doSharpen) sharpenCanvas(ctx, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', 0.92)
}

function sharpenCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height)
  const src = new Uint8ClampedArray(imageData.data)
  const dst = imageData.data
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const val =
          kernel[0] * src[((y-1)*width+(x-1))*4+c] +
          kernel[1] * src[((y-1)*width+ x  )*4+c] +
          kernel[2] * src[((y-1)*width+(x+1))*4+c] +
          kernel[3] * src[( y   *width+(x-1))*4+c] +
          kernel[4] * src[( y   *width+ x   )*4+c] +
          kernel[5] * src[( y   *width+(x+1))*4+c] +
          kernel[6] * src[((y+1)*width+(x-1))*4+c] +
          kernel[7] * src[((y+1)*width+ x   )*4+c] +
          kernel[8] * src[((y+1)*width+(x+1))*4+c]
        dst[idx + c] = clamp(val)
      }
      dst[idx + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img   = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src     = dataUrl
  })
}
