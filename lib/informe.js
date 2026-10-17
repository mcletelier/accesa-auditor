/**
 * Plantilla del informe. La misma sirve para el correo y para imprimir / guardar como PDF
 * desde el navegador. Usa tablas y estilos en línea para que se vea bien en Gmail y Outlook.
 */

const C = {
  crema: "#FAF6EE", papel: "#FFFFFF", tinta: "#1A1A1A", gris: "#55524D", linea: "#E4DED2",
  terracota: "#A8431F", dorado: "#E8A030", verde: "#3B6B4A", azul: "#2A5C8F",
};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ISOTIPO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36" aria-hidden="true" style="display:block"><circle cx="32" cy="32" r="28" fill="none" stroke="#C4522A" stroke-width="2.5"/><path d="M20 46 L32 16 L44 46" fill="none" stroke="#1A1A1A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="13" r="4" fill="#E8A030"/></svg>`;

/**
 * Clasificación del puntaje automático en tramos, con una frase para la persona.
 * Se usa en la pantalla de resultados y en el correo.
 */
export function clasificar(puntaje) {
  if (puntaje == null) return {
    tramo: "parcial", etiqueta: "Revisión parcial",
    frase: "No pudimos ver el contenido completo de esta página, así que no le asignamos puntaje. Te recomendamos una revisión en navegador y manual.",
  };
  if (puntaje >= 90) return {
    tramo: "alto", etiqueta: "Muy buen punto de partida",
    frase: "Tu sitio supera casi todas las revisiones automáticas. El siguiente paso es nuestra revisión manual con teclado y lector de pantalla: si la aprueba, obtiene el Sello Accesa.",
  };
  if (puntaje >= 70) return {
    tramo: "bueno", etiqueta: "Vas por buen camino",
    frase: "Tu sitio va bien encaminado. Corrige los puntos pendientes y estarás más cerca de cumplir con WCAG 2.2 y de obtener el Sello Accesa.",
  };
  if (puntaje >= 50) return {
    tramo: "medio", etiqueta: "Hay barreras importantes",
    frase: "Algunas personas pueden tener dificultades para usar tu sitio. Corregir las fallas de nivel A es la prioridad.",
  };
  return {
    tramo: "bajo", etiqueta: "Necesita atención urgente",
    frase: "Hay barreras que pueden impedir que muchas personas usen tu sitio. Te recomendamos empezar por las fallas de nivel A.",
  };
}

