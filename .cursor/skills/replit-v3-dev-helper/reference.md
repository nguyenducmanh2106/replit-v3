# Repo-specific reference (replit-v3)

## Package names (pnpm `--filter`)

- `@workspace/edu-platform`
- `@workspace/api-server`

## Notable scripts

### `artifacts/edu-platform/package.json`

- `dev`: `vite --config vite.config.ts --host 0.0.0.0`
- `build`: `vite build --config vite.config.ts`
- `serve`: `vite preview --config vite.config.ts --host 0.0.0.0`
- `typecheck`: `tsc -p tsconfig.json --noEmit`

### `artifacts/api-server/package.json`

- `dev`: `cross-env NODE_ENV=development pnpm run build && pnpm run start`
- `build`: `node ./build.mjs`
- `start`: `node --env-file-if-exists=../../.env --env-file-if-exists=.env --enable-source-maps ./dist/index.mjs`
- `typecheck`: `tsc -p tsconfig.json --noEmit`

## Environment files

- api-server `start` optionally loads env from `../../.env` (repo root) and `artifacts/api-server/.env` if present.
- Treat `.env*` as secrets by default; prefer documenting required vars in an example file.

