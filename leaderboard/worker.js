/**
 * Atrophy leaderboard — a deliberately tiny Cloudflare Worker + D1 API.
 *
 * Everything here is self-reported and opt-in: entries are anonymous handles,
 * write access is a per-entry bearer token minted on first publish, and the
 * whole thing is honor-system by design (you'd only be cheating your own chart).
 *
 * POST /v1/publish      { token?, handle, overall, reps, axes } -> { token, handle }
 * GET  /v1/leaderboard  -> { count, entries: [{ handle, overall, reps, updated_at }] }
 */

const AXES = ["syntax-recall", "debugging", "code-reading", "api-memory", "decomposition"];
const HANDLE_RE = /^[a-zA-Z0-9_-]{3,20}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function validate(body) {
  if (typeof body !== "object" || body === null) return null;
  const handle = String(body.handle ?? "");
  if (!HANDLE_RE.test(handle)) return null;
  const overall = Number(body.overall);
  const reps = Number(body.reps);
  if (!Number.isFinite(overall) || !Number.isFinite(reps)) return null;
  const axes = {};
  if (typeof body.axes !== "object" || body.axes === null) return null;
  for (const [axis, v] of Object.entries(body.axes)) {
    if (!AXES.includes(axis) || typeof v !== "object" || v === null) return null;
    axes[axis] = {
      rating: clamp(Number(v.rating) || 0, 0, 4000),
      rd: clamp(Number(v.rd) || 0, 0, 350),
      reps: clamp(Math.floor(Number(v.reps) || 0), 0, 100000),
    };
  }
  return {
    handle,
    overall: clamp(overall, 0, 4000),
    reps: clamp(Math.floor(reps), 0, 100000),
    axes: JSON.stringify(axes),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/v1/leaderboard" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT handle, overall, reps, updated_at FROM entries ORDER BY overall DESC, reps DESC LIMIT 100",
      ).all();
      const count = (await env.DB.prepare("SELECT COUNT(*) AS c FROM entries").first())?.c ?? 0;
      return json({ count, entries: results });
    }

    if (url.pathname === "/v1/publish" && request.method === "POST") {
      let body;
      try {
        const text = await request.text();
        if (text.length > 4096) return json({ error: "payload too large" }, 413);
        body = JSON.parse(text);
      } catch {
        return json({ error: "invalid JSON" }, 400);
      }
      const entry = validate(body);
      if (!entry) return json({ error: "invalid payload" }, 400);
      const now = new Date().toISOString();

      const token = typeof body.token === "string" && body.token.length >= 16 ? body.token : null;
      if (token) {
        const existing = await env.DB.prepare("SELECT handle FROM entries WHERE token = ?")
          .bind(token)
          .first();
        if (!existing) return json({ error: "unknown token" }, 404);
        const clash = await env.DB.prepare(
          "SELECT 1 FROM entries WHERE handle = ? COLLATE NOCASE AND token != ?",
        )
          .bind(entry.handle, token)
          .first();
        if (clash) return json({ error: "handle already taken" }, 409);
        await env.DB.prepare(
          "UPDATE entries SET handle = ?, overall = ?, reps = ?, axes = ?, updated_at = ? WHERE token = ?",
        )
          .bind(entry.handle, entry.overall, entry.reps, entry.axes, now, token)
          .run();
        return json({ token, handle: entry.handle });
      }

      const clash = await env.DB.prepare("SELECT 1 FROM entries WHERE handle = ? COLLATE NOCASE")
        .bind(entry.handle)
        .first();
      if (clash) return json({ error: "handle already taken" }, 409);
      const minted = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO entries (token, handle, overall, reps, axes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(minted, entry.handle, entry.overall, entry.reps, entry.axes, now, now)
        .run();
      return json({ token: minted, handle: entry.handle });
    }

    return json({ error: "not found" }, 404);
  },
};
