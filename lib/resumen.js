/**
 * Resumen ejecutivo escrito por Claude a partir de los hallazgos ya detectados.
 * Claude NO calcula el puntaje ni agrega problemas: solo redacta en lenguaje claro.
 * Si la API falla o no hay clave, se usa un resumen escrito por reglas.
 */

const MODELO_POR_DEFECTO = "claude-haiku-5-5";

export async function resumir(env, { url, meta, lista, puntaje }) {
  const respaldo = resumenRespaldo({ meta, lista, puntaje });
  if (!env.ANTHROPIC_API_KEY) return { ...respaldo, fuente: "reglas" };

  const errores = lista.filter((h) => h.severity === "error");
  const revisar = lista.filter((h) => h.severity === "revisar");
  const linea = (h) => `- [${h.rule} · nivel ${h.level}] ${h.name} (${h.count} caso${h.count > 1 ? "s" : ""})`;

  const prompt = `Sitio revisado: ${url}
Título de la página: ${meta.title || "(sin título)"}
Puntaje automático: ${puntaje ?? "no calculado"} / 100
${meta.dependeDeJs ? "Advertencia: la página se arma con JavaScript y el HTML inicial casi no tiene contenido, así que la revisión es muy parcial.\n" : ""}
Fallas detectadas (${errores.length}):
${errores.map(linea).join("\n") || "- Ninguna"}

Puntos a revisar manualmente (${revisar.length}):
${revisar.map(linea).join("\n") || "- Ninguno"}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.CLAUDE_MODEL || MODELO_POR_DEFECTO,
        max_tokens: 700,
        system: `Eres especialista en accesibilidad web (WCAG 2.2) y escribes para Accesa, consultora chilena.
Recibes los resultados de una revisión automática del HTML de una página. Tu tarea es explicarlos a una persona que no es técnica (por ejemplo, encargada de comunicaciones de un municipio o una universidad).

Reglas:
- Español neutro, tono claro, cercano y profesional. Sin tecnicismos innecesarios ni exageraciones.
- Usa SOLO los hallazgos entregados. No inventes problemas, cifras ni normas.
- No afirmes que el sitio "cumple" WCAG: una revisión automática no puede certificar conformidad.
- Explica el impacto en personas (por ejemplo, quienes usan lector de pantalla o solo teclado).
- Si no hay fallas, dilo con mesura y recuerda que hay aspectos que solo se evalúan manualmente.

Responde SOLO con JSON válido, sin markdown:
{"resumen": "<2 a 3 oraciones>", "prioridades": ["<acción concreta 1>", "<acción concreta 2>", "<acción concreta 3>"]}`,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.log("Claude respondió", res.status, (await res.text()).slice(0, 300));
      return { ...respaldo, fuente: "reglas" };
    }
    const data = await res.json();
    const texto = data.content?.find((b) => b.type === "text")?.text || "";
    const j = JSON.parse(texto.replace(/```json|```/g, "").trim());
    if (typeof j.resumen !== "string" || !j.resumen.trim()) throw new Error("respuesta vacía");
    return {
      resumen: j.resumen.trim().slice(0, 900),
      prioridades: (Array.isArray(j.prioridades) ? j.prioridades : []).filter((p) => typeof p === "string").slice(0, 4).map((p) => p.slice(0, 300)),
      fuente: "claude",
    };
  } catch (e) {
    console.log("No se pudo generar el resumen con Claude:", e.message);
    return { ...respaldo, fuente: "reglas" };
  } finally {
    clearTimeout(timer);
  }
}

function resumenRespaldo({ meta, lista, puntaje }) {
  const errores = lista.filter((h) => h.severity === "error");
  const revisar = lista.filter((h) => h.severity === "revisar");
  let resumen;
  if (meta.dependeDeJs) {
    resumen = "Esta página se construye con JavaScript en el navegador, por lo que su HTML inicial casi no trae contenido. La revisión automática es muy parcial: para conocer su estado real se necesita una revisión en navegador y manual.";
  } else if (!errores.length) {
    resumen = `No encontramos fallas en los puntos que esta revisión automática puede detectar${revisar.length ? `, aunque hay ${revisar.length} aspecto${revisar.length > 1 ? "s" : ""} que conviene revisar manualmente` : ""}. Recuerda que el contraste de colores, la navegación con teclado y la experiencia con lector de pantalla requieren una evaluación humana.`;
  } else {
    const a = errores.filter((h) => h.level === "A").length;
    resumen = `Detectamos ${errores.length} tipo${errores.length > 1 ? "s" : ""} de falla${a ? `, ${a} de nivel A (el mínimo exigido)` : ""}, con un puntaje automático de ${puntaje}/100. Estas barreras afectan sobre todo a personas que usan lector de pantalla, navegan solo con teclado o necesitan ampliar el texto.`;
  }
  const prioridades = errores.slice(0, 3).map((h) => `${h.name}: ${h.fix}`);
  return { resumen, prioridades };
}
