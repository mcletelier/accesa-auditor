import { useEffect, useRef, useState } from "react";
import { informeHTML } from "../lib/informe.js";

const CONTACTO = "https://accesa.agency/#contacto";

/* ─── Isotipo ─────────────────────────────────────────────────────────── */
function Logo({ size = 32 }) {
  return (
    <a className="logo" href="https://accesa.agency" aria-label="Accesa, ir al sitio principal">
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
        <circle cx="32" cy="32" r="28" fill="none" stroke="#C4522A" strokeWidth="2.5" />
        <path d="M20 46 L32 16 L44 46" fill="none" stroke="#FAF6EE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="13" r="4" fill="#E8A030" />
      </svg>
      <span>accesa</span>
    </a>
  );
}

/* ─── Inicio ──────────────────────────────────────────────────────────── */
function Inicio({ onAuditar, error, urlPrevia }) {
  const [url, setUrl] = useState(urlPrevia || "");
  const errorRef = useRef(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  return (
    <main id="contenido" className="inicio">
      <p className="sobretitulo">Auditoría WCAG 2.2 · gratuita</p>
      <h1>Descubre qué tan <em>accesible</em> es tu sitio.</h1>
      <p className="bajada">
        Revisamos el HTML real de tu página y te mostramos las barreras que afectan a personas que usan lector de pantalla, navegan con teclado o necesitan ampliar el texto.
      </p>

      {error && (
        <div className="alerta" role="alert" tabIndex={-1} ref={errorRef}>
          <strong>No pudimos revisar ese sitio.</strong> {error}
        </div>
      )}

      <form className="form-url" onSubmit={(e) => { e.preventDefault(); if (url.trim()) onAuditar(url.trim()); }}>
        <label htmlFor="url">Dirección del sitio</label>
        <div className="fila">
          <input id="url" name="url" type="text" inputMode="url" autoComplete="url" spellCheck="false"
            placeholder="www.tu-sitio.cl" value={url} onChange={(e) => setUrl(e.target.value)} required
            aria-describedby="url-ayuda" />
          <button className="btn-primario" type="submit">Auditar</button>
        </div>
        <p id="url-ayuda" className="ayuda">Revisamos una página por vez. No guardamos el contenido de tu sitio.</p>
      </form>
    </main>
  );
}

/* ─── Cargando ────────────────────────────────────────────────────────── */
const PASOS = ["Descargando la página", "Leyendo la estructura del HTML", "Evaluando criterios WCAG 2.2", "Revisando hojas de estilo", "Redactando el diagnóstico"];
function Cargando({ url }) {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <main id="contenido" className="cargando">
      <h1>Revisando tu sitio</h1>
      <p className="mono">{url}</p>
      <div className="panel" role="status" aria-live="polite">
        <ol className="pasos">
          {PASOS.map((p, i) => (
            <li key={p} className={i < paso ? "hecho" : i === paso ? "actual" : ""} aria-current={i === paso ? "step" : undefined}>
              <span aria-hidden="true">{i < paso ? "✓" : i === paso ? "●" : "○"}</span> {p}
            </li>
          ))}
        </ol>
        <p className="ayuda">Puede tardar hasta 30 segundos.</p>
      </div>
    </main>
  );
}

/* ─── Resultados ──────────────────────────────────────────────────────── */
function Puntaje({ valor }) {
  if (valor == null) return <div className="puntaje vacio"><span className="num">—</span><span className="de">sin puntaje</span></div>;
  const r = 52, c = 2 * Math.PI * r;
  const clase = valor >= 80 ? "alto" : valor >= 50 ? "medio" : "bajo";
  return (
    <div className={`puntaje ${clase}`}>
      <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden="true" focusable="false">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#2E2E2E" strokeWidth="8" />
        <circle cx="65" cy="65" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={c}
          strokeDashoffset={c * (1 - valor / 100)} strokeLinecap="round" transform="rotate(-90 65 65)" />
      </svg>
      <span className="num">{valor}</span>
      <span className="de">de 100</span>
    </div>
  );
}

function Hallazgo({ h }) {
  const [abierto, setAbierto] = useState(false);
  const id = `det-${h.id}`;
  return (
    <li className="hallazgo">
      <h3>
        <button type="button" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto((a) => !a)}>
          <span className="criterio">{h.rule}</span>
          <span className={`nivel nivel-${h.level}`}>Nivel {h.level}</span>
          <span className="nombre">{h.name}</span>
          <span className="cuenta">{h.count} caso{h.count > 1 ? "s" : ""}</span>
          <span className="chevron" aria-hidden="true">{abierto ? "−" : "+"}</span>
        </button>
      </h3>
      <div id={id} hidden={!abierto} className="detalle">
        <p className="como"><strong>Cómo resolverlo:</strong> {h.fix}</p>
        {h.examples?.length > 0 && (
          <>
            <p className="etiqueta">Ejemplos encontrados</p>
            <ul className="ejemplos">{h.examples.map((e, i) => <li key={i}><code>{e}</code></li>)}</ul>
          </>
        )}
      </div>
    </li>
  );
}

