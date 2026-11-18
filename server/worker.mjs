// Cloudflare Worker for Money Account: share prices (GET /quote, /search) and AI helper (POST /ai, /transcribe).
// Deploy from this folder with wrangler (see GO LIVE.md). Secrets: OPENAI_API_KEY, APP_CODE.
import { handle } from './quote.mjs';
import { handleAI } from './ai.mjs';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Code', 'Content-Type': 'application/json' };

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    let r;
    if (req.method === 'POST') r = await handleAI(url.pathname, req, env);
    else if (req.method === 'GET') r = await handle(url.pathname, url.searchParams);
    else r = { status: 405, body: { error: 'method' } };
    const extra = req.method === 'GET' && r.status === 200 ? { 'Cache-Control': 'public, max-age=120' } : { 'Cache-Control': 'no-store' };
    return new Response(JSON.stringify(r.body), { status: r.status, headers: Object.assign(extra, CORS) });
  },
};
