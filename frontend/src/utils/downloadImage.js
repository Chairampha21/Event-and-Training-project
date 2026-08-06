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

// Triggers one download per item, staggered slightly so the browser doesn't
// block a burst of simultaneous downloads. items: [{ url, filename }]
export async function downloadAllImages(items) {
  for (const item of items) {
    if (!item.url) continue;
    // eslint-disable-next-line no-await-in-loop
    await downloadDataUrl(item.url, item.filename);
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }
}
