import { cn, compactControlClass } from '@whiskeyjack-net/design-system'

export interface CompactIconButtonProps {
  /** Names the button for assistive tech and as its tooltip. */
  label: string
  icon: React.ReactNode
  onClick: () => void
  /** Turn the border and glyph red on hover, for something that discards. */
  destructive?: boolean
  className?: string
}

/**
 * A square icon button at the compact-control height.
 *
 * It exists because two places want the same thing -- the clear button in a source
 * card's header and the copy button beside a CLI command -- and both need to line up
 * with the preview card's segmented controls and pills. All of them take their
 * geometry from the design system's `compactControlClass`, so a 32px row stays a
 * 32px row without anyone matching numbers by eye.
 *
 * The DS `Button` was the obvious choice and is the wrong size for this: `size="sm"`
 * is 32px tall but padded for text, and `size="icon"` is 40px square, which stands a
 * head above everything beside it.
 */
export function CompactIconButton({
  label,
  icon,
  onClick,
  destructive,
  className,
}: CompactIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        compactControlClass(),
        // `!px-0` beats the recipe's text padding; the recipe owns the height and
        // this owns being square.
        'w-8 shrink-0 justify-center !px-0 border',
        'border-[var(--color-border-light)] text-[var(--color-text-muted-light)]',
        'dark:border-[var(--color-border-dark)] dark:text-[var(--color-text-muted-dark)]',
        destructive
          ? [
              'hover:border-[var(--color-error-500)] hover:text-[var(--color-error-500)]',
              'dark:hover:border-[var(--color-error-400)] dark:hover:text-[var(--color-error-400)]',
            ]
          : [
              'hover:border-[var(--color-accent-500)] hover:text-[var(--color-accent-600)]',
              'dark:hover:border-[var(--color-accent-400)] dark:hover:text-[var(--color-accent-400)]',
            ],
        className,
      )}
    >
      {icon}
    </button>
  )
}
