import { useState, useEffect } from "react";

/* ─── PALETTE ────────────────────────────────────────────────────────── */
const T = {
  bg: "#0F0F0F",
  surface: "#1A1A1A",
  border: "#2A2A2A",
  borderLight: "#383838",
  text: "#F0EDE8",
  textMuted: "#888480",
  textDim: "#555250",
  accent: "#E8A030",      // Dorado — punto del isotipo Accesa (exacto del SVG)
  accentDim: "#C4522A",
  red: "#C4522A",         // Rojo terracota — círculo del isotipo Accesa (exacto del SVG)
  yellow: "#F5C842",
  green: "#5DD67A",
  white: "#FFFFFF",
};

/* ─── LOGO (isotipo real Accesa) ─────────────────────────────────────── */
function AccesaLogo({ size = 40 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap: Math.round(size * 0.3) }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"
        width={size} height={size} aria-hidden="true" focusable="false">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#C4522A" strokeWidth="2.5"/>
        <path d="M20 46 L32 16 L44 46" fill="none" stroke="#FAF6EE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="32" cy="13" r="4" fill="#E8A030"/>
      </svg>
      <span style={{
        fontFamily:"'DM Serif Display', serif",
        fontSize: "1.5rem",
        color: "#F0EDE8",
        lineHeight: 1,
      }}>accesa</span>
    </div>
  );
}


/* ─── ANÁLISIS ESTÁTICO ─────────────────────────────────────────────── */
function analyzeHTML(html) {
  const findings = [];
  const doc = new DOMParser().parseFromString(html, "text/html");

  // 1.1.1 - Imágenes sin alt
  doc.querySelectorAll("img:not([alt])").forEach(el => {
    findings.push({ rule: "1.1.1", level: "A", cat: "Perceptible", name: "Imagen sin texto alternativo", element: el.outerHTML.slice(0, 120), fix: "Agregar atributo alt descriptivo." });
  });

  // 1.3.1 - Jerarquía encabezados
  const headings = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  let prevLevel = 0;
  headings.forEach(h => {
    const level = parseInt(h.tagName[1]);
    if (level > prevLevel + 1 && prevLevel !== 0) {
      findings.push({ rule: "1.3.1", level: "A", cat: "Perceptible", name: `Salto de jerarquía: h${prevLevel} → h${level}`, element: h.outerHTML.slice(0, 120), fix: "La jerarquía debe ser secuencial (h1→h2→h3)." });
    }
    prevLevel = level;
  });

  // 1.3.5 - Autocomplete
  doc.querySelectorAll("input[type='text'], input[type='email'], input[type='tel']").forEach(el => {
    if (!el.getAttribute("autocomplete")) {
      findings.push({ rule: "1.3.5", level: "AA", cat: "Perceptible", name: "Campo sin atributo autocomplete", element: el.outerHTML.slice(0, 120), fix: "Agregar autocomplete apropiado (name, email, tel, etc.)." });
    }
  });

  // 1.3.1 - Tablas sin th
  doc.querySelectorAll("table").forEach(el => {
    if (!el.querySelector("th")) {
      findings.push({ rule: "1.3.1", level: "A", cat: "Perceptible", name: "Tabla sin celdas de encabezado (<th>)", element: el.outerHTML.slice(0, 80), fix: "Agregar <th scope=\"col/row\"> para identificar encabezados." });
    }
  });

  // 2.1.1 - tabindex negativo
  doc.querySelectorAll("[tabindex='-1']").forEach(el => {
    findings.push({ rule: "2.1.1", level: "A", cat: "Operable", name: "Elemento con tabindex=-1 (excluido del foco)", element: el.outerHTML.slice(0, 120), fix: "tabindex=-1 excluye el elemento del foco de teclado. Revisar si es intencional." });
  });

  // 2.4.1 - Skip link
  if (!html.match(/(?:skip|saltar|jump).*(?:content|contenido|main)/i)) {
    findings.push({ rule: "2.4.1", level: "A", cat: "Operable", name: "No se detectó enlace para saltar contenido", element: '<a href="#main">Saltar al contenido</a>', fix: "Agregar un enlace «Saltar al contenido» al inicio del <body>." });
  }

  // 2.4.2 - Title
  const title = doc.querySelector("title");
  if (!title || !title.textContent.trim()) {
    findings.push({ rule: "2.4.2", level: "A", cat: "Operable", name: "Página sin elemento <title>", element: "<title></title>", fix: "Agregar un <title> único y descriptivo." });
  }

  // 2.4.4 - Texto de enlace genérico
  doc.querySelectorAll("a").forEach(el => {
    const txt = el.textContent.trim().toLowerCase();
    if (["aquí", "here", "clic", "click", "ver más", "más info", "leer más"].includes(txt)) {
      findings.push({ rule: "2.4.4", level: "A", cat: "Operable", name: `Enlace con texto no descriptivo: "${el.textContent.trim()}"`, element: el.outerHTML.slice(0, 120), fix: "Reemplazar por texto que describa el destino del enlace." });
    }
  });

  // 2.4.7 - Foco eliminado
  const outlineRemoved = html.match(/outline\s*:\s*(?:0|none)/gi);
  if (outlineRemoved) {
    findings.push({ rule: "2.4.7", level: "AA", cat: "Operable", name: `Se detectó outline:none o outline:0 (${outlineRemoved.length} instancia${outlineRemoved.length > 1 ? "s" : ""})`, element: "CSS: outline: none / outline: 0", fix: "Diseñar un foco visible personalizado en lugar de eliminarlo." });
  }

  // 3.1.1 - lang
  const htmlEl = doc.querySelector("html");
  if (!htmlEl?.getAttribute("lang")) {
    findings.push({ rule: "3.1.1", level: "A", cat: "Comprensible", name: "Atributo lang ausente en <html>", element: "<html>", fix: 'Agregar lang="es" al elemento <html>.' });
  }

  // 3.3.1 / 3.3.2 - Inputs sin label
  doc.querySelectorAll("input, textarea, select").forEach(el => {
    const id = el.getAttribute("id");
    const hasLabel = id && doc.querySelector(`label[for="${id}"]`);
    const hasAria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (!hasLabel && !hasAria && el.getAttribute("type") !== "hidden") {
      findings.push({ rule: "3.3.2", level: "A", cat: "Comprensible", name: "Campo de formulario sin etiqueta asociada", element: el.outerHTML.slice(0, 120), fix: 'Agregar <label for="id"> o aria-label al campo.' });
    }
    if (el.hasAttribute("required") && !el.getAttribute("aria-required")) {
      findings.push({ rule: "3.3.1", level: "A", cat: "Comprensible", name: "Campo requerido sin aria-required", element: el.outerHTML.slice(0, 120), fix: 'Agregar aria-required="true" junto al atributo required.' });
    }
  });

  // 4.1.2 - Botones sin texto
  doc.querySelectorAll("button").forEach(el => {
    const txt = el.textContent.trim();
    if (!txt && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
      findings.push({ rule: "4.1.2", level: "A", cat: "Robusto", name: "Botón sin texto accesible", element: el.outerHTML.slice(0, 120), fix: "Agregar aria-label descriptivo al botón." });
    }
  });

  return findings;
}

