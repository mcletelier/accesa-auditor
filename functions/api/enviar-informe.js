/**
 * POST /api/enviar-informe   { nombre, email, organizacion?, payload, firma, sitio_web (trampa anti-spam) }
 * Envía el informe a la persona y avisa a Accesa del nuevo contacto.
 *
 * Variables (Cloudflare Pages → Settings → Variables and secrets):
 *   RESEND_API_KEY  (secreto)   Clave de Resend.
 *   REPORT_FROM     (opcional)  Remitente. Por defecto "Accesa <informes@accesa.agency>".
 *                               El dominio accesa.agency debe estar verificado en Resend;
 *                               si no, Resend solo deja enviar al correo dueño de la cuenta.
 *   CONTACT_TO      (opcional)  Dónde llega el aviso de cada informe. Por defecto accesa.agency@gmail.com.
 */
import { informeHTML, textoPlano } from "../../lib/informe.js";
import { json, mismoOrigen, verificar, escapeHtml } from "../../lib/servidor.js";

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;
const limpiar = (v, max) => String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

async function enviar(env, correo) {
  try {
    const res = await fetch(env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(correo),
    });
    const texto = await res.text();
    if (!res.ok) console.log("Resend respondió", res.status, texto.slice(0, 400));
    return { ok: res.ok, status: res.status, texto };
  } catch (e) {
    console.log("No se pudo conectar con Resend:", e.message);
    return { ok: false, status: 0, texto: "sin conexión con Resend" };
  }
}

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request)) return json({ error: "Origen no permitido." }, 403);

  let d;
  try { d = await request.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }

  // Trampa para bots: este campo está oculto para las personas
  if (d.sitio_web) return json({ ok: true });

  const nombre = limpiar(d.nombre, 80);
  const email = limpiar(d.email, 120).toLowerCase();
  const organizacion = limpiar(d.organizacion, 120);
  if (!nombre) return json({ error: "Escribe tu nombre." }, 400);
  if (!EMAIL.test(email)) return json({ error: "Revisa el correo: debe tener un formato como nombre@dominio.cl." }, 400);

  if (typeof d.payload !== "string" || typeof d.firma !== "string" || !(await verificar(env, d.payload, d.firma))) {
    return json({ error: "No pudimos validar el resultado de la revisión. Vuelve a auditar el sitio e inténtalo otra vez." }, 400);
  }
  const r = JSON.parse(d.payload);
  if (Date.now() - new Date(r.fecha).getTime() > 24 * 60 * 60 * 1000) {
    return json({ error: "Este resultado tiene más de 24 horas. Vuelve a auditar el sitio para recibir un informe actualizado." }, 400);
  }

  if (!env.RESEND_API_KEY) return json({ error: "El envío de correos no está configurado todavía." }, 500);

  const from = env.REPORT_FROM || "Accesa <informes@accesa.agency>";
  const avisoA = env.CONTACT_TO || "accesa.agency@gmail.com";
  const host = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();

  // 1. Informe para la persona
  const envio = await enviar(env, {
    from,
    to: [email],
    reply_to: avisoA,
    subject: `Tu informe de accesibilidad: ${host}`,
    html: informeHTML(r, { nombre, modo: "correo" }),
    text: textoPlano(r, { nombre }),
  });

  // 2. Aviso del nuevo contacto para Accesa (se intenta aunque falle el envío a la persona)
  const errores = r.hallazgos.filter((h) => h.severity === "error").length;
  const correoAviso = {
    from,
    to: [avisoA],
    reply_to: email,
    subject: `Nuevo informe solicitado: ${host} (${nombre})`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1A1A1A">
      <p><strong>${escapeHtml(nombre)}</strong> pidió el informe del auditor.</p>
      <p>Correo: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a><br>
      ${organizacion ? `Organización: ${escapeHtml(organizacion)}<br>` : ""}
      Sitio: <a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a><br>
      Puntaje: ${r.puntaje ?? "no disponible"} / 100 · ${errores} tipos de falla · ${r.hallazgos.length - errores} puntos a revisar</p>
      <p>Estado del envío a la persona: ${envio.ok ? "enviado ✔" : `<strong>falló</strong> (${escapeHtml(envio.texto.slice(0, 200))})`}</p>
      <p>Puedes responder este correo para escribirle directamente.</p></div>`,
    text: `${nombre} <${email}>${organizacion ? ` · ${organizacion}` : ""} pidió el informe de ${r.url}. Puntaje ${r.puntaje ?? "—"}. Envío a la persona: ${envio.ok ? "ok" : "falló"}.`,
  };
  let aviso = await enviar(env, correoAviso);
  // Si el dominio aún no está verificado en Resend, el aviso se reintenta con el remitente de
  // prueba de Resend, que funciona cuando CONTACT_TO es el correo dueño de la cuenta.
  if (!aviso.ok && aviso.status === 403) {
    aviso = await enviar(env, { ...correoAviso, from: "Accesa <onboarding@resend.dev>" });
  }

  if (!envio.ok) {
    const dominioNoVerificado = envio.status === 403 || /verify a domain|testing emails|not verified/i.test(envio.texto);
    return json({
      error: dominioNoVerificado
        ? "No pudimos enviar el correo en este momento. Puedes descargar el informe ahora y te escribiremos pronto."
        : "Hubo un problema al enviar el correo. Puedes descargar el informe ahora mismo.",
      avisoRegistrado: aviso.ok,
    }, 502);
  }
  return json({ ok: true });
}
