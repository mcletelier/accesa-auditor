/**
 * Motor de análisis estático de Accesa.
 * Corre en el servidor (Cloudflare Pages Functions) con HTMLRewriter, que lee el
 * HTML real del sitio sin construir el árbol completo (rápido y con poco uso de CPU).
 *
 * Cada hallazgo agrupa todas las instancias de un mismo problema:
 *   { id, rule, level, cat, severity: "error" | "revisar", name, count, examples[], fix }
 *   - "error":   falla detectada con certeza razonable.
 *   - "revisar": señal de posible problema que una persona debe confirmar.
 */

const MAX_EJEMPLOS = 3;
const GENERICOS = new Set([
  "aquí", "aqui", "click aquí", "click aqui", "clic aquí", "clic aqui", "haz clic aquí", "haz click aquí",
  "pincha aquí", "here", "click here", "click", "clic", "ver más", "ver mas", "más", "mas", "más info",
  "mas info", "más información", "leer más", "leer mas", "read more", "more", "learn more", "link", "enlace",
  "saber más", "saber mas", "ir", "ver", "continuar", "seguir leyendo",
]);
const ALT_POBRE = /^(image|imagen|img|foto|photo|picture|logo|icono|icon|banner|untitled|sin título|dsc[_-]?\d+)$|\.(jpe?g|png|gif|webp|svg|avif)$/i;
const LANG_VALIDO = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

