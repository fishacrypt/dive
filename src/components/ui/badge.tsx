import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      neutral: 'border-ink-500 bg-ink-700 text-fog-300',
      cyan: 'border-cyan-dive/30 bg-cyan-dive/10 text-cyan-dive',
      violet: 'border-violet-dive/30 bg-violet-dive/10 text-violet-dive',
      green: 'border-mint-dive/30 bg-mint-dive/10 text-mint-dive',
      amber: 'border-amber-dive/30 bg-amber-dive/10 text-amber-dive',
      red: 'border-rose-dive/30 bg-rose-dive/10 text-rose-dive',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
