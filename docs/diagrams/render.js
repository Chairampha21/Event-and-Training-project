// Renders a diagram page from src/ to a PNG at twice its size.
//   node render.js <name>          e.g. node render.js use-case-simple
// Needs Playwright (npm i playwright) and a Chromium it can launch; set
// CHROME_PATH to use a particular browser binary.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src');
const name = process.argv[2];
const server = http.createServer((req, res) => {
  const f = path.join(src, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(src) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'content-type': type });
  fs.createReadStream(f).pipe(res);
}).listen(0, async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 800 } });
  p.on('pageerror', (e) => console.log('page error:', e.message));
  await p.goto(`http://localhost:${server.address().port}/${name}.html`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  await p.evaluate(() => window.drawWires && window.drawWires());
  await p.locator('#canvas').screenshot({ path: path.join(__dirname, `${name}.png`) });
  console.log('wrote', `${name}.png`);
  await b.close();
  server.close();
});