const DEF = {
  "img-alt":        { rule: "1.1.1", level: "A",  cat: "Perceptible",  severity: "error",   name: "Imágenes sin texto alternativo", fix: "Agrega un atributo alt que describa la imagen. Si es decorativa, usa alt=\"\" para que el lector de pantalla la omita." },
  "img-alt-pobre":  { rule: "1.1.1", level: "A",  cat: "Perceptible",  severity: "revisar", name: "Texto alternativo poco descriptivo (nombre de archivo o palabra genérica)", fix: "Reemplaza el alt por una descripción de lo que la imagen comunica, no por su nombre de archivo." },
  "input-img-alt":  { rule: "1.1.1", level: "A",  cat: "Perceptible",  severity: "error",   name: "Botones de imagen sin texto alternativo", fix: "Agrega alt al <input type=\"image\"> indicando la acción del botón (por ejemplo, alt=\"Buscar\")." },
  "svg-img":        { rule: "1.1.1", level: "A",  cat: "Perceptible",  severity: "error",   name: "Gráficos SVG marcados como imagen sin nombre accesible", fix: "Agrega aria-label o un <title> dentro del <svg role=\"img\">." },
  "video-subt":     { rule: "1.2.2", level: "A",  cat: "Perceptible",  severity: "revisar", name: "Videos sin pista de subtítulos detectable", fix: "Incluye subtítulos sincronizados (<track kind=\"captions\">) y verifica su calidad." },
  "iframe-video":   { rule: "1.2.2", level: "A",  cat: "Perceptible",  severity: "revisar", name: "Videos incrustados (YouTube, Vimeo u otros): verificar subtítulos", fix: "Confirma que cada video incrustado tenga subtítulos revisados, no solo los automáticos." },
  "encabezado-salto": { rule: "1.3.1", level: "A", cat: "Perceptible", severity: "error",   name: "Saltos en la jerarquía de encabezados", fix: "Usa los encabezados en orden (h1 → h2 → h3) sin saltar niveles, para que la estructura se entienda al navegar con lector de pantalla." },
  "sin-h1":         { rule: "1.3.1", level: "A",  cat: "Perceptible",  severity: "revisar", name: "La página no tiene encabezado principal (h1)", fix: "Agrega un <h1> que describa el contenido principal de la página." },
  "tabla-th":       { rule: "1.3.1", level: "A",  cat: "Perceptible",  severity: "error",   name: "Tablas de datos sin celdas de encabezado (<th>)", fix: "Marca los encabezados con <th scope=\"col\"> o <th scope=\"row\">. Si la tabla es solo de diseño, agrega role=\"presentation\"." },
  "autocomplete":   { rule: "1.3.5", level: "AA", cat: "Perceptible",  severity: "revisar", name: "Campos de datos personales sin atributo autocomplete", fix: "Agrega autocomplete con el valor que corresponda (name, email, tel, street-address, etc.)." },
  "autoplay":       { rule: "1.4.2", level: "A",  cat: "Perceptible",  severity: "revisar", name: "Audio o video con reproducción automática", fix: "Evita la reproducción automática con sonido, o entrega un control visible para pausarlo o silenciarlo." },
  "zoom":           { rule: "1.4.4", level: "AA", cat: "Perceptible",  severity: "error",   name: "La página impide hacer zoom en el teléfono", fix: "Quita user-scalable=no y maximum-scale de la etiqueta <meta name=\"viewport\">." },
  "refresh":        { rule: "2.2.1", level: "A",  cat: "Operable",     severity: "error",   name: "La página se recarga o redirige sola después de un tiempo", fix: "Elimina el <meta http-equiv=\"refresh\"> temporizado o permite a la persona controlar el tiempo." },
  "marquee":        { rule: "2.2.2", level: "A",  cat: "Operable",     severity: "error",   name: "Texto en movimiento que no se puede detener (<marquee> o <blink>)", fix: "Reemplaza el movimiento automático por contenido estático o agrega un botón para pausarlo." },
  "bypass":         { rule: "2.4.1", level: "A",  cat: "Operable",     severity: "error",   name: "No hay forma de saltar directo al contenido principal", fix: "Agrega una región <main> y un enlace «Saltar al contenido» al inicio de la página." },
  "titulo":         { rule: "2.4.2", level: "A",  cat: "Operable",     severity: "error",   name: "La página no tiene título (<title>)", fix: "Agrega un <title> único que describa la página y el sitio." },
  "tabindex":       { rule: "2.4.3", level: "A",  cat: "Operable",     severity: "revisar", name: "Elementos con tabindex positivo (alteran el orden del teclado)", fix: "Usa tabindex=\"0\" o el orden natural del HTML; los valores positivos desordenan la navegación con teclado." },
  "enlace-vacio":   { rule: "2.4.4", level: "A",  cat: "Operable",     severity: "error",   name: "Enlaces sin texto (el lector de pantalla no sabe adónde llevan)", fix: "Agrega texto visible o un aria-label que describa el destino. En íconos, usa texto oculto visualmente." },
  "enlace-generico": { rule: "2.4.4", level: "A", cat: "Operable",     severity: "revisar", name: "Enlaces con texto genérico («aquí», «ver más»)", fix: "Usa textos que describan el destino, por ejemplo «Ver requisitos de postulación» en vez de «aquí»." },
  "foco":           { rule: "2.4.7", level: "AA", cat: "Operable",     severity: "revisar", name: "Hojas de estilo que eliminan el indicador de foco (outline)", fix: "Si se quita el outline, reemplázalo por un estilo de foco visible (borde, sombra o fondo) en :focus-visible." },
  "clic-div":       { rule: "2.1.1", level: "A",  cat: "Operable",     severity: "error",   name: "Elementos clicables que no funcionan con teclado (div o span con onclick)", fix: "Usa <button> o <a href>. Si no es posible, agrega role, tabindex=\"0\" y manejo de las teclas Enter y Espacio." },
  "lang":           { rule: "3.1.1", level: "A",  cat: "Comprensible", severity: "error",   name: "No se declara el idioma de la página", fix: "Agrega lang=\"es\" (o el idioma que corresponda) a la etiqueta <html>." },
  "lang-invalido":  { rule: "3.1.1", level: "A",  cat: "Comprensible", severity: "error",   name: "El idioma declarado no es válido", fix: "Usa un código de idioma válido, como lang=\"es\" o lang=\"es-CL\"." },
  "campo-etiqueta": { rule: "3.3.2", level: "A",  cat: "Comprensible", severity: "error",   name: "Campos de formulario sin etiqueta", fix: "Asocia cada campo a un <label for=\"id\">. El placeholder no reemplaza a la etiqueta porque desaparece al escribir." },
  "boton-nombre":   { rule: "4.1.2", level: "A",  cat: "Robusto",      severity: "error",   name: "Botones sin nombre accesible", fix: "Agrega texto al botón o un aria-label que describa la acción (por ejemplo, «Abrir menú»)." },
  "iframe-titulo":  { rule: "4.1.2", level: "A",  cat: "Robusto",      severity: "error",   name: "Marcos (iframe) sin título", fix: "Agrega title al <iframe> describiendo su contenido (por ejemplo, title=\"Mapa de la oficina\")." },
};

function snippet(el) {
  let s = `<${el.tagName}`;
  let n = 0;
  for (const [k, v] of el.attributes) {
    if (s.length > 140 || n++ >= 4) break;
    const val = v.length > 60 ? v.slice(0, 57) + "…" : v;
    s += ` ${k}="${val}"`;
  }
  return (s.length > 160 ? s.slice(0, 157) + "…" : s) + ">";
}
/** Ejecuta fn cuando se cierra la etiqueta (o de inmediato si no tiene cierre). */
function alCerrar(el, fn) {
  if (el.canHaveContent === false || el.selfClosing) { fn(); return; }
  try { el.onEndTag(() => fn()); } catch { fn(); }
}
const attr = (el, n) => (el.getAttribute(n) || "").trim();
const oculto = (el) => attr(el, "aria-hidden") === "true" || el.hasAttribute("hidden");

