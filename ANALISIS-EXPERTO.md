# Análisis experto del proyecto — Sistema de Tickets/Tareas/Equipos

Evaluación integral con criterio senior (TI, desarrollo, UX/accesibilidad), realizada con auditoría
multi-agente y **verificación adversarial** de cada hallazgo. Cubre frontend, UX/UI, seguridad cliente,
arquitectura, deuda técnica, madurez y escalabilidad. El **backend** ya fue auditado y consolidado a
v5.2 aparte (ver `AUDITORIA-BACKEND.md`).

> **Veredicto ejecutivo — Score global: 68/100 (beta / prototipo avanzado, muy aprovechable).**
> Sorprendentemente completo y usable para ser una herramienta interna **sin servidor ni costos**:
> login con roles, tickets, tareas por persona, dos inventarios, calendario, usuarios e historial
> funcionando de punta a punta. La calidad del frontend está **por encima del promedio vanilla**
> (el `inventory-module.js` por descriptor es SOLID real; sesión/escape de HTML centralizados; modo
> DEMO para desarrollar sin desplegar). **No es aún software de producción crítico ni escalable a gran
> escala:** arrastra deuda estructural que conviene saldar con un *sprint de saneamiento* antes de
> añadir más funcionalidad. Techo honesto: **~20-30 usuarios concurrentes y ~3.000-5.000 registros**.

---

## 1. ¿Qué tan desarrollado está? (madurez por área)

| Área | Nivel | % | Nota |
|---|---|---|---|
| Tickets | beta | 85% | Crear/atender/tomar/reasignar/resolver con UI pulida. Lastrado por doble contrato y evidencia por JSONP |
| Equipos | beta | 85% | `InventoryModule` por descriptor: CRUD, filtros, stats, carga masiva. Buen SOLID/OCP |
| Celulares | beta | 85% | Mismo componente reutilizable; integrado en backend v5.2 |
| Usuarios/Roles | beta | 85% | Alta/edición, roles, activo/inactivo, stats. Falta cambio de PIN por el propio usuario |
| Login/Sesión | beta | 80% | PIN hash+sal + token 6 h; guard centralizado. Falta: PIN largo, revalidación de rol, recuperación |
| Tareas/Sub-tareas | funcional | 70% | Tarea→Sub-tarea→Estado por persona, con roles y catálogo. Conviven hoja TAREAS (sin UI) y Sub-tareas |
| Panel/Stats | funcional | 65% | Dashboard con KPIs + 2 gráficos + tabla. KPIs en cliente; sin paginación; CDN sin SRI |
| Calendario | funcional | 60% | Vista semanal solo lectura; integración real con Google Calendar sigue desactivada |
| Reportes | prototipo | 35% | Solo exportación CSV y gráficos. Sin reporte por técnico ni envío automático |

---

## 2. Diseño y UX/UI (puntuaciones 0-10)

| Dimensión | Nota |
|---|---|
| Jerarquía visual | 8 |
| Feedback de estados (loading/vacío/error/toasts) | 7 |
| Consistencia / sistema de diseño | 7 |
| Responsive | 7 |
| Navegación | 7 |
| **Accesibilidad (WCAG)** | **4** ⚠️ |

**Lo bueno:** sistema de diseño maduro (tokens CSS en `:root`, badges con buen contraste ≥6:1,
componentes consistentes, skeletons, toasts, pill de conexión, modo DEMO), layout unificado por
`initLayout()`, responsive en 1024/768/480 y dashboard con tabla desktop + tarjetas móviles.

**El punto débil es la accesibilidad (4/10):** sin landmark `<main>` ni *skip-link*; `<nav>` sin
`aria-label`/`aria-current`; encabezados irregulares (la mayoría de páginas sin `<h1>`); **modales no
operables por teclado/lector** (sin `role=dialog`, `aria-modal`, atrapado de foco, cierre con Esc) — lo
que rompe flujos centrales (crear tarea, alta de usuario, detalle de ticket, carga masiva); mensajes de
estado sin `aria-live`/`role=alert`; varios textos *muted* por debajo de 4.5:1; campos con `*` sin
`required`; y filas/ítems clicables solo con mouse. Con esas correcciones pasaría de "visualmente sólido
pero poco accesible" a estándar profesional WCAG AA.

---

## 3. Hallazgos confirmados (18 — verificados, 1 descartado)

### 🔴 Severidad ALTA

