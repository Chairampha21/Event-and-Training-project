import { zip } from './xlsxExport';

// Downloads an already-loaded data: URL image as a file, without needing a
// server round-trip — matches how event/recap posters are stored (base64
// data URLs), same spirit as csvExport.js's dependency-free approach.
export async function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl) return;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// Downloads every item as one ZIP file — a burst of separate downloads gets
// blocked by browsers after the first file. items: [{ url, filename }], where
// a filename may carry a folder ("folder/name") to group files; each
// file gets the extension of what the image really is. Returns how many
// images went into the ZIP.
export async function downloadAllImages(items, zipName) {
  const used = new Set();
  const files = [];
  for (const item of items) {
    if (!item.url) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const blob = await (await fetch(item.url)).blob();
      const base = item.filename.replace(/\.(jpe?g|png|webp|gif)$/i, '');
      const ext = EXT[blob.type] || 'png';
      let name = `${base}.${ext}`;
      for (let n = 2; used.has(name); n += 1) name = `${base} (${n}).${ext}`;
      used.add(name);
      // eslint-disable-next-line no-await-in-loop
      files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
    } catch {
      // skip an image that cannot be read; the rest still download
    }
  }
  if (files.length === 0) return 0;
  const url = URL.createObjectURL(new Blob([zip(files)], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return files.length;
}
