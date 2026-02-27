import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_CODEMIRROR_COMMAND,
  INSERT_HEADING_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  INSERT_MATH_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_TABLE_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ReactCodePlugin,
  ReactCodemirrorPlugin,
  ReactHRPlugin,
  ReactImagePlugin,
  ReactLinkPlugin,
  ReactListPlugin,
  ReactLiteXmlPlugin,
  ReactMathPlugin,
  ReactTablePlugin,
  ReactToolbarPlugin,
  type IEditor,
} from '@lobehub/editor';
import { Editor, EditorProvider, useEditor, useEditorState } from '@lobehub/editor/react';
import { ConfigProvider, Text, ThemeProvider } from '@lobehub/ui';
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  Table2Icon,
} from 'lucide-react';
import * as motion from 'motion/react-m';
import React, { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import markdownFileIcon from '../../file.png';
import markdownFileWhiteIcon from '../../file-white.png';
import tocToggleIcon from '../../align-text-justify-svgrepo-com.svg';
import InlineToolbar from './InlineToolbar';
import { enEditorLocale, getEditorLocale } from './locale';

import './main.css';

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      getState: () => unknown;
      postMessage: (message: unknown) => void;
      setState: (state: unknown) => void;
    };
  }
}

type ThemeType = 'light' | 'dark';

type HostMessage =
  | {
      command: 'update';
      content: string;
      meta?: {
        fileName: string;
        filePath: string;
        relativePath: string;
      };
      options?: {
        editorMaxWidth: number;
        useVscodeThemeColor: boolean;
      };
      theme?: ThemeType;
      type?: 'init' | 'update';
    }
  | {
      command: 'theme';
      theme: ThemeType;
    }
  | {
      command: 'upload-image-result';
      requestId: string;
      ok: boolean;
      url?: string;
      error?: string;
    };

const vscode =
  window.acquireVsCodeApi?.() ?? {
    getState: () => undefined,
    postMessage: (_message: unknown) => undefined,
    setState: (_state: unknown) => undefined,
  };

const safeTemplate = (raw: string, params?: Record<string, unknown>) => {
  if (!params) return raw;
  return raw.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key) => {
    const value = params[key as string];
    return value === undefined || value === null ? '' : String(value);
  });
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const raw = typeof reader.result === 'string' ? reader.result : '';
      const base64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });

const createRequestId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const resolveWebviewAssetUrl = (assetPath: string): string => {
  if (
    /^(data:|blob:|https?:|vscode-webview-resource:|vscode-file:|\/)/i.test(assetPath)
  ) {
    return assetPath;
  }

  const scriptElement = Array.from(document.querySelectorAll('script[src]')).find((element) =>
    element.getAttribute('src')?.includes('main.js'),
  );

  const scriptSrc = scriptElement?.getAttribute('src');
  if (!scriptSrc) return assetPath;

  return new URL(assetPath, scriptSrc).toString();
};

interface EditorAppProps {
  onThemeChange: (theme: ThemeType) => void;
  theme: ThemeType;
}

interface TocItem {
  depth: number;
  id: string;
  level: number;
  text: string;
}

const tocTitleId = 'toc-document-title';
const tocHeadingSelector =
  ".editor-frame [data-lexical-editor='true'] h1[data-toc-id], .editor-frame [data-lexical-editor='true'] h2[data-toc-id], .editor-frame [data-lexical-editor='true'] h3[data-toc-id], .editor-frame [data-lexical-editor='true'] h4[data-toc-id], .editor-frame [data-lexical-editor='true'] h5[data-toc-id], .editor-frame [data-lexical-editor='true'] h6[data-toc-id]";
const tocActiveSelector = `${tocHeadingSelector}, .editor-doc-title[data-toc-id]`;

const isSameToc = (a: TocItem[], b: TocItem[]) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index].id !== b[index].id) return false;
    if (a[index].depth !== b[index].depth) return false;
    if (a[index].level !== b[index].level) return false;
    if (a[index].text !== b[index].text) return false;
  }
  return true;
};

