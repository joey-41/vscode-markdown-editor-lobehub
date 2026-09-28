# Clipboard regression tests

Run `npm run build` followed by `npm run test:clipboard` (Google Chrome required;
set `BROWSER_CHANNEL` to another installed Playwright channel if needed).

The browser suite loads the actual bundled editor and the CodeMirror CDN script
used by `@lobehub/editor`. Set `CODEMIRROR_BUNDLE` to a local copy of that script
for offline runs. `EDITOR_BUNDLE` can point to an older build for regression checks.
The suite starts and closes its own local HTTP server.

Coverage: code-selection keyboard copy, context-menu copy isolation, empty
selection, explicit Copy Selection command, host write rejection, upstream
copy-whole-block button, inputs, and multiple selections. The host suite executes
the compiled extension against a mocked VS Code clipboard API.

These tests do not replace a real VS Code Webview check. Install the generated
VSIX and verify Cmd/Ctrl+C, right-click Copy, the code-block Copy button, rich-text
copy/paste, and copying from the terminal/search box while this editor is open.
