import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

const COLORS = { cyan: 'bg-cyan-dive', violet: 'bg-violet-dive', green: 'bg-mint-dive', amber: 'bg-amber-dive', red: 'bg-rose-dive' }

export function Progress({ value, tone = 'cyan', className, label }: { value: number; tone?: keyof typeof COLORS; className?: string; label?: string }) {
  const pct = Math.min(100, Math.max(0, value * 100))
  return (
    <ProgressPrimitive.Root aria-label={label} value={pct} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-ink-600', className)}>
      <ProgressPrimitive.Indicator className={cn('h-full rounded-full transition-[width] duration-500', COLORS[tone])} style={{ width: `${pct}%` }} />
    </ProgressPrimitive.Root>
  )
}
