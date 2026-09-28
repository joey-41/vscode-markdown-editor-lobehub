// Run after npm run build. Provide playwright through NODE_PATH if not local.
// CODEMIRROR_BUNDLE can point to the exact CDN script used by @lobehub/editor.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

(async () => {
  const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(error => { server.close(); throw error; });
  try {
    const page = await browser.newPage();
    if (process.env.CODEMIRROR_BUNDLE) {
      await page.route('**/@lobehub/codemirror/**', route => route.fulfill({
        path: process.env.CODEMIRROR_BUNDLE, contentType: 'application/javascript',
      }));
    }
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {
      window.writes = [];
      window.acquireVsCodeApi = () => ({
        getState: () => undefined, setState: () => {},
        postMessage: message => {
          if (message.command === 'copy-clipboard') {
            window.writes.push(message.text);
            window.postMessage({ command: 'copy-clipboard-result', requestId: message.requestId, ok: !window.failCopy, error: 'Test failure' }, '*');
          }
        },
      });
    });
    await page.addScriptTag({ path: path.resolve(process.env.EDITOR_BUNDLE || 'media/dist/main.js') });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.postMessage({
      command: 'update', type: 'init',
      content: '# Clipboard test\n\nBody with **bold** text.\n\n```javascript\nconst first = 1;\nconst second = 2;\n```\n',
    }, '*'));
    const content = page.locator('.cm-content');
    await content.waitFor();
    const select = async (ranges) => page.evaluate(ranges => {
      const el = document.querySelector('.cm-content');
      const view = el.cmView.rootView.view;
      view.focus();
      view.dispatch({ selection: { anchor: ranges[0], head: ranges[1] } });
      window.writes = [];
    }, ranges);
    await select([0, 16]);
    await page.keyboard.press('Meta+c');
    await page.waitForFunction(() => window.writes.length > 0);
    assert.equal(await page.evaluate(() => window.writes.at(-1)), 'const first = 1;');
    console.log('PASS keyboard code selection');

    await select([0, 16]);
    const copied = await page.evaluate(() => {
      const el = document.querySelector('.cm-content');
      window.outerCopy = false;
      document.body.addEventListener('copy', () => { window.outerCopy = true; }, { once: true });
      const data = new DataTransfer();
      el.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data }));
      return { text: data.getData('text/plain'), outerCopy: window.outerCopy };
    });
    assert.deepEqual(copied, { text: 'const first = 1;', outerCopy: false });
    console.log('PASS context-menu copy does not reach outer Lexical');

    await select([0, 16]);
    await page.evaluate(() => document.execCommand('copy'));
    await page.waitForFunction(() => window.writes.length > 0);
    assert.equal(await page.evaluate(() => window.writes.at(-1)), 'const first = 1;');
    console.log('PASS native webview copy command reaches host bridge');

    await select([0, 0]);
    await page.evaluate(() => document.querySelector('.cm-content').dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })));
    assert.deepEqual(await page.evaluate(() => window.writes), []);
    console.log('PASS empty code selection does not copy stale text');

    await select([17, 34]);
    await page.evaluate(() => window.postMessage({ command: 'perform-copy' }, '*'));
    await page.waitForFunction(() => window.writes.length > 0);
    assert.equal(await page.evaluate(() => window.writes.at(-1)), 'const second = 2;');
    console.log('PASS explicit Copy Selection command');

    const status = await page.evaluate(async () => {
      window.failCopy = true;
      try { await navigator.clipboard.writeText('failure'); return 'resolved'; }
      catch (error) { return error.message; }
    });
    assert.equal(status, 'Test failure');
    await page.evaluate(() => { window.failCopy = false; });
    console.log('PASS host failure rejects clipboard promise');

    await select([0, 16]);
    await page.locator('.cm-header-toolbar .cm-hidden-actions').last().click({ force: true });
    await page.waitForFunction(() => window.writes.length > 0);
    assert.equal(await page.evaluate(() => window.writes.at(-1)), 'const first = 1;\nconst second = 2;');
    console.log('PASS upstream copy-whole-block button');

    const richCopy = await page.evaluate(() => {
      const paragraph = [...document.querySelectorAll('p')].find(p => p.textContent.includes('Body with'));
      paragraph.closest('[contenteditable="true"]').focus();
      const range = document.createRange(); range.selectNodeContents(paragraph);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const data = new DataTransfer(); window.writes = [];
      paragraph.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data }));
      return { html: data.getData('text/html'), plain: data.getData('text/plain'), writes: window.writes };
    });
    assert.match(richCopy.html, /bold/);
    assert.match(richCopy.plain, /Body with/);
    assert.deepEqual(richCopy.writes, []);
    console.log('PASS body copy retains rich text without host plain-text overwrite');

    await page.evaluate(() => {
      const input = document.createElement('input');
      input.value = 'search query';
      document.body.append(input);
      input.focus(); input.setSelectionRange(0, 6);
      window.writes = [];
      window.postMessage({ command: 'perform-copy' }, '*');
    });
    await page.waitForFunction(() => window.writes.length > 0);
    assert.equal(await page.evaluate(() => window.writes.at(-1)), 'search');
    await page.evaluate(() => {
      document.activeElement.setSelectionRange(0, 0);
      window.writes = [];
      window.postMessage({ command: 'perform-copy' }, '*');
    });
    await page.waitForTimeout(100);
    assert.deepEqual(await page.evaluate(() => window.writes), []);
    console.log('PASS input selection and empty-input stale-selection guard');

    await page.evaluate(() => {
      const view = document.querySelector('.cm-content').cmView.rootView.view;
      const State = view.state.constructor;
      const Selection = view.state.selection.constructor;
      view.setState(State.create({ doc: 'alpha beta gamma',
        selection: Selection.create([Selection.range(0, 5), Selection.range(11, 16)]),
        extensions: [State.allowMultipleSelections.of(true)] }));
      view.focus(); window.writes = [];
      window.postMessage({ command: 'perform-copy' }, '*');
    });
    await page.waitForFunction(() => window.writes.length > 0);
    assert.equal(await page.evaluate(() => window.writes.at(-1)), 'alpha\ngamma');
    console.log('PASS multiple code selections');

  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