/* ─── CLAUDE ANALYSIS ───────────────────────────────────────────────── */
async function claudeAnalyze(html, url, staticFindings) {
  const truncated = html.length > 15000 ? html.slice(0, 15000) + "\n<!-- [HTML truncado] -->" : html;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `Eres auditora experta en accesibilidad web WCAG 2.2 para Accesa, agencia chilena.
Analiza el HTML y entrega un resumen ejecutivo en español.
Responde SOLO con JSON válido, sin markdown ni texto extra:
{
  "score": <número 0-100>,
  "summary": "<2-3 oraciones ejecutivas sobre accesibilidad>",
  "critical": ["<hallazgo crítico 1>", "<hallazgo crítico 2>"],
  "recommendations": ["<recomendación 1>", "<recomendación 2>", "<recomendación 3>"],
  "conformanceLevel": "<A | AA parcial | AA | sin conformance>"
}`,
      messages: [{ role: "user", content: `URL: ${url}\nHallazgos estáticos (${staticFindings.length}):\n${staticFindings.slice(0, 10).map(f => `- [${f.rule}] ${f.name}`).join("\n")}\n\nHTML:\n${truncated}` }]
    })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { score: 50, summary: "Análisis completado.", critical: [], recommendations: [], conformanceLevel: "sin datos" }; }
}

