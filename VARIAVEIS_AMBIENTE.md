# Variáveis — ManuControl Frontend (Vercel)

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://manuback.onrender.com/api` |

Deve terminar com `/api`. Depois de salvar, faça **Redeploy**.

## Topologia (igual PneuSistemma)

- **Vercel** → só `manufront` (SPA)
- **Render** → só `manuback` (API Flask + Neon + WuzAPI)
- Não crie projeto `manuback` na Vercel
