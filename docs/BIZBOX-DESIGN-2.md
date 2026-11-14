# BizBox 2.0 — Liquid Glass UI

A presentation-only refresh on top of the existing production logic.

## Brand
- Brand violet: `#6258EB`, mint accent `#ADEEDB`
- Dark background: `#0E1124`
- Light background: `#F6F7FC`, ink `#171A2B`
- Recreated B symbol from the approved BizBox redesign. App shell and favicon updated.

## UI patterns
- Frosted-glass panels (`backdrop-filter`, subtle highlights, glass borders) with graceful fallbacks.
- Dock with large touch targets and clear active indicator.
- Monthly revenue emphasis; all amounts continue using actual app state.
- Appearance toggle in top bar (sun/moon); preference saved separately in `localStorage` as `bizbox_ui_theme`.
- Telegram native header/background/dock colors update with the appearance.
- `prefers-reduced-motion` and `prefers-reduced-transparency` supported.
- Safe-area padding for Telegram preserved.
- UI stays functional when blur is unsupported.
- No changes to business data, billing, authorization, permissions, storage or API.

## Validation before merge
1. Run `npm ci && npm run check` (Node 24), plus `npm run lint`.
2. Open the preview in mobile Telegram; check both themes, 320px and 390px widths, keyboard and notch safe area.
3. Exercise operations, subscription flow, onboarding and persistence — check the UI changes do not block saving.
4. Test iOS Safari and Android Telegram blur fallback; check contrast of metric panels and form fields.
5. Merge only after validating on a preview; live BotFather URL remains unchanged.

## Motion — v2
- Active navigation: spring-selection animation and active underline.
- Page changes: 440ms slide/fade, reduced motion respected.
- Dashboard: staggered sequential reveal for greeting, quick actions, balance, KPI, tasks and operations.
- Balance card: drifting light sweep and orbiting violet glow; content and data remain interactive.
- Buttons: press scaling and glossy hover feedback; mobile hit areas remain unchanged.
- Charts: existing interpolated data animation with refreshed violet palette.
- App shell: slow ambient glow orbs using compositor transforms.
- Decorative motion disabled by `prefers-reduced-motion: reduce`.
