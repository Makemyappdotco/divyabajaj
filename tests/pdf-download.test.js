// The admin PDF download must arrive as a PDF.
//
// It did not. res.send() JSON-encodes anything that is not a Buffer or a
// string, Puppeteer 23+ returns a Uint8Array from page.pdf(), and the result
// was a 41MB file of {"0":37,"1":80,"2":68,"3":70,...} - the PDF's own bytes
// spelled out as JSON, served under a .pdf name with a PDF content type. Two
// real customer reports were delivered that way before it was caught.
//
// This runs the actual Express response objects, not a mock of them, because
// the bug lived entirely in how Express decides what to do with its argument.

const assert = require('assert');
const express = require('express');
const http = require('http');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
  queue.push(async () => {
    try { await fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
  });
}

// A tiny but real PDF, as a Uint8Array - exactly what Puppeteer hands back.
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1');
const AS_UINT8 = new Uint8Array(PDF_BYTES);

function serve(handler) {
  return new Promise(resolve => {
    const app = express();
    app.get('/pdf', handler);
    const server = http.createServer(app).listen(0, () => resolve({ server, port: server.address().port }));
  });
}

async function fetchPdf(port) {
  const response = await fetch(`http://127.0.0.1:${port}/pdf`);
  const body = Buffer.from(await response.arrayBuffer());
  return { contentType: response.headers.get('content-type'), body };
}

console.log('\nadmin PDF download\n');

test('reproduces the bug: res.send() on a Uint8Array produces JSON', async () => {
  const { server, port } = await serve((req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(AS_UINT8);
  });
  const { body } = await fetchPdf(port);
  server.close();

  // This is the old behaviour, asserted so nobody "simplifies" the fix away.
  assert.ok(body.toString('utf8').startsWith('{"0":37,"1":80'),
    'expected the broken JSON encoding, got: ' + body.subarray(0, 20).toString('latin1'));
  assert.ok(body.length > PDF_BYTES.length * 5, 'the JSON form should be many times larger');
});

test('the fix: res.end() on a coerced Buffer produces a real PDF', async () => {
  const { server, port } = await serve((req, res) => {
    const out = Buffer.isBuffer(AS_UINT8) ? AS_UINT8 : Buffer.from(AS_UINT8);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(out.length));
    res.end(out);
  });
  const { contentType, body } = await fetchPdf(port);
  server.close();

  assert.strictEqual(contentType, 'application/pdf');
  assert.ok(body.subarray(0, 5).toString('latin1') === '%PDF-', 'does not start with %PDF-');
  assert.ok(body.toString('latin1').trimEnd().endsWith('%%EOF'), 'does not end with %%EOF');
  assert.strictEqual(body.length, PDF_BYTES.length, 'byte length changed');
  assert.ok(body.equals(PDF_BYTES), 'bytes differ from what was rendered');
});

test('a real Buffer still works unchanged', async () => {
  const { server, port } = await serve((req, res) => {
    const out = Buffer.isBuffer(PDF_BYTES) ? PDF_BYTES : Buffer.from(PDF_BYTES);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(out.length));
    res.end(out);
  });
  const { body } = await fetchPdf(port);
  server.close();
  assert.ok(body.equals(PDF_BYTES));
});

test('the live route no longer calls res.send with the pdf', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes.js'), 'utf8');
  const route = source.slice(source.indexOf("router.get('/reports/:id/pdf'"));
  const body = route.slice(0, route.indexOf('router.get', 10));
  assert.ok(!/res\.send\(pdfBuffer\)/.test(body), 'res.send(pdfBuffer) is back');
  assert.ok(/res\.end\(body\)/.test(body), 'the route should res.end() an explicit Buffer');
  assert.ok(/Buffer\.isBuffer/.test(body), 'the route should coerce to a Buffer');
  assert.ok(/Content-Length/.test(body), 'the route should set Content-Length');
});

test('the renderer returns a Buffer, whatever Puppeteer gave it', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'htmlReport', 'render.js'), 'utf8');
  assert.ok(/Buffer\.isBuffer\(rendered\) \? rendered : Buffer\.from\(rendered\)/.test(source),
    'renderReportPdfBuffer should coerce its result to a Buffer');
});

test('a JSON-encoded PDF can be recognised, so this is caught next time', () => {
  // The signature of the bug, for anyone debugging a "corrupt" download: the
  // file is ASCII, starts with {"0": and the first four values spell %PDF.
  const broken = Buffer.from(JSON.stringify(AS_UINT8), 'utf8');
  const text = broken.toString('utf8', 0, 40);
  assert.ok(text.startsWith('{"0":'));
  const values = JSON.parse(broken.toString('utf8'));
  const recovered = Buffer.from(Object.keys(values).sort((a, b) => a - b).map(k => values[k]));
  assert.ok(recovered.equals(PDF_BYTES), 'a broken download is fully recoverable');
});

(async () => {
  for (const run of queue) await run();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
