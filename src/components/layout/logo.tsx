import { cn } from '@/lib/utils'

/** The wordmark: the lowercase word "dive" in teal. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('select-none font-display text-4xl font-bold lowercase leading-none tracking-tight text-teal-400', className)}>
      dive
    </span>
  )
}

/** Logo used in navigation. `lg` fills the sidebar, `md` suits the mobile header. */
export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('flex items-center', className)}>
      <LogoMark className={size === 'lg' ? 'text-6xl' : 'text-4xl'} />
    </span>
  )
}
