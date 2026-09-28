// The CDN-backed LobeHub CodeMirror exposes CM6 through a CM5-compatible API.
// Read the model, not the rendered DOM (which may contain only visible lines).
type CodeView = {
  state: {
    selection: { ranges: readonly { from: number; to: number }[] };
    sliceDoc: (from: number, to: number) => string;
  };
};
type CodeContent = HTMLElement & {
  cmView?: { view?: CodeView; rootView?: { view?: CodeView } };
};

export const isCodeSelectionTarget = (target: Element | null) =>
  Boolean(target?.closest('.cm-content, .CodeMirror'));

export const collectSelectionText = (target: Element | null = document.activeElement): string => {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    // An empty input selection must not fall through to stale document text.
    if (!target.closest('.CodeMirror')) return target.value.slice(start, end);
  }

  const content = target?.closest<CodeContent>('.cm-content');
  const view = content?.cmView?.rootView?.view ?? content?.cmView?.view;
  if (view) {
    return view.state.selection.ranges
      .filter(({ from, to }) => from !== to)
      .map(({ from, to }) => view.state.sliceDoc(from, to))
      .join('\n');
  }
  const legacy = target?.closest('.CodeMirror') as
    | (HTMLElement & { CodeMirror?: { getSelection: () => string } })
    | null;
  if (legacy?.CodeMirror) return legacy.CodeMirror.getSelection();
  return window.getSelection()?.toString() ?? '';
};

export const installClipboardBridge = (postMessage: (message: unknown) => void) => {
  let nextId = 0;
  const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: number }>();
  const writeText = (text: string): Promise<void> => new Promise((resolve, reject) => {
    const requestId = `clipboard-${++nextId}`;
    const timer = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('Clipboard write timed out'));
    }, 5000);
    pending.set(requestId, { resolve, reject, timer });
    try {
      postMessage({ command: 'copy-clipboard', requestId, text });
    } catch (error) {
      window.clearTimeout(timer);
      pending.delete(requestId);
      reject(error);
    }
  });
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message?.command !== 'copy-clipboard-result') return;
    const request = pending.get(message.requestId);
    if (!request) return;
    window.clearTimeout(request.timer);
    pending.delete(message.requestId);
    if (message.ok) request.resolve();
    else request.reject(new Error(message.error || 'Clipboard write failed'));
  });
  // The upstream code-block button calls this API. Use the host directly so a
  // temporary textarea cannot steal editor focus or overwrite its selection.
  if (navigator.clipboard) {
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: writeText });
  } else {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  }
  return writeText;
};
