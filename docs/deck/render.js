const { chromium } = require("playwright");
const [src, pdf, pngDir] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("file://" + src, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ["Oswald", "Archivo", "JetBrains Mono"].map((f) => f + ":" + document.fonts.check(`16px "${f}"`)));
  console.log(fonts.join(" "));
  if (pngDir) {
    const slides = await page.$$(".slide");
    for (let i = 0; i < slides.length; i++) await slides[i].screenshot({ path: `${pngDir}/slide-${i + 1}.png` });
    console.log("slides", slides.length);
  }
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: pdf, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
