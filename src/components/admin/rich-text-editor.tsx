'use client'

import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { MediaBrowser } from '@/components/admin/media/media-browser'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { cn } from '@/lib/utils'

/**
 * TipTap editor used for every rich-text field. The value is HTML; it is
 * sanitised again server-side before being stored, so the editor never has to
 * be trusted.
 */
export function RichTextEditor({
  value,
  onChange,
  storageEnabled,
  className,
}: {
  value: string
  onChange: (html: string) => void
  storageEnabled: boolean
  className?: string
}) {
  const t = useTranslations('admin.editor')
  const tCommon = useTranslations('common')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [imageOpen, setImageOpen] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer noopener' } }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: t('placeholder') }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose-content max-w-none px-4 py-3 min-h-64 focus:outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  })

  // Keep the editor in sync when the surrounding form switches language tab.
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current && !editor.isFocused) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) {
    return <div className="h-64 animate-pulse rounded-[var(--radius-md)] bg-muted" />
  }

  return (
    <div className={cn('tiptap-editor overflow-hidden rounded-[var(--radius-md)] border border-border', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface p-1.5">
        <ToolbarButton
          editor={editor}
          label={t('bold')}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('italic')}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('underline')}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-4" aria-hidden />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          editor={editor}
          label={t('heading2')}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('heading3')}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-4" aria-hidden />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          editor={editor}
          label={t('bulletList')}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('orderedList')}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('quote')}
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-4" aria-hidden />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          editor={editor}
          label={t('alignLeft')}
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('alignCenter')}
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={t('alignRight')}
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="size-4" aria-hidden />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          editor={editor}
          label={t('link')}
          active={editor.isActive('link')}
          onClick={() => {
            setLinkUrl(editor.getAttributes('link').href ?? '')
            setLinkOpen(true)
          }}
        >
          <Link2 className="size-4" aria-hidden />
        </ToolbarButton>
        {editor.isActive('link') ? (
          <ToolbarButton
            editor={editor}
            label={t('unlink')}
            onClick={() => editor.chain().focus().unsetLink().run()}
          >
            <Link2Off className="size-4" aria-hidden />
          </ToolbarButton>
        ) : null}
        <ToolbarButton editor={editor} label={t('image')} onClick={() => setImageOpen(true)}>
          <ImagePlus className="size-4" aria-hidden />
        </ToolbarButton>

        <Divider />

        <ToolbarButton editor={editor} label={t('undo')} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton editor={editor} label={t('redo')} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-4" aria-hidden />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent closeLabel={tCommon('close')} className="sm:w-[min(28rem,92vw)]">
          <DialogHeader>
            <DialogTitle>{t('link')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://…"
              aria-label={t('linkUrl')}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (linkUrl.trim()) {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run()
                } else {
                  editor.chain().focus().unsetLink().run()
                }
                setLinkOpen(false)
              }}
            >
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent closeLabel={tCommon('close')} className="sm:w-[min(60rem,94vw)]">
          <DialogHeader>
            <DialogTitle>{t('image')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <MediaBrowser
              storageEnabled={storageEnabled}
              kind="image"
              onSelect={(item) => {
                if (!item.url) return
                editor
                  .chain()
                  .focus()
                  .setImage({ src: item.url, alt: item.alt?.en ?? '' })
                  .run()
                setImageOpen(false)
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  editor: Editor
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        // The toolbar packs its buttons at `gap-0.5`, so overlapping invisible
        // hit areas would fight each other: on touch the buttons grow instead.
        'grid size-8 place-items-center rounded-[var(--radius-sm)] transition-colors pointer-coarse:size-11',
        active ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}