export async function analizar(response, { baseUrl }) {
  const hallazgos = new Map();
  const add = (id, ejemplo) => {
    const h = hallazgos.get(id) || { id, ...DEF[id], count: 0, examples: [] };
    h.count++;
    if (ejemplo && h.examples.length < MAX_EJEMPLOS) h.examples.push(ejemplo);
    hallazgos.set(id, h);
  };

  const st = {
    lang: null, title: "", inTitle: 0, h1: 0, prevHeading: 0,
    main: false, skip: false, linksSeen: 0,
    inScript: 0, bodyText: 0, scripts: 0,
    labelFor: new Set(), inLabel: 0,
    campos: [], // { id, snippet, nombrado }
    stylesheets: [], inlineCss: [],
    stack: [], // contenedores que acumulan texto: a, button, h1-6, svg, table, video
    viewport: null, refresh: null, imgs: 0, links: 0, forms: 0,
  };

  // Abre un contenedor que junta texto y nombres accesibles de sus hijos
  const abrir = (el, tipo, datos) => {
    const ctx = { tipo, texto: "", ...datos };
    st.stack.push(ctx);
    alCerrar(el, () => {
      const i = st.stack.lastIndexOf(ctx);
      if (i >= 0) st.stack.splice(i, 1);
      ctx.cerrar?.(ctx);
    });
    return ctx;
  };
  const aportarTexto = (t) => { for (const c of st.stack) if (c.texto.length < 200) c.texto += t; };
  const contexto = (tipo) => { for (let i = st.stack.length - 1; i >= 0; i--) if (st.stack[i].tipo === tipo) return st.stack[i]; return null; };

  const rw = new HTMLRewriter()
    .on("html", { element(el) { st.lang = el.getAttribute("lang"); } })
    .on("title", { element(el) { st.inTitle++; alCerrar(el, () => st.inTitle--); } })
    .on("script", { element(el) { st.scripts++; st.inScript++; alCerrar(el, () => st.inScript--); } })
    .on("style", { element(el) { st.inScript++; const c = { css: "" }; st.inlineCss.push(c); st.styleActual = c; alCerrar(el, () => { st.inScript--; st.styleActual = null; }); } })
    .on("noscript, template", { element(el) { st.inScript++; alCerrar(el, () => st.inScript--); } })
    .on("meta", { element(el) {
      const name = attr(el, "name").toLowerCase();
      if (name === "viewport") st.viewport = attr(el, "content");
      if (attr(el, "http-equiv").toLowerCase() === "refresh") st.refresh = { content: attr(el, "content"), s: snippet(el) };
    } })
    .on("link", { element(el) {
      const rel = attr(el, "rel").toLowerCase();
      const href = attr(el, "href");
      if (rel.split(/\s+/).includes("stylesheet") && href && st.stylesheets.length < 6) st.stylesheets.push(href);
    } })
    .on("main, [role=main]", { element() { st.main = true; } })
    .on("h1, h2, h3, h4, h5, h6", { element(el) {
      const nivel = Number(el.tagName[1]);
      if (nivel === 1) st.h1++;
      if (st.prevHeading && nivel > st.prevHeading + 1) add("encabezado-salto", `h${st.prevHeading} → h${nivel}: ${snippet(el)}`);
      st.prevHeading = nivel;
    } })
    .on("img", { element(el) {
      st.imgs++;
      const role = attr(el, "role");
      if (oculto(el) || role === "presentation" || role === "none") return;
      if (!el.hasAttribute("alt")) { add("img-alt", snippet(el)); return; }
      const alt = attr(el, "alt");
      if (alt && ALT_POBRE.test(alt)) add("img-alt-pobre", snippet(el));
      if (alt) aportarTexto(" " + alt);
    } })
    .on("svg", { element(el) {
      const svg = abrir(el, "svg", { role: attr(el, "role"), label: attr(el, "aria-label") || attr(el, "aria-labelledby"), titulo: false, s: snippet(el), oculto: oculto(el),
        cerrar: (c) => { if (c.role === "img" && !c.oculto && !c.label && !c.titulo) add("svg-img", c.s); if (c.label) aportarTexto(" " + c.label); } });
      return svg;
    } })
    .on("svg title", { element() { const s = contexto("svg"); if (s) s.titulo = true; } })
    .on("a", { element(el) {
      if (!el.hasAttribute("href")) return;
      st.links++;
      const href = attr(el, "href");
      const nombre = attr(el, "aria-label") || attr(el, "aria-labelledby") || attr(el, "title");
      const enInicio = st.linksSeen++ < 12;
      const esOculto = oculto(el);
      abrir(el, "a", { s: snippet(el), cerrar: (c) => {
        const t = c.texto.replace(/\s+/g, " ").trim();
        if (enInicio && href.startsWith("#") && href.length > 1 && /salt|skip|ir al contenido|contenido principal|main content|ir al principal/i.test(t + " " + nombre)) st.skip = true;
        if (esOculto) return;
        if (!t && !nombre) add("enlace-vacio", c.s);
        else if (!nombre && GENERICOS.has(t.toLowerCase().replace(/[.…»›→>]+$/g, "").trim())) add("enlace-generico", `«${t}» ${c.s}`);
      } });
    } })
    .on("button, [role=button]", { element(el) {
      const nombre = attr(el, "aria-label") || attr(el, "aria-labelledby") || attr(el, "title");
      const esOculto = oculto(el);
      abrir(el, "button", { s: snippet(el), cerrar: (c) => {
        if (esOculto) return;
        if (!c.texto.trim() && !nombre) add("boton-nombre", c.s);
      } });
    } })
    .on("h1, h2, h3, h4, h5, h6", { element(el) { abrir(el, "h", {}); } })
    .on("label", { element(el) {
      const f = attr(el, "for");
      if (f) st.labelFor.add(f);
      st.inLabel++;
      alCerrar(el, () => st.inLabel--);
    } })
    .on("form", { element() { st.forms++; } })
    .on("input, select, textarea", { element(el) {
      const tag = el.tagName;
      const type = (attr(el, "type") || "text").toLowerCase();
      if (tag === "input" && ["hidden", "submit", "reset", "button", "image"].includes(type)) {
        if (type === "image" && !attr(el, "alt") && !attr(el, "aria-label")) add("input-img-alt", snippet(el));
        if (type === "button" && !attr(el, "value") && !attr(el, "aria-label") && !attr(el, "title")) add("boton-nombre", snippet(el));
        return;
      }
      if (oculto(el)) return;
      const nombrado = st.inLabel > 0 || !!(attr(el, "aria-label") || attr(el, "aria-labelledby") || attr(el, "title"));
      st.campos.push({ id: attr(el, "id"), s: snippet(el), nombrado });
      if (tag === "input" && !el.hasAttribute("autocomplete")) {
        const n = (attr(el, "name") + " " + attr(el, "id")).toLowerCase();
        if (["email", "tel"].includes(type) || /(^|[_\-\s])(e?mail|correo|nombre|name|apellido|telefono|teléfono|phone|celular|direcci[oó]n|address|rut)([_\-\s]|$)/.test(n)) add("autocomplete", snippet(el));
      }
    } })
    .on("table", { element(el) {
      const role = attr(el, "role");
      abrir(el, "table", { th: false, s: snippet(el), cerrar: (c) => {
        if (!c.th && role !== "presentation" && role !== "none" && c.celdas > 1) add("tabla-th", c.s);
      }, celdas: 0 });
    } })
    .on("th, [role=columnheader], [role=rowheader]", { element() { const t = contexto("table"); if (t) t.th = true; } })
    .on("td", { element() { const t = contexto("table"); if (t) t.celdas++; } })
    .on("iframe", { element(el) {
      if (oculto(el)) return;
      const src = attr(el, "src");
      if (!attr(el, "title") && !attr(el, "aria-label")) add("iframe-titulo", snippet(el));
      if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion|wistia|facebook\.com\/plugins\/video/i.test(src)) add("iframe-video", snippet(el));
    } })
    .on("video", { element(el) {
      if (el.hasAttribute("autoplay") && !el.hasAttribute("muted")) add("autoplay", snippet(el));
      abrir(el, "video", { track: false, s: snippet(el), cerrar: (c) => { if (!c.track) add("video-subt", c.s); } });
    } })
    .on("video track", { element(el) { const k = attr(el, "kind").toLowerCase(); const v = contexto("video"); if (v && (k === "captions" || k === "subtitles")) v.track = true; } })
    .on("audio", { element(el) { if (el.hasAttribute("autoplay")) add("autoplay", snippet(el)); } })
    .on("marquee, blink", { element(el) { add("marquee", snippet(el)); } })
    .on("[tabindex]", { element(el) { if (Number(attr(el, "tabindex")) > 0) add("tabindex", snippet(el)); } })
    .on("div[onclick], span[onclick], li[onclick], img[onclick]", { element(el) {
      if (!el.hasAttribute("role") && !el.hasAttribute("tabindex")) add("clic-div", snippet(el));
    } })
    .onDocument({ text(t) {
      if (st.styleActual) { if (st.styleActual.css.length < 200000) st.styleActual.css += t.text; return; }
      if (st.inScript) return;
      if (st.inTitle) { st.title += t.text; return; }
      if (st.bodyText < 2000) st.bodyText += t.text.replace(/\s+/g, "").length;
      if (st.stack.length) aportarTexto(t.text);
    } });

  await rw.transform(response).arrayBuffer();

  // Etiquetas con for="id" pueden aparecer después del campo: se resuelven al final
  for (const c of st.campos) if (!c.nombrado && !(c.id && st.labelFor.has(c.id))) add("campo-etiqueta", c.s);

  const title = st.title.replace(/\s+/g, " ").trim();
  if (!title) add("titulo", "<title></title>");
  if (!st.lang || !st.lang.trim()) add("lang", "<html>");
  else if (!LANG_VALIDO.test(st.lang.trim())) add("lang-invalido", `<html lang="${st.lang}">`);
  if (!st.h1) add("sin-h1", "Ningún <h1> en la página");
  if (!st.main && !st.skip) add("bypass", "Sin <main> ni enlace «Saltar al contenido»");

  if (st.viewport) {
    const v = st.viewport.toLowerCase().replace(/\s/g, "");
    const max = v.match(/maximum-scale=([\d.]+)/);
    if (/user-scalable=(no|0)/.test(v) || (max && Number(max[1]) < 2)) add("zoom", `<meta name="viewport" content="${st.viewport}">`);
  }
  if (st.refresh) {
    const seg = parseFloat(st.refresh.content);
    if (seg > 0) add("refresh", st.refresh.s);
  }

  const meta = {
    title,
    lang: st.lang,
    imgs: st.imgs,
    links: st.links,
    forms: st.forms,
    campos: st.campos.length,
    scripts: st.scripts,
    textoVisible: st.bodyText,
    // Sitios armados con JavaScript: el HTML inicial casi no trae contenido
    dependeDeJs: st.bodyText < 250 && st.scripts > 0,
    hojasDeEstilo: st.stylesheets.map((h) => { try { return new URL(h, baseUrl).toString(); } catch { return null; } }).filter(Boolean),
    cssInterno: st.inlineCss.map((c) => c.css).join("\n"),
  };

  return { hallazgos, add, meta };
}

