# Frontend (`frontend`)

## Overview
React 19 + TypeScript + Vite single-page application (SPA) styled with Tailwind CSS and packaged into an Nginx HTTP container on port 80 that serves the bundled static assets and reverse-proxies `/api/` requests to the internal FastAPI backend.

## Interface
- `[package.json:scripts.dev]` `vite` development server
- `[package.json:scripts.build]` `tsc -b && vite build` production TypeScript check and Vite bundle
- `[package.json:scripts.lint]` `eslint .` static linter
- `[package.json:scripts.preview]` `vite preview` bundle preview server
- `[vite.config.ts:default]` Vite configuration enabling `@vitejs/plugin-react`
- `[eslint.config.js:default]` Flat ESLint configuration targeting `**/*.{ts,tsx}` and ignoring `dist`
- `[tailwind.config.js:default]` Tailwind CSS configuration scanning `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`
- `[postcss.config.js:default]` PostCSS plugin configuration (`@tailwindcss/postcss`, `autoprefixer`)
- `[nginx.conf:map $http_x_forwarded_proto $forwarded_proto]` Maps upstream `X-Forwarded-Proto` header when present and falls back to `$scheme`
- `[nginx.conf:listen 80]` HTTP listener serving `/usr/share/nginx/html` at `/` and reverse-proxying `/api/` to `http://backend:8000/`
- `[Dockerfile:EXPOSE 80]`, `[Dockerfile:CMD]` (`nginx -g 'daemon off;'`)
- Subdirectories:
  - [`./src/README.md`](./src/README.md) - TypeScript/React application source, router (`App.tsx`), Axios client (`api.ts`), domain types (`types.ts`), authentication context (`./src/context/README.md`), and UI components (`./src/components/README.md`)

## Invariants
- `[package.json:private]` Package is marked `"private": true` and `"type": "module"`.
- `[nginx.conf:client_max_body_size]` Enforces a `1m` (`1 MB`) request body size cap.
- `[nginx.conf:$forwarded_proto]` Preserves upstream `X-Forwarded-Proto` when present, falling back to `$scheme`.
- `[nginx.conf:try_files]` Falls back unmatched paths under `/` to `/index.html` for client-side React Router navigation.

## Side Effects
- `[Dockerfile:RUN npm install]` and `[Dockerfile:RUN npm run build]` Install Node dependencies and emit production assets to `/app/dist` during container build.
- `[nginx.conf:proxy_pass]` Forwards `/api/` HTTP requests over the Docker network to `http://backend:8000/` with `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers.

## Verification
- Run: `npm run build && npm run lint`

---

## Developer Notes (React + TypeScript + Vite)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

### React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

### Expanding the ESLint configuration

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

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-react-dom) for React-specific lint rules:

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
