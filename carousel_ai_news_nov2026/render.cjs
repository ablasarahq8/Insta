// يحوّل كل شريحة لفيديو MP4 متحرك + صورة PNG للإطار الأخير
// الاستخدام: node render.js [preview] [أرقام الشرائح...]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const OUT = path.join(HERE, 'output');
const FPS = 30, SECONDS = 7;
const args = process.argv.slice(2);
const previewOnly = args[0] === 'preview';
const nums = args.filter(a => /^\d+$/.test(a)).map(Number);
const slides = nums.length ? nums : [1, 2, 3, 4, 5, 6, 7, 8];
fs.mkdirSync(OUT, { recursive: true });

async function open(browser, n, scale) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: scale });
  await page.goto(`file://${HERE}/slide${n}.html`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  return page;
}

(async () => {
  const browser = await chromium.launch();
  for (const n of slides) {
    const id = String(n).padStart(2, '0');
    // الصورة الثابتة (الإطار الأخير)
    const hi = await open(browser, n, previewOnly ? 1 : 2);
    await hi.evaluate(() => document.getAnimations().forEach(a => { a.currentTime = 6500; }));
    await (await hi.$('.slide')).screenshot({ path: path.join(OUT, `slide_${id}.png`) });
    await hi.close();
    if (previewOnly) { console.log('png', n); continue; }

    const page = await open(browser, n, 1);
    const el = await page.$('.slide');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart',
      path.join(OUT, `slide_${id}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < FPS * SECONDS; f++) {
      const t = f * 1000 / FPS;
      await page.evaluate(t => document.getAnimations().forEach(a => { a.currentTime = t; }), t);
      const buf = await el.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    await page.close();
    console.log('mp4', n);
  }
  await browser.close();
})();
