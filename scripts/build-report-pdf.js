const fs = require('fs');
const path = require('path');
const marked = require('marked');
const puppeteer = require('puppeteer');

async function build() {
  const repoRoot = path.resolve(__dirname, '..');
  const milestoneDir = path.join(repoRoot, 'milestone');
  const mdFile = path.join(milestoneDir, 'm3_computer-humanRephrase.md');
  const cssFile = path.join(milestoneDir, 'report-style.css');
  const outPdf = path.join(milestoneDir, 'm3_computer-humanRephrase.pdf');

  const md = fs.readFileSync(mdFile, 'utf8');
  const css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, 'utf8') : '';

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <base href="file://${milestoneDir}/">
  <style>${css}</style>
  <style>
    /* Ensure images fit within page width when rendering for PDF */
    img{max-width:100%;height:auto}
    body{background:white}
  </style>
</head>
<body>
${marked.parse(md)}
</body>
</html>`;

  const tmpHtml = path.join(milestoneDir, 'report-temp.html');
  fs.writeFileSync(tmpHtml, html, 'utf8');

  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('file://' + tmpHtml, {waitUntil: 'networkidle0'});

  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    margin: {top: '15mm', bottom: '15mm', left: '15mm', right: '15mm'}
  });

  await browser.close();
  fs.unlinkSync(tmpHtml);
  console.log('Wrote PDF:', outPdf);
}

build().catch(err=>{console.error(err); process.exit(1)});
