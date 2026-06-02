# EaseMotion Dark Mode

This submission demonstrates how to implement dark mode using EaseMotion's CSS variable system.

## What this includes

- `dark-mode-demo.html` — self-contained demo page with theme toggle
- `dark-mode.css` — CSS variables, light/dark theme overrides, and manual toggle styles
- `README.md` — documentation for implementing dark mode with EaseMotion

## How it works

EaseMotion's token system is built on global CSS variables such as `--ease-background`, `--ease-foreground`, `--ease-primary`, and more.

### 1. Default theme
Define your default color palette in `:root`.

```css
:root {
  --ease-background: #ffffff;
  --ease-surface: #f8fafc;
  --ease-surface-strong: #f1f5f9;
  --ease-foreground: #0f172a;
  --ease-muted: #64748b;
  --ease-border: #cbd5e1;
  --ease-border-muted: #e2e8f0;
  --ease-primary: #2563eb;
  --ease-primary-contrast: #ffffff;
  --ease-secondary: #7c3aed;
  --ease-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}
```

### 2. Automatic dark mode with `prefers-color-scheme`
Use `@media (prefers-color-scheme: dark)` to override the same variables for users who prefer dark mode.

```css
@media (prefers-color-scheme: dark) {
  :root {
    --ease-background: #020617;
    --ease-surface: #111827;
    --ease-surface-strong: #1f2937;
    --ease-foreground: #f8fafc;
    --ease-muted: #94a3b8;
    --ease-border: #334155;
    --ease-border-muted: #334155;
    --ease-primary: #60a5fa;
    --ease-primary-contrast: #0f172a;
    --ease-secondary: #8b5cf6;
    --ease-shadow: 0 10px 30px rgba(15, 23, 42, 0.45);
  }
}
```

### 3. Manual toggle using `data-theme`
A manual theme toggle gives users control independent of system settings.

```css
:root[data-theme="dark"] {
  --ease-background: #020617;
  --ease-surface: #111827;
  --ease-surface-strong: #1f2937;
  --ease-foreground: #f8fafc;
  --ease-muted: #94a3b8;
  --ease-border: #334155;
  --ease-border-muted: #334155;
  --ease-primary: #60a5fa;
  --ease-primary-contrast: #0f172a;
  --ease-secondary: #8b5cf6;
  --ease-shadow: 0 10px 30px rgba(15, 23, 42, 0.45);
}

:root[data-theme="light"] {
  --ease-background: #ffffff;
  --ease-surface: #f8fafc;
  --ease-surface-strong: #f1f5f9;
  --ease-foreground: #0f172a;
  --ease-muted: #64748b;
  --ease-border: #cbd5e1;
  --ease-border-muted: #e2e8f0;
  --ease-primary: #2563eb;
  --ease-primary-contrast: #ffffff;
  --ease-secondary: #7c3aed;
  --ease-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}
```

## Variable reference

Override these common `--ease-*` tokens to enable dark mode across your UI:

- `--ease-background`
- `--ease-surface`
- `--ease-surface-strong`
- `--ease-foreground`
- `--ease-muted`
- `--ease-border`
- `--ease-border-muted`
- `--ease-primary`
- `--ease-primary-contrast`
- `--ease-secondary`
- `--ease-shadow`
- `--ease-ring`
- `--ease-code-bg`
- `--ease-link`
- `--ease-link-hover`

> Tip: only override the variables your theme needs. Components built with the EaseMotion token system will automatically adapt when the shared variables change.

## Demo

Open `dark-mode-demo.html` in a browser to preview:

- automatic dark mode through `prefers-color-scheme`
- manual toggle using the theme button
- accessible keyboard and local storage support

## Why this approach

- `@media (prefers-color-scheme: dark)` respects user system preferences
- `:root[data-theme]` makes manual toggling explicit and easy to override
- CSS variables keep theme values centralized and reusable
- The demo shows how to build UI components that depend on the same global tokens
