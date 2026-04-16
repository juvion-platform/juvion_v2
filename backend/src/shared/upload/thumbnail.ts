import sharp from 'sharp';

/**
 * Generate a thumbnail from an image buffer.
 * Default: 150×150 center-cropped JPEG at quality 80.
 */
export async function generateThumbnail(
  buffer: Buffer,
  width = 150,
  height = 150,
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/**
 * Optimize the original photo: resize to max width, convert to JPEG.
 * Keeps aspect ratio. Default max width: 800px, quality 85.
 */
export async function optimizePhoto(
  buffer: Buffer,
  maxWidth = 800,
  quality = 85,
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, undefined, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}
