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

## WebRTC Sync & Signaling

The app uses **y-webrtc** for peer-to-peer sync. Peers discover each other via a **signaling server**. By default it tries:

- `wss://signaling.yjs.dev`
- `wss://y-webrtc-signaling-eu.herokuapp.com`
- `wss://y-webrtc-signaling-us.herokuapp.com`

If you see **"WebSocket connection to 'wss://signaling.yjs.dev/' failed"**:

1. **Public servers may be down** – Try again later or use your own server.
2. **Network/firewall** – Some networks block WebSockets. Try another network.
3. **Custom signaling server** – Run the built-in server:
   ```bash
   cd node_modules/y-webrtc && PORT=4444 node bin/server.js
   ```
   Then set `VITE_YJS_SIGNALING=ws://localhost:4444` (or your server’s `wss://` URL) when building.

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
