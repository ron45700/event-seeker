/**
 * Category tabs, in display order. A new category is one line here; an event whose
 * category is not listed still shows under "all events", it just has no tab.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  music: 'הופעות',
  standup: 'סטנד אפ',
}

export function isKnownCategory(value: string | null | undefined): value is string {
  return !!value && Object.hasOwn(CATEGORY_LABELS, value)
}

/** The category from a URL parameter, or null for none or an unknown value. */
export function categoryFromParam(value: string | null): string | null {
  return isKnownCategory(value) ? value : null
}