/* ─── BADGE COMPONENTS ──────────────────────────────────────────────── */
function Badge({ level }) {
  const c = { A: T.red, AA: T.yellow }[level] || T.textMuted;
  return <span style={{ display:"inline-block", padding:"1px 7px", borderRadius:3, fontSize:10, fontWeight:700, letterSpacing:"0.08em", color: level === "A" ? T.white : T.bg, background:c }}>{level}</span>;
}
function CatBadge({ cat }) {
  const c = { Perceptible:"#5B8FF9", Operable:T.red, Comprensible:"#A978F5", Robusto:T.green }[cat] || T.textMuted;
  return <span style={{ display:"inline-block", padding:"1px 7px", borderRadius:3, fontSize:10, fontWeight:600, color:T.white, background:c, opacity:0.85 }}>{cat}</span>;
}

/* ─── SCORE RING ────────────────────────────────────────────────────── */
function ScoreRing({ score }) {
  const r = 52, circ = 2 * Math.PI * r;
  const color = score >= 70 ? T.accent : score >= 40 ? T.yellow : T.red;
  return (
    <svg width="130" height="130">
      <circle cx="65" cy="65" r={r} fill="none" stroke={T.border} strokeWidth="8"/>
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score/100)}
        strokeLinecap="round" transform="rotate(-90 65 65)"
        style={{ transition:"stroke-dashoffset 1.2s ease" }}/>
      <text x="65" y="60" textAnchor="middle" fill={color} style={{ fontSize:26, fontWeight:800, fontFamily:"inherit" }}>{score}</text>
      <text x="65" y="78" textAnchor="middle" fill={T.textMuted} style={{ fontSize:11, fontFamily:"inherit" }}>/100</text>
    </svg>
  );
}