export function fechaLarga(iso) {
  try { return new Date(iso).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Santiago" }); }
  catch { return ""; }
}

export function informeHTML(r, { nombre = "", modo = "correo", contactoUrl = "https://accesa.agency/#contacto" } = {}) {
  const errores = r.hallazgos.filter((h) => h.severity === "error");
  const revisar = r.hallazgos.filter((h) => h.severity === "revisar");
  const nivelA = errores.filter((h) => h.level === "A").length;
  const font = "font-family:'DM Sans',Helvetica,Arial,sans-serif;";
  const serif = "font-family:'DM Serif Display',Georgia,serif;font-weight:400;";

  const fila = (h) => `
    <tr>
      <td style="padding:12px 10px;border-top:1px solid ${C.linea};vertical-align:top;${font}font-size:12px;color:${C.gris};white-space:nowrap;">${esc(h.rule)}<br><span style="font-weight:700;color:${h.level === "A" ? C.terracota : C.azul};">Nivel ${esc(h.level)}</span></td>
      <td style="padding:12px 10px;border-top:1px solid ${C.linea};vertical-align:top;${font}font-size:14px;color:${C.tinta};line-height:1.5;">
        <strong>${esc(h.name)}</strong> <span style="color:${C.gris};">(${h.count} caso${h.count > 1 ? "s" : ""})</span>
        <div style="margin-top:6px;font-size:13px;color:${C.gris};line-height:1.55;">${esc(h.fix)}</div>
        ${h.examples?.length ? `<div style="margin-top:6px;font-family:Menlo,Consolas,monospace;font-size:11px;color:${C.gris};word-break:break-all;">${h.examples.slice(0, 2).map(esc).join("<br>")}</div>` : ""}
      </td>
    </tr>`;

  const tabla = (titulo, lista, nota) => !lista.length ? "" : `
    <h2 style="${serif}font-size:22px;color:${C.tinta};margin:32px 0 6px;">${titulo}</h2>
    ${nota ? `<p style="${font}font-size:13px;color:${C.gris};margin:0 0 10px;line-height:1.5;">${nota}</p>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${lista.map(fila).join("")}</table>`;

  const puntaje = r.puntaje == null ? "—" : r.puntaje;
  const clase = clasificar(r.puntaje);
  const colorP = r.puntaje == null ? C.gris : r.puntaje >= 70 ? C.verde : r.puntaje >= 50 ? "#8A5A00" : C.terracota;

  const cuerpo = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.crema};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:${C.papel};border:1px solid ${C.linea};border-radius:10px;">
<tr><td style="padding:28px 28px 8px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:10px;">${ISOTIPO}</td>
    <td style="${serif}font-size:24px;color:${C.tinta};">accesa</td>
  </tr></table>
  <p style="${font}font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.terracota};font-weight:700;margin:24px 0 4px;">Informe de accesibilidad · WCAG 2.2</p>
  <h1 style="${serif}font-size:30px;line-height:1.15;color:${C.tinta};margin:0 0 10px;">${esc(r.meta?.title || "Revisión automática")}</h1>
  <p style="${font}font-size:13px;color:${C.gris};margin:0;word-break:break-all;">${esc(r.url)}</p>
  <p style="${font}font-size:13px;color:${C.gris};margin:4px 0 0;">${fechaLarga(r.fecha)}${nombre ? ` · Preparado para ${esc(nombre)}` : ""}</p>
</td></tr>

<tr><td style="padding:16px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.crema};border-radius:8px;">
  <tr>
    <td style="padding:18px;text-align:center;width:33%;"><div style="${serif}font-size:40px;color:${colorP};line-height:1;">${puntaje}</div><div style="${font}font-size:12px;color:${C.gris};margin-top:4px;">puntaje automático / 100</div></td>
    <td style="padding:18px;text-align:center;width:33%;"><div style="${serif}font-size:40px;color:${C.terracota};line-height:1;">${errores.length}</div><div style="${font}font-size:12px;color:${C.gris};margin-top:4px;">tipos de falla${nivelA ? ` (${nivelA} nivel A)` : ""}</div></td>
    <td style="padding:18px;text-align:center;width:33%;"><div style="${serif}font-size:40px;color:${C.azul};line-height:1;">${revisar.length}</div><div style="${font}font-size:12px;color:${C.gris};margin-top:4px;">puntos a revisar</div></td>
  </tr></table>
</td></tr>

<tr><td style="padding:8px 28px 8px;">
  <h2 style="${serif}font-size:22px;color:${C.tinta};margin:16px 0 8px;">Diagnóstico</h2>
  <p style="${font}font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:${colorP};margin:0 0 4px;">${esc(clase.etiqueta)}</p>
  <p style="${font}font-size:17px;line-height:1.55;color:${C.tinta};margin:0 0 14px;font-weight:700;">${esc(clase.frase)}</p>
  <p style="${font}font-size:15px;line-height:1.65;color:${C.tinta};margin:0;">${esc(r.resumen)}</p>
  ${r.meta?.dependeDeJs ? `<p style="${font}font-size:13px;line-height:1.55;color:${C.terracota};margin:12px 0 0;"><strong>Revisión parcial:</strong> esta página se arma con JavaScript, por lo que su HTML inicial casi no trae contenido. El puntaje no es representativo.</p>` : ""}
  ${r.prioridades?.length ? `
  <h2 style="${serif}font-size:22px;color:${C.tinta};margin:28px 0 8px;">Por dónde empezar</h2>
  <ol style="${font}font-size:14px;line-height:1.6;color:${C.tinta};margin:0;padding-left:20px;">${r.prioridades.map((p) => `<li style="margin-bottom:6px;">${esc(p)}</li>`).join("")}</ol>` : ""}

  ${tabla("Fallas detectadas", errores, "Barreras que la revisión automática identificó con certeza razonable.")}
  ${tabla("Puntos a revisar", revisar, "Señales de posibles problemas que una persona debe confirmar.")}
  ${!errores.length && !revisar.length ? `<p style="${font}font-size:14px;color:${C.verde};margin:24px 0 0;">No se detectaron problemas en los criterios que esta herramienta puede evaluar.</p>` : ""}

  <h2 style="${serif}font-size:22px;color:${C.tinta};margin:32px 0 8px;">Lo que esta revisión no cubre</h2>
  <p style="${font}font-size:14px;line-height:1.6;color:${C.tinta};margin:0;">Una herramienta automática detecta solo una parte de las barreras. Quedan fuera, entre otros: el contraste de colores, el uso completo con teclado, la experiencia con lector de pantalla, la calidad de los textos alternativos y subtítulos, y los formularios y contenidos que aparecen al interactuar. El puntaje es una referencia para priorizar, no una certificación de cumplimiento.</p>
</td></tr>

<tr><td style="padding:24px 28px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tinta};border-radius:8px;"><tr><td style="padding:22px;">
    <p style="${serif}font-size:20px;color:#FAF6EE;margin:0 0 6px;">¿Quieres una revisión completa?</p>
    <p style="${font}font-size:14px;line-height:1.55;color:#E9E3D8;margin:0 0 14px;">En Accesa revisamos tu sitio a mano, con teclado y lector de pantalla, y te entregamos un plan de acción priorizado. Los sitios que aprueban la revisión reciben el Sello Accesa.</p>
    <a href="${esc(contactoUrl)}" style="display:inline-block;${font}font-size:14px;font-weight:700;color:#1A1A1A;background:${C.dorado};padding:10px 18px;border-radius:6px;text-decoration:none;">Conversemos</a>
  </td></tr></table>
  <p style="${font}font-size:12px;color:${C.gris};margin:18px 0 0;line-height:1.5;">Accesa · Accesibilidad digital · Santiago, Chile · <a href="https://accesa.agency" style="color:${C.gris};">accesa.agency</a></p>
</td></tr>
</table>
</td></tr></table>`;

  if (modo === "correo") {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe de accesibilidad — Accesa</title></head><body style="margin:0;padding:0;background:${C.crema};">${cuerpo}</body></html>`;
  }

  // Versión para imprimir o guardar como PDF desde el navegador
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe de accesibilidad — ${esc(r.meta?.title || r.url)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:${C.crema};-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .barra{display:flex;gap:12px;justify-content:center;padding:16px;${font}}
  .barra button{${font}font-size:15px;font-weight:700;padding:10px 18px;border-radius:6px;border:2px solid ${C.tinta};background:${C.tinta};color:#FAF6EE;cursor:pointer;}
  .barra button:focus-visible{outline:3px solid ${C.azul};outline-offset:3px;}
  @media print{.barra{display:none}body{background:#fff}}
</style></head><body>
<div class="barra"><button type="button" onclick="window.print()">Imprimir o guardar como PDF</button></div>
<main>${cuerpo}</main></body></html>`;
}

export function textoPlano(r, { nombre = "" } = {}) {
  const lineas = [
    `Informe de accesibilidad — Accesa`,
    r.url,
    nombre ? `Preparado para ${nombre}` : "",
    "",
    `Puntaje automático: ${r.puntaje ?? "no disponible"} / 100`,
    "",
    r.resumen,
    "",
    ...r.hallazgos.map((h) => `- [${h.rule} · ${h.level} · ${h.severity === "error" ? "falla" : "revisar"}] ${h.name} (${h.count})\n  ${h.fix}`),
    "",
    "Esta revisión automática no reemplaza una evaluación manual.",
    "Accesa · https://accesa.agency",
  ];
  return lineas.filter((l, i) => l !== "" || lineas[i - 1] !== "").join("\n");
}
