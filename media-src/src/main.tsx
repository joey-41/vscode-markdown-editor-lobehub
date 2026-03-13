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
import { ConfigProvider, Text as LobeText, ThemeProvider } from '@lobehub/ui';
import { $isTableNode, $isTableRowNode, setScrollableTablesActive } from '@lexical/table';
import {
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  REDO_COMMAND,
  SELECT_ALL_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  SearchIcon,
  ListTodoIcon,
  MinusIcon,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  Table2Icon,
  XIcon,
} from 'lucide-react';
import * as motion from 'motion/react-m';
import React, { Component, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import markdownFileIcon from './assets/file.png';
import markdownFileWhiteIcon from './assets/file-white.png';
import tocToggleIcon from './assets/align-text-justify-svgrepo-com.svg';
import InlineToolbar from './InlineToolbar';
import { enEditorLocale, getEditorLocale } from './locale';
import ReactMermaidCodemirrorPlugin from './MermaidCodemirrorPlugin';

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

interface TableDimensionsSnapshot {
  colWidths?: number[];
  rowHeights: Record<string, number | undefined>;
  structureSignature: string;
}

interface SearchTextSegment {
  end: number;
  node: Text;
  start: number;
}

interface TextSearchMatch {
  range: Range;
  scopeElement: HTMLElement;
}

interface TextSearchResult {
  limitReached: boolean;
  matches: TextSearchMatch[];
}

interface SearchHighlightRegistry {
  delete: (name: string) => void;
  set: (name: string, value: unknown) => void;
}

const CODEMIRROR_SELECTOR = '.cm-container, .cm-textarea, .cm-language-select, .CodeMirror';
const EDITOR_ROOT_SELECTOR = ".editor-frame [data-lexical-editor='true']";
const SEARCH_SCOPE_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th, pre, .cm-content, .cm-line';
const SEARCH_HIGHLIGHT_NAME = 'editor-search-match';
const SEARCH_HIGHLIGHT_ACTIVE_NAME = 'editor-search-current';
const SEARCH_MATCH_LIMIT = 1000;

const readSelectedCodeMirrorText = (target: HTMLElement | null) => {
  const nativeSelection = window.getSelection()?.toString();
  if (nativeSelection) return nativeSelection;

  const codeMirrorElement = target?.closest(CODEMIRROR_SELECTOR) as
    | (HTMLElement & { CodeMirror?: { getSelection?: () => string } })
    | null;
  const codeMirrorInstance = codeMirrorElement?.CodeMirror;
  const codeMirrorSelection = codeMirrorInstance?.getSelection?.();
  if (codeMirrorSelection) return codeMirrorSelection;

  const activeElement = document.activeElement;
  const candidates = [
    activeElement instanceof HTMLTextAreaElement ? activeElement : null,
    ...(target ? Array.from(target.closest(CODEMIRROR_SELECTOR)?.querySelectorAll('textarea') ?? []) : []),
  ];

  for (const textarea of candidates) {
    if (!(textarea instanceof HTMLTextAreaElement)) continue;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (end > start) {
      return textarea.value.slice(start, end);
    }
  }

  return null;
};

const getSearchSeedFromTarget = (target: HTMLElement | null) => {
  const selectedText = readSelectedCodeMirrorText(target) ?? window.getSelection()?.toString() ?? '';
  const normalized = selectedText.replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 200) {
    return undefined;
  }

  return normalized;
};

const copyTextToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.inset = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } finally {
      textarea.remove();
    }
  }
};


