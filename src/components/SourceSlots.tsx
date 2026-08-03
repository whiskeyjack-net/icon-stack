import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Notice,
  SegmentedControl,
  cn,
} from '@whiskeyjack-net/design-system'
import { UploadSimple, Image as ImageIcon, X, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'
import type { ImageFit } from '@whiskeyjack-net/icon-stack-core'
import { CompactIconButton } from './CompactIconButton'
import { useGenerator, type SourceSlot } from '@/contexts/GeneratorContext'

/**
 * The two source images.
 *
 * `main` is required. `alternate` is optional and exists so dark, monochrome and
 * taskbar variants can use different artwork -- a mark that reads on a light
 * plate often does not read knocked out on a dark one. Platforms pick between
 * them per-variant; see PlatformSettings.
 */
/**
 * A two-tone checkerboard, as an inline SVG data URI so it needs no asset.
 *
 * It is what makes a transparent source legible: against the card's own surface,
 * "transparent" and "the same colour as the card" look identical, and for an icon
 * tool that distinction is the whole point of the preview.
 */
const CHECKERBOARD =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23f4f4f4'/%3E%3Crect width='8' height='8' fill='%23dcdcdc'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23dcdcdc'/%3E%3C/svg%3E\")"

export function SourceSlots() {
  const { t } = useTranslation()
  const { source, alternate, sourceWarning, alternateWarning } = useGenerator()

  return (
    // One column until there is something to sit beside. The grid was
    // unconditionally `md:grid-cols-2`, so the only card on an empty Generator
    // took the left half and left the right half blank -- the drop target read
    // as undersized and off-centre, which is the first thing anyone sees.
    <div className={cn('grid gap-4', source && 'md:grid-cols-2')}>
      <Slot slot="main" />
      {source ? <Slot slot="alternate" /> : null}
      {(sourceWarning || alternateWarning) && (
        <div className="md:col-span-2 space-y-2">
          {sourceWarning && <Notice tone="warning">{sourceWarning}</Notice>}
          {alternateWarning && <Notice tone="warning">{alternateWarning}</Notice>}
        </div>
      )}
      {!alternate && source && (
        <p className="md:col-span-2 text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
          {t('source.alternateHint')}
        </p>
      )}
    </div>
  )
}

function Slot({ slot }: { slot: SourceSlot }) {
  const { t } = useTranslation()
  const { source, alternate, sourceFit, alternateFit, setSlot, setFit, requestFile, triggerUpload } =
    useGenerator()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const image = slot === 'main' ? source : alternate
  const fit = slot === 'main' ? sourceFit : alternateFit

  // The main slot borrows the Layout's picker, so the toolbar's Replace and this
  // card's Choose open the same input and go through the same replace
  // confirmation. The alternate slot carries its own, since nothing else opens it.
  const openPicker = () => (slot === 'main' ? triggerUpload() : input.current?.click())

  // The heading earns its place only when it has something to sit beside. An
  // empty main slot is the whole of the landing page, and the EmptyState below
  // already titles it ("Drop a source image") -- so a card heading reading
  // "Source image" directly above says the same thing twice. Dropping the
  // heading drops `compact` with it: that density exists ONLY to balance a
  // title, so with no title the padding goes back to even on all four sides.
  //
  // The empty ALTERNATE slot keeps its header, because the "optional" marker
  // lives there and is the one thing the drop target does not say. The two
  // empty states never appear together: the alternate slot only renders once
  // the main one is loaded.
  const showHeader = Boolean(image) || slot === 'alternate'

  return (
    <Card>
      {/* Without a header this wants even padding, which is neither density:
          the `p-5` overrides compact's top inset through tailwind-merge. */}
      <CardContent density="compact" className={cn(!showHeader && 'p-5')}>
        {showHeader && (
          /* `items-center` rather than baseline: the trailing slot holds a button
             as often as text, and a 32px control cannot sit on a text baseline. */
          <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
              {t(`source.${slot}`)}
            </h3>

            {/* One trailing slot, two states. Loaded, it is the remove button; empty
                and optional, it is the word "optional" -- which has nothing to say
                once a file is there. */}
            {image ? (
              <CompactIconButton
                destructive
                label={t('source.clear')}
                icon={<X size={14} weight="bold" />}
                onClick={() => setSlot(slot, null)}
              />
            ) : (
              <span className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                {t('source.optional')}
              </span>
            )}
          </div>
        )}

        {slot === 'alternate' && (
          <input
            ref={input}
            type="file"
            accept="image/png,image/svg+xml,.svg"
            className="sr-only"
            aria-label={t('source.choose')}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void requestFile(slot, file)
            }}
          />
        )}

        {image ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {/* Checkerboard behind the art, so a transparent source reads as
                  transparent rather than as whatever the card happens to be.
                  For an icon tool that is the first thing worth seeing. */}
              <div
                className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]"
                style={{ backgroundImage: CHECKERBOARD, backgroundSize: '16px 16px' }}
              >
                <img
                  src={image.dataUrl}
                  alt=""
                  className={cn('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)]">
                  {image.fileName}
                </p>
                <p className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                  {image.width}&times;{image.height} &middot; {image.type.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Only meaningful for a non-square source; square art fills either way. */}
            {image.width !== image.height && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)]">
                  {t('source.fit')}
                </span>
                <SegmentedControl
                  aria-label={t('source.fit')}
                  value={fit}
                  onChange={(next: ImageFit) => setFit(slot, next)}
                  options={[
                    { value: 'contain' as const, label: t('source.contain'), icon: <ArrowsIn size={14} /> },
                    { value: 'cover' as const, label: t('source.cover'), icon: <ArrowsOut size={14} /> },
                  ]}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void requestFile(slot, e.dataTransfer.files[0])
            }}
            className={cn(
              'rounded-2xl border-2 border-dashed transition-colors',
              dragging
                ? 'border-[var(--color-accent-500)] bg-[var(--color-accent-50)]'
                : 'border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]',
            )}
          >
            <EmptyState
              className="py-10"
              icon={<ImageIcon size={28} />}
              title={t(`source.${slot}Title`)}
              subtitle={t(`source.${slot}Subtitle`)}
              action={
                <Button variant={slot === 'main' ? 'accent' : 'outline'} onClick={openPicker}>
                  <UploadSimple size={16} weight="bold" className="mr-1.5" />
                  {t('source.choose')}
                </Button>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
