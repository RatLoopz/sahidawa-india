# Voice Triage Keyboard Navigation

This document records the supported keyboard path for `apps/web/app/[locale]/voice/page.tsx` and the manual audit steps for issue `#476`.

## Supported Keys

- `Tab`: Move forward through interactive controls.
- `Shift + Tab`: Move backward through interactive controls.
- `Enter` or `Space`: Activate the currently focused button, switch, or link.
- `Escape`: Stop speech playback, stop active listening, or reset the current review, result, or error panel back to the initial state.

## Expected Focus Order

### Initial state

1. `Skip to main content`
2. Header back button
3. Voice language selector
4. Voice animation toggle
5. Voice mic button

### Listening state

1. `Skip to main content`
2. Header back button
3. Voice language selector is disabled and skipped by the browser
4. Voice animation toggle
5. Voice mic button in stop-listening mode

### Review state

1. `Skip to main content`
2. Header back button
3. Voice language selector
4. Voice animation toggle
5. Review panel receives programmatic focus
6. `Try Again`
7. `Analyse Anyway`

### Result state

1. `Skip to main content`
2. Header back button
3. Voice language selector is disabled and skipped by the browser
4. Voice animation toggle
5. Result panel receives programmatic focus
6. `Share with Doctor`
7. `Read Aloud` or `Stop Audio`
8. `Start New Check`

### Error state

1. `Skip to main content`
2. Header back button
3. Voice language selector
4. Voice animation toggle
5. Error panel receives programmatic focus
6. `Try Again`

## Audit Notes

- The voice visualizer is not focusable, so it cannot trap keyboard users.
- The current voice flow does not render modal dialogs. Review, result, and error states are inline panels, so the audit focuses on focus order and escape paths rather than dialog focus loops.
- The skip link targets `main#main-content`, which is focusable with `tabIndex={-1}`.

## Manual Audit Checklist

1. Start the web app with `npm run dev -w web`.
2. Open `http://127.0.0.1:3000/en/voice`.
3. Press `Tab` once and confirm the skip link appears.
4. Activate the skip link and confirm focus lands on the main voice landmark.
5. Tab through the initial state and confirm the focus order matches the list above.
6. Start listening, then press `Escape` and confirm listening stops without trapping focus.
7. Drive the flow into review, result, and error states and confirm the active panel receives focus.
8. In each non-initial state, use `Tab` and `Shift + Tab` to confirm focus can leave the panel and return without cycling forever.
9. In review, result, and error states, press `Escape` and confirm the flow resets to the initial state.
10. Run `npm run test:a11y:voice` to execute the automated `axe-core` audit.
