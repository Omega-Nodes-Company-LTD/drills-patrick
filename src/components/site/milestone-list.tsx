import { Check, Circle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Progress } from '@/components/ui/progress'
import type { Locale } from '@/i18n/config'
import { milestoneStates, nextMilestone, type MilestoneInput } from '@/lib/giving/milestones'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * The steps between "some money in" and "goal reached".
 *
 * The line that matters is the one naming the next step and what it buys:
 * "€400 more and the pump gets a solar array" is a decision someone can make
 * today, in a way that "€12,000 to go" never is.
 */
export async function MilestoneList({
  milestones,
  raisedMinor,
  currency,
  locale,
}: {
  milestones: MilestoneInput[]
  raisedMinor: number
  currency: string
  locale: Locale
}) {
  if (milestones.length === 0) return null

  const t = await getTranslations('milestones')
  const states = milestoneStates(milestones, raisedMinor)
  const next = nextMilestone(states)
  const money = (minor: number) => formatMoney(minor, currency, locale, { hideDecimals: true })

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-subheading font-semibold">{t('title')}</h2>

      {next ? (
        <p className="rounded-[var(--radius-md)] border border-primary/40 bg-primary/8 p-4 text-sm">
          {t('next', { amount: money(next.remainingMinor), label: next.label })}
        </p>
      ) : null}

      <ol className="flex flex-col gap-4">
        {states.map((state) => (
          <li key={state.id} className="flex items-start gap-3">
            <span
              className={cn(
                'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border',
                state.unlocked
                  ? 'border-success bg-success text-white'
                  : 'border-border text-muted-foreground',
              )}
              aria-hidden
            >
              {state.unlocked ? <Check className="size-3.5" /> : <Circle className="size-2.5" />}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  !state.unlocked && 'text-muted-foreground',
                )}
              >
                {state.label}
                <span className="ms-2 font-normal text-muted-foreground">
                  {money(state.thresholdMinor)}
                </span>
              </p>

              {state.description ? (
                <p className="text-sm text-muted-foreground">{state.description}</p>
              ) : null}

              {state.unlocked ? (
                <p className="text-xs font-medium text-success">{t('unlocked')}</p>
              ) : (
                <>
                  {/* Measured from the previous step, so this bar reflects the
                      step being worked on rather than the whole campaign. */}
                  <Progress value={state.progress * 100} className="mt-2 h-1.5" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('remaining', { amount: money(state.remainingMinor) })}
                  </p>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
