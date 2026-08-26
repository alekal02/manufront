# ManuControl Frontend

SPA Vite do ManuControl — **só o front** na Vercel. A API Flask fica no **Render** (`manuback`).

## Repos

| Parte | GitHub | Deploy |
|-------|--------|--------|
| Front | [alekal02/manufront](https://github.com/alekal02/manufront) | [Vercel](https://manufront.vercel.app) |
| API | [alekal02/manuback](https://github.com/alekal02/manuback) | [Render](https://manuback.onrender.com) |

## Local

```powershell
cd C:\Projetos\manufront
npm install
npm run dev
```

Com a API em `http://127.0.0.1:5000`, use `VITE_API_URL=/api` (proxy do Vite).

## Produção (Vercel)

Defina:

```text
VITE_API_URL=https://manuback.onrender.com/api
```

Build: `npm run build` · Output: `dist`.

Não publique o `manuback` na Vercel — Flask/Gunicorn roda no Render.
