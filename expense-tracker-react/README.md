# Expense Tracker (React 19)

React 19 + TypeScript + Vite migration of the Expense Tracker app. Uses Dexie (IndexedDB), Zustand, Yjs/y-webrtc sync, Tesseract OCR, and PWA (Workbox).

## GitHub Pages

The repo includes a workflow (`.github/workflows/deploy.yml`) that builds the React app and deploys to GitHub Pages on push to `master` or `main`.

1. In the repo: **Settings → Pages → Build and deployment → Source** = **GitHub Actions**.
2. Push to `master` or `main`; the workflow builds from `expense-tracker-react` with base path `/<repo-name>/` and deploys the `dist` artifact.
3. App URL: `https://<user>.github.io/<repo>/` (e.g. `https://username.github.io/expensTrack/`).

Local preview with the same base path (replace `expensTrack` with your repo name):

```bash
cd expense-tracker-react
VITE_BASE_PATH='/expensTrack/' npm run build
npm run preview
```

## Sync (PeerJS + Yjs, no backend)

The app uses **PeerJS** for signaling and WebRTC DataChannels, and **Yjs** for shared state. No y-webrtc and no custom signaling servers.

- **PeerJS**: peer discovery and WebRTC connection (uses PeerJS cloud: `0.peerjs.com`).
- **Yjs**: CRDT sync over the DataChannel (encodeStateAsUpdate on connect, applyUpdate on data, ydoc.on('update') to broadcast).
- **IndexedDB**: local persistence via y-indexeddb.

Works on GitHub Pages with no backend. Creator shows QR/link with their device id; joiners connect to that peer.

**Add / remove / edit on one peer:** Changes go into the local Yjs doc and are sent to all connected peers. The other peer’s Yjs doc is updated, its observers run, and the Zustand store and list update automatically—no manual refresh needed. If the list ever feels stale (e.g. after reconnecting), use the **↻** refresh button next to the month on the home screen (shared mode) to re-read from the Yjs doc into the store.

### Policy for adding or removing items

**Current policy (default):**

- **Add:** Any connected peer can add an expense. No approval step; the item is added to the shared Yjs doc and synced to all peers.
- **Edit:** Any peer can edit any expense (description, amount, date, payer, etc.).
- **Remove:** Any peer can delete any expense. Deletion is applied in Yjs and synced to all peers.
- **Concurrent edits:** Yjs (CRDT) merges simultaneous changes; there is no “lock” or “last writer wins” conflict—all peers converge to the same state.
- **Offline:** Add/edit/delete work offline; changes are stored locally and synced when a peer reconnects (full state is sent on connect).

So the rule is: **anyone in the shared account can add, edit, or delete any expense.** There is no “only host can delete” or “only payer can edit” check. If you want a stricter policy (e.g. only the host can delete, or only the payer can edit an expense), that would require extra checks in the UI and/or in the store before calling add/update/delete.

## What's missing / optional

Things that are not implemented or are local-only; useful when deciding what to add next.

| Area | Status | Notes |
|------|--------|--------|
| **Receipt images** | Synced on demand | `imageId` syncs via Yjs; the actual image is requested from peers when missing. When you open an expense with a receipt you don't have locally (shared account, connected), the app requests it from a peer over the DataChannel; the peer sends the image as base64 and it is stored locally. |
| **Settings (shared)** | Per device | Currency, budget, dark mode come from `settingsStore` (persist). They are not in the Yjs doc, so each device can have different settings. Optional: sync currency (and maybe budget) for shared accounts. |
| **Recurring / templates / category budgets** | Local only | Stored in IndexedDB only; not in Yjs. Expenses, people, and payments sync; recurring expenses, templates, and category budgets do not. |
| **Awareness / presence** | No-op | `setAwareness` exists but does nothing (no awareness protocol over the simple Yjs sync). "Who's online" would require sending awareness updates over the same DataChannel. |
| **Reconnection** | Manual | On PeerJS disconnect, the app updates "Not connected" but does not auto-reconnect. User can refresh or re-open the invite flow. Optional: auto-reconnect with backoff. |
| **Connection errors** | User-facing + retry | A "Connection failed" banner appears when PeerJS errors; a "Retry" button reconnects using the last connect params. |
| **Tests** | None | No test script or test files (no Vitest/Jest). Adding `vitest` and a few unit tests for stores/sync would help. |
| **Error boundary** | Root boundary | A root `ErrorBoundary` catches uncaught errors and shows "Something went wrong" with a "Reload" button. |
| **Validation** | Minimal | Forms submit without strict validation (e.g. required amount/description). Optional: explicit validation and inline errors. |
| **Accessibility** | Partial | Some buttons/labels; no full audit. Optional: ARIA labels, keyboard nav, focus management. |
| **i18n** | English only | All copy is hardcoded in English. |

## Verification (existing data)

- **Build**: `npm run build` — TypeScript and Vite build succeed.
- **Same data**: The app uses the same IndexedDB database name (`ExpenseTracker_${accountId}`) and schema (version 7) as the vanilla app. On the same origin, existing expenses, people, and payments will load.
- **Manual check**: Run `npm run dev`, complete onboarding or use an existing account, then confirm Home (expenses), People, Settle, Sync, Settings, and Add/Camera flows work.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
