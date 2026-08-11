/**
 * Milestones on the way to a campaign goal.
 *
 * "€12,000 to go" moves nobody. "€400 more and the pump gets a solar array"
 * is a decision someone can make today. The whole value of this file is
 * turning a raised total into that second sentence.
 */

export type MilestoneInput = {
  id: string
  thresholdMinor: number
  label: string
  description: string
}

export type MilestoneState = MilestoneInput & {
  unlocked: boolean
  /** What is still needed to reach it; zero once unlocked. */
  remainingMinor: number
  /** Progress towards this milestone from the previous one, 0–1. */
  progress: number
}

/**
 * Marks each milestone against the amount raised.
 *
 * Progress is measured from the previous milestone rather than from zero, so
 * the bar for the step being worked on fills at a rate that reflects that
 * step. Measuring from zero makes every later milestone look nearly done,
 * which is both misleading and demotivating.
 */
export function milestoneStates(
  milestones: MilestoneInput[],
  raisedMinor: number,
): MilestoneState[] {
  const ordered = [...milestones].sort((a, b) => a.thresholdMinor - b.thresholdMinor)

  return ordered.map((milestone, index) => {
    const floor = index === 0 ? 0 : ordered[index - 1]!.thresholdMinor
    const span = milestone.thresholdMinor - floor
    const unlocked = raisedMinor >= milestone.thresholdMinor

    return {
      ...milestone,
      unlocked,
      remainingMinor: unlocked ? 0 : milestone.thresholdMinor - raisedMinor,
      progress: unlocked ? 1 : span <= 0 ? 0 : Math.max(0, Math.min(1, (raisedMinor - floor) / span)),
    }
  })
}

/** The next milestone still to reach, or null once they are all unlocked. */
export function nextMilestone(states: MilestoneState[]): MilestoneState | null {
  return states.find((state) => !state.unlocked) ?? null
}
