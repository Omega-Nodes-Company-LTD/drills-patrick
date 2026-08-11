'use client'

import { FileCheck2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/field'
import { intlLocale, type Locale } from '@/i18n/config'
import { Link } from '@/i18n/navigation'
import type { RegistryRow } from '@/lib/transparency/registry'

/**
 * The register, filterable in the browser.
 *
 * Filtering client-side rather than through the URL because the whole set is
 * already on the page — it is small enough to hand over at once, and a
 * round-trip per filter would make comparing districts tedious for exactly
 * the person the register exists for.
 *
 * A real `<table>`: the numbers are meant to be copied into a spreadsheet.
 */

export type RegistryLabels = {
  filterDistrict: string
  filterStatus: string
  all: string
  search: string
  empty: string
  name: string
  place: string
  status: string
  depth: string
  yield: string
  people: string
  completed: string
  certificates: string
  measuredOn: string
  statuses: Record<string, string>
}

export function RegistryTable({
  rows,
  districts,
  locale,
  labels,
}: {
  rows: RegistryRow[]
  districts: string[]
  locale: Locale
  labels: RegistryLabels
}) {
  const [district, setDistrict] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')

  const numbers = useMemo(() => new Intl.NumberFormat(intlLocale(locale)), [locale])
  const dates = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale(locale), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [locale],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return rows.filter((row) => {
      if (district && row.district !== district) return false
      if (status && row.status !== status) return false
      if (!needle) return true

      return [row.title, row.village, row.district, row.region]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle))
    })
  }, [rows, district, status, query])

  const formatDate = (value: string | null) =>
    value ? dates.format(new Date(`${value}T00:00:00Z`)) : '—'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="max-w-xs"
        />

        <Select
          value={district}
          onChange={(event) => setDistrict(event.target.value)}
          aria-label={labels.filterDistrict}
          className="max-w-[14rem]"
        >
          <option value="">{labels.filterDistrict}</option>
          {districts.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>

        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={labels.filterStatus}
          className="max-w-[14rem]"
        >
          <option value="">{labels.all}</option>
          {Object.entries(labels.statuses).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-10 text-center text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                {[
                  labels.name,
                  labels.place,
                  labels.status,
                  labels.depth,
                  labels.yield,
                  labels.people,
                  labels.completed,
                  labels.certificates,
                ].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 text-start font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${row.slug}`} className="font-medium hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[row.village, row.district].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{labels.statuses[row.status] ?? row.status}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.depthMeters ? `${row.depthMeters} m` : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {/* The measured figure wins over the drilling-day one, and
                        says when it was taken: a yield from 2019 presented as
                        current is the most misleading number on the page. */}
                    {row.latestYield?.value ? (
                      <>
                        {numbers.format(row.latestYield.value)} l/h
                        <span className="block text-xs text-muted-foreground">
                          {labels.measuredOn} {formatDate(row.latestYield.measuredOn)}
                        </span>
                      </>
                    ) : row.yieldLitersPerHour ? (
                      `${numbers.format(row.yieldLitersPerHour)} l/h`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{numbers.format(row.beneficiaries)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.completionDate)}</td>
                  <td className="px-4 py-3">
                    {row.certificates.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <FileCheck2 className="size-4" aria-hidden />
                        {row.certificates.length}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
