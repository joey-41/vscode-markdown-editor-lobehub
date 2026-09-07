import { mergeRegister } from '@lexical/utils';
import { ActionIconGroup } from '@lobehub/ui';
import {
  $createRangeSelection,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_NORMAL,
  type LexicalEditor,
} from 'lexical';
import { EditIcon, ExternalLinkIcon, UnlinkIcon } from 'lucide-react';
import React, { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';

import PortalAnchor from '@lobehub/editor/es/editor-kernel/react/PortalAnchor';
import { useLexicalComposerContext } from '@lobehub/editor/es/editor-kernel/react/react-context';
import { useLexicalEditor } from '@lobehub/editor/es/editor-kernel/react/useLexicalEditor';
import { useEditable } from '@lobehub/editor/es/editor-kernel/react/useEditable';
import { useTranslation } from '@lobehub/editor/es/editor-kernel/react/useTranslation';
import LinkEdit, { EDIT_LINK_COMMAND } from '@lobehub/editor/es/plugins/link/react/components/LinkEdit';
import {
  $isLinkNode,
  HOVER_LINK_COMMAND,
  HOVER_OUT_LINK_COMMAND,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '@lobehub/editor/es/plugins/link/node/LinkNode';
import { LinkPlugin } from '@lobehub/editor/es/plugins/link/plugin';
import { ILinkService } from '@lobehub/editor/es/plugins/link/service/i-link-service';
import { styles } from '@lobehub/editor/es/plugins/link/react/style';
import { MarkdownPlugin } from '@lobehub/editor/es/plugins/markdown/plugin';
import { cleanPosition, updatePosition } from '@lobehub/editor/es/utils/updatePosition';

interface CustomLinkPluginProps {
  attributes?: Record<string, string>;
  enableHotkey?: boolean;
  theme?: any;
  validateUrl?: (url: string) => boolean;
}

const CustomLinkToolbar = memo<{ editor: LexicalEditor; enable: boolean }>(({ editor, enable }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLElement | null>(null);
  const [linkNode, setLinkNode] = useState<LinkNode | null>(null);
  const t = useTranslation();
  const clearTimerRef = useRef<any>(-1);
  const { editable } = useEditable();

  const handleEdit = useCallback(() => {
    if (!linkNode) return;
    const dom = editor.getElementByKey(linkNode.getKey());
    if (!dom) return;

    editor.dispatchCommand(EDIT_LINK_COMMAND, {
      linkNode,
      linkNodeDOM: dom,
    });
  }, [editor, linkNode]);

  const handleCancel = useCallback(() => {
    clearTimeout(clearTimerRef.current);
    if (divRef.current) {
      cleanPosition(divRef.current);
    }
  }, []);

  const handleRemove = useCallback(() => {
    if (!linkNode) return;
    editor.update(() => {
      const node = $getNodeByKey(linkNode.getKey());
      if (!$isLinkNode(node)) return;

      const selection = $getSelection();
      let activeSelection = selection;
      if (!activeSelection || !$isRangeSelection(activeSelection)) {
        $setSelection($createRangeSelection());
        activeSelection = $getSelection();
      }

      const first = node.getFirstDescendant();
      const last = node.getLastDescendant();
      if (activeSelection && $isRangeSelection(activeSelection) && $isTextNode(first) && $isTextNode(last)) {
        activeSelection.anchor.set(first.getKey(), 0, 'text');
        activeSelection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        return;
      }

      const children = node.getChildren();
      for (const child of children) {
        node.insertBefore(child);
      }
      node.remove();
    });
  }, [editor, linkNode]);

  const handleOpenLink = useCallback(() => {
    if (!linkNode) return;
    const url = editor.getEditorState().read(() => linkNode.getURL());
    if (url) {
      window.open(url, '_blank');
    }
  }, [editor, linkNode]);

  useLexicalEditor((lexicalInstance) => {
    if (!editable) return;

    return mergeRegister(
      lexicalInstance.registerCommand(
        HOVER_LINK_COMMAND,
        (payload: any) => {
          if (!enable) return false;
          if (!payload?.event?.target || !divRef.current) return false;

          clearTimeout(clearTimerRef.current);
          setLinkNode(payload.linkNode);
          updatePosition({
            callback: () => {
              linkRef.current = payload.event.target;
            },
            floating: divRef.current,
            offset: 4,
            placement: 'top-start',
            reference: payload.event.target,
          });
          return false;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
      lexicalInstance.registerCommand(
        HOVER_OUT_LINK_COMMAND,
        () => {
          clearTimerRef.current = setTimeout(handleCancel, 300);
          return true;
        },
        COMMAND_PRIORITY_NORMAL,
      ),
    );
  }, [enable, editable, handleCancel]);

  return (
    <ActionIconGroup
      className={styles.linkToolbar}
      items={[
        {
          icon: EditIcon,
          key: 'edit',
          label: t('link.edit') || 'Edit link',
          onClick: handleEdit,
        },
        {
          icon: ExternalLinkIcon,
          key: 'openLink',
          label: t('link.open') || 'Open link',
          onClick: handleOpenLink,
        },
        {
          icon: UnlinkIcon,
          key: 'unlink',
          label: t('link.unlink') || 'Unlink',
          onClick: () => {
            handleRemove();
            handleCancel();
          },
        },
      ]}
      onMouseEnter={() => {
        clearTimeout(clearTimerRef.current);
      }}
      onMouseLeave={handleCancel}
      ref={divRef as any}
      shadow
      size={{
        blockSize: 32,
        size: 16,
      }}
      variant="outlined"
    />
  );
});

CustomLinkToolbar.displayName = 'CustomLinkToolbar';

export const CustomLinkPlugin: React.FC<CustomLinkPluginProps> = ({
  attributes,
  enableHotkey = true,
  theme,
  validateUrl,
}) => {
  const [enableToolbar, setEnableToolbar] = useState(false);
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(LinkPlugin, {
      attributes,
      enableHotkey,
      theme: theme || styles,
      validateUrl,
    });
  }, [attributes, editor, enableHotkey, theme, validateUrl]);

  useLexicalEditor(() => {
    try {
      const linkService = editor.requireService(ILinkService) as any;
      if (linkService) {
        setEnableToolbar(Boolean(linkService.enableLinkToolbar));
        const handleChange = () => {
          setEnableToolbar(Boolean(linkService.enableLinkToolbar));
        };
        linkService.on?.('linkToolbarChange', handleChange);
        return () => {
          linkService.off?.('linkToolbarChange', handleChange);
        };
      }
    } catch {
      // ignore if link service not available
    }
  }, []);

  const lexicalEditor = editor.getLexicalEditor?.();

  return (
    <PortalAnchor>
      {lexicalEditor && <CustomLinkToolbar editor={lexicalEditor} enable={enableToolbar} />}
      {lexicalEditor && <LinkEdit editor={lexicalEditor} />}
    </PortalAnchor>
  );
};

CustomLinkPlugin.displayName = 'CustomLinkPlugin';

export default CustomLinkPlugin;
