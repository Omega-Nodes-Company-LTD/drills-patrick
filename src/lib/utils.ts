import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { env } from '@/env'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** URL-safe slug that keeps accented characters readable. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90)
}

export function absoluteUrl(path = '/'): string {
  return `${env.APP_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** Strips HTML tags and collapses whitespace — used for excerpts and indexing. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function truncate(value: string, length = 160): string {
  if (value.length <= length) return value
  return `${value.slice(0, length - 1).trimEnd()}…`
}

/** Rough reading time, assuming 200 words per minute. */
export function readingMinutes(html: string): number {
  const words = htmlToPlainText(html).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function percentage(current: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

/** Stable id generator usable both on the server and in the browser. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 12)
}

export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')
}
