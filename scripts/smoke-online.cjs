/**
 * Online / local smoke checks for Phase 19.
 * Usage:
 *   node scripts/smoke-online.cjs
 *   SMOKE_API_URL=https://api.example.com SMOKE_WEB_URL=https://app.example.com node scripts/smoke-online.cjs
 *
 * Does not print secrets. Exit 0 only if required checks pass.
 */
const apiBase = (process.env.SMOKE_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const webBase = (process.env.SMOKE_WEB_URL || "").replace(/\/$/, "");

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, message });
    console.log(`FAIL  ${name}: ${message}`);
  }
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function main() {
  console.log(`[smoke] API=${apiBase}${webBase ? ` WEB=${webBase}` : ""}`);

  await check("GET /health", async () => {
    const { res, body } = await getJson(`${apiBase}/health`);
    if (!res.ok || !body?.ok) throw new Error(`status=${res.status}`);
  });

  await check("GET /health/supabase", async () => {
    const { res, body } = await getJson(`${apiBase}/health/supabase`);
    if (res.status === 503 && body?.configured === false) {
      throw new Error("Supabase env not configured on API");
    }
    if (!res.ok) throw new Error(`status=${res.status} message=${body?.message ?? ""}`);
  });

  await check("unauthorized protected ping blocked", async () => {
    const { res } = await getJson(`${apiBase}/api/v1/protected/ping`);
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`expected 401/403, got ${res.status}`);
    }
  });

  await check("unauthorized /auth/me blocked", async () => {
    const { res } = await getJson(`${apiBase}/api/v1/auth/me`);
    if (res.status !== 401 && res.status !== 403) {
      throw new Error(`expected 401/403, got ${res.status}`);
    }
  });

  await check("login rejects empty body", async () => {
    const { res } = await getJson(`${apiBase}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status < 400) throw new Error(`expected 4xx, got ${res.status}`);
  });

  if (webBase) {
    await check("WEB /login reachable", async () => {
      const res = await fetch(`${webBase}/login`);
      if (!res.ok) throw new Error(`status=${res.status}`);
      const html = await res.text();
      if (!html.includes("<!DOCTYPE html") && !html.includes("<html")) {
        throw new Error("response is not HTML");
      }
    });
  } else {
    console.log("SKIP  WEB checks (set SMOKE_WEB_URL)");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`[smoke] ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(2);
}

main().catch((err) => {
  console.error("[smoke] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
