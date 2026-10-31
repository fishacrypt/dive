import { cn } from '@/lib/utils'

/** The Dive logo. Traced from the supplied brand artwork; colour follows the surrounding text colour. */
const LOGO_PATHS = [
  'M143 298 H272 C380 298 440 380 440 478 C440 580 380 658 272 658 H143 Z M218 363 V594 H268 C330 594 365 550 365 478 C365 408 330 363 268 363 Z',
  'M250 190 C245 150 285 118 335 128 C420 150 520 235 610 400 C635 445 650 470 657 492 C660 505 655 512 640 518 C600 535 565 541 545 541 C528 541 518 532 508 515 C470 440 430 380 360 320 C330 292 300 270 285 258 C262 240 252 215 250 190 Z',
  'M946 310 C945 280 925 266 895 268 C835 285 740 380 686 492 C680 505 688 518 705 520 C735 520 755 525 764 538 C770 545 780 544 784 530 C800 470 830 410 870 380 C910 355 946 340 946 310 Z',
  'M855 510 C855 420 915 357 995 357 C1080 357 1137 420 1137 495 C1137 515 1130 525 1115 525 H945 C945 580 975 600 1010 600 C1040 600 1065 585 1080 578 C1090 573 1100 575 1108 585 L1135 618 C1110 645 1060 667 1005 667 C915 667 855 607 855 510 Z M945 475 H1057 C1055 440 1035 418 1000 418 C965 418 947 440 945 475 Z',
] as const

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="135 110 1010 565" className={cn('h-8 w-auto text-teal-400', className)} fill="currentColor" role="img" aria-label="Dive">
      {LOGO_PATHS.map((d) => (
        <path key={d} fillRule="evenodd" d={d} />
      ))}
      <circle cx="668" cy="600" r="58" />
    </svg>
  )
}

/** Logo used in navigation. `lg` fills the sidebar width, `md` suits the mobile header. */
export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('flex items-center', className)}>
      <LogoMark className={size === 'lg' ? 'h-[84px]' : 'h-11'} />
    </span>
  )
}
