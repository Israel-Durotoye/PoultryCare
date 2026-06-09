# CluckCare — Poultry Health Diagnostics (Frontend)

Minimal React + TypeScript frontend for the CluckCare demo. Update `API_BASE_URL` in [src/pages/Index.tsx](src/pages/Index.tsx#L1) to point to your FastAPI server.

Install and run (using `npm`, `pnpm`, or `yarn`):

```bash
# install (npm)
npm install

# start dev server (npm)
npm run dev

# build for production
npm run build
```

If you prefer `pnpm` or `yarn`, use `pnpm install` / `yarn install` and the same `run` scripts.

Endpoints expected:
- `POST /analyze-audio` (FormData `file`)
- `POST /analyze-image` (FormData `file`)
