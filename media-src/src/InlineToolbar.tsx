import { type IEditor, getHotkeyById, HotkeyEnum, INSERT_HEADING_COMMAND } from '@lobehub/editor';
import { type ChatInputActionsProps, type EditorState } from '@lobehub/editor/react';
import { FloatActions } from '@lobehub/editor/react';
import {
  BoldIcon,
  CodeXmlIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MessageSquareQuote,
  SigmaIcon,
  SquareDashedBottomCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from 'lucide-react';
import { memo, useMemo } from 'react';

interface InlineToolbarProps {
  editor?: IEditor;
  editorState?: EditorState;
  floating?: boolean;
  labels: Record<string, string>;
}

const InlineToolbar = memo<InlineToolbarProps>(({ editor, editorState, floating = true, labels }) => {
  const items: ChatInputActionsProps['items'] = useMemo(() => {
    if (!editorState) return [];

    const baseItems = [
      {
        active: editorState.isBold,
        icon: BoldIcon,
        key: 'bold',
        label: labels['typobar.bold'] || 'Bold',
        onClick: editorState.bold,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Bold).keys },
      },
      {
        active: editorState.isItalic,
        icon: ItalicIcon,
        key: 'italic',
        label: labels['typobar.italic'] || 'Italic',
        onClick: editorState.italic,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Italic).keys },
      },
      {
        active: editorState.isUnderline,
        icon: UnderlineIcon,
        key: 'underline',
        label: labels['typobar.underline'] || 'Underline',
        onClick: editorState.underline,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Underline).keys },
      },
      {
        active: editorState.isStrikethrough,
        icon: StrikethroughIcon,
        key: 'strikethrough',
        label: labels['typobar.strikethrough'] || 'Strikethrough',
        onClick: editorState.strikethrough,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Strikethrough).keys },
      },
      { type: 'divider' },
      !floating && {
        icon: Heading1Icon,
        key: 'h1',
        label: labels['slash.h1'] || 'Heading 1',
        onClick: () => {
          if (editor) editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h1' });
        },
      },
      !floating && {
        icon: Heading2Icon,
        key: 'h2',
        label: labels['slash.h2'] || 'Heading 2',
        onClick: () => {
          if (editor) editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h2' });
        },
      },
      !floating && {
        icon: Heading3Icon,
        key: 'h3',
        label: labels['slash.h3'] || 'Heading 3',
        onClick: () => {
          if (editor) editor.dispatchCommand(INSERT_HEADING_COMMAND, { tag: 'h3' });
        },
      },
      !floating && { type: 'divider' },
      {
        icon: ListIcon,
        key: 'bulletList',
        label: labels['typobar.bulletList'] || 'Bulleted list',
        onClick: editorState.bulletList,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.BulletList).keys },
      },
      {
        icon: ListOrderedIcon,
        key: 'numberList',
        label: labels['typobar.numberList'] || 'Numbered list',
        onClick: editorState.numberList,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.NumberList).keys },
      },
      {
        icon: ListTodoIcon,
        key: 'taskList',
        label: labels['typobar.taskList'] || 'Task list',
        onClick: editorState.checkList,
      },
      { type: 'divider' },
      {
        active: editorState.isBlockquote,
        icon: MessageSquareQuote,
        key: 'blockquote',
        label: labels['typobar.blockquote'] || 'Blockquote',
        onClick: editorState.blockquote,
      },
      {
        icon: LinkIcon,
        key: 'link',
        label: labels['typobar.link'] || 'Link',
        onClick: editorState.insertLink,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.Link).keys },
      },
      {
        icon: SigmaIcon,
        key: 'math',
        label: labels['typobar.tex'] || 'TeX Formula',
        onClick: editorState.insertMath,
      },
      { type: 'divider' },
      {
        active: editorState.isCode,
        icon: CodeXmlIcon,
        key: 'code',
        label: labels['typobar.code'] || 'Inline code',
        onClick: editorState.code,
        tooltipProps: { hotkey: getHotkeyById(HotkeyEnum.CodeInline).keys },
      },
      !floating && {
        icon: SquareDashedBottomCodeIcon,
        key: 'codeblock',
        label: labels['typobar.codeblock'] || 'Code block',
        onClick: editorState.codeblock,
      },
    ];

    return baseItems.filter(Boolean) as ChatInputActionsProps['items'];
  }, [editor, editorState, floating, labels]);

  if (!editorState) return null;

  return <FloatActions className="lobe-float-toolbar" items={items} />;
});

InlineToolbar.displayName = 'InlineToolbar';

export default InlineToolbar;