/* ─── FINDING CARD ──────────────────────────────────────────────────── */
function FindingCard({ finding, idx }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom:`1px solid ${T.border}`, padding:"14px 0", animation:`fadeUp 0.3s ease ${idx*0.03}s both` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={() => setOpen(o=>!o)}>
        <span style={{ color:T.textDim, fontSize:11, minWidth:36, fontFamily:"monospace" }}>{finding.rule}</span>
        <Badge level={finding.level}/>
        <CatBadge cat={finding.cat}/>
        <span style={{ flex:1, fontSize:13, color:T.text }}>{finding.name}</span>
        <span style={{ color:T.textMuted, fontSize:12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop:12, paddingLeft:46 }}>
          <div style={{ marginBottom:8 }}>
            <span style={{ fontSize:11, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.08em" }}>Elemento detectado</span>
            <pre style={{ marginTop:4, padding:"8px 12px", borderRadius:6, background:"#111", color:T.accent, fontSize:11, border:`1px solid ${T.border}`, whiteSpace:"pre-wrap", wordBreak:"break-all", overflowX:"auto" }}>{finding.element}</pre>
          </div>
          <div style={{ padding:"10px 14px", borderRadius:6, background:"#1D1A0A", borderLeft:`3px solid ${T.accent}` }}>
            <span style={{ fontSize:11, color:T.accent, fontWeight:700 }}>✦ Cómo resolverlo</span>
            <p style={{ margin:"4px 0 0", fontSize:12, color:T.text, lineHeight:1.7 }}>{finding.fix}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── GLOBAL STYLES ─────────────────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:${T.bg}; color:${T.text}; font-family:'DM Sans',sans-serif; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
  @keyframes ticker { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes spin { to { transform:rotate(360deg); } }
  .url-input { width:100%; padding:14px 18px; font-size:15px; font-family:'DM Mono',monospace;
    background:${T.surface}; border:1px solid ${T.border}; border-radius:8px; color:${T.text};
    outline:none; transition:border-color 0.2s; }
  .url-input:focus { border-color:${T.accent}; }
  .cta-btn { padding:14px 28px; background:${T.accent}; color:#111; border:none;
    border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif;
    transition:opacity 0.2s,transform 0.1s; white-space:nowrap; }
  .cta-btn:hover:not(:disabled) { opacity:0.85; transform:translateY(-1px); }
  .cta-btn:disabled { opacity:0.35; cursor:default; transform:none; }
  .ghost-btn { padding:10px 20px; background:transparent; color:${T.textMuted}; border:1px solid ${T.border};
    border-radius:7px; font-size:13px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:border-color 0.2s,color 0.2s; }
  .ghost-btn:hover { border-color:${T.borderLight}; color:${T.text}; }
  .tab-btn { padding:6px 14px; border-radius:6px; border:1px solid ${T.border}; background:transparent;
    color:${T.textMuted}; font-size:12px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
  .tab-btn.active { background:${T.surface}; color:${T.text}; border-color:${T.borderLight}; }
  .tab-btn:hover { border-color:${T.borderLight}; color:${T.text}; }
  .form-input { width:100%; padding:10px 14px; background:${T.surface}; border:1px solid ${T.border};
    border-radius:6px; color:${T.text}; font-size:14px; font-family:'DM Sans',sans-serif; outline:none; transition:border-color 0.2s; }
  .form-input:focus { border-color:${T.accent}; }
`;

/* ─── HOME SCREEN ───────────────────────────────────────────────────── */
function HomeScreen({ onSubmit }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!url) return;
    setLoading(true);
    await onSubmit(url);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px" }}>
      <style>{STYLES}</style>

      {/* Logo */}
      <div style={{ marginBottom:52, animation:"fadeUp 0.5s ease" }}>
        <AccesaLogo size={34} />
        <div style={{ fontSize:11, color:T.textMuted, letterSpacing:"0.14em", textTransform:"uppercase", marginTop:6, textAlign:"center" }}>
          Auditoría WCAG 2.2
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign:"center", maxWidth:620, animation:"fadeUp 0.5s ease 0.1s both" }}>
        <h1 style={{ fontFamily:"'Instrument Serif',serif", fontSize:"clamp(38px,6vw,66px)", lineHeight:1.08, letterSpacing:"-0.03em", marginBottom:20, color:T.text }}>
          Descubre qué tan<br /><em style={{ color:T.accent }}>accesible</em> es tu sitio.
        </h1>
        <p style={{ fontSize:16, color:T.textMuted, lineHeight:1.75, maxWidth:460, margin:"0 auto 44px" }}>
          Ingresa una URL y analizamos su HTML contra los criterios WCAG 2.2. Gratis, sin registro.
        </p>
      </div>

      {/* Input */}
      <div style={{ width:"100%", maxWidth:540, animation:"fadeUp 0.5s ease 0.2s both" }}>
        <div style={{ display:"flex", gap:10 }}>
          <input className="url-input" type="url" placeholder="https://tu-sitio.cl"
            value={url} onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && handle()}
            aria-label="URL del sitio a auditar"/>
          <button className="cta-btn" disabled={!url||loading} onClick={handle}>
            {loading ? "…" : "Auditar →"}
          </button>
        </div>
        <p style={{ fontSize:12, color:T.textDim, marginTop:10, textAlign:"center" }}>
          Análisis estático gratuito · Sin almacenamiento de datos
        </p>
      </div>

      {/* Ticker */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, overflow:"hidden", borderTop:`1px solid ${T.border}`, background:T.surface, padding:"10px 0" }}>
        <div style={{ display:"flex", animation:"ticker 22s linear infinite", whiteSpace:"nowrap" }}>
          {[0,1].map(i=>(
            <span key={i} style={{ fontSize:11, color:T.textDim, letterSpacing:"0.12em", paddingRight:40 }}>
              WCAG 2.2 · PERCEPCIÓN · OPERABILIDAD · COMPRENSIÓN · ROBUSTEZ · NIVEL A · NIVEL AA · ACCESIBILIDAD DIGITAL · CHILE · LATAM ·&nbsp;
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── LOADING SCREEN ────────────────────────────────────────────────── */
function LoadingScreen({ url }) {
  const steps = ["Descargando HTML del sitio…","Parseando estructura del DOM…","Evaluando criterios WCAG 2.2…","Analizando formularios y roles ARIA…","Consultando modelo de análisis…","Generando informe…"];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s=>Math.min(s+1, steps.length-1)), 950);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <style>{STYLES}</style>
      <div style={{ marginBottom:36 }}><AccesaLogo size={30}/></div>
      <div style={{ width:"100%", maxWidth:420, background:T.surface, borderRadius:12, padding:32, border:`1px solid ${T.border}` }}>
        <p style={{ fontSize:12, color:T.textMuted, marginBottom:24, fontFamily:"'DM Mono',monospace", wordBreak:"break-all" }}>{url}</p>
        {steps.map((s,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"7px 0", opacity:i<=step?1:0.2, transition:"opacity 0.4s" }}>
            <span style={{ color:i<step?T.accent:i===step?T.yellow:T.textDim, fontSize:14 }}>
              {i<step?"✓":i===step?"◐":"○"}
            </span>
            <span style={{ fontSize:13, color:T.text }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── RESULTS SCREEN ────────────────────────────────────────────────── */
function ResultsScreen({ url, findings, aiData, onReset }) {
  const [activeTab, setActiveTab] = useState("todos");
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);

  const cats = ["todos","Perceptible","Operable","Comprensible","Robusto"];
  const filtered = activeTab==="todos" ? findings : findings.filter(f=>f.cat===activeTab);
  const byLevel = { A:findings.filter(f=>f.level==="A").length, AA:findings.filter(f=>f.level==="AA").length };
  const score = aiData?.score ?? Math.max(0, 100 - findings.length*6);

  return (
    <div style={{ minHeight:"100vh", maxWidth:900, margin:"0 auto", padding:"40px 20px 120px" }}>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:44 }}>
        <AccesaLogo size={28}/>
        <button className="ghost-btn" onClick={onReset}>← Nueva auditoría</button>
      </div>

      {/* URL */}
      <div style={{ marginBottom:36 }}>
        <p style={{ fontSize:11, color:T.textMuted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Sitio auditado</p>
        <p style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:T.text, wordBreak:"break-all" }}>{url}</p>
      </div>

      {/* Score card */}
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:32, alignItems:"center", background:T.surface, borderRadius:12, padding:32, marginBottom:28, border:`1px solid ${T.border}` }}>
        <ScoreRing score={score}/>
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:T.textMuted }}>Conformance:</span>
            <span style={{ fontSize:12, fontWeight:700, color:T.accent }}>{aiData?.conformanceLevel || "Sin datos suficientes"}</span>
          </div>
          <p style={{ fontSize:14, color:T.text, lineHeight:1.75, marginBottom:20 }}>
            {aiData?.summary || "Análisis completado. Revisa los hallazgos a continuación."}
          </p>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
            <div><span style={{ fontSize:24, fontWeight:800, color:T.red }}>{byLevel.A}</span><span style={{ fontSize:11, color:T.textMuted, marginLeft:6 }}>críticos (A)</span></div>
            <div><span style={{ fontSize:24, fontWeight:800, color:T.yellow }}>{byLevel.AA}</span><span style={{ fontSize:11, color:T.textMuted, marginLeft:6 }}>importantes (AA)</span></div>
            <div><span style={{ fontSize:24, fontWeight:800, color:T.text }}>{findings.length}</span><span style={{ fontSize:11, color:T.textMuted, marginLeft:6 }}>total</span></div>
          </div>
        </div>
      </div>

      {/* Hallazgos críticos */}
      {aiData?.critical?.length > 0 && (
        <div style={{ background:"#1A0E0A", border:`1px solid ${T.red}33`, borderRadius:10, padding:20, marginBottom:20 }}>
          <p style={{ fontSize:11, color:T.red, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>⚠ Hallazgos críticos</p>
          {aiData.critical.map((c,i)=>(
            <p key={i} style={{ fontSize:13, color:T.text, lineHeight:1.65, paddingLeft:14, borderLeft:`2px solid ${T.red}`, marginBottom:8 }}>{c}</p>
          ))}
        </div>
      )}

      {/* Recomendaciones */}
      {aiData?.recommendations?.length > 0 && (
        <div style={{ background:"#1A160A", border:`1px solid ${T.accent}33`, borderRadius:10, padding:20, marginBottom:28 }}>
          <p style={{ fontSize:11, color:T.accent, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>✦ Recomendaciones prioritarias</p>
          {aiData.recommendations.map((r,i)=>(
            <p key={i} style={{ fontSize:13, color:T.text, lineHeight:1.65, paddingLeft:14, borderLeft:`2px solid ${T.accent}`, marginBottom:8 }}>{r}</p>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:4 }}>
        {cats.map(c=>(
          <button key={c} className={`tab-btn ${activeTab===c?"active":""}`} onClick={()=>setActiveTab(c)}>
            {c} ({c==="todos" ? findings.length : findings.filter(f=>f.cat===c).length})
          </button>
        ))}
      </div>

      {/* Findings */}
      <div style={{ borderTop:`1px solid ${T.border}`, marginBottom:48 }}>
        {filtered.length===0
          ? <p style={{ padding:"32px 0", color:T.textMuted, textAlign:"center", fontSize:14 }}>✓ Sin problemas detectados en esta categoría.</p>
          : filtered.map((f,i)=><FindingCard key={i} finding={f} idx={i}/>)
        }
      </div>

      {/* CTA informe por correo */}
      <div style={{ padding:28, borderRadius:12, border:`1px solid ${T.border}`, background:T.surface, textAlign:"center", marginBottom:16 }}>
        {!emailMode && !sent ? (
          <>
            <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:22, marginBottom:8 }}>¿Quieres el informe completo en PDF?</p>
            <p style={{ fontSize:13, color:T.textMuted, marginBottom:20 }}>Te lo enviamos gratis por correo — con hallazgos priorizados y plan de acción.</p>
            <button className="cta-btn" onClick={()=>setEmailMode(true)}>Recibir informe →</button>
          </>
        ) : sent ? (
          <>
            <p style={{ fontSize:32, marginBottom:8 }}>✓</p>
            <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:20, marginBottom:6 }}>¡Listo!</p>
            <p style={{ fontSize:13, color:T.textMuted }}>Te enviaremos el informe a <strong style={{ color:T.text }}>{email}</strong> en breve.</p>
          </>
        ) : (
          <div style={{ maxWidth:380, margin:"0 auto" }}>
            <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:18, marginBottom:20 }}>Ingresa tus datos</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <input className="form-input" placeholder="Tu nombre" value={name} onChange={e=>setName(e.target.value)} aria-label="Tu nombre"/>
              <input className="form-input" type="email" placeholder="tu@correo.cl" value={email} onChange={e=>setEmail(e.target.value)} aria-label="Correo electrónico"/>
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <button className="ghost-btn" onClick={()=>setEmailMode(false)}>Cancelar</button>
                <button className="cta-btn" style={{ flex:1 }} disabled={!name||!email} onClick={()=>{
                  const fecha = new Date().toLocaleDateString("es-CL", { year:"numeric", month:"long", day:"numeric" });
                  const html = generatePDFHTML({ url, findings, aiData, name, fecha });
                  const blob = new Blob([html], { type:"text/html" });
                  const blobUrl = URL.createObjectURL(blob);
                  window.open(blobUrl, "_blank");
                  setSent(true);
                }}>Ver informe PDF →</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade CTA */}
      <div style={{ padding:28, borderRadius:12, background:"linear-gradient(135deg,#1A140A 0%,#0F0F0F 100%)", border:`1px solid ${T.accent}22` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
          <div>
            <p style={{ fontSize:11, color:T.accent, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>Versión profesional</p>
            <p style={{ fontFamily:"'Instrument Serif',serif", fontSize:20, marginBottom:6 }}>Auditoría completa con axe-core + revisión manual</p>
            <p style={{ fontSize:13, color:T.textMuted }}>Análisis dinámico · Evaluación de video y audio · Testing con teclado · Informe VPAT</p>
          </div>
          <a href="mailto:hola@accesa.agency" style={{ padding:"12px 24px", background:T.accent, color:"#111", borderRadius:8, fontWeight:700, fontSize:14, textDecoration:"none", whiteSpace:"nowrap" }}>
            Conversemos →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── GENERADOR HTML DEL INFORME PDF ────────────────────────────────── */
function generatePDFHTML({ url, findings, aiData, name, fecha }) {
  const score = aiData?.score ?? Math.max(0, 100 - findings.length * 6);
  const byLevel = {
    A: findings.filter(f => f.level === "A").length,
    AA: findings.filter(f => f.level === "AA").length,
  };
  const catColors = { Perceptible:"#5B8FF9", Operable:"#C4522A", Comprensible:"#A978F5", Robusto:"#5DD67A" };
  const scoreColor = score >= 70 ? "#E8A030" : score >= 40 ? "#F5C842" : "#C4522A";

  const isotopoSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="44" height="44" style="display:block">
      <circle cx="32" cy="32" r="28" fill="none" stroke="#C4522A" stroke-width="2.5"/>
      <path d="M20 46 L32 16 L44 46" fill="none" stroke="#FAF6EE" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="13" r="4" fill="#E8A030"/>
    </svg>`;

  const findingRows = findings.map((f, i) => `
    <tr style="border-bottom:1px solid #2A2A2A;">
      <td style="padding:10px 8px; font-family:monospace; font-size:11px; color:#888480; white-space:nowrap;">${f.rule}</td>
      <td style="padding:10px 8px;">
        <span style="display:inline-block; padding:2px 7px; border-radius:3px; font-size:10px; font-weight:700;
          background:${f.level === "A" ? "#C4522A" : "#F5C842"};
          color:${f.level === "A" ? "#FAF6EE" : "#111"};">${f.level}</span>
      </td>
      <td style="padding:10px 8px;">
        <span style="display:inline-block; padding:2px 7px; border-radius:3px; font-size:10px; font-weight:600;
          background:${catColors[f.cat] || "#888"}; color:#fff; opacity:0.9;">${f.cat}</span>
      </td>
      <td style="padding:10px 8px; font-size:12px; color:#F0EDE8;">${f.name}</td>
      <td style="padding:10px 8px; font-size:11px; color:#888480; max-width:220px;">${f.fix}</td>
    </tr>`).join("");

  const criticalHTML = aiData?.critical?.length
    ? aiData.critical.map(c => `<p style="font-size:13px; color:#F0EDE8; line-height:1.7; padding-left:14px; border-left:2px solid #C4522A; margin-bottom:10px;">${c}</p>`).join("")
    : "<p style='color:#888480; font-size:13px;'>Sin hallazgos críticos adicionales.</p>";

  const recoHTML = aiData?.recommendations?.length
    ? aiData.recommendations.map(r => `<p style="font-size:13px; color:#F0EDE8; line-height:1.7; padding-left:14px; border-left:2px solid #E8A030; margin-bottom:10px;">${r}</p>`).join("")
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Informe de Accesibilidad — Accesa</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#0F0F0F; color:#F0EDE8; font-family:'DM Sans',sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @media print {
    .no-print { display:none !important; }
    body { background:#0F0F0F; }
    .page-break { page-break-before:always; }
  }
</style>
</head>
<body>

<!-- ── PORTADA ─────────────────────────────────────────────── -->
<div style="min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; padding:56px 64px; background:#0F0F0F;">

  <!-- Header portada -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div style="display:flex; align-items:center; gap:14px;">
      ${isotopoSVG}
      <span style="font-family:'DM Serif Display',serif; font-size:1.5rem; color:#F0EDE8;">accesa</span>
    </div>
    <div style="text-align:right;">
      <p style="font-size:11px; color:#888480; letter-spacing:0.1em; text-transform:uppercase;">Informe de Accesibilidad</p>
      <p style="font-size:11px; color:#888480; margin-top:4px;">${fecha}</p>
    </div>
  </div>

  <!-- Centro portada -->
  <div>
    <p style="font-size:11px; color:#C4522A; letter-spacing:0.14em; text-transform:uppercase; font-weight:700; margin-bottom:20px;">WCAG 2.2 · Análisis Estático</p>
    <h1 style="font-family:'DM Serif Display',serif; font-size:clamp(40px,6vw,72px); line-height:1.05; letter-spacing:-0.02em; margin-bottom:24px;">
      Informe de<br/><em style="color:#E8A030;">Accesibilidad</em>
    </h1>
    <p style="font-size:13px; color:#888480; font-family:'DM Mono',monospace; margin-bottom:8px;">Sitio auditado</p>
    <p style="font-size:16px; color:#F0EDE8; font-family:'DM Mono',monospace; word-break:break-all;">${url}</p>
    ${name ? `<p style="font-size:13px; color:#888480; margin-top:16px;">Preparado para: <strong style="color:#F0EDE8;">${name}</strong></p>` : ""}
  </div>

  <!-- Score portada -->
  <div style="display:flex; align-items:center; gap:48px; padding-top:40px; border-top:1px solid #2A2A2A;">
    <div style="text-align:center;">
      <p style="font-size:56px; font-weight:800; color:${scoreColor}; line-height:1;">${score}</p>
      <p style="font-size:11px; color:#888480; margin-top:4px;">Score /100</p>
    </div>
    <div style="display:flex; gap:40px;">
      <div>
        <p style="font-size:32px; font-weight:800; color:#C4522A;">${byLevel.A}</p>
        <p style="font-size:11px; color:#888480; margin-top:4px;">Críticos (Nivel A)</p>
      </div>
      <div>
        <p style="font-size:32px; font-weight:800; color:#F5C842;">${byLevel.AA}</p>
        <p style="font-size:11px; color:#888480; margin-top:4px;">Importantes (Nivel AA)</p>
      </div>
      <div>
        <p style="font-size:32px; font-weight:800; color:#F0EDE8;">${findings.length}</p>
        <p style="font-size:11px; color:#888480; margin-top:4px;">Total hallazgos</p>
      </div>
    </div>
    <div style="flex:1; text-align:right;">
      <p style="font-size:11px; color:#888480; margin-bottom:4px;">Conformance</p>
      <p style="font-size:14px; font-weight:700; color:#E8A030;">${aiData?.conformanceLevel || "Sin datos suficientes"}</p>
    </div>
  </div>
</div>

<!-- ── RESUMEN EJECUTIVO ────────────────────────────────────── -->
<div class="page-break" style="padding:56px 64px; background:#1A1A1A; min-height:60vh;">
  <p style="font-size:11px; color:#E8A030; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:24px;">01 — Resumen ejecutivo</p>
  <h2 style="font-family:'DM Serif Display',serif; font-size:32px; margin-bottom:24px; letter-spacing:-0.01em;">Diagnóstico general</h2>
  <p style="font-size:15px; color:#F0EDE8; line-height:1.8; max-width:680px; margin-bottom:40px;">
    ${aiData?.summary || "Análisis completado. Revisa los hallazgos detallados a continuación."}
  </p>

  ${aiData?.critical?.length ? `
  <div style="background:#1A0E0A; border:1px solid #C4522A44; border-radius:10px; padding:24px; margin-bottom:24px;">
    <p style="font-size:11px; color:#C4522A; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px;">⚠ Hallazgos críticos</p>
    ${criticalHTML}
  </div>` : ""}

  ${aiData?.recommendations?.length ? `
  <div style="background:#1A160A; border:1px solid #E8A03044; border-radius:10px; padding:24px;">
    <p style="font-size:11px; color:#E8A030; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px;">✦ Recomendaciones prioritarias</p>
    ${recoHTML}
  </div>` : ""}
</div>

<!-- ── TABLA DE HALLAZGOS ───────────────────────────────────── -->
<div class="page-break" style="padding:56px 64px; background:#0F0F0F;">
  <p style="font-size:11px; color:#E8A030; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:24px;">02 — Hallazgos detallados</p>
  <h2 style="font-family:'DM Serif Display',serif; font-size:32px; margin-bottom:32px; letter-spacing:-0.01em;">${findings.length} issue${findings.length !== 1 ? "s" : ""} detectado${findings.length !== 1 ? "s" : ""}</h2>

  <table style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead>
      <tr style="border-bottom:1px solid #383838;">
        <th style="padding:10px 8px; text-align:left; font-size:10px; color:#888480; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Criterio</th>
        <th style="padding:10px 8px; text-align:left; font-size:10px; color:#888480; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Nivel</th>
        <th style="padding:10px 8px; text-align:left; font-size:10px; color:#888480; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Categoría</th>
        <th style="padding:10px 8px; text-align:left; font-size:10px; color:#888480; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Hallazgo</th>
        <th style="padding:10px 8px; text-align:left; font-size:10px; color:#888480; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Cómo resolverlo</th>
      </tr>
    </thead>
    <tbody>${findingRows}</tbody>
  </table>
</div>

<!-- ── FOOTER ──────────────────────────────────────────────── -->
<div style="padding:40px 64px; background:#1A1A1A; border-top:1px solid #2A2A2A; display:flex; justify-content:space-between; align-items:center;">
  <div style="display:flex; align-items:center; gap:12px;">
    ${isotopoSVG}
    <div>
      <span style="font-family:'DM Serif Display',serif; font-size:1.1rem; color:#F0EDE8; display:block;">accesa</span>
      <span style="font-size:11px; color:#888480;">Agencia de Accesibilidad Digital</span>
    </div>
  </div>
  <div style="text-align:right;">
    <p style="font-size:11px; color:#888480;">hola@accesa.agency</p>
    <p style="font-size:11px; color:#888480; margin-top:2px;">accesa.agency · Santiago, Chile</p>
    <p style="font-size:10px; color:#555250; margin-top:8px;">Informe generado automáticamente · Análisis estático WCAG 2.2</p>
  </div>
</div>

</body>
</html>`;
}

/* ─── APP ───────────────────────────────────────────────────────────── */
export default function AccesaAuditor() {
  const [screen, setScreen] = useState("home");
  const [url, setUrl] = useState("");
  const [findings, setFindings] = useState([]);
  const [aiData, setAiData] = useState(null);

  async function handleSubmit(inputUrl) {
    const norm = inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`;
    setUrl(norm);
    setScreen("loading");
    try {
      let html = "";
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(norm)}`);
        const data = await res.json();
        html = data.contents || "";
      } catch {
        html = `<html><head><title></title></head><body><img src="x.jpg"><button></button><input type="text" required></body></html>`;
      }
      const staticFindings = analyzeHTML(html);
      const ai = await claudeAnalyze(html, norm, staticFindings);
      setFindings(staticFindings);
      setAiData(ai);
      setScreen("results");
    } catch(err) {
      console.error(err);
      setScreen("home");
    }
  }

  if (screen === "loading") return <LoadingScreen url={url}/>;
  if (screen === "results") return <ResultsScreen url={url} findings={findings} aiData={aiData} onReset={()=>setScreen("home")}/>;
  return <HomeScreen onSubmit={handleSubmit}/>;
}