| # | Hallazgo | Dónde | Arreglo |
|---|---|---|---|
| F01 | **`js/index.js` es código muerto** (275 líneas): ningún HTML lo carga y apunta a IDs inexistentes; `index.html` resuelve todo en un `<script>` inline paralelo | `js/index.js` vs `index.html` | Borrar `index.js`; mover el inline de `index.html` a un `index.js` limpio con IDs reales + `Utils` |
| F02 | **`ticket.html` no carga `demo-backend.js`** → la página de detalle queda **rota en modo DEMO/local** (hace JSONP real y falla offline) | `ticket.html:14-16` | Añadir `<script src="js/demo-backend.js">` antes de `utils.js` |
| F07/F1 | **"Mis Tickets" no filtra por el usuario en sesión**: un rol *Usuario* ve los tickets de TODOS (bug de producto + fuga de info) | `mis-tickets.js:53-86` | Si rol = Usuario, filtrar por `t.nombre === Session.nombre()` (como ya hacen tareas/calendario) |
| F2 | **Dashboard e Historial sin guard de rol**: un *Usuario* entra por URL directa y ve datos globales | `todos-los-tickets.html`, `historial.html` | Anteponer `Session.require(['Técnico TI','Líder de equipo'])` |
| F3 | **En modo DEMO no se puede registrar ningún ticket**: `config` del demo devuelve `raw:[]`, el `<select nombre>` (required) nunca se habilita | `demo-backend.js:124`, `registrar.js` | Poblar `config.raw` en el demo desde USUARIOS |
| XSS-01 | **XSS por URI `javascript:`** en enlaces de Evidencia/URL: `escapeHtml` no valida el *esquema*; un dato de Sheet manipulado roba el token de `localStorage` al hacer clic | `mis-tickets.js:149`, `ticket.js:64`, `calendario.js:146` | Helper `safeUrl()` que solo acepte `http(s)` antes de pintar el `href` |
| A11Y-01 | Sin landmark `<main>` ni *skip-link* (WCAG 2.4.1/1.3.1) | `utils.js` `initLayout()` | `<main id=pageContent>` + enlace "Saltar al contenido" |
| A11Y-03 | **Modales no accesibles** (sin `role=dialog`, foco atrapado, Esc) | `inventory-module.js` y modales HTML | Helper de modal accesible reutilizable |

### 🟠 Severidad MEDIA (selección)

- **F07/contrato doble** — Conviven dos contratos de respuesta: Tickets usa `status:'success'`; el resto usa `ok:true`. Frágil ante refactors; el demo replica ambos. *(Unificar a `ok` + `status`.)*
- **F03/EXP-02** — `SweetAlert2` y `Chart.js` por **CDN sin SRI ni fallback**: rompen el modo offline y son riesgo de cadena de suministro; el dashboard no protege `new Chart(...)`. *(Vendorizar local + guardas.)*
- **F05** — `?action=config` se pide **sin caché** en dashboard/registrar/pill → 2-3 llamadas redundantes por carga a un backend lento. *(Usar `Utils.jsonpCached`.)*
- **F06** — Mezcla de capas datos/render/eventos: lógica inline en `index.html` y *mega template-strings* con CSS inline en ticket/admin/mis-tickets, sin render de ficha compartido. *(Extraer `Utils.ticketDetailHTML`.)*
- **F04** — Lógica Área→Usuarios duplicada en `registrar.js` y `mis-tickets.js`. *(Extraer a `Utils`.)*
- **F6** — `jsonpCached` **cachea respuestas de error/authError** y las reutiliza hasta el TTL (1.5-5 min). *(No cachear respuestas no exitosas.)*
- **SES-01 / EXP-01** — Token en `localStorage` **sin CSP** en ninguna página; `demo-backend.js` (espejo del backend + semilla admin/1234 + PII de ejemplo) se sirve en producción. *(Añadir CSP; excluir demo en prod.)*
- **VAL-01** — **Open redirect** por el parámetro `next` del login sin validar. *(Lista blanca de rutas internas.)*
- **PII-01** — El *gating* por rol es solo de presentación; depende de que el backend **filtre por identidad**, no solo que valide el token. *(Confirmar recorte por rol en backend.)*
- **UX**: contraste insuficiente en textos *muted*, encabezados sin `<h1>`, mensajes sin `aria-live`, inventario sin tarjetas en móvil, `todos-los-tickets.html` titulado "Dashboard" (nomenclatura inconsistente), estilos inline duplicados en `admin.html`.

### ✅ Descartado (falso positivo, verificado)
- *"`dateForInput_` corre la fecha un día por UTC"* — **refutado** para Perú (UTC−5): el desfase solo ocurriría en zonas con offset positivo. Es a lo sumo una mejora de robustez, no un bug.

---

## 4. Arquitectura: SOLID, spaghetti y documentación

**Juicio:** el frontend está **parcialmente bien estructurado y necesita refactor focalizado, no
reescritura.**

- **A favor de SOLID:** `inventory-module.js` es un acierto (factory por descriptor → Equipos y
  Celulares lo reutilizan sin duplicar — OCP real); `utils.js` centraliza JSONP+caché+sesión+roles+escape;
  `demo-backend.js` tiene responsabilidad única; el guard de sesión es consistente en páginas elevadas.