const escapeSelectorValue = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/(["\\#.;?+*~':!^$\[\]()=>|/@])/g, '\\$1');
};

const findHashTarget = (href: string) => {
  const rawHash = href.startsWith('#') ? href.slice(1) : href;
  if (!rawHash) return null;

  const decodedHash = decodeURIComponent(rawHash);
  const candidates = Array.from(
    new Set([rawHash, decodedHash, createHeadingAnchorValue(rawHash), createHeadingAnchorValue(decodedHash)]),
  ).filter(Boolean);
  for (const candidate of candidates) {
    const byId = document.getElementById(candidate);
    if (byId) return byId;

    const selector = '[name="' + escapeSelectorValue(candidate) + '"]';
    const byName = document.querySelector<HTMLElement>(selector);
    if (byName) return byName;
  }

  return null;
};

const getEditorRootElement = () => document.querySelector<HTMLElement>(EDITOR_ROOT_SELECTOR);

const clearSearchHighlights = () => {
  const highlightRegistry = (
    globalThis as typeof globalThis & {
      CSS?: { highlights?: SearchHighlightRegistry };
    }
  ).CSS?.highlights;

  highlightRegistry?.delete(SEARCH_HIGHLIGHT_NAME);
  highlightRegistry?.delete(SEARCH_HIGHLIGHT_ACTIVE_NAME);
};

const applySearchHighlights = (matches: TextSearchMatch[], activeIndex: number) => {
  clearSearchHighlights();

  const HighlightCtor = (window as Window & {
    Highlight?: new (...ranges: Range[]) => unknown;
  }).Highlight;
  const highlightRegistry = (
    globalThis as typeof globalThis & {
      CSS?: { highlights?: SearchHighlightRegistry };
    }
  ).CSS?.highlights;

  if (!HighlightCtor || !highlightRegistry || matches.length === 0) {
    return false;
  }

  highlightRegistry.set(
    SEARCH_HIGHLIGHT_NAME,
    new HighlightCtor(...matches.map((item) => item.range.cloneRange())),
  );

  const activeMatch = matches[activeIndex];
  if (activeMatch) {
    highlightRegistry.set(SEARCH_HIGHLIGHT_ACTIVE_NAME, new HighlightCtor(activeMatch.range.cloneRange()));
  }

  return true;
};

const getSearchScopeElement = (textNode: Text, root: HTMLElement) => {
  const parentElement = textNode.parentElement;
  if (!parentElement) return root;

  const scopedElement = parentElement.closest<HTMLElement>(SEARCH_SCOPE_SELECTOR);
  if (scopedElement && root.contains(scopedElement)) {
    return scopedElement;
  }

  let candidate = parentElement;
  while (candidate.parentElement && candidate.parentElement !== root && root.contains(candidate.parentElement)) {
    candidate = candidate.parentElement;
  }

  return candidate;
};

const findSearchSegmentIndex = (segments: SearchTextSegment[], offset: number) => {
  for (let index = 0; index < segments.length; index += 1) {
    if (offset < segments[index].end) {
      return index;
    }
  }

  return Math.max(segments.length - 1, 0);
};

const createSearchRangeFromOffsets = (
  segments: SearchTextSegment[],
  startOffset: number,
  endOffset: number,
) => {
  const startSegment = segments[findSearchSegmentIndex(segments, startOffset)];
  const endSegment = segments[findSearchSegmentIndex(segments, Math.max(startOffset, endOffset - 1))];
  const range = document.createRange();

  range.setStart(startSegment.node, startOffset - startSegment.start);
  range.setEnd(endSegment.node, endOffset - endSegment.start);

  return range;
};

const collectTextSearchResults = (root: HTMLElement, rawQuery: string): TextSearchResult => {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) {
    return { limitReached: false, matches: [] };
  }

  const scopes = new Map<HTMLElement, { segments: SearchTextSegment[]; text: string }>();
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
        if (!node.data) return NodeFilter.FILTER_REJECT;

        const parentElement = node.parentElement;
        if (!parentElement) return NodeFilter.FILTER_REJECT;
        if (parentElement.closest('[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        if (parentElement.closest('.cm-header-toolbar, .cm-language-select, .lobe-float-toolbar')) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const scopeElement = getSearchScopeElement(textNode, root);
    const bucket = scopes.get(scopeElement) ?? { segments: [], text: '' };
    const start = bucket.text.length;

    bucket.text += textNode.data;
    bucket.segments.push({
      end: bucket.text.length,
      node: textNode,
      start,
    });
    scopes.set(scopeElement, bucket);
  }

  const matches: TextSearchMatch[] = [];
  let limitReached = false;

  for (const [scopeElement, bucket] of scopes) {
    if (!bucket.text) continue;

    const haystack = bucket.text.toLocaleLowerCase();
    let fromIndex = 0;

    while (matches.length < SEARCH_MATCH_LIMIT) {
      const matchIndex = haystack.indexOf(query, fromIndex);
      if (matchIndex === -1) break;

      matches.push({
        range: createSearchRangeFromOffsets(bucket.segments, matchIndex, matchIndex + query.length),
        scopeElement,
      });
      fromIndex = matchIndex + Math.max(1, query.length);
    }

    if (matches.length >= SEARCH_MATCH_LIMIT) {
      limitReached = true;
      break;
    }
  }

  return { limitReached, matches };
};

const revealSearchMatch = (match: TextSearchMatch, behavior: ScrollBehavior = 'smooth') => {
  const rect = match.range.getBoundingClientRect();
  const topThreshold = 88;
  const bottomThreshold = window.innerHeight - 40;

  if (rect.height > 0 && rect.top >= topThreshold && rect.bottom <= bottomThreshold) {
    return;
  }

  match.scopeElement.scrollIntoView({
    behavior,
    block: 'center',
    inline: 'nearest',
  });
};

const navigateToHash = (href: string) => {
  const target = findHashTarget(href);
  if (!target) return false;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (typeof history !== 'undefined') {
    history.replaceState(null, '', href);
  }

  return true;
};


const createHeadingAnchorValue = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const createHeadingAnchorId = (text: string, counts: Map<string, number>) => {
  const base = createHeadingAnchorValue(text) || 'section';
  const nextCount = counts.get(base) ?? 0;
  counts.set(base, nextCount + 1);
  return nextCount === 0 ? base : base + '-' + nextCount;
};

const cloneTableDimensionsSnapshot = (
  snapshot: TableDimensionsSnapshot,
): TableDimensionsSnapshot => ({
  colWidths: snapshot.colWidths ? [...snapshot.colWidths] : undefined,
  rowHeights: { ...snapshot.rowHeights },
  structureSignature: snapshot.structureSignature,
});

const areNumberArraysEqual = (a?: number[], b?: number[]) => {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }

  return true;
};

