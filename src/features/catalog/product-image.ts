import { MAX_PRODUCT_IMAGE_LENGTH } from '../../domain/workbook';

export const photoTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];

export async function makeThumbnail(file: File) {
  const supported = file.type
    ? photoTypes.includes(file.type)
    : /\.(?:jpe?g|png|webp|avif|hei[cf])$/i.test(file.name);
  if (!supported) throw new Error('Choose a JPEG, PNG, WebP, AVIF, or HEIC photo.');
  if (file.size > 24 * 1024 * 1024) throw new Error('Choose a photo smaller than 24 MB.');

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error('This photo could not be opened. Try a JPEG, PNG, or WebP copy.');
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context || !image.naturalWidth || !image.naturalHeight) {
      throw new Error('This photo could not be prepared. Try another photo.');
    }
    for (const maxSide of [1024, 768, 480, 360, 260, 180]) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.68, 0.54]) {
        const thumbnail = canvas.toDataURL('image/jpeg', quality);
        if (thumbnail.length <= MAX_PRODUCT_IMAGE_LENGTH && thumbnail.startsWith('data:image/jpeg;base64,')) {
          return thumbnail;
        }
      }
    }
    throw new Error('This picture is still too large. Try a smaller photo.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
