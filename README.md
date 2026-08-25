# ManuControl Frontend

SPA Vite do ManuControl — deploy na **Vercel**, API no Render.

## Local

```powershell
cd C:\Projetos\manufront
npm install
npm run dev
```

Com a API em `http://127.0.0.1:5000`, use `VITE_API_URL=/api` (proxy do Vite).

## Produção

Defina na Vercel:

```text
VITE_API_URL=https://manucontrol-backend.onrender.com/api
```

Build: `npm run build` · Output: `dist` · ver `vercel.json`.
