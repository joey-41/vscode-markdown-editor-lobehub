import * as path from 'node:path';
import * as vscode from 'vscode';

const VIEW_TYPE = 'lobehub-markdown-editor.customEditor';
const CONFIG_NAMESPACE = 'lobehub-markdown-editor';

interface WebviewInitPayload {
  command: 'update';
  type: 'init' | 'update';
  content: string;
  theme: 'light' | 'dark';
  revision?: number;
  options?: {
    editorMaxWidth: number;
    useVscodeThemeColor: boolean;
  };
  meta?: {
    fileName: string;
    filePath: string;
    relativePath: string;
  };
}

interface WebviewMessage {
  command: 'ready' | 'edit' | 'save' | 'open-link' | 'upload-image';
  content?: string;
  href?: string;
  requestId?: string;
  fileName?: string;
  mimeType?: string;
  dataBase64?: string;
}

interface UploadImageResultMessage {
  command: 'upload-image-result';
  requestId: string;
  url?: string;
  error?: string;
  ok: boolean;
}

function getThemeKind(): 'light' | 'dark' {
  return vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light';
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function isMarkdownUri(uri: vscode.Uri) {
  return /\.(md|markdown)$/i.test(uri.path);
}

function showError(message: string) {
  vscode.window.showErrorMessage(`[LobeHub Markdown Editor] ${message}`);
}

function getRelativePath(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return uri.fsPath || uri.path;

  const relative = path.relative(folder.uri.fsPath, uri.fsPath);
  return relative || path.basename(uri.fsPath || uri.path);
}

function getConfig() {
  const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

  return {
    editorMaxWidth: config.get<number>('editorMaxWidth', 780),
    useVscodeThemeColor: config.get<boolean>('useVscodeThemeColor', true),
  };
}

function normalizeContentForDocument(content: string, document: vscode.TextDocument): string {
  const normalizedLf = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  return eol === '\n' ? normalizedLf : normalizedLf.replace(/\n/g, '\r\n');
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function decodeUriComponentSafely(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeLocalFilePath(value: string) {
  const decoded = decodeUriComponentSafely(value);
  if (process.platform !== 'win32') {
    return decoded;
  }

  return decoded.replace(/^\/([a-zA-Z]:[\\/])/, '$1').replace(/\//g, '\\');
}

function tryResolveWebviewBackedFileUri(href: string): vscode.Uri | undefined {
  try {
    const parsed = new URL(href);
    const hostname = parsed.hostname.toLowerCase();
    const isWebviewCdn =
      parsed.protocol === 'https:' &&
      hostname.includes('vscode-resource') &&
      hostname.endsWith('vscode-cdn.net');
    const isWebviewResource =
      parsed.protocol === 'vscode-webview-resource:' ||
      parsed.protocol === 'vscode-resource:' ||
      parsed.protocol === 'vscode-file:';

    if (!isWebviewCdn && !isWebviewResource) {
      return undefined;
    }

    const fragment = parsed.hash ? decodeUriComponentSafely(parsed.hash.slice(1)) : '';
    return vscode.Uri.file(normalizeLocalFilePath(parsed.pathname)).with({
      fragment,
    });
  } catch {
    return undefined;
  }
}

function tryResolveLinkedFileUri(documentUri: vscode.Uri, href: string): vscode.Uri | undefined {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const webviewBackedUri = tryResolveWebviewBackedFileUri(trimmed);
  if (webviewBackedUri) {
    return webviewBackedUri;
  }

  if (/^file:/i.test(trimmed)) {
    const parsed = vscode.Uri.parse(trimmed);
    return vscode.Uri.file(parsed.fsPath).with({ fragment: parsed.fragment });
  }

  if (/^vscode-(file|resource):/i.test(trimmed)) {
    const parsed = vscode.Uri.parse(trimmed);
    return vscode.Uri.file(normalizeLocalFilePath(parsed.path)).with({ fragment: parsed.fragment });
  }

  const hasUriScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  if (hasUriScheme && !isWindowsAbsolutePath(trimmed)) {
    return undefined;
  }

  const hashIndex = trimmed.indexOf('#');
  const pathPart = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const fragment = hashIndex >= 0 ? decodeUriComponentSafely(trimmed.slice(hashIndex + 1)) : '';
  const normalizedPath = normalizeLocalFilePath(pathPart.split('?')[0]);

  if (path.isAbsolute(normalizedPath)) {
    return vscode.Uri.file(normalizedPath).with({ fragment });
  }

  const docDirUri = vscode.Uri.joinPath(documentUri, '..');
  return vscode.Uri.joinPath(docDirUri, normalizedPath).with({ fragment });
}

async function openLinkedUri(targetUri: vscode.Uri) {
  if (isMarkdownUri(targetUri)) {
    await vscode.commands.executeCommand('vscode.openWith', targetUri, VIEW_TYPE, {
      preview: false,
    });
    return;
  }

  await vscode.commands.executeCommand('vscode.open', targetUri, {
    preview: false,
  });
}

function inferImageExtension(fileName?: string, mimeType?: string): string {
  const extFromName = (fileName && path.extname(fileName)) || '';
  if (extFromName) return extFromName.toLowerCase();

  const map: Record<string, string> = {
    'image/avif': '.avif',
    'image/bmp': '.bmp',
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
  };

  return map[mimeType?.toLowerCase() ?? ''] ?? '.png';
}

function safeImageBaseName(fileName?: string): string {
  const original = fileName ? path.parse(fileName).name : 'image';
  const normalized = original
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');

  return normalized || 'image';
}

async function createUniqueImageFileUri(
  assetsDirUri: vscode.Uri,
  baseName: string,
  extension: string,
): Promise<vscode.Uri> {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0',
  )}${String(now.getSeconds()).padStart(2, '0')}`;

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `-${index}`;
    const fileName = `${baseName}-${stamp}${suffix}${extension}`;
    const candidateUri = vscode.Uri.joinPath(assetsDirUri, fileName);

    try {
      await vscode.workspace.fs.stat(candidateUri);
    } catch {
      return candidateUri;
    }
  }

  throw new Error('Could not generate a unique image filename. Please try again.');
}

async function saveImageToAssets(
  document: vscode.TextDocument,
  payload: { dataBase64: string; fileName?: string; mimeType?: string },
): Promise<string> {
  if (document.isUntitled || document.uri.scheme === 'untitled') {
    throw new Error('Please save the Markdown file first before adding images.');
  }

  const parentDirUri = vscode.Uri.joinPath(document.uri, '..');
  const assetsDirUri = vscode.Uri.joinPath(parentDirUri, 'assets');

  try {
    await vscode.workspace.fs.createDirectory(assetsDirUri);
  } catch {
    // Directory may already exist
  }

  const extension = inferImageExtension(payload.fileName, payload.mimeType);
  const baseName = safeImageBaseName(payload.fileName);
  const targetFileUri = await createUniqueImageFileUri(assetsDirUri, baseName, extension);

  const raw = payload.dataBase64.includes(',')
    ? payload.dataBase64.slice(payload.dataBase64.indexOf(',') + 1)
    : payload.dataBase64;

  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) {
    throw new Error('Image data is empty. Save failed.');
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (buffer.length > MAX_SIZE) {
    throw new Error(`Image exceeds the 10 MB size limit (got ${(buffer.length / 1024 / 1024).toFixed(1)} MB).`);
  }

  await vscode.workspace.fs.writeFile(targetFileUri, buffer);

  const fileName = path.posix.basename(targetFileUri.path);
  return `assets/${fileName}`;
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new LobeHubMarkdownEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
      supportsMultipleEditorsPerDocument: false,
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lobehub-markdown-editor.openEditor', async (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        showError('Please open a Markdown file first.');
        return;
      }

      if (!isMarkdownUri(targetUri)) {
        showError(`Only .md / .markdown files are supported. Current file: ${path.basename(targetUri.fsPath)}`);
        return;
      }

      await vscode.commands.executeCommand('vscode.openWith', targetUri, VIEW_TYPE);
    }),
  );
}

export function deactivate() {}

class LobeHubMarkdownEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    const docDirUri = vscode.Uri.joinPath(document.uri, '..');

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        docDirUri,
        ...(vscode.workspace.workspaceFolders?.map((item) => item.uri) ?? []),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document.uri);

    const disposables: vscode.Disposable[] = [];
    let applyingCount = 0;
    let pendingApplyChain = Promise.resolve();
    let documentRevision = 0;

    const refreshTitle = () => {
      webviewPanel.title = path.basename(document.uri.fsPath || document.uri.path);
    };

    const postDocumentToWebview = (type: 'init' | 'update' = 'update') => {
      const payload: WebviewInitPayload = {
        command: 'update',
        content: document.getText(),
        meta: {
          fileName: path.basename(document.uri.fsPath || document.uri.path),
          filePath: document.uri.fsPath || document.uri.path,
          relativePath: getRelativePath(document.uri),
        },
        options: getConfig(),
        revision: documentRevision,
        theme: getThemeKind(),
        type,
      };

      webviewPanel.webview.postMessage(payload);
      refreshTitle();
    };

    const applyContent = async (content: string) => {
      pendingApplyChain = pendingApplyChain
        .then(async () => {
          const normalizedContent = normalizeContentForDocument(content, document);
          if (normalizedContent === document.getText()) {
            return;
          }

          applyingCount += 1;
          documentRevision += 1;

          try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = document.validateRange(
              new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
            );
            edit.replace(document.uri, fullRange, normalizedContent);
            await vscode.workspace.applyEdit(edit);
          } finally {
            applyingCount = Math.max(0, applyingCount - 1);
          }

          refreshTitle();
        })
        .catch((err) => {
          applyingCount = Math.max(0, applyingCount - 1);
          console.error('[LobeHub Markdown Editor] applyContent error:', err);
        });

      return pendingApplyChain;
    };

    disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() !== document.uri.toString()) {
          return;
        }

        if (applyingCount > 0) {
          return;
        }

        postDocumentToWebview('update');
      }),
    );

    disposables.push(
      vscode.workspace.onDidCloseTextDocument((closedDoc) => {
        if (closedDoc.uri.toString() === document.uri.toString()) {
          webviewPanel.dispose();
        }
      }),
    );

    disposables.push(
      vscode.window.onDidChangeActiveColorTheme(() => {
        webviewPanel.webview.postMessage({
          command: 'theme',
          theme: getThemeKind(),
        });
      }),
    );

    disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(CONFIG_NAMESPACE)) {
          return;
        }
        postDocumentToWebview('update');
      }),
    );

    disposables.push(
      webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
        switch (message.command) {
          case 'ready': {
            postDocumentToWebview('init');
            break;
          }
          case 'edit': {
            if (typeof message.content === 'string') {
              await applyContent(message.content);
            }
            break;
          }
          case 'save': {
            if (typeof message.content === 'string') {
              await applyContent(message.content);
            }
            await document.save();
            refreshTitle();
            break;
          }
          case 'open-link': {
            if (typeof message.href !== 'string') {
              return;
            }

            const href = message.href.trim();
            if (!href) {
              return;
            }

            // 1. In-page anchor link - handled inside webview
            if (href.startsWith('#')) {
              return;
            }

            // 2. External web URL (http, https, mailto, tel) -> open in user's default browser
            if (/^(https?|mailto|tel):/i.test(href)) {
              try {
                await vscode.env.openExternal(vscode.Uri.parse(href));
              } catch (err) {
                showError(`Failed to open external link: ${href}`);
              }
              return;
            }

            // 3. Local file or webview-backed URI
            const linkedFileUri = tryResolveLinkedFileUri(document.uri, href);
            if (linkedFileUri) {
              try {
                await openLinkedUri(linkedFileUri);
              } catch (err) {
                showError(`Failed to open linked file: ${linkedFileUri.fsPath || linkedFileUri.path}`);
              }
              return;
            }

            // 4. Other URI schemes (e.g. custom protocols) -> try external open first, fallback to vscode.open
            if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/i.test(href) && !isWindowsAbsolutePath(href)) {
              try {
                const parsed = vscode.Uri.parse(href);
                const opened = await vscode.env.openExternal(parsed);
                if (!opened) {
                  await vscode.commands.executeCommand('vscode.open', parsed, { preview: false });
                }
              } catch {
                showError(`Cannot open link: ${href}`);
              }
              return;
            }

            break;
          }
          case 'upload-image': {
            const requestId = message.requestId;
            const postResult = (payload: UploadImageResultMessage) => {
              webviewPanel.webview.postMessage(payload);
            };

            if (!requestId || typeof requestId !== 'string') {
              postResult({
                command: 'upload-image-result',
                error: 'Missing requestId.',
                ok: false,
                requestId: requestId ?? '',
              });
              return;
            }

            if (!message.dataBase64 || typeof message.dataBase64 !== 'string') {
              postResult({
                command: 'upload-image-result',
                error: 'Invalid image data.',
                ok: false,
                requestId,
              });
              return;
            }

            try {
              const url = await saveImageToAssets(document, {
                dataBase64: message.dataBase64,
                fileName: message.fileName,
                mimeType: message.mimeType,
              });

              postResult({
                command: 'upload-image-result',
                ok: true,
                requestId,
                url,
              });
            } catch (error) {
              postResult({
                command: 'upload-image-result',
                error: error instanceof Error ? error.message : 'Failed to save image.',
                ok: false,
                requestId,
              });
            }

            break;
          }
          default:
            break;
        }
      }),
    );

    webviewPanel.onDidDispose(() => {
      disposables.forEach((item) => item.dispose());
    });

    refreshTitle();
  }

  private getHtmlForWebview(webview: vscode.Webview, documentUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'dist', 'main.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'dist', 'main.css'),
    );
    const docDirUri = vscode.Uri.joinPath(documentUri, '..');
    const baseHref = webview.asWebviewUri(docDirUri).toString() + '/';
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base href="${baseHref}" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; connect-src ${webview.cspSource} https://registry.npmmirror.com https://unpkg.com; worker-src blob:; script-src 'nonce-${nonce}' ${webview.cspSource} https://registry.npmmirror.com https://unpkg.com blob:;"
  />
  <link rel="stylesheet" href="${styleUri}" />
  <title>LobeHub Markdown Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
