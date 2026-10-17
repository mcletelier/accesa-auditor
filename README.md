# Auditor de accesibilidad de Accesa

Herramienta gratuita que revisa una página web según WCAG 2.2 y envía el informe por correo.
Es React + Vite, publicada en Cloudflare Pages con funciones del servidor en `functions/`.

## Cómo funciona

1. La persona ingresa una dirección. `POST /api/auditar` descarga **la página real** desde el servidor de Cloudflare
   (sin proxys externos ni datos de ejemplo) y la analiza con `lib/analizar.js`.
2. El puntaje se **calcula** a partir de los hallazgos (parte en 100 y descuenta por cada tipo de falla). Claude solo
   redacta el diagnóstico en lenguaje claro (`lib/resumen.js`); si Claude no responde, se usa un resumen por reglas.
3. El resultado vuelve firmado. Cuando la persona pide el informe, `POST /api/enviar-informe` verifica la firma
   (nadie puede alterar el contenido para mandar correos falsos a nombre de Accesa), envía el informe con Resend
   y avisa a Accesa del nuevo contacto.
4. Si el correo falla, la persona igual puede descargar o imprimir el informe como PDF desde el navegador.

### Qué revisa

Imágenes sin texto alternativo o con alt poco descriptivo, botones de imagen, SVG sin nombre, videos sin subtítulos,
videos incrustados, saltos de encabezados, falta de h1, tablas sin encabezados, autocomplete en datos personales,
reproducción automática, bloqueo del zoom, recarga automática, texto en movimiento, forma de saltar al contenido,
título de la página, tabindex positivo, enlaces sin texto o genéricos, eliminación del foco en el CSS, elementos
clicables que no son botones, idioma de la página, campos sin etiqueta, botones sin nombre e iframes sin título.

Cada hallazgo es **falla** (detectada con certeza razonable) o **a revisar** (una persona debe confirmarlo).
Si la página se arma con JavaScript (el HTML inicial casi no tiene contenido), se avisa que la revisión es parcial y no se muestra puntaje.

## Variables en Cloudflare Pages

Proyecto `accesa-auditor` → Settings → Variables and secrets (Production):

| Variable | Tipo | Para qué |
|---|---|---|
| `RESEND_API_KEY` | Secreto | Envío de correos. Debe ser de la cuenta de Resend donde está verificado `accesa.agency`. |
| `ANTHROPIC_API_KEY` | Secreto | Diagnóstico redactado por Claude (opcional). |
| `REPORT_SECRET` | Secreto | Firma de los resultados. Cualquier texto largo y aleatorio. |
| `REPORT_FROM` | Texto (opcional) | Remitente. Por defecto `Accesa <informes@accesa.agency>`. |
| `CONTACT_TO` | Texto (opcional) | Dónde llega el aviso de cada informe. Por defecto `accesa.agency@gmail.com`. |
| `CLAUDE_MODEL` | Texto (opcional) | Modelo de Claude. Por defecto `claude-haiku-5-5`. |

> Resend solo envía a cualquier persona si el dominio del remitente está verificado. Sin eso, solo puede enviar al
> correo dueño de la cuenta: el informe no llegará a quien lo pide (pero sí el aviso a Accesa, y la persona puede descargarlo).

## Publicar

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name accesa-auditor
```

## Probar en tu computador

Crea un archivo `.dev.vars` (no se sube a GitHub) con las variables, por ejemplo `REPORT_SECRET=prueba`, y luego:

```bash
npm run build
npx wrangler pages dev dist
```
