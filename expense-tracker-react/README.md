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

## WebRTC Sync (GitHub Pages only)

The app uses **y-webrtc** for peer-to-peer sync. With **only GitHub Pages** (no other hosting), the app uses the built-in **public signaling servers** so peers can find each other:

- `wss://signaling.yjs.dev`
- `wss://y-webrtc-signaling-eu.herokuapp.com`
- `wss://y-webrtc-signaling-us.herokuapp.com`

If you see **"WebSocket connection to 'wss://signaling.yjs.dev/' failed"**, the public servers may be down or blocked by your network; try another network or again later. Sync works when at least one of these servers is reachable.

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
