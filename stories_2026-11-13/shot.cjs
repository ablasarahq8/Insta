// يصوّر شرائح الستوري من stories.html
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + __dirname + '/stories.html');
  await p.waitForLoadState('networkidle');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  const fr = await p.$$('.frame');
  const names = ['story_02.png', 'story_04.png'];
  for (let i = 0; i < fr.length; i++) await fr[i].screenshot({ path: __dirname + '/' + names[i] });
  await b.close();
})();
