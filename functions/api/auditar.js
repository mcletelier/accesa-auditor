/**
 * POST /api/auditar   { url }
 * Descarga la página real desde el servidor de Cloudflare (sin proxys externos),
 * la analiza y devuelve el resultado firmado.
 *
 * Variables (Cloudflare Pages → Settings → Variables and secrets):
 *   ANTHROPIC_API_KEY  (secreto, opcional)  Resumen en lenguaje claro. Sin ella se usa un resumen por reglas.
 *   CLAUDE_MODEL       (opcional)           Modelo de Claude. Por defecto claude-haiku-5-5.
 *   REPORT_SECRET      (secreto, opcional)  Clave para firmar resultados. Si no está, se usa RESEND_API_KEY.
 */
import { analizar, revisarFoco, calcularPuntaje, ordenar } from "../../lib/analizar.js";
import { resumir } from "../../lib/resumen.js";
import { json, mismoOrigen, normalizarUrl, firmar } from "../../lib/servidor.js";

const MAX_HTML = 3 * 1024 * 1024;
const MAX_CSS = 400 * 1024;
const UA = "Mozilla/5.0 (compatible; AccesaAuditor/2.0; +https://accesa.agency)";
// Algunos sitios bloquean cualquier cliente que no se identifique como navegador.
// Si responden «acceso denegado», se reintenta una vez con encabezados de navegador.
const UA_NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const ENCABEZADOS_NAVEGADOR = {
  "User-Agent": UA_NAVEGADOR,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

async function descargar(url, { timeout = 15000, max = MAX_HTML, accept = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", comoNavegador = false } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: comoNavegador ? ENCABEZADOS_NAVEGADOR : { "User-Agent": UA, Accept: accept, "Accept-Language": "es-CL,es;q=0.9,en;q=0.6" },
      cf: { cacheTtl: 0 },
    });
    // Lee como máximo `max` bytes para no colgar la función con páginas gigantes
    const reader = res.body?.getReader();
    const partes = [];
    let total = 0, truncado = false;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max) { truncado = true; partes.push(value.slice(0, value.byteLength - (total - max))); await reader.cancel(); break; }
        partes.push(value);
      }
    }
    const cuerpo = new Uint8Array(Math.min(total, max));
    let off = 0;
    for (const p of partes) { cuerpo.set(p, off); off += p.byteLength; }
    return { res, cuerpo, truncado };
  } finally {
    clearTimeout(t);
  }
}

function mensajeHttp(status) {
  if (status === 401 || status === 403) return "El sitio tiene una protección que bloquea las revisiones automáticas (respondió «acceso denegado»). Si es tu sitio, escríbenos y lo revisamos de otra forma.";
  if (status === 404) return "La página no existe (error 404). Revisa que la dirección esté bien escrita.";
  if (status === 429) return "El sitio está limitando las consultas en este momento. Intenta de nuevo en unos minutos.";
  if (status >= 500) return `El sitio respondió con un error del servidor (${status}). Intenta más tarde.`;
  return `El sitio respondió con un código inesperado (${status}).`;
}

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request)) return json({ error: "Origen no permitido." }, 403);

  let entrada;
  try { entrada = (await request.json()).url; } catch { return json({ error: "Solicitud inválida." }, 400); }

  let url;
  try { url = normalizarUrl(entrada, { permitirLocal: env.ALLOW_LOCAL === "1" }); }
  catch (e) { return json({ error: e.message }, 400); }

  // 1. Descargar la página real
  let descarga;
  try {
    descarga = await descargar(url.toString());
    if ([401, 403, 406, 429, 503].includes(descarga.res.status)) {
      const servidor = descarga.res.headers.get("server") || "?";
      console.log(`Primer intento ${descarga.res.status} (server: ${servidor}); reintentando como navegador`);
      descarga = await descargar(url.toString(), { comoNavegador: true });
    }
  } catch (e) {
    const msg = e.name === "AbortError"
      ? "El sitio tardó demasiado en responder (más de 15 segundos)."
      : "No pudimos conectarnos con el sitio. Revisa que la dirección exista y esté publicada.";
    return json({ error: msg }, 502);
  }
  const { res, cuerpo, truncado } = descarga;
  if (!res.ok) {
    console.log(`No se pudo revisar ${url}: ${res.status} (server: ${res.headers.get("server") || "?"})`);
    return json({ error: mensajeHttp(res.status) }, 502);
  }
  const tipo = (res.headers.get("content-type") || "").toLowerCase();
  if (tipo && !tipo.includes("html")) return json({ error: "Esa dirección no es una página web (parece ser un archivo). Ingresa la dirección de una página HTML." }, 422);
  const finalUrl = res.url || url.toString();

  // 2. Analizar el HTML
  const html = new Response(cuerpo, { headers: { "content-type": "text/html; charset=utf-8" } });
  const { hallazgos, add, meta } = await analizar(html, { baseUrl: finalUrl });

  // Protección contra bots que entrega una página de desafío en vez del sitio
  if (/just a moment|attention required|access denied|captcha/i.test(meta.title) && meta.textoVisible < 1500) {
    return json({ error: "El sitio mostró una página de verificación anti-bots en vez de su contenido, así que no podemos revisarlo automáticamente." }, 502);
  }

  // 3. Revisar las hojas de estilo (indicador de foco)
  revisarFoco(meta.cssInterno, "CSS interno", add);
  const hojas = meta.hojasDeEstilo.slice(0, 4);
  await Promise.all(hojas.map(async (href) => {
    try {
      const { res: r, cuerpo: c } = await descargar(href, { timeout: 6000, max: MAX_CSS, accept: "text/css,*/*;q=0.1" });
      if (r.ok) revisarFoco(new TextDecoder().decode(c), href.split("/").pop().split("?")[0] || "estilos", add);
    } catch { /* una hoja de estilo que no carga no detiene la revisión */ }
  }));

  // Si la página se arma con JavaScript, solo valen los hallazgos de la cabecera y los estilos:
  // el resto del contenido aún no existe en el HTML inicial y daría falsos positivos.
  const SOLO_CABECERA = new Set(["titulo", "lang", "lang-invalido", "zoom", "refresh", "foco"]);
  const lista = ordenar([...hallazgos.values()].filter((h) => !meta.dependeDeJs || SOLO_CABECERA.has(h.id)));
  const puntaje = meta.dependeDeJs ? null : calcularPuntaje(lista);

  // 4. Resumen en lenguaje claro
  const { resumen, prioridades, fuente } = await resumir(env, { url: finalUrl, meta, lista, puntaje });

  const resultado = {
    version: 2,
    url: finalUrl,
    fecha: new Date().toISOString(),
    puntaje,
    resumen,
    prioridades,
    fuenteResumen: fuente,
    hallazgos: lista,
    meta: {
      title: meta.title, lang: meta.lang, imgs: meta.imgs, links: meta.links, forms: meta.forms,
      campos: meta.campos, dependeDeJs: meta.dependeDeJs, truncado, hojasRevisadas: hojas.length,
    },
  };
  const payload = JSON.stringify(resultado);
  return json({ payload, firma: await firmar(env, payload) });
}
