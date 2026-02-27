import { useLexicalComposerContext } from '@lobehub/editor/es/editor-kernel/react';
import { MODES } from '@lobehub/editor/es/plugins/codemirror-block/lib/mode';
import type { CodeMirrorNode } from '@lobehub/editor/es/plugins/codemirror-block/node/CodeMirrorNode';
import { CodemirrorPlugin } from '@lobehub/editor/es/plugins/codemirror-block/plugin';
import ReactCodemirrorNode from '@lobehub/editor/es/plugins/codemirror-block/react/CodemirrorNode';
import mermaid from 'mermaid';
import type { LexicalEditor } from 'lexical';
import React, { type FC, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTokenRef = useRef(0);

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
    <div className="mermaid-preview-body">
      {isEmpty ? (
        <div className="mermaid-preview-empty">{isZh ? 'Mermaid 代码块为空' : 'Mermaid block is empty'}</div>
      ) : (
        <div className="mermaid-preview-canvas" ref={containerRef} />
      )}
      {error && <div className="mermaid-preview-error">{error}</div>}
    </div>
  );
};

const MermaidCodemirrorNode: FC<MermaidCodemirrorNodeProps> = ({ className, editor, node }) => {
  const isZh = useMemo(() => navigator.language.toLowerCase().startsWith('zh'), []);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const autoCollapsedRef = useRef(false);

  useEffect(() => {
    if (autoCollapsedRef.current) return;

    let cancelled = false;
    let tries = 0;

    const collapseEditor = () => {
      if (cancelled || autoCollapsedRef.current) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const container = wrapper.querySelector<HTMLElement>('.cm-container');
      const toolbar = wrapper.querySelector<HTMLElement>('.cm-header-toolbar');

      if (!container || !toolbar) {
        if (tries < 20) {
          tries += 1;
          window.setTimeout(collapseEditor, 60);
        }
        return;
      }

      if (container.classList.contains('cm-container-collapsed')) {
        autoCollapsedRef.current = true;
        return;
      }

      toolbar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

      window.setTimeout(() => {
        if (cancelled || autoCollapsedRef.current) return;

        const nextContainer = wrapperRef.current?.querySelector<HTMLElement>('.cm-container');
        if (nextContainer?.classList.contains('cm-container-collapsed')) {
          autoCollapsedRef.current = true;
          return;
        }

        if (tries < 20) {
          tries += 1;
          collapseEditor();
        }
      }, 80);
    };

    const raf = window.requestAnimationFrame(collapseEditor);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="mermaid-codeblock" ref={wrapperRef}>
      <ReactCodemirrorNode className={className} editor={editor} node={node} />
      <section
        className="mermaid-preview-panel"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="mermaid-preview-header">
          {isZh ? 'Mermaid 流程图预览' : 'Mermaid Diagram Preview'}
        </header>
        <MermaidPreview code={node.code} />
      </section>
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
