'use client'

import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'

export function FaqAccordion({
  items,
}: {
  items: { id: string; question: string; answerHtml: string }[]
}) {
  return (
    <Accordion.Root type="single" collapsible className="flex flex-col gap-2">
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
          className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-surface-foreground"
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
