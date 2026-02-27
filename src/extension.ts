import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

const VIEW_TYPE = 'lobehub-markdown-editor.customEditor';
const CONFIG_NAMESPACE = 'lobehub-markdown-editor';

interface WebviewInitPayload {
  command: 'update';
  type: 'init' | 'update';
  content: string;
  theme: 'light' | 'dark';
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
  return /\.(md|markdown)$/i.test(uri.fsPath);
}

function showError(message: string) {
  vscode.window.showErrorMessage(`[LobeHub Markdown Editor] ${message}`);
}

function getRelativePath(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return uri.fsPath;

  const relative = path.relative(folder.uri.fsPath, uri.fsPath);
  return relative || path.basename(uri.fsPath);
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

async function createUniqueImageFilePath(
  assetsDir: string,
  baseName: string,
  extension: string,
): Promise<string> {
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
    const candidate = path.join(assetsDir, fileName);

    try {
      await fs.access(candidate);
    } catch {
      return candidate;
    }
  }

  throw new Error('Could not generate a unique image filename. Please try again.');
}

async function saveImageToAssets(
  document: vscode.TextDocument,
  payload: { dataBase64: string; fileName?: string; mimeType?: string },
): Promise<string> {
  const parentDir = path.dirname(document.uri.fsPath);
  const assetsDir = path.join(parentDir, 'assets');

  await fs.mkdir(assetsDir, { recursive: true });

  const extension = inferImageExtension(payload.fileName, payload.mimeType);
  const baseName = safeImageBaseName(payload.fileName);
  const absolutePath = await createUniqueImageFilePath(assetsDir, baseName, extension);

  const raw = payload.dataBase64.includes(',')
    ? payload.dataBase64.slice(payload.dataBase64.indexOf(',') + 1)
    : payload.dataBase64;

  if (!/^[\w+/]+=*$/.test(raw)) {
    throw new Error('Invalid base64 image data.');
  }

  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) {
    throw new Error('Image data is empty. Save failed.');
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (buffer.length > MAX_SIZE) {
    throw new Error(`Image exceeds the 10 MB size limit (got ${(buffer.length / 1024 / 1024).toFixed(1)} MB).`);
  }

  await fs.writeFile(absolutePath, buffer);

  const relative = path.relative(parentDir, absolutePath);
  return relative.split(path.sep).join('/');
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
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.file(path.dirname(document.uri.fsPath)),
        ...(vscode.workspace.workspaceFolders?.map((item) => item.uri) ?? []),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document.uri);

    const disposables: vscode.Disposable[] = [];
    let isApplyingFromWebview = false;

    const refreshTitle = () => {
      webviewPanel.title = path.basename(document.uri.fsPath);
    };

    const postDocumentToWebview = (type: 'init' | 'update' = 'update') => {
      const payload: WebviewInitPayload = {
        command: 'update',
        content: document.getText(),
        meta: {
          fileName: path.basename(document.uri.fsPath),
          filePath: document.uri.fsPath,
          relativePath: getRelativePath(document.uri),
        },
        options: getConfig(),
        theme: getThemeKind(),
        type,
      };

      webviewPanel.webview.postMessage(payload);
      refreshTitle();
    };

    const applyContent = async (content: string) => {
      const normalizedContent = normalizeContentForDocument(content, document);
      if (normalizedContent === document.getText()) {
        return;
      }

      isApplyingFromWebview = true;

      try {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), normalizedContent);
        await vscode.workspace.applyEdit(edit);
      } finally {
        isApplyingFromWebview = false;
      }

      refreshTitle();
    };

    disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() !== document.uri.toString()) {
          return;
        }

        if (isApplyingFromWebview) {
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

            if (/^https?:\/\//i.test(href)) {
              await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(href));
              return;
            }

            const absolutePath = path.resolve(path.dirname(document.uri.fsPath), href);
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(absolutePath));
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
    const baseHref =
      path.dirname(webview.asWebviewUri(vscode.Uri.file(documentUri.fsPath)).toString()) + '/';
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
