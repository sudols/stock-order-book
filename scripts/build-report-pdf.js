const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const marked = require('marked');
const puppeteer = require('puppeteer');
const https = require('https');

function normalizeName(v) {
	return v.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findBestMmdForImage(umlDir, imageRef) {
	const imageBase = path.basename(imageRef).replace(path.extname(imageRef), '');
	const imageNorm = normalizeName(imageBase);

	const files = fs
		.readdirSync(umlDir)
		.filter((f) => f.toLowerCase().endsWith('.mmd'));
	if (!files.length) return null;

	// 1) Exact basename match
	const exact = files.find(
		(f) => path.basename(f, '.mmd').toLowerCase() === imageBase.toLowerCase(),
	);
	if (exact) return path.join(umlDir, exact);

	// 2) Best normalized match (contains relation)
	const candidates = files
		.map((f) => ({
			file: f,
			norm: normalizeName(path.basename(f, '.mmd')),
		}))
		.filter(({ norm }) => norm.includes(imageNorm) || imageNorm.includes(norm))
		.sort((a, b) => a.norm.length - b.norm.length);

	if (candidates.length) return path.join(umlDir, candidates[0].file);

	return null;
}

function toMermaidInkUrl(mmdContent) {
	const mermaidState = {
		code: mmdContent,
		mermaid: {
			theme: 'default',
		},
		autoSync: true,
		updateDiagram: true,
	};

	const compressed = zlib.deflateSync(JSON.stringify(mermaidState));
	const payload = compressed.toString('base64url');
	return `https://mermaid.ink/img/pako:${payload}?type=png&theme=default`;
}

async function fetchUrl(url) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () =>
					resolve({ statusCode: res.statusCode, body: data }),
				);
			})
			.on('error', reject);
	});
}

async function rewriteUmlImageLinksToMermaid(md, milestoneDir) {
	const umlDir = path.join(milestoneDir, 'uml');
	if (!fs.existsSync(umlDir)) return md;

	const regex = /!\[([^\]]*)\]\((uml\/[^)]+\.(?:png|svg))\)/gi;
	let match;
	let out = md;
	const replacements = [];
	while ((match = regex.exec(md)) !== null) {
		const [full, altText, imageRef] = match;
		const mmdPath = findBestMmdForImage(umlDir, imageRef);
		if (!mmdPath || !fs.existsSync(mmdPath)) continue;

		const mmdContent = fs.readFileSync(mmdPath, 'utf8');
		const url =
			toMermaidInkUrl(mmdContent)
				.replace('/img/pako:', '/svg/pako:')
				.split('?')[0] + '?theme=default';

		replacements.push({ full, altText, imageRef, mmdPath, url, mmdContent });
	}

	for (const r of replacements) {
		try {
			const res = await fetchUrl(r.url);
			if (res.statusCode === 200 && res.body) {
				const svgContent = res.body.replace(/<\?xml[^>]*>/i, '');
				const wrapped = `\n<div class="uml-diagram">\n${svgContent}\n</div>\n`;
				out = out.split(r.full).join(wrapped);
			} else {
				out = out.split(r.full).join(`![${r.altText}](${r.url})`);
			}
		} catch (err) {
			out = out.split(r.full).join(`![${r.altText}](${r.url})`);
		}
	}

	return out;
}

async function build() {
	const repoRoot = path.resolve(__dirname, '..');
	const milestoneDir = path.join(repoRoot, 'milestone');
	const mdFile = path.join(milestoneDir, 'm3_computer-humanRephrase.md');
	const cssFile = path.join(milestoneDir, 'report-style.css');
	const outPdf = path.join(milestoneDir, 'm3_computer-humanRephrase.pdf');

	const mdRaw = fs.readFileSync(mdFile, 'utf8');
	const md = await rewriteUmlImageLinksToMermaid(mdRaw, milestoneDir);
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
		.uml-diagram{page-break-inside:avoid;text-align:center;margin:12px 0}
		.uml-diagram svg{max-width:100%;height:auto}
		.uml-diagram svg *{font-family: Arial, Helvetica, sans-serif;}
  </style>
</head>
<body>
${marked.parse(md)}
</body>
</html>`;

	const tmpHtml = path.join(milestoneDir, 'report-temp.html');
	fs.writeFileSync(tmpHtml, html, 'utf8');

	const browser = await puppeteer.launch({
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});
	const page = await browser.newPage();
	await page.goto('file://' + tmpHtml, { waitUntil: 'networkidle0' });

	await page.pdf({
		path: outPdf,
		format: 'A4',
		printBackground: true,
		margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
	});

	await browser.close();
	fs.unlinkSync(tmpHtml);
	console.log('Wrote PDF:', outPdf);
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