function FormularioInforme({ firma, payload, onDescargar }) {
  const [estado, setEstado] = useState("inicial"); // inicial | form | enviando | ok | error
  const [error, setError] = useState("");
  const [d, setD] = useState({ nombre: "", email: "", organizacion: "", sitio_web: "" });
  const refMsg = useRef(null);
  useEffect(() => { if (estado === "ok" || estado === "error") refMsg.current?.focus(); }, [estado]);

  async function enviar(e) {
    e.preventDefault();
    setEstado("enviando");
    try {
      const res = await fetch("/api/enviar-informe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, payload, firma }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "No pudimos enviar el correo.");
      setEstado("ok");
    } catch (err) {
      setError(err.message);
      setEstado("error");
    }
  }

  if (estado === "inicial") return (
    <section className="tarjeta-cta" aria-labelledby="t-informe">
      <h2 id="t-informe">Recibe el informe completo en tu correo</h2>
      <p>Con todos los hallazgos, ejemplos del código y por dónde empezar. Gratis.</p>
      <div className="acciones">
        <button className="btn-primario" type="button" onClick={() => setEstado("form")}>Recibir informe</button>
        <button className="btn-secundario" type="button" onClick={onDescargar}>Descargar o imprimir</button>
      </div>
    </section>
  );

  if (estado === "ok") return (
    <section className="tarjeta-cta" aria-labelledby="t-ok">
      <h2 id="t-ok" tabIndex={-1} ref={refMsg}>¡Listo! Revisa tu correo</h2>
      <p>Enviamos el informe a <strong>{d.email}</strong>. Si no lo ves en unos minutos, revisa la carpeta de spam o promociones.</p>
      <div className="acciones"><button className="btn-secundario" type="button" onClick={onDescargar}>Descargar o imprimir</button></div>
    </section>
  );

  return (
    <section className="tarjeta-cta" aria-labelledby="t-form">
      <h2 id="t-form">¿A dónde te enviamos el informe?</h2>
      {estado === "error" && (
        <div className="alerta" role="alert" tabIndex={-1} ref={refMsg}>
          {error} <button className="enlace" type="button" onClick={onDescargar}>Descargar el informe ahora</button>
        </div>
      )}
      <form className="form-datos" onSubmit={enviar} noValidate={false}>
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" autoComplete="name" required value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" required value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="org">Organización <span className="opcional">(opcional)</span></label>
          <input id="org" autoComplete="organization" value={d.organizacion} onChange={(e) => setD({ ...d, organizacion: e.target.value })} />
        </div>
        <div className="trampa" aria-hidden="true">
          <label htmlFor="sitio_web">No completar</label>
          <input id="sitio_web" tabIndex={-1} autoComplete="off" value={d.sitio_web} onChange={(e) => setD({ ...d, sitio_web: e.target.value })} />
        </div>
        <p className="ayuda">Usaremos tu correo para enviarte el informe y, si quieres, conversar sobre cómo mejorar tu sitio. No lo compartimos con nadie.</p>
        <div className="acciones">
          <button className="btn-primario" type="submit" disabled={estado === "enviando"}>
            {estado === "enviando" ? "Enviando…" : "Enviar informe"}
          </button>
          <button className="btn-secundario" type="button" onClick={() => setEstado("inicial")}>Cancelar</button>
        </div>
      </form>
    </section>
  );
}

function Resultados({ resultado, payload, firma, onNueva }) {
  const [filtro, setFiltro] = useState("todos");
  const tituloRef = useRef(null);
  useEffect(() => { tituloRef.current?.focus(); }, []);

  const { hallazgos, meta } = resultado;
  const errores = hallazgos.filter((h) => h.severity === "error");
  const revisar = hallazgos.filter((h) => h.severity === "revisar");
  const nivelA = errores.filter((h) => h.level === "A").length;
  const filtros = [
    ["todos", "Todos", hallazgos.length],
    ["error", "Fallas", errores.length],
    ["revisar", "A revisar", revisar.length],
  ];
  const visibles = filtro === "todos" ? hallazgos : hallazgos.filter((h) => h.severity === filtro);

  function descargar() {
    const html = informeHTML(resultado, { modo: "imprimir", contactoUrl: CONTACTO });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <main id="contenido" className="resultados">
      <div className="cabecera-res">
        <div>
          <p className="sobretitulo">Resultado de la revisión</p>
          <h1 tabIndex={-1} ref={tituloRef}>{meta.title || "Página revisada"}</h1>
          <p className="mono">{resultado.url}</p>
        </div>
        <button className="btn-secundario" type="button" onClick={onNueva}>Revisar otro sitio</button>
      </div>

      {meta.dependeDeJs && (
        <div className="alerta aviso" role="note">
          <strong>Revisión parcial.</strong> Esta página se arma con JavaScript en el navegador, así que su HTML inicial casi no tiene contenido. Por eso no mostramos puntaje: para conocer su estado real se necesita una revisión en navegador y manual.
        </div>
      )}

      <section className="resumen" aria-labelledby="t-diag">
        <Puntaje valor={resultado.puntaje} />
        <div>
          <h2 id="t-diag">Diagnóstico</h2>
          <p>{resultado.resumen}</p>
          <dl className="cifras">
            <div><dt>Tipos de falla</dt><dd className="c-falla">{errores.length}</dd></div>
            <div><dt>De nivel A</dt><dd className="c-falla">{nivelA}</dd></div>
            <div><dt>Puntos a revisar</dt><dd className="c-revisar">{revisar.length}</dd></div>
          </dl>
        </div>
      </section>

      {resultado.prioridades?.length > 0 && (
        <section className="prioridades" aria-labelledby="t-prio">
          <h2 id="t-prio">Por dónde empezar</h2>
          <ol>{resultado.prioridades.map((p, i) => <li key={i}>{p}</li>)}</ol>
        </section>
      )}

      <section aria-labelledby="t-hall">
        <h2 id="t-hall">Hallazgos</h2>
        <div className="filtros" role="group" aria-label="Filtrar hallazgos">
          {filtros.map(([k, t, n]) => (
            <button key={k} type="button" className="filtro" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
              {t} <span className="n">{n}</span>
            </button>
          ))}
        </div>
        {visibles.length === 0
          ? <p className="vacio">No se detectaron problemas en esta categoría.</p>
          : <ul className="lista-hallazgos">{visibles.map((h) => <Hallazgo key={h.id} h={h} />)}</ul>}
        <p className="ayuda">
          <strong>Fallas</strong>: barreras detectadas con certeza razonable. <strong>A revisar</strong>: señales que una persona debe confirmar.
          El puntaje parte en 100 y descuenta según la cantidad y el nivel de las fallas.
        </p>
      </section>

      <FormularioInforme payload={payload} firma={firma} onDescargar={descargar} />

      <section className="no-cubre" aria-labelledby="t-limites">
        <h2 id="t-limites">Lo que esta revisión no cubre</h2>
        <p>
          Una herramienta automática detecta solo una parte de las barreras. Quedan fuera el contraste de colores, el uso completo con teclado,
          la experiencia con lector de pantalla, la calidad de los textos alternativos y subtítulos, y lo que aparece al interactuar con la página.
          El puntaje es una referencia para priorizar, no una certificación de cumplimiento.
        </p>
        <div className="pro">
          <div>
            <p className="sobretitulo">Auditoría experta</p>
            <p className="pro-titulo">Revisión manual con teclado y lector de pantalla, con un plan de acción priorizado.</p>
          </div>
          <a className="btn-primario" href={CONTACTO}>Conversemos</a>
        </div>
      </section>
    </main>
  );
}

/* ─── App ─────────────────────────────────────────────────────────────── */
export default function App() {
  const [pantalla, setPantalla] = useState("inicio");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [datos, setDatos] = useState(null);

  async function auditar(u) {
    setUrl(u);
    setError("");
    setPantalla("cargando");
    try {
      const res = await fetch("/api/auditar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.payload) throw new Error(j.error || "Ocurrió un error inesperado. Intenta de nuevo en unos minutos.");
      setDatos({ resultado: JSON.parse(j.payload), payload: j.payload, firma: j.firma });
      setPantalla("resultados");
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "No hay conexión con el auditor. Revisa tu internet e intenta de nuevo." : e.message);
      setPantalla("inicio");
    }
  }

  useEffect(() => {
    document.title = pantalla === "resultados" && datos
      ? `Resultado: ${datos.resultado.meta.title || datos.resultado.url} — Auditor Accesa`
      : pantalla === "cargando" ? "Revisando… — Auditor Accesa" : "Auditor de accesibilidad web gratuito — Accesa";
  }, [pantalla, datos]);

  return (
    <>
      <a className="saltar" href="#contenido">Saltar al contenido</a>
      <header className="cabecera"><Logo /></header>
      {pantalla === "cargando" && <Cargando url={url} />}
      {pantalla === "inicio" && <Inicio onAuditar={auditar} error={error} urlPrevia={url} />}
      {pantalla === "resultados" && datos && <Resultados {...datos} onNueva={() => { setDatos(null); setPantalla("inicio"); }} />}
      <footer className="pie">
        <p>Accesa · Accesibilidad digital · Santiago, Chile · <a href="https://accesa.agency">accesa.agency</a></p>
      </footer>
    </>
  );
}
