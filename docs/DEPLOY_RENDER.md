# Déployer le backend sur Render + frontend sur Vercel

## Architecture cible

```text
Navigateur → Vercel (React) → https://talentos-api.onrender.com (FastAPI)
                              ↓
                    PostgreSQL Render (déjà dans votre .env)
                    Redis Upstash (REDIS_URL)
```

**Plus besoin de ngrok** pour la démo si le backend est sur Render.

---

## 1. Service Web sur Render

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connectez le repo GitHub `pfe-recrutement-ia`
3. Paramètres :

| Champ | Valeur |
|--------|--------|
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/health` |

Ou importez `render.yaml` à la racine du repo (Blueprint).

**Plan :** préférez **Starter** (512 Mo+). Le plan Free peut échouer (PaddleOCR, TensorFlow, PyTorch).

---

## 2. Variables d'environnement (Render → Environment)

Copiez depuis votre `backend/.env` local (ne les commitez pas) :

| Variable | Exemple / note |
|----------|----------------|
| `DATABASE_URL` | URL **Internal** PostgreSQL Render |
| `REDIS_URL` | URL Upstash (déjà configurée) |
| `SECRET_KEY` | Chaîne aléatoire longue |
| `GROQ_API_KEY` | Clé Groq |
| `FRONTEND_URL` | `https://pfe-recrutement-ia.vercel.app` |
| `CORS_EXTRA_ORIGINS` | `https://pfe-recrutement-ia.vercel.app` |
| `DEBUG` | `false` |
| `SMTP_*`, `EMAIL_FROM` | Mailtrap ou SMTP réel |
| `OCR_LANG` | `latin` ou `fr` |

Celery utilise automatiquement `REDIS_URL` si `CELERY_BROKER_URL` n'est pas défini.

---

## 3. Vérifier le déploiement

URL Render du type : `https://talentos-api-xxxx.onrender.com`

```text
GET https://VOTRE-URL.onrender.com/health  →  {"status":"ok"}
GET https://VOTRE-URL.onrender.com/docs    →  Swagger
```

---

## 4. Vercel (frontend)

**Settings → Environment Variables** :

```env
VITE_API_URL=https://VOTRE-URL.onrender.com
```

Puis **Redeploy** le projet frontend.

Sur la page login, la ligne **API:** doit afficher l’URL Render (pas `localhost`).

---

## 5. Sur votre PC (développement local)

| Terminal | Commande | Quand |
|----------|----------|--------|
| Backend local | `uvicorn main:app --port 8000` | Dev / tests |
| ngrok | — | **Optionnel**, plus requis si API sur Render |
| `npm run dev` | — | **Optionnel** si vous utilisez Vercel |

`frontend/.env.local` en local :

```env
VITE_API_URL=http://localhost:8000
```

ou l’URL Render pour tester contre la prod :

```env
VITE_API_URL=https://VOTRE-URL.onrender.com
```

---

## 6. Limitations Render

- **Disque éphémère** : fichiers `interview_media/` et CV uploadés peuvent disparaître après redéploiement → à terme, stockage S3/Render Disk.
- **Cold start** (plan Free) : première requête lente après inactivité.
- **Build lourd** : IA (OCR, DeepFace, torch) → build 10–20 min, RAM élevée.

---

## 7. Worker Celery (optionnel)

Tâches async (CV, closing). Sur Render : **Background Worker** avec :

```bash
celery -A celery_app.celery_app worker --loglevel=info
```

Même `rootDir: backend` et mêmes variables d’environnement que le Web Service.

Sans worker, une partie des tâches tourne en synchrone au démarrage / requêtes API.

---

## 8. Checklist

- [ ] Web Service Render déployé, `/health` OK
- [ ] `VITE_API_URL` sur Vercel = URL Render
- [ ] Redeploy Vercel
- [ ] Login sur `https://pfe-recrutement-ia.vercel.app` OK
- [ ] `CORS_EXTRA_ORIGINS` et `FRONTEND_URL` pointent vers Vercel
- [ ] Retirer ngrok du flux de démo si tout passe par Render
