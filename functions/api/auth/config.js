import { json } from "../../_utils/http.js";
export async function onRequestGet({ env }) {
  const enabled = Boolean(String(env?.TURNSTILE_SITE_KEY || "").trim() && String(env?.TURNSTILE_SECRET_KEY || "").trim());
  return json({ turnstileSiteKey: enabled ? String(env.TURNSTILE_SITE_KEY) : "" });
}