const EditorApp = ({ theme, onThemeChange }: EditorAppProps) => {
  const editor = useEditor();
  const editorState = useEditorState(editor);

  const locale = useMemo(() => getEditorLocale(), []);
  const userLanguage = navigator.language.toLowerCase();

  const [fileName, setFileName] = useState<string>('Untitled.md');
  const [editorMaxWidth, setEditorMaxWidth] = useState<number>(780);
  const [useVscodeThemeColor, setUseVscodeThemeColor] = useState<boolean>(true);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [tocCollapsed, setTocCollapsed] = useState<boolean>(true);
  const [viewportWidth, setViewportWidth] = useState<number>(() => window.innerWidth);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const titleText = useMemo(() => {
    const name = fileName?.trim() || 'Untitled';
    const stripped = name.replace(/\.(md|markdown)$/i, '');
    return stripped || name;
  }, [fileName]);

  const readyRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const hasUserInteractionRef = useRef(false);
  const lastSyncedMarkdownRef = useRef<string>('');
  const pendingRemoteContentRef = useRef<string | null>(null);
  const tocRafRef = useRef<number | undefined>(undefined);
  const activeTocRafRef = useRef<number | undefined>(undefined);
  const uploadResolversRef = useRef(
    new Map<string, { reject: (reason?: unknown) => void; resolve: (value: { url: string }) => void }>(),
  );

  const updateTocFromDom = useCallback(() => {
    const headingNodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".editor-frame [data-lexical-editor='true'] h1, .editor-frame [data-lexical-editor='true'] h2, .editor-frame [data-lexical-editor='true'] h3, .editor-frame [data-lexical-editor='true'] h4, .editor-frame [data-lexical-editor='true'] h5, .editor-frame [data-lexical-editor='true'] h6",
      ),
    );

    const extracted = headingNodes
      .map((node) => {
        const level = Number.parseInt(node.tagName.slice(1), 10);
        const text = node.textContent?.trim() ?? '';
        return { level, node, text };
      })
      .filter((item) => Boolean(item.text));

    const nextItems: TocItem[] = extracted.map((item, index) => {
      const id = `toc-heading-${index}`;
      item.node.dataset.tocId = id;
      return {
        depth: Math.max(0, item.level - 1),
        id,
        level: item.level,
        text: item.text,
      };
    });

    headingNodes.forEach((node) => {
      const text = node.textContent?.trim() ?? '';
      if (text) return;
      delete node.dataset.tocId;
    });

    if (nextItems.length > 0) {
      nextItems.unshift({
        depth: 0,
        id: tocTitleId,
        level: 1,
        text: titleText,
      });
    }

    setTocItems((previous) => (isSameToc(previous, nextItems) ? previous : nextItems));

    if (nextItems.length === 0) {
      setTocCollapsed(true);
      setActiveTocId(null);
    }
  }, [titleText]);

  const updateActiveTocFromScroll = useCallback(() => {
    const nativeSelection = window.getSelection();
    const selectionAnchorNode = nativeSelection?.anchorNode ?? null;
    const selectionAnchorElement =
      selectionAnchorNode instanceof Element
        ? selectionAnchorNode
        : selectionAnchorNode?.parentElement ?? null;
    const activeHeadingBySelection = selectionAnchorElement?.closest<HTMLElement>(
      tocActiveSelector,
    );
    const activeHeadingId = activeHeadingBySelection?.dataset.tocId ?? null;
    if (activeHeadingId) {
      setActiveTocId((previous) => (previous === activeHeadingId ? previous : activeHeadingId));
      return;
    }

    const headingNodes = Array.from(
      document.querySelectorAll<HTMLElement>(tocHeadingSelector),
    );

    if (headingNodes.length === 0) {
      setActiveTocId(null);
      return;
    }

    const anchorY = Math.max(56, Math.min(84, window.innerHeight * 0.1));
    const hysteresis = 6;

    let currentId = tocItems.some((item) => item.id === tocTitleId)
      ? tocTitleId
      : headingNodes[0].dataset.tocId ?? null;

    for (const node of headingNodes) {
      const id = node.dataset.tocId;
      if (!id) continue;

      if (node.getBoundingClientRect().top <= anchorY + hysteresis) {
        currentId = id;
      } else {
        break;
      }
    }

    setActiveTocId((previous) => (previous === currentId ? previous : currentId));
  }, [tocItems]);

  const scheduleActiveTocSync = useCallback(() => {
    if (activeTocRafRef.current !== undefined) {
      window.cancelAnimationFrame(activeTocRafRef.current);
    }

    activeTocRafRef.current = window.requestAnimationFrame(() => {
      updateActiveTocFromScroll();
      activeTocRafRef.current = undefined;
    });
  }, [updateActiveTocFromScroll]);

  const scheduleTocSync = useCallback(() => {
    if (tocRafRef.current !== undefined) {
      window.cancelAnimationFrame(tocRafRef.current);
    }

    tocRafRef.current = window.requestAnimationFrame(() => {
      updateTocFromDom();
      scheduleActiveTocSync();
      tocRafRef.current = undefined;
    });
  }, [scheduleActiveTocSync, updateTocFromDom]);

  const patchEditorTranslation = useCallback(
    (instance: IEditor) => {
      const originalT = instance.t?.bind(instance);

      instance.t = ((key: string, params?: Record<string, unknown>) => {
        const raw = locale[key] ?? enEditorLocale[key] ?? originalT?.(key) ?? key;
        if (typeof raw !== 'string') return key;
        return safeTemplate(raw, params);
      }) as IEditor['t'];
    },
    [locale],
  );

  const setEditorMarkdown = useCallback(
    (markdown: string) => {
      hasUserInteractionRef.current = false;

      if (!readyRef.current) {
        pendingRemoteContentRef.current = markdown;
        return;
      }

      const currentMarkdown = String(editor.getDocument('markdown') ?? '');
      if (currentMarkdown === markdown) {
        lastSyncedMarkdownRef.current = markdown;
        return;
      }

      applyingRemoteRef.current = true;
      editor.setDocument('markdown', markdown, { keepId: true });
      applyingRemoteRef.current = false;

      lastSyncedMarkdownRef.current = markdown;
      scheduleTocSync();
    },
    [editor, scheduleTocSync],
  );

  const syncToHost = useCallback(() => {
    if (applyingRemoteRef.current) {
      return;
    }

    if (!hasUserInteractionRef.current) {
      return;
    }

    const markdown = String(editor.getDocument('markdown') ?? '');
    if (markdown === lastSyncedMarkdownRef.current) {
      return;
    }

    lastSyncedMarkdownRef.current = markdown;

    vscode.postMessage({
      command: 'edit',
      content: markdown,
    });
  }, [editor]);

  const handleSave = useCallback(() => {
    const markdown = String(editor.getDocument('markdown') ?? '');
    lastSyncedMarkdownRef.current = markdown;

    vscode.postMessage({
      command: 'save',
      content: markdown,
    });
  }, [editor]);

  const handleImageUpload = useCallback(async (file: File): Promise<{ url: string }> => {
    const requestId = createRequestId();
    const dataBase64 = await fileToBase64(file);

    return new Promise<{ url: string }>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        uploadResolversRef.current.delete(requestId);
        reject(new Error(userLanguage.startsWith('zh') ? '图片保存超时，请重试。' : 'Image upload timed out.'));
      }, 30_000);

      uploadResolversRef.current.set(requestId, {
        reject: (reason) => {
          window.clearTimeout(timeout);
          reject(reason);
        },
        resolve: (value) => {
          window.clearTimeout(timeout);
          resolve(value);
        },
      });

      vscode.postMessage({
        command: 'upload-image',
        dataBase64,
        fileName: file.name,
        mimeType: file.type,
        requestId,
      });
    });
  }, [userLanguage]);

  const slashItems = useMemo(() => {
    const data = [
      {
        icon: Heading1Icon,
        key: 'h1',
        label: locale['slash.h1'] || 'Heading 1',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
        },
      },
      {
        icon: Heading2Icon,
        key: 'h2',
        label: locale['slash.h2'] || 'Heading 2',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
        },
      },
      {
        icon: Heading3Icon,
        key: 'h3',
        label: locale['slash.h3'] || 'Heading 3',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h3' });
        },
      },
      { type: 'divider' as const },
      {
        icon: ListTodoIcon,
        key: 'tl',
        label: locale['typobar.taskList'] || 'Task List',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        },
      },
      {
        icon: ListIcon,
        key: 'ul',
        label: locale['typobar.bulletList'] || 'Bulleted list',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        },
      },
      {
        icon: ListOrderedIcon,
        key: 'ol',
        label: locale['typobar.numberList'] || 'Numbered list',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        },
      },
      { type: 'divider' as const },
      {
        icon: MinusIcon,
        key: 'hr',
        label: locale['slash.hr'] || 'Divider',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {});
        },
      },
      {
        icon: Table2Icon,
        key: 'table',
        label: locale['slash.table'] || 'Table',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
        },
      },
      {
        icon: SquareDashedBottomCodeIcon,
        key: 'codeblock',
        label: locale['typobar.codeblock'] || 'Code block',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_CODEMIRROR_COMMAND, undefined);
          queueMicrotask(() => currentEditor.focus());
        },
      },
      {
        icon: SigmaIcon,
        key: 'tex',
        label: locale['slash.tex'] || 'TeX Formula',
        onSelect: (currentEditor: IEditor) => {
          currentEditor.dispatchCommand(INSERT_MATH_COMMAND, { code: 'x^2 + y^2 = z^2' });
          queueMicrotask(() => currentEditor.focus());
        },
      },
    ];

    return data.map((item) => {
      if ('type' in item && item.type === 'divider') return item;

      const current = item as {
        icon: React.ComponentType<any>;
        key: string;
        label: string;
        onSelect: (currentEditor: IEditor) => void;
      };

      return {
        ...current,
        extra: (
          <Text code fontSize={12} type={'secondary'}>
            {current.key}
          </Text>
        ),
        style: {
          minWidth: 220,
        },
      };
    });
  }, [locale]);

  useEffect(() => {
    patchEditorTranslation(editor);

    const lexicalEditor = editor.getLexicalEditor?.();
    if (!lexicalEditor) return;

    let previousContent = JSON.stringify(editor.getDocument('text'));

    const unregister = lexicalEditor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      const currentContent = JSON.stringify(editor.getDocument('text'));
      if (currentContent === previousContent) return;
      previousContent = currentContent;

      syncToHost();
      scheduleTocSync();
    });

    return () => unregister();
  }, [editor, patchEditorTranslation, scheduleTocSync, syncToHost]);

  useEffect(() => {
    return () => {
      if (tocRafRef.current !== undefined) {
        window.cancelAnimationFrame(tocRafRef.current);
      }
      if (activeTocRafRef.current !== undefined) {
        window.cancelAnimationFrame(activeTocRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const isEditorTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest('.editor-frame'));
    };

    const markUserInteraction = (event: Event) => {
      if (!isEditorTarget(event.target)) return;
      hasUserInteractionRef.current = true;
    };

    const events: Array<keyof DocumentEventMap> = [
      'beforeinput',
      'cut',
      'drop',
      'input',
      'keydown',
      'paste',
      'pointerdown',
    ];

    events.forEach((eventName) => {
      document.addEventListener(eventName, markUserInteraction, true);
    });

    return () => {
      events.forEach((eventName) => {
        document.removeEventListener(eventName, markUserInteraction, true);
      });
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      scheduleActiveTocSync();
    };
    const handleSelectionChange = () => {
      scheduleActiveTocSync();
    };

    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('wheel', handleScroll, { capture: true, passive: true });
    window.addEventListener('touchmove', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleScroll);
    scheduleActiveTocSync();

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleScroll, true);
      window.removeEventListener('touchmove', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [scheduleActiveTocSync, tocItems.length]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<HostMessage>) => {
      const message = event.data;
      if (!message || typeof message !== 'object' || !('command' in message)) {
        return;
      }

      if (message.command === 'theme') {
        onThemeChange(message.theme ?? 'light');
        return;
      }

      if (message.command === 'upload-image-result') {
        const resolver = uploadResolversRef.current.get(message.requestId);
        if (!resolver) return;
        uploadResolversRef.current.delete(message.requestId);

        if (message.ok && message.url) {
          resolver.resolve({ url: message.url });
        } else {
          resolver.reject(
            new Error(message.error || (userLanguage.startsWith('zh') ? '图片保存失败。' : 'Image upload failed.')),
          );
        }
        return;
      }

      if (message.command === 'update') {
        if (message.theme) onThemeChange(message.theme);
        if (message.options?.editorMaxWidth) setEditorMaxWidth(message.options.editorMaxWidth);
        if (typeof message.options?.useVscodeThemeColor === 'boolean') {
          setUseVscodeThemeColor(message.options.useVscodeThemeColor);
        }

        if (message.meta?.fileName) setFileName(message.meta.fileName);
        if (typeof message.content === 'string') {
          setEditorMarkdown(message.content);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ command: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
      uploadResolversRef.current.forEach((resolver) => {
        resolver.reject(new Error(userLanguage.startsWith('zh') ? '编辑器已关闭。' : 'Editor closed.'));
      });
      uploadResolversRef.current.clear();
    };
  }, [setEditorMarkdown, onThemeChange, userLanguage]);

  useEffect(() => {
    document.body.dataset.theme = theme;
    document.body.dataset.useVscodeThemeColor = useVscodeThemeColor ? '1' : '0';
  }, [theme, useVscodeThemeColor]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSave = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';
      if (!isSave) return;

      event.preventDefault();
      handleSave();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor?.getAttribute('href')) return;

      event.preventDefault();
      vscode.postMessage({
        command: 'open-link',
        href: anchor.getAttribute('href'),
      });
    };

    document.addEventListener('click', clickHandler);
    return () => {
      document.removeEventListener('click', clickHandler);
    };
  }, []);

  const isMarkdownFile = useMemo(() => /\.(md|markdown)$/i.test(fileName || ''), [fileName]);
  const markdownFileIconSrc = useMemo(
    () => resolveWebviewAssetUrl(theme === 'dark' ? markdownFileWhiteIcon : markdownFileIcon),
    [theme],
  );
  const tocToggleIconSrc = useMemo(() => resolveWebviewAssetUrl(tocToggleIcon), []);

  const handleMainClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.editor-doc-head')) return;
      if (target?.closest('.editor-toc')) return;
      if (target?.closest('.editor-toc-toggle')) return;
      if (target?.closest('.editor-toc-hotspot')) return;
      if (window.getSelection()?.type === 'Range') return;
      editor.focus();
    },
    [editor],
  );

  const handleTocJump = useCallback((id: string) => {
    const headingElement = document.querySelector<HTMLElement>(`[data-toc-id="${id}"]`);
    if (!headingElement) return;
    setActiveTocId(id);
    headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const showToc = tocItems.length > 0;
  const tocDocked = viewportWidth >= editorMaxWidth + 300;
  const tocFloating = showToc && !tocDocked;
  const tocExpanded = showToc && !tocCollapsed;
  const toggleIconStyle = useMemo(
    () =>
      ({
        '--toc-toggle-icon': `url("${tocToggleIconSrc}")`,
      }) as React.CSSProperties,
    [tocToggleIconSrc],
  );

  const openToc = useCallback(() => {
    setTocCollapsed(false);
  }, []);

  const closeTocForHover = useCallback(() => {
    if (!tocFloating) return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    setTocCollapsed(true);
  }, [tocFloating]);

  useEffect(() => {
    if (!showToc) return;
    if (tocDocked) {
      setTocCollapsed(false);
    }
  }, [showToc, tocDocked]);

  return (
    <div className="app-shell" style={{ '--editor-max-width': `${editorMaxWidth}px` } as React.CSSProperties}>
      <main
        className={`editor-main ${tocDocked && tocExpanded ? 'editor-main-has-toc' : ''}`}
        onClick={handleMainClick}
      >
        {showToc && (
          <>
            {tocFloating && tocCollapsed && (
              <div
                aria-hidden="true"
                className="editor-toc-hotspot"
                onMouseEnter={openToc}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  openToc();
                }}
              />
            )}
            <button
              aria-label={tocExpanded ? (userLanguage.startsWith('zh') ? '收起目录' : 'Collapse table of contents') : (userLanguage.startsWith('zh') ? '展开目录' : 'Expand table of contents')}
              className={`editor-toc-toggle ${tocFloating ? 'editor-toc-toggle--floating' : 'editor-toc-toggle--docked'}`}
              type="button"
              style={toggleIconStyle}
              onClick={(event) => {
                event.stopPropagation();
                setTocCollapsed((previous) => !previous);
              }}
              onMouseEnter={tocFloating && tocCollapsed ? openToc : undefined}
            >
              <span aria-hidden="true" className="editor-toc-toggle-icon" />
            </button>
          </>
        )}
        <div className="editor-layout">
          {showToc && (
            <aside
              className={`editor-toc ${tocFloating ? 'editor-toc--floating' : 'editor-toc--docked'} ${tocExpanded ? 'is-open' : 'is-closed'}`}
              onClick={(event) => event.stopPropagation()}
              onMouseLeave={tocFloating ? closeTocForHover : undefined}
            >
              <nav className="editor-toc-list" role="navigation">
                {tocItems.map((item) => (
                  <button
                    key={item.id}
                    className={`editor-toc-item ${activeTocId === item.id ? 'is-active' : ''}`}
                    data-depth={item.depth}
                    data-level={item.level}
                    style={{ '--toc-depth': item.depth } as React.CSSProperties}
                    type="button"
                    onClick={() => handleTocJump(item.id)}
                  >
                    {item.text}
                  </button>
                ))}
              </nav>
            </aside>
          )}
          <div className="editor-content">
            <div className="editor-frame">
              <div className="editor-doc-head">
                <h1 className="editor-doc-title" data-toc-id={showToc ? tocTitleId : undefined}>
                  {isMarkdownFile && (
                    <span aria-hidden="true" className="editor-doc-title-icon">
                      <img alt="" className="editor-doc-title-icon-image" src={markdownFileIconSrc} />
                    </span>
                  )}
                  {titleText}
                </h1>
              </div>
              <Editor
                autoFocus
                content={pendingRemoteContentRef.current ?? ''}
                editor={editor}
                lineEmptyPlaceholder={userLanguage.startsWith('zh') ? '输入 / 调出命令' : 'Type / for commands'}
                plugins={[
                  ReactLiteXmlPlugin,
                  ReactListPlugin,
                  ReactCodePlugin,
                  ReactCodemirrorPlugin,
                  ReactHRPlugin,
                  Editor.withProps(ReactImagePlugin, {
                    defaultBlockImage: true,
                    handleUpload: handleImageUpload,
                  }),
                  ReactLinkPlugin,
                  ReactTablePlugin,
                  ReactMathPlugin,
                  Editor.withProps(ReactToolbarPlugin, {
                    children: (
                      <InlineToolbar floating editor={editor} editorState={editorState} labels={locale} />
                    ),
                  }),
                ]}
                slashOption={{ items: slashItems }}
                style={{
                  minHeight: '100%',
                  paddingBottom: 72,
                }}
                type={'text'}
                onInit={(instance) => {
                  readyRef.current = true;
                  patchEditorTranslation(instance);

                  const pendingContent = pendingRemoteContentRef.current;
                  if (typeof pendingContent === 'string') {
                    applyingRemoteRef.current = true;
                    instance.setDocument('markdown', pendingContent, { keepId: true });
                    applyingRemoteRef.current = false;
                    lastSyncedMarkdownRef.current = pendingContent;
                  }

                  scheduleTocSync();
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ color: 'var(--vscode-errorForeground, #f48771)', fontFamily: 'monospace', padding: '24px' }}>
          <strong>Editor crashed</strong>
          <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const Root = () => {
  const locale = useMemo(() => getEditorLocale(), []);
  const [theme, setTheme] = useState<ThemeType>('light');

  const handleThemeChange = useCallback((nextTheme: ThemeType) => {
    setTheme(nextTheme);
  }, []);

  return (
    <ThemeProvider
      appearance={theme}
      defaultAppearance={theme}
      defaultThemeMode={theme}
      enableCustomFonts={false}
    >
      <ConfigProvider motion={motion}>
        <EditorProvider
          config={{
            locale,
          }}
        >
          <EditorApp onThemeChange={handleThemeChange} theme={theme} />
        </EditorProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
};

const rootNode = document.getElementById('root');
if (!rootNode) {
  throw new Error('Missing #root element');
}

createRoot(rootNode).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
