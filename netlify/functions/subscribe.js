// subscribe.js - Netlify Function: capture an email from a landing page into Brevo.
//
// The Brevo API key lives ONLY here, as a Netlify environment variable (BREVO_API_KEY) - never in
// the browser, never in the repo. The form on /not-a-stock POSTs here; we create/update the contact
// tagged by KEYWORD + SOURCE and drop it into the right Brevo list. A Brevo Automation (triggered by
// "contact added to list") then delivers the magnet PDF and starts the nurture sequence.
//
// Env vars (set once in Netlify -> Site settings -> Environment variables):
//   BREVO_API_KEY   - the Brevo v3 API key (required)
//   BREVO_LISTS     - JSON map of keyword -> Brevo list id, e.g. {"SPX":2,"PRINTER":3}  (optional)
//
// Until BREVO_API_KEY is set, this returns a clean 503 and the page falls back to the direct PDF link,
// so the landing page is safe to deploy before the account exists.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "method_not_allowed" });
  }

  // parse JSON or urlencoded
  let body = {};
  try {
    const ct = (event.headers["content-type"] || "").toLowerCase();
    if (ct.includes("application/json")) {
      body = JSON.parse(event.body || "{}");
    } else {
      body = Object.fromEntries(new URLSearchParams(event.body || ""));
    }
  } catch (_) {
    return json(400, { ok: false, error: "bad_body" });
  }

  // honeypot: real users never fill "company"
  if (body.company) return json(200, { ok: true });

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: "invalid_email" });

  const keyword = String(body.keyword || "SPX").trim().toUpperCase().slice(0, 24);
  const firstName = String(body.firstName || "").trim().slice(0, 80);

  const KEY = process.env.BREVO_API_KEY;
  if (!KEY) {
    // Account not wired yet. Tell the page to fall back to the direct PDF link.
    return json(503, { ok: false, error: "not_configured" });
  }

  let listIds = [];
  try {
    const map = JSON.parse(process.env.BREVO_LISTS || "{}");
    if (map[keyword]) listIds = [Number(map[keyword])];
  } catch (_) { /* no map -> no list; automation can trigger on the KEYWORD attribute instead */ }

  const attributes = { KEYWORD: keyword, SOURCE: "landing" };
  if (firstName) attributes.FIRSTNAME = firstName;

  const make = (attrs) => ({
    email,
    updateEnabled: true,
    ...(attrs ? { attributes: attrs } : {}),
    ...(listIds.length ? { listIds } : {}),
  });

  try {
    let res = await brevo(KEY, make(attributes));
    // If an attribute isn't defined in the Brevo account, retry without attributes so capture
    // never fails the visitor. (Setup guide creates KEYWORD/SOURCE; this is just a safety net.)
    if (res.status === 400) {
      const txt = await res.text();
      if (/attribute/i.test(txt)) {
        res = await brevo(KEY, make(null));
      } else {
        return json(502, { ok: false, error: "brevo", detail: txt.slice(0, 300) });
      }
    }
    if (res.status >= 400) {
      const txt = await res.text();
      return json(502, { ok: false, error: "brevo", detail: txt.slice(0, 300) });
    }
    return json(200, { ok: true });
  } catch (e) {
    return json(502, { ok: false, error: "exception", detail: String(e).slice(0, 300) });
  }
};

function brevo(key, payload) {
  return fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: { "api-key": key, "accept": "application/json", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function json(status, obj) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(obj),
  };
}
