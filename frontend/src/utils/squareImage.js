/**
 * Reads an image file and returns it as a square JPEG data: URL, `size` pixels
 * a side, cropped from the middle — small enough to keep as a profile picture
 * (a few tens of KB). Rejects files that aren't images.
 */
export function squareImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('ไฟล์ต้องเป็นรูปภาพ')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // a transparent PNG gets a white background, not black
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดรูปภาพไม่ได้')); };
    img.src = url;
  });
}
