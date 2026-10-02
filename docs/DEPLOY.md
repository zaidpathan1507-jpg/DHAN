# Deploy DHAN on Render (one link)

DHAN deploys as a single Docker web service: the image builds the React app and FastAPI serves both the site and `/api`.

## 1. MongoDB Atlas
1. Create a free cluster at cloud.mongodb.com.
2. Database Access: create a user with a password.
3. Network Access: add `0.0.0.0/0` (Render's free tier has no fixed IP).
4. Connect > Drivers: copy the URI, replace `<password>`. Put the database name in `MONGODB_DB`, not the URI.

## 2. Push to GitHub
```bash
git add -A
git commit -m "Deploy config"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
`.env` is git-ignored, so no secrets are pushed.

## 3. Create the Render service
1. render.com > New > **Blueprint** > connect the repo. Render reads `render.yaml`.
   (Or New > Web Service > Runtime **Docker**, health check path `/api/v1/health`.)
2. Fill the prompted env vars:
   - `MONGODB_URI`: the Atlas URI
   - `GROQ_API_KEY`: your Groq key (optional; without it DHAN AI uses the rules engine)
   - `JWT_SECRET` is generated for you.
3. Deploy. The first build takes about 5-8 minutes.

## 4. Seed the demo account
After the first deploy, from your own machine, with `backend/.env` pointing at the same Atlas URI:
```bash
cd backend
python -m scripts.seed_gowurk
```
Log in at your Render URL with `7410534319` / `12345678`.

## 5. Optional env vars (Render > Environment)
`SMTP_*` (real email), `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID`, `RAZORPAY_*`. Payment links use `RENDER_EXTERNAL_URL` automatically; set `APP_BASE_URL` only if you add a custom domain.

## Things to know
- Free instances sleep after ~15 minutes idle (first request takes ~30-50 s). Open the URL before a demo. The reminder scheduler and Monday report only run while the instance is awake.
- Live notifications use SSE; they work on Render.
- Redeploys happen on every push to `main`.