- **Spaghetti acotado** (no caos generalizado): nace de la **coexistencia de dos generaciones de código**
  — el viejo `index.js`/inline de `index.html` frente a los módulos nuevos. Síntomas: código muerto (F01),
  lógica de negocio embebida en HTML (F06), 3 normalizadores de estado distintos (riesgo de conteos que no
  cuadran entre home/dashboard/admin), helpers de escape/clase duplicados en vez de usar `Utils`.
- **Documentación desigual:** los módulos modelo traen cabecera (`inventory-module.js`, `tareas.js`,
  `calendario.js`, `demo-backend.js`), pero `ticket.js`, `mis-tickets.js` y el inline de `index.html` no
  están comentados, y `Utils` carece de JSDoc por método. *(El backend v5.2, en cambio, quedó con cada
  función documentada.)*

---

## 5. Deuda técnica (priorizada)

| Deuda | Severidad | Esfuerzo |
|---|---|---|
| Doble contrato de respuesta (`status` vs `ok`) conviviendo | alta | medio |
| Escrituras vía JSONP-GET (la evidencia base64 viaja en la URL → **inviable para fotos reales**) | alta | alto |
| Lógica de negocio duplicada frontend/backend (`demo-backend.js` espejo) con divergencias ya visibles | media | medio |
| Sin paginación: cada vista trae **todos** los tickets y filtra en cliente | media | medio |
| Sin build, tests, tipado ni CI: toda regresión se paga en producción | media | alto |
| Control de acceso por rol incompleto en la UI (varias páginas sin `Session.require`) | media | bajo |
| CDN sin SRI/fallback; `SCRIPT_URL` y versión de despliegue manuales | media | bajo |
| Token con rol embebido y TTL 6 h (rol degradado sigue activo hasta expirar); PIN de 4 dígitos | media | medio |
| Acoplamiento a nombres de columna del Sheet en español | baja | medio |
| Helpers utilitarios duplicados (escape/normalize) en vez de reusar `Utils` | baja | bajo |

---

## 6. ¿Es escalable?

**Para su propósito (TI interno) sí; para escala masiva, no.** Límites técnicos reales:

- **Apps Script:** ~6 min por ejecución y cuotas diarias (MailApp ~100 correos/día en cuenta gratuita →
  afecta avisos de urgentes). `LockService` **serializa las escrituras**: con decenas de usuarios a la vez
  aparecen colas y timeouts.
- **Google Sheets como BD:** límite duro ~10 M celdas, pero el rendimiento **se degrada mucho antes**
  (~5.000-10.000 filas), agravado porque el frontend **no pagina** y trae todo en cada vista.
- **JSONP es solo-GET:** sin cuerpos grandes (evidencia en la URL choca con el límite de longitud), sin
  cabeceras de auth, sin CSRF estándar.
- **CacheService:** ~6 h / ~100 KB por entrada (sirve para tokens y rate-limit, no para datasets grandes).
- **Frontend sin paginación/virtualización:** miles de filas en el DOM penalizan memoria y pintado.

**Techo estimado honesto:** ~20-30 usuarios concurrentes y ~3.000-5.000 tickets/registros. Más allá,
duelen los tiempos de carga, la serialización por lock y las cuotas de correo.

---

## 7. Plan de evolución recomendado

**Corto plazo (días) — *sprint de saneamiento*:**
unificar el contrato de respuesta a uno solo · arreglar `ticket.html` (incluir demo-backend) · borrar
`index.js` muerto · `Session.require([roles])` en Dashboard/Historial · filtrar "Mis Tickets" por usuario ·
`safeUrl()` para los `href` (XSS-01) · poblar `config.raw` en demo · no cachear errores en `jsonpCached` ·
vendorizar/`SRI` para SweetAlert2/Chart.js · centralizar `escapeHtml` · accesibilidad de modales + `<main>`
+ `aria-live` + contraste · sincronizar README con el backend v5.2.

**Medio plazo (semanas):**
mover la subida de evidencia a `doPost` (cuerpo JSON/base64) o subida directa a Drive · **paginación/consultas
filtradas en backend** (no traer toda la hoja) · set mínimo de **tests de contrato + linter en CI** (GitHub
Actions) · revalidar rol contra USUARIOS en acciones críticas y subir el PIN a ≥6 dígitos · añadir CSP.

**Largo plazo (meses), si crece el uso:**
migrar la persistencia de Sheets a una **BD real** (Firestore/Cloud SQL/Supabase) manteniendo la UI ·
reemplazar JSONP por un **API HTTPS con CORS** y OAuth del dominio · build ligero (Vite) con tipado
(TS o JSDoc+checkJs) · una **única fuente de verdad** de la lógica de negocio (eliminar el espejo demo).

---

*Metodología: auditoría multi-agente (5 expertos en paralelo) + verificación adversarial de cada bug y
hallazgo de seguridad de severidad alta/media (18 confirmados, 1 refutado). El frontend no se ejecutó en
runtime para esta evaluación: el análisis es estático + contrato con el backend, complementando la prueba
en vivo del modo DEMO ya realizada.*
