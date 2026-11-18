# Money Account — go live (not done yet)

Three pieces. Nothing here has been published or deployed.

## 1. The app (phone)
Static files in `docs/`. Same pattern as the other apps: a public GitHub repo with Pages serving `docs/` on main. The repo holds code only — your records never leave your phone.
After changing files, bump `CACHE` in `docs/sw.js` so phones pick up the update.

## 2. The server (share prices + AI) — Cloudflare Worker `money-account-server`
Code in `server/` (`worker.mjs`, `quote.mjs`, `ai.mjs`). It stores nothing.
```
cd "Money Account/server"
node "../../Die With Zero Simulator/rooms-server/node_modules/wrangler/bin/wrangler.js" deploy
node "../../Die With Zero Simulator/rooms-server/node_modules/wrangler/bin/wrangler.js" secret put APP_CODE
node "../../Die With Zero Simulator/rooms-server/node_modules/wrangler/bin/wrangler.js" secret put OPENAI_API_KEY
```
- `APP_CODE`: a long private code (you type it; also typed into the app's Settings → AI access code). Without it anyone who finds the link could spend your OpenAI credit.
- `OPENAI_API_KEY`: your key — type it yourself.
- Optional vars: `AI_MODEL` (text, default gpt-4o-mini), `AI_VISION_MODEL` (photos, default gpt-4o), `TRANSCRIBE_MODEL`.
- Then in the app: More → Settings → Server link = `https://money-account-server.<your-subdomain>.workers.dev`.
- The PC has little RAM: close browser tabs if wrangler crashes.

## 3. Privacy note for AI
Voice notes and photos you choose to read are sent through the Worker to OpenAI and are not kept by the Worker. Share prices send only ticker symbols.

## Local testing
`node serve.js 5201` (preview config `money-account`). Without `OPENAI_API_KEY` in the environment the AI gives clearly marked STAND-IN replies from `test/fixtures/`. `node test.js` runs the money-maths checks.
