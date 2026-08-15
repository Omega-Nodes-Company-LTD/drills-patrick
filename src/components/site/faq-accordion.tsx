'use client'

import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

export function FaqAccordion({
  items,
}: {
  items: { id: string; question: string; answerHtml: string }[]
}) {
  const [open, setOpen] = useState<string>('')

  /**
   * Search results, the assistant's citations and any link somebody shares
   * point at `/faq#<id>`. The anchor used to reach the page and do nothing:
   * the id was never written into the markup, and Radix keeps the item closed
   * until it is asked. Here the hash opens the answer and brings it into view.
   */
  useEffect(() => {
    const target = window.location.hash.slice(1)
    if (!target || !items.some((item) => item.id === target)) return

    setOpen(target)
    // After the item has been told to open, so the scroll lands on the answer
    // rather than where the collapsed row used to be.
    requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ block: 'center' })
    })
  }, [items])

  return (
    <Accordion.Root
      type="single"
      collapsible
      value={open}
      onValueChange={setOpen}
      className="flex flex-col gap-2"
    >
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
          id={item.id}
          className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-surface-foreground scroll-mt-24"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 p-5 text-start text-base font-medium transition-colors hover:bg-muted">
              {item.question}
              <ChevronDown
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-none">
            <div
              className="prose-content max-w-none px-5 pb-5"
              dangerouslySetInnerHTML={{ __html: item.answerHtml }}
            />
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}
