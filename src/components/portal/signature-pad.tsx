'use client'

import { Loader2, PenLine, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { signDocument } from '@/app/actions/portal-signature'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

/**
 * Signature capture for a handover certificate.
 *
 * A canvas, a name and a timestamp. Pointer events rather than mouse events
 * so it works with a finger on the phone the site engineer actually has, and
 * the canvas is sized from its rendered box so the stroke does not come out
 * stretched on a narrow screen.
 */
export function SignaturePad({
  documentId,
  documentTitle,
  onSigned,
}: {
  documentId: string
  documentTitle: string
  onSigned?: () => void
}) {
  const t = useTranslations('portal')
  const tCommon = useTranslations('common')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [pending, startTransition] = useTransition()

  function context() {
    const canvas = canvasRef.current
    if (!canvas) return null

    // Match the backing store to the rendered size once, on first use: a
    // canvas left at its default 300×150 draws a stretched signature.
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== Math.round(rect.width)) {
      canvas.width = Math.round(rect.width)
      canvas.height = Math.round(rect.height)
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    return ctx
  }

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
  }

  function submit() {
    const canvas = canvasRef.current
    if (!canvas || !hasStroke || !name.trim()) return

    startTransition(async () => {
      const result = await signDocument({
        documentId,
        signerName: name.trim(),
        signerRole: role.trim() || undefined,
        signatureImage: canvas.toDataURL('image/png'),
      })

      if (result.ok) {
        toast.success(t('signed'))
        clear()
        onSigned?.()
      } else {
        toast.error(tCommon('error.generic'))
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
        <PenLine className="size-4 text-primary" aria-hidden />
        {t('signTitle', { title: documentTitle })}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('signerName')} htmlFor="signer-name" required>
          <Input
            id="signer-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </Field>
        <Field label={t('signerRole')} htmlFor="signer-role">
          <Input id="signer-role" value={role} onChange={(event) => setRole(event.target.value)} />
        </Field>
      </div>

      <canvas
        ref={canvasRef}
        aria-label={t('signHere')}
        className="h-40 w-full touch-none rounded-[var(--radius-md)] border border-dashed border-border bg-background"
        onPointerDown={(event) => {
          const ctx = context()
          if (!ctx) return
          event.currentTarget.setPointerCapture(event.pointerId)
          const point = pointFrom(event)
          ctx.beginPath()
          ctx.moveTo(point.x, point.y)
          drawing.current = true
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return
          const ctx = context()
          if (!ctx) return
          const point = pointFrom(event)
          ctx.lineTo(point.x, point.y)
          ctx.stroke()
          setHasStroke(true)
        }}
        onPointerUp={() => {
          drawing.current = false
        }}
        onPointerLeave={() => {
          drawing.current = false
        }}
      />

      <p className="text-xs text-muted-foreground">{t('signDisclaimer')}</p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={clear} disabled={pending}>
          <RotateCcw className="size-4" aria-hidden />
          {t('clear')}
        </Button>
        <Button type="button" onClick={submit} disabled={pending || !hasStroke || !name.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t('sign')}
        </Button>
      </div>
    </div>
  )
}
