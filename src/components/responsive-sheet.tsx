import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { useWide } from '@/hooks/use-media'
import { cn } from '@/lib/utils'

/**
 * One scoped task over the current screen (sheets.md): a centred dialog on wide screens, a
 * bottom sheet you can swipe down on phones. Both share an iOS-style bar: a way out on the
 * leading edge (Cancel), the title, and the confirming action on the trailing edge (Done).
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  leading,
  trailing,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Read by screen readers when the sheet opens. */
  description: string
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  const wide = useWide()

  const bar = (Title: typeof DialogTitle | typeof DrawerTitle) => (
    <header className="grid min-h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-separator px-2">
      <div className="justify-self-start">{leading}</div>
      <Title className="truncate text-center text-[15px] leading-5 font-semibold tracking-[-0.01em]">{title}</Title>
      <div className="justify-self-end">{trailing}</div>
    </header>
  )

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(760px,calc(100dvh-4rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[27rem]"
        >
          {bar(DialogTitle)}
          <DialogDescription className="sr-only">{description}</DialogDescription>
          <div className={cn('min-h-0 flex-1 overflow-y-auto p-5', className)}>{children}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[94dvh] [--field:var(--sheet-field)] [--group:var(--sheet-group)]">
        {bar(DrawerTitle)}
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
            className,
          )}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/** Text-only bar buttons, in the link colour (Cancel, Done, Save). */
export function BarButton({ strong, className, ...props }: ComponentProps<typeof Button> & { strong?: boolean }) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'h-9 px-2.5 text-[15px] text-link hover:text-link disabled:text-muted-foreground',
        strong ? 'font-semibold' : 'font-normal',
        className,
      )}
      {...props}
    />
  )
}

/** Grouped rows on a card (Share's Settings groups). */
export function Group({ title, footer, children, className }: { title?: string; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('grid gap-1.5', className)}>
      {title && <h3 className="px-1 text-[13px] leading-5 font-semibold">{title}</h3>}
      <div className="inset-divide overflow-hidden rounded-group bg-group shadow-group">{children}</div>
      {footer && <p className="px-1 text-xs leading-4 text-muted-foreground">{footer}</p>}
    </section>
  )
}

export function Row({
  label,
  children,
  className,
}: {
  label: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-3 px-3.5 py-2 text-[15px] md:text-sm', className)}>
      <span className="shrink-0">{label}</span>
      {children !== undefined && <span className="min-w-0 text-right text-muted-foreground">{children}</span>}
    </div>
  )
}

export function RowButton({
  icon,
  children,
  destructive,
  trailing,
  className,
  ...props
}: ComponentProps<'button'> & { icon?: ReactNode; destructive?: boolean; trailing?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-left text-[15px] transition-colors outline-none hover:bg-fill focus-visible:bg-fill active:bg-fill-strong md:text-sm',
        destructive ? 'text-destructive' : 'text-link',
        '[&_svg]:size-[18px] [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing}
    </button>
  )
}