const areRowHeightsEqual = (
  a: Record<string, number | undefined>,
  b: Record<string, number | undefined>,
) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!(key in b)) return false;
    if (a[key] !== b[key]) return false;
  }

  return true;
};

const hasTableDimensionsDifference = (a: TableDimensionsSnapshot, b: TableDimensionsSnapshot) =>
  a.structureSignature !== b.structureSignature ||
  !areNumberArraysEqual(a.colWidths, b.colWidths) ||
  !areRowHeightsEqual(a.rowHeights, b.rowHeights);

const getTableStructureSignature = (tableNode: { getChildren: () => any[]; getColumnCount: () => number }) => {
  const rows = tableNode.getChildren().filter($isTableRowNode);
  return `${tableNode.getColumnCount()}:${rows.length}:${rows.map((row) => row.getChildren().length).join(',')}`;
};

const collectTableDimensionsSnapshots = () => {
  const snapshots = new Map<string, TableDimensionsSnapshot>();

  const visit = (node: any) => {
    if ($isTableNode(node)) {
      const rows = node.getChildren().filter($isTableRowNode);
      const rowHeights = Object.fromEntries(rows.map((row) => [row.getKey(), row.getHeight()]));

      snapshots.set(node.getKey(), {
        colWidths: node.getColWidths() ? [...node.getColWidths()!] : undefined,
        rowHeights,
        structureSignature: getTableStructureSignature(node),
      });
      return;
    }

    if (!$isElementNode(node)) return;
    node.getChildren().forEach(visit);
  };

  visit($getRoot());
  return snapshots;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [searchLimitReached, setSearchLimitReached] = useState(false);
  const [searchRefreshVersion, setSearchRefreshVersion] = useState(0);
  const deferredSearchQuery = useDeferredValue(searchQuery);
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
  const searchRefreshRafRef = useRef<number | undefined>(undefined);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchMatchesRef = useRef<TextSearchMatch[]>([]);
  const searchOpenRef = useRef(false);
  const searchQueryRef = useRef('');
  const uploadResolversRef = useRef(
    new Map<string, { reject: (reason?: unknown) => void; resolve: (value: { url: string }) => void }>(),
  );
  const cachedTableDimensionsRef = useRef(new Map<string, TableDimensionsSnapshot>());
  const lastObservedTableDimensionsRef = useRef(new Map<string, TableDimensionsSnapshot>());
  const isRestoringTableDimensionsRef = useRef(false);
  const normalizedSearchQuery = deferredSearchQuery.trim();

  const scheduleSearchRefresh = useCallback(() => {
    if (!searchOpenRef.current || !searchQueryRef.current.trim()) {
      return;
    }

    if (searchRefreshRafRef.current !== undefined) {
      window.cancelAnimationFrame(searchRefreshRafRef.current);
    }

    searchRefreshRafRef.current = window.requestAnimationFrame(() => {
      setSearchRefreshVersion((previous) => previous + 1);
      searchRefreshRafRef.current = undefined;
    });
  }, []);

  const focusSearchInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const openSearch = useCallback(
    (seedQuery?: string) => {
      const nextQuery = seedQuery?.trim();
      setSearchOpen(true);
      if (nextQuery) {
        setSearchQuery(nextQuery);
      }
      focusSearchInput();
    },
    [focusSearchInput],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    clearSearchHighlights();
  }, []);

  const jumpToSearchMatch = useCallback((direction: 1 | -1) => {
    setSearchActiveIndex((previous) => {
      if (searchMatchCount <= 0) return 0;
      const next = previous + direction;
      if (next < 0) return searchMatchCount - 1;
      if (next >= searchMatchCount) return 0;
      return next;
    });
  }, [searchMatchCount]);

  const focusEditorWithoutScrolling = useCallback(() => {
    const previousScrollX = window.scrollX;
    const previousScrollY = window.scrollY;

    window.requestAnimationFrame(() => {
      const editorRoot = getEditorRootElement();

      if (editorRoot) {
        try {
          editorRoot.focus({ preventScroll: true });
        } catch {
          editorRoot.focus();
          window.scrollTo(previousScrollX, previousScrollY);
        }
        return;
      }

      editor.focus();
      window.scrollTo(previousScrollX, previousScrollY);
    });
  }, [editor]);

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

    const headingAnchorCounts = new Map<string, number>();
    const nextItems: TocItem[] = extracted.map((item, index) => {
      const id = `toc-heading-${index}`;
      const anchorId = createHeadingAnchorId(item.text, headingAnchorCounts);
      item.node.dataset.tocId = id;
      item.node.id = anchorId;
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
      node.removeAttribute('id');
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

  useEffect(() => {
    searchOpenRef.current = searchOpen;
  }, [searchOpen]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    setSearchActiveIndex(0);
  }, [normalizedSearchQuery]);

  useEffect(() => {
    if (!searchOpen) {
      searchMatchesRef.current = [];
      setSearchMatchCount(0);
      setSearchLimitReached(false);
      clearSearchHighlights();
      return;
    }

    if (!normalizedSearchQuery) {
      searchMatchesRef.current = [];
      setSearchMatchCount(0);
      setSearchLimitReached(false);
      clearSearchHighlights();
      return;
    }

    const editorRoot = getEditorRootElement();
    if (!editorRoot) {
      searchMatchesRef.current = [];
      setSearchMatchCount(0);
      setSearchLimitReached(false);
      clearSearchHighlights();
      return;
    }

    const { limitReached, matches } = collectTextSearchResults(editorRoot, normalizedSearchQuery);
    searchMatchesRef.current = matches;
    setSearchMatchCount(matches.length);
    setSearchLimitReached(limitReached);
    setSearchActiveIndex((previous) => (matches.length === 0 ? 0 : Math.min(previous, matches.length - 1)));
  }, [normalizedSearchQuery, searchOpen, searchRefreshVersion]);

  useEffect(() => {
    if (!searchOpen || !normalizedSearchQuery) {
      clearSearchHighlights();
      return;
    }

    const matches = searchMatchesRef.current;
    if (matches.length === 0) {
      clearSearchHighlights();
      return;
    }

    applySearchHighlights(matches, searchActiveIndex);
    const activeMatch = matches[searchActiveIndex];
    if (activeMatch) {
      revealSearchMatch(activeMatch, 'smooth');
    }
  }, [normalizedSearchQuery, searchActiveIndex, searchMatchCount, searchOpen]);

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
      scheduleSearchRefresh();
    },
    [editor, scheduleSearchRefresh, scheduleTocSync],
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
          <LobeText code fontSize={12} type={'secondary'}>
            {current.key}
          </LobeText>
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
    lastObservedTableDimensionsRef.current = lexicalEditor.getEditorState().read(() => collectTableDimensionsSnapshots());

    const unregister = lexicalEditor.registerUpdateListener(({ dirtyElements, dirtyLeaves, editorState, tags }) => {
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

      let currentTableSnapshots = new Map<string, TableDimensionsSnapshot>();
      editorState.read(() => {
        currentTableSnapshots = collectTableDimensionsSnapshots();
      });

      const isHistoricUpdate = tags.has(HISTORIC_TAG);
      const cachedTableDimensions = cachedTableDimensionsRef.current;
      const previousTableSnapshots = lastObservedTableDimensionsRef.current;

      if (isRestoringTableDimensionsRef.current) {
        isRestoringTableDimensionsRef.current = false;
      } else if (!applyingRemoteRef.current) {
        if (isHistoricUpdate) {
          const tablesToRestore = Array.from(cachedTableDimensions.entries()).filter(([tableKey, cachedSnapshot]) => {
            const current = currentTableSnapshots.get(tableKey);
            if (!current) return false;
            if (current.structureSignature !== cachedSnapshot.structureSignature) return false;

            return hasTableDimensionsDifference(current, cachedSnapshot);
          });

          if (tablesToRestore.length > 0) {
            isRestoringTableDimensionsRef.current = true;
            queueMicrotask(() => {
              lexicalEditor.update(
                () => {
                  for (const [tableKey, cachedSnapshot] of tablesToRestore) {
                    const tableNode = $getNodeByKey(tableKey);
                    if (!$isTableNode(tableNode)) continue;
                    if (getTableStructureSignature(tableNode) !== cachedSnapshot.structureSignature) continue;

                    tableNode.setColWidths(cachedSnapshot.colWidths ? [...cachedSnapshot.colWidths] : undefined);

                    for (const row of tableNode.getChildren().filter($isTableRowNode)) {
                      row.setHeight(cachedSnapshot.rowHeights[row.getKey()]);
                    }
                  }
                },
                { tag: HISTORY_MERGE_TAG },
              );
            });
          }
        } else {
          for (const tableKey of cachedTableDimensions.keys()) {
            if (!currentTableSnapshots.has(tableKey)) {
              cachedTableDimensions.delete(tableKey);
            }
          }

          for (const [tableKey, current] of currentTableSnapshots) {
            const previous = previousTableSnapshots.get(tableKey);
            const cachedSnapshot = cachedTableDimensions.get(tableKey);

            if (cachedSnapshot && cachedSnapshot.structureSignature !== current.structureSignature) {
              cachedTableDimensions.delete(tableKey);
            }

            if (previous && hasTableDimensionsDifference(previous, current)) {
              cachedTableDimensions.set(tableKey, cloneTableDimensionsSnapshot(current));
            }
          }
        }
      }

      lastObservedTableDimensionsRef.current = currentTableSnapshots;

      const currentContent = JSON.stringify(editor.getDocument('text'));
      if (currentContent === previousContent) return;
      previousContent = currentContent;

      syncToHost();
      scheduleTocSync();
      scheduleSearchRefresh();
    });

    return () => unregister();
  }, [editor, patchEditorTranslation, scheduleSearchRefresh, scheduleTocSync, syncToHost]);

  useEffect(() => {
    return () => {
      if (tocRafRef.current !== undefined) {
        window.cancelAnimationFrame(tocRafRef.current);
      }
      if (activeTocRafRef.current !== undefined) {
        window.cancelAnimationFrame(activeTocRafRef.current);
      }
      if (searchRefreshRafRef.current !== undefined) {
        window.cancelAnimationFrame(searchRefreshRafRef.current);
      }
      clearSearchHighlights();
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
      const target = event.target instanceof HTMLElement ? event.target : null;
      const key = event.key.toLowerCase();
      const hasPrimaryModifier = event.metaKey || event.ctrlKey;
      const isInCodeMirror = Boolean(target?.closest(CODEMIRROR_SELECTOR));
      const isInEditorArea = Boolean(target?.closest(EDITOR_ROOT_SELECTOR));
      const hasSearchQuery = Boolean(searchQueryRef.current.trim());
      const canNavigateSearch = searchOpenRef.current && hasSearchQuery;

      if (hasPrimaryModifier && key === 'f') {
        event.preventDefault();
        openSearch(target?.closest('.editor-search') ? undefined : getSearchSeedFromTarget(target));
        return;
      }

      if ((hasPrimaryModifier && key === 'g') || (key === 'f3' && canNavigateSearch)) {
        if (!canNavigateSearch) return;
        event.preventDefault();
        jumpToSearchMatch(event.shiftKey ? -1 : 1);
        return;
      }

      if (key === 'escape' && searchOpenRef.current && !target?.closest('.editor-search')) {
        if (isInCodeMirror) {
          return;
        }

        event.preventDefault();
        closeSearch();
        return;
      }

      if (!hasPrimaryModifier) return;

      const isSave = key === 's';
      if (isSave) {
        event.preventDefault();
        handleSave();
        return;
      }

      if (isInCodeMirror) {
        return;
      }

      if (!isInEditorArea) return;

      const lexicalEditor = editor.getLexicalEditor?.();
      if (!lexicalEditor) return;

      const isSelectAll = key === 'a';
      if (isSelectAll) {
        event.preventDefault();
        lexicalEditor.dispatchCommand(SELECT_ALL_COMMAND, event);
        return;
      }

      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
      if (isUndo || isRedo) {
        event.preventDefault();
        lexicalEditor.dispatchCommand(isUndo ? UNDO_COMMAND : REDO_COMMAND, undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [closeSearch, editor, handleSave, jumpToSearchMatch, openSearch]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isInCodeMirror = Boolean(target?.closest(CODEMIRROR_SELECTOR));
      if (!isInCodeMirror) return;

      const selectedText = readSelectedCodeMirrorText(target);
      if (!selectedText) return;

      if (event.clipboardData) {
        event.preventDefault();
        event.clipboardData.setData('text/plain', selectedText);
        return;
      }

      void copyTextToClipboard(selectedText);
    };

    document.addEventListener('copy', handleCopy, true);
    return () => document.removeEventListener('copy', handleCopy, true);
  }, []);

  useEffect(() => {
    const nativeWindowOpen = window.open.bind(window);

    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (!url) {
        return nativeWindowOpen(url as string | URL, target, features);
      }

      const href = String(url).trim();
      if (!href || /^(about:blank|javascript:)/i.test(href)) {
        return nativeWindowOpen(url as string | URL, target, features);
      }

      vscode.postMessage({
        command: 'open-link',
        href,
      });

      return null;
    }) as typeof window.open;

    return () => {
      window.open = nativeWindowOpen;
    };
  }, []);

  useEffect(() => {
    const clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href')?.trim();
      if (!href) return;

      if (href.startsWith('#') && navigateToHash(href)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      vscode.postMessage({
        command: 'open-link',
        href,
      });
    };

    document.addEventListener('click', clickHandler, true);
    return () => {
      document.removeEventListener('click', clickHandler, true);
    };
  }, []);

  const isMarkdownFile = useMemo(() => /\.(md|markdown)$/i.test(fileName || ''), [fileName]);
  const markdownFileIconSrc = useMemo(
    () => resolveWebviewAssetUrl(theme === 'dark' ? markdownFileWhiteIcon : markdownFileIcon),
    [theme],
  );
  const tocToggleIconSrc = useMemo(() => resolveWebviewAssetUrl(tocToggleIcon), []);
  const searchHasResults = searchMatchCount > 0;
  const searchResultLabel = useMemo(() => {
    if (!normalizedSearchQuery) {
      return locale['search.idle'] || 'Type to search';
    }

    if (searchMatchCount === 0) {
      return locale['search.noResults'] || 'No results';
    }

    const totalLabel = searchLimitReached ? `${searchMatchCount}+` : String(searchMatchCount);
    return `${Math.min(searchActiveIndex + 1, searchMatchCount)}/${totalLabel}`;
  }, [locale, normalizedSearchQuery, searchActiveIndex, searchLimitReached, searchMatchCount]);

  const handleMainClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.editor-doc-head')) return;
      if (target?.closest('.editor-toc')) return;
      if (target?.closest('.editor-toc-toggle')) return;
      if (target?.closest('.editor-toc-hotspot')) return;
      if (target?.closest('.mermaid-preview-panel')) return;
      if (target?.closest('.mermaid-preview-canvas')) return;
      if (target?.closest('.cm-header-toolbar')) return;
      if (target?.closest('.cm-container')) return;
      if (target?.closest('.cm-language-select')) return;
      if (target?.closest('.cm-textarea')) return;
      if (target?.closest(".editor-frame [data-lexical-editor='true']")) return;
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
        {searchOpen && (
          <div
            className="editor-search"
            role="search"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span aria-hidden="true" className="editor-search-icon">
              <SearchIcon size={15} strokeWidth={1.9} />
            </span>
            <input
              ref={searchInputRef}
              aria-label={locale['search.placeholder'] || 'Find in document'}
              className="editor-search-input"
              placeholder={locale['search.placeholder'] || 'Find in document'}
              spellCheck={false}
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  jumpToSearchMatch(event.shiftKey ? -1 : 1);
                  return;
                }

                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeSearch();
                  focusEditorWithoutScrolling();
                }
              }}
            />
            <span className={`editor-search-count ${searchHasResults ? '' : 'is-empty'}`}>
              {searchResultLabel}
            </span>
            <button
              aria-label={locale['search.previous'] || 'Previous result'}
              className="editor-search-action"
              disabled={!searchHasResults}
              type="button"
              onClick={() => jumpToSearchMatch(-1)}
            >
              <ChevronUpIcon size={16} strokeWidth={1.9} />
            </button>
            <button
              aria-label={locale['search.next'] || 'Next result'}
              className="editor-search-action"
              disabled={!searchHasResults}
              type="button"
              onClick={() => jumpToSearchMatch(1)}
            >
              <ChevronDownIcon size={16} strokeWidth={1.9} />
            </button>
            <button
              aria-label={locale['search.close'] || 'Close search'}
              className="editor-search-action"
              type="button"
              onClick={() => {
                closeSearch();
                focusEditorWithoutScrolling();
              }}
            >
              <XIcon size={16} strokeWidth={1.9} />
            </button>
          </div>
        )}
        <div className="editor-layout">
          {showToc && (
            <aside
              className={`editor-toc ${tocFloating ? 'editor-toc--floating' : 'editor-toc--docked'} ${tocExpanded ? 'is-open' : 'is-closed'}`}
              onClick={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
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
                  ReactMermaidCodemirrorPlugin,
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
                  const lexicalEditor = instance.getLexicalEditor?.();
                  if (lexicalEditor) {
                    setScrollableTablesActive(lexicalEditor, false);
                  }

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
