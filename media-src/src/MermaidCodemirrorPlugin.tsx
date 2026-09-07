import { useLexicalComposerContext } from '@lobehub/editor/es/editor-kernel/react';
import { MODES } from '@lobehub/editor/es/plugins/codemirror-block/lib/mode';
import type { CodeMirrorNode } from '@lobehub/editor/es/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@lobehub/editor/es/plugins/codemirror-block/plugin';
import ReactCodemirrorNode from '@lobehub/editor/es/plugins/codemirror-block/react/CodemirrorNode';
import mermaid from 'mermaid';
import type { LexicalEditor } from 'lexical';
import { Maximize2Icon, Minimize2Icon, RotateCcwIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import React, { type FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

type ThemeType = 'dark' | 'light';

interface ReactMermaidCodemirrorPluginProps {
  className?: string;
}

interface MermaidCodemirrorNodeProps {
  className?: string;
  editor: LexicalEditor;
  node: CodeMirrorNode;
}

const MERMAID_MODE_VALUE = 'mermaid';

const ensureMermaidMode = () => {
  const existed = MODES.some((mode) => mode.value === MERMAID_MODE_VALUE);
  if (existed) return;

  MODES.push({
    ext: ['mermaid', 'mmd'],
    name: 'Mermaid',
    syntax: 'markdown',
    value: MERMAID_MODE_VALUE,
  });
};

const isMermaidLanguage = (language?: string) => {
  const normalized = language?.trim().toLowerCase();
  return normalized === 'mermaid' || normalized === 'mmd';
};

const useBodyTheme = (): ThemeType => {
  const [theme, setTheme] = useState<ThemeType>(
    () => (document.body.dataset.theme === 'dark' ? 'dark' : 'light'),
  );

  useEffect(() => {
    const updateTheme = () => {
      setTheme(document.body.dataset.theme === 'dark' ? 'dark' : 'light');
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, {
      attributeFilter: ['data-theme'],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return theme;
};

let initializedMermaidTheme: ThemeType | null = null;

const initMermaid = (theme: ThemeType) => {
  if (initializedMermaidTheme === theme) return;

  mermaid.initialize({
    securityLevel: 'strict',
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: theme === 'dark' ? 'dark' : 'default',
  });

  initializedMermaidTheme = theme;
};

const MermaidPreview: FC<{ code: string }> = ({ code }) => {
  const theme = useBodyTheme();
  const isZh = useMemo(() => navigator.language.toLowerCase().startsWith('zh'), []);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isPointerDownRef = useRef(false);
  const renderTokenRef = useRef(0);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(4, Math.round((prev + 0.2) * 10) / 10));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.2, Math.round((prev - 0.2) * 10) / 10));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (scale !== 1 || position.x !== 0 || position.y !== 0) {
      resetZoom();
    } else {
      setScale(1.6);
    }
  }, [position.x, position.y, resetZoom, scale]);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (event.ctrlKey || event.metaKey || scale !== 1 || isFullscreen) {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.deltaY < 0 ? 0.15 : -0.15;
        setScale((prev) => Math.min(4, Math.max(0.2, Number((prev + delta).toFixed(2)))));
      }
    },
    [isFullscreen, scale],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    isPointerDownRef.current = true;
    dragStartRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setIsDragging(true);
  }, [position.x, position.y]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!isPointerDownRef.current) return;
    setPosition({
      x: event.clientX - dragStartRef.current.x,
      y: event.clientY - dragStartRef.current.y,
    });
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    isPointerDownRef.current = false;
    setIsDragging(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFullscreen]);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const source = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!source) {
      target.innerHTML = '';
      setIsEmpty(true);
      setError(null);
      return;
    }

    setIsEmpty(false);
    setError(null);

    renderTokenRef.current += 1;
    const currentToken = renderTokenRef.current;

    void (async () => {
      try {
        initMermaid(theme);
        const { bindFunctions, svg } = await mermaid.render(
          `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          source,
        );

        if (!containerRef.current || currentToken !== renderTokenRef.current) return;

        containerRef.current.innerHTML = svg;
        bindFunctions?.(containerRef.current);
      } catch (reason) {
        if (!containerRef.current || currentToken !== renderTokenRef.current) return;

        containerRef.current.innerHTML = '';
        setError(
          reason instanceof Error
            ? reason.message
            : isZh
              ? 'Mermaid 渲染失败'
              : 'Failed to render Mermaid diagram',
        );
      }
    })();
  }, [code, isZh, theme]);

  return (
    <section
      className={`mermaid-preview-panel ${isFullscreen ? 'mermaid-preview-panel--fullscreen' : ''}`}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header className="mermaid-preview-header">
        <span className="mermaid-preview-title">
          {isZh ? 'Mermaid 流程图预览' : 'Mermaid Diagram Preview'}
        </span>
        {!isEmpty && !error && (
          <div className="mermaid-preview-toolbar">
            <button
              aria-label={isZh ? '缩小' : 'Zoom out'}
              className="mermaid-preview-btn"
              disabled={scale <= 0.2}
              title={isZh ? '缩小 (Ctrl/Cmd + 滚轮向下)' : 'Zoom out'}
              type="button"
              onClick={zoomOut}
            >
              <ZoomOutIcon size={14} />
            </button>
            <span
              className="mermaid-preview-scale-text"
              title={isZh ? '点击还原 100%' : 'Click to reset to 100%'}
              onClick={resetZoom}
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              aria-label={isZh ? '放大' : 'Zoom in'}
              className="mermaid-preview-btn"
              disabled={scale >= 4}
              title={isZh ? '放大 (Ctrl/Cmd + 滚轮向上)' : 'Zoom in'}
              type="button"
              onClick={zoomIn}
            >
              <ZoomInIcon size={14} />
            </button>
            <button
              aria-label={isZh ? '还原比例' : 'Reset view'}
              className="mermaid-preview-btn"
              title={isZh ? '还原视图' : 'Reset view'}
              type="button"
              onClick={resetZoom}
            >
              <RotateCcwIcon size={13} />
            </button>
            <button
              aria-label={
                isFullscreen ? (isZh ? '退出全屏' : 'Exit fullscreen') : isZh ? '全屏查看' : 'Fullscreen'
              }
              className="mermaid-preview-btn"
              title={
                isFullscreen
                  ? isZh
                    ? '退出全屏 (Esc)'
                    : 'Exit fullscreen'
                  : isZh
                    ? '全屏查看'
                    : 'Fullscreen'
              }
              type="button"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2Icon size={14} /> : <Maximize2Icon size={14} />}
            </button>
          </div>
        )}
      </header>
      <div className="mermaid-preview-body">
        {isEmpty ? (
          <div className="mermaid-preview-empty">
            {isZh ? 'Mermaid 代码块为空' : 'Mermaid block is empty'}
          </div>
        ) : (
          <div
            className={`mermaid-preview-viewport ${scale !== 1 || isFullscreen ? 'is-grabbable' : ''} ${isDragging ? 'is-dragging' : ''}`}
            ref={viewportRef}
            onDoubleClick={handleDoubleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          >
            <div
              className="mermaid-preview-content"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 120ms cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              <div className="mermaid-preview-canvas" ref={containerRef} />
            </div>
          </div>
        )}
        {error && <div className="mermaid-preview-error">{error}</div>}
      </div>
    </section>
  );
};

const MermaidCodemirrorNode: FC<MermaidCodemirrorNodeProps> = ({ className, editor, node }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autoCollapsedRef = useRef(false);

  useEffect(() => {
    if (autoCollapsedRef.current) return;

    const timer = window.setTimeout(() => {
      if (autoCollapsedRef.current) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const container = wrapper.querySelector<HTMLElement>('.cm-container');
      const toolbar = wrapper.querySelector<HTMLElement>('.cm-header-toolbar');

      if (toolbar && container && !container.classList.contains('cm-container-collapsed')) {
        autoCollapsedRef.current = true;
        toolbar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    }, 60);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="mermaid-codeblock" ref={wrapperRef}>
      <ReactCodemirrorNode className={className} editor={editor} node={node} />
      <MermaidPreview code={node.code} />
    </div>
  );
};

const ReactMermaidCodemirrorPlugin: FC<ReactMermaidCodemirrorPluginProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    ensureMermaidMode();

    editor.registerPlugin(CodemirrorPlugin, {
      decorator: (node: CodeMirrorNode, lexicalEditor: LexicalEditor) => {
        if (isMermaidLanguage(node.lang)) {
          return <MermaidCodemirrorNode className={className} editor={lexicalEditor} node={node} />;
        }

        return <ReactCodemirrorNode className={className} editor={lexicalEditor} node={node} />;
      },
      theme: className,
    });
  }, [className, editor]);

  return null;
};

ReactMermaidCodemirrorPlugin.displayName = 'ReactMermaidCodemirrorPlugin';

export default ReactMermaidCodemirrorPlugin;