/** Busca reglas CSS que quitan el indicador de foco sin reemplazarlo. */
export function revisarFoco(css, origen, add) {
  if (!css) return;
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m, n = 0;
  while ((m = re.exec(limpio)) && n < 20000) {
    n++;
    const sel = m[1].trim();
    const decl = m[2];
    if (!/outline\s*:\s*(none|0)(\s|;|!|$)|outline-style\s*:\s*none|outline-width\s*:\s*0/i.test(decl)) continue;
    const afectaFoco = /:focus/.test(sel) || /(^|,|\s)(\*|a|button|input|select|textarea)(\s*(,|$))/i.test(sel);
    if (!afectaFoco) continue;
    if (/:focus-visible/.test(sel) && /box-shadow|border|background/i.test(decl)) continue;
    if (/box-shadow\s*:(?!\s*none)|border(-[a-z]+)?\s*:(?!\s*(none|0))|background(-color)?\s*:/i.test(decl)) continue;
    add("foco", `${origen}: ${sel.slice(0, 90)} { ${decl.trim().replace(/\s+/g, " ").slice(0, 70)} }`);
  }
}

/** Puntaje transparente: parte en 100 y descuenta por cada tipo de falla. */
export function calcularPuntaje(lista) {
  let p = 100;
  for (const h of lista) {
    if (h.severity === "error") {
      const base = h.level === "A" ? 8 : 5;
      p -= base + Math.min(h.count - 1, h.level === "A" ? 6 : 4);
    } else {
      p -= 2;
    }
  }
  return Math.max(0, Math.round(p));
}

export function ordenar(lista) {
  const peso = (h) => (h.severity === "error" ? 0 : 10) + (h.level === "A" ? 0 : 1);
  return lista.sort((a, b) => peso(a) - peso(b) || b.count - a.count);
}
