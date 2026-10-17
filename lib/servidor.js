/** Utilidades compartidas por las funciones del servidor. */

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Solo se aceptan llamadas desde el propio auditor (no desde otros sitios). */
export function mismoOrigen(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

/* ── Firma del resultado ─────────────────────────────────────────────────
   El resultado de la auditoría viaja al navegador y vuelve cuando la persona pide
   el informe por correo. La firma impide que alguien altere el contenido y use
   el auditor para mandar correos con texto inventado a nombre de Accesa. */
const enc = new TextEncoder();
async function clave(env) {
  const secreto = env.REPORT_SECRET || env.RESEND_API_KEY || "accesa-sin-secreto";
  return crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function firmar(env, payload) {
  return b64(await crypto.subtle.sign("HMAC", await clave(env), enc.encode(payload)));
}
export async function verificar(env, payload, firma) {
  try { return await crypto.subtle.verify("HMAC", await clave(env), deb64(firma), enc.encode(payload)); }
  catch { return false; }
}

/* ── Validación de la URL a auditar ─────────────────────────────────────── */
export function normalizarUrl(entrada, { permitirLocal = false } = {}) {
  let s = String(entrada || "").trim();
  if (!s) throw new Error("Escribe la dirección del sitio que quieres revisar.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) throw new Error("Solo se pueden revisar páginas web (http o https).");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch { throw new Error("La dirección no parece válida. Prueba con algo como https://www.tu-sitio.cl"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Solo se pueden revisar páginas web (http o https).");
  const h = u.hostname.toLowerCase();
  const esIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");
  if (!permitirLocal && (esIp || h === "localhost" || !h.includes(".") || /\.(local|localhost|internal|lan|home|test)$/.test(h))) {
    throw new Error("Esa dirección no es un sitio público. Ingresa un dominio, como https://www.tu-sitio.cl");
  }
  if (!permitirLocal && u.port && !["80", "443"].includes(u.port)) throw new Error("Solo se pueden revisar sitios en los puertos web habituales.");
  u.hash = "";
  return u;
}
