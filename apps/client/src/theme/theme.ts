/** Every theme must set all of these; styles.css reads them as `var(--name)`. */
export type ThemeVar =
  | 'bg'
  | 'ink'
  | 'muted'
  | 'card'
  | 'card-border'
  | 'card-shadow'
  | 'accent'
  | 'accent-ink'
  | 'accent-shadow'
  | 'btn-bg'
  | 'btn-ink'
  | 'btn-shadow'
  | 'line'
  | 'input-bg'
  | 'font-display'
  | 'font-body'
  | 'text-size'
  | 'display-size'
  | 'radius'
  | 'glow';

export interface Theme {
  /** Exposed as `<html data-theme>` for theme-specific decoration in CSS. */
  id: string;
  /** Mobile browser chrome colour. */
  themeColor: string;
  vars: Record<ThemeVar, string>;
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  for (const [name, value] of Object.entries(theme.vars)) root.style.setProperty(`--${name}`, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
}
