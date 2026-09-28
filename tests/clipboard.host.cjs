const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const disposable = () => ({ dispose() {} });
let provider, receive;
const replies = [], writes = [], errors = [];
let failWrite = false;
const uri = { fsPath: '/test.md', path: '/test.md', toString: () => 'file:///test.md' };
const vscode = {
  Uri: { joinPath: () => uri },
  window: {
    registerCustomEditorProvider: (_id, value) => { provider = value; return disposable(); },
    onDidChangeActiveColorTheme: disposable,
    showErrorMessage: message => errors.push(message),
  },
  commands: { registerCommand: disposable },
  workspace: {
    onDidChangeTextDocument: disposable, onDidCloseTextDocument: disposable,
    onDidChangeConfiguration: disposable,
  },
  env: { clipboard: { writeText: async text => {
    if (failWrite) throw new Error('Clipboard denied');
    writes.push(text);
  } } },
};
(async () => {
  assert.equal(require('../package.json').contributes.keybindings, undefined, 'Use native VS Code copy routing instead of a global override');
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.resolve('out/extension.js'), 'utf8'), {
    exports, console, Buffer, Error, require: name => name === 'vscode' ? vscode : require(name),
  });
  exports.activate({ extensionUri: uri, subscriptions: [] });
  await provider.resolveCustomTextEditor({ uri }, {
    webview: {
      asWebviewUri: value => value,
      onDidReceiveMessage: callback => { receive = callback; return disposable(); },
      postMessage: async message => replies.push(message),
    },
    onDidDispose: disposable,
  });
  await receive({ command: 'copy-clipboard', requestId: '1', text: 'const x = 1;' });
  assert.deepEqual(writes, ['const x = 1;']);
  assert.equal(replies.at(-1).ok, true);
  assert.equal(replies.at(-1).requestId, '1');
  failWrite = true;
  await receive({ command: 'copy-clipboard', requestId: '2', text: 'denied' });
  assert.equal(replies.at(-1).ok, false);
  assert.equal(replies.at(-1).error, 'Clipboard denied');
  assert.equal(errors.length, 1);
  await receive({ command: 'copy-clipboard', requestId: '3', text: 42 });
  assert.equal(replies.length, 2);
  console.log('PASS extension host clipboard success, failure and invalid payload');
})();
