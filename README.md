# 🛠️ Sistema de Tickets, Tareas y Equipos — CE · v5.1

Sistema web interno para el área de **TI** que centraliza, en un solo lugar y **sin costo de servidor**:

- 🎫 **Tickets de soporte** — incidencias, requerimientos y eventos reportados por los empleados.
- ✅ **Tareas asignadas** — trabajo planificado por persona, con un **catálogo parametrizado** de tareas.
- 💻 **Inventario de equipos** — control de equipos informáticos (PCs, laptops, impresoras…) y a quién están asignados.
- 👥 **Usuarios y roles** — alta de personal por equipo de trabajo, con permisos diferenciados.

> **Evolución desde v4:** el sistema dejó de ser solo un gestor de tickets. Ahora TI puede ver **quién atiende cada ticket** (al tomarlo, el técnico queda como *asignado* y el ticket pasa a *En atención*), gestionar las **tareas de cada persona** de forma parametrizada, llevar el **inventario de equipos** y administrar **usuarios con roles**. Queda además la base lista para **agendar tareas en Google Calendar** a futuro.

---

## 🧱 Arquitectura

| Capa | Tecnología | Detalle |
|------|------------|---------|
| **Frontend** | HTML + CSS + JavaScript (vanilla) | Páginas estáticas, sin framework. Comunicación por **JSONP**. |
| **Backend** | **Google Apps Script** (WebApp) | `backend-apps-script.gs` — un solo archivo, desplegado como WebApp `/exec`. |
| **Base de datos** | **Google Sheets** | Cada módulo es una hoja. Las columnas y hojas faltantes se crean **automáticamente**. |

No hay servidor propio que mantener ni hosting de base de datos: todo corre sobre la cuenta de Google de la empresa.

---

## 🔐 Roles y permisos

Al iniciar sesión (`login.html`), el sistema valida correo/usuario + PIN contra la hoja **USUARIOS** y guarda la sesión con su **rol**. El menú lateral y el acceso a cada página se adaptan al rol.

| Rol | Puede |
|-----|-------|
| **Administrador** | Todo: usuarios, equipos, tareas, catálogo, tickets, parámetros. |
| **Técnico TI** | Atender/tomar tickets, gestionar sus tareas, inventario de equipos. |
| **Líder de equipo** | Asignar tareas a su equipo, supervisar avances, ver tickets y equipos. |
| **Usuario / Empleado** | Registrar tickets, ver los suyos y sus tareas asignadas. |

> **Acceso inicial:** la primera vez se crea automáticamente un administrador → usuario **`admin`**, PIN **`1234`**. Cámbialo de inmediato dando de alta usuarios reales desde el módulo **Usuarios**.

---

## 🗂️ Módulos e interfaces

### 🎫 Tickets
| Página | Rol | Descripción |
|--------|-----|-------------|
| `index.html` | Todos | Inicio personalizado con estado del sistema y accesos rápidos. |
| `registrar.html` | Todos | Crear un ticket nuevo (con evidencia opcional). |
| `mis-tickets.html` | Todos | Ver y filtrar los tickets propios. |
| `todos-los-tickets.html` | TI / Líder / Admin | Dashboard general con métricas. |
| `admin.html` (**Atender Tickets**) | TI / Líder / Admin | Tomar, asignar y resolver tickets. |
| `historial.html` | TI / Líder / Admin | Log de cada cambio de estado. |

**Flujo "Tomar / Atender":** al abrir un ticket, el técnico ve quién lo atiende. Con **🙋 Tomar ticket** queda **asignado a él** y el ticket pasa a **En atención** automáticamente; si ya lo tiene otro técnico, puede **reasignárselo**. Al resolver, se conserva quién lo atendió y se registra en el historial.

### ✅ Tareas (`tareas.html`)
- Administrador / Líder **crean y asignan** tareas a cualquier persona; el resto ve **sus** tareas y actualiza su estado.
- **Catálogo parametrizado** (`📚 Catálogo`): plantillas de tareas reutilizables (nombre, descripción, categoría, duración estimada, rol sugerido). Al crear una tarea y elegir un *tipo* del catálogo, se **autocompletan** título y descripción.
- Cada tarea maneja prioridad, estado, fecha de inicio y **fecha límite** (base para el calendario).
- Casilla **"Agendar en Google Calendar"** lista para activarse a futuro (ver más abajo).

### 💻 Equipos / Inventario (`equipos.html`)
Registro de equipos informáticos: tipo, marca, modelo, N° de serie, **responsable asignado**, área, ubicación, **estado** (Operativo / En stock / En reparación / Asignado / De baja) y observaciones. Tarjetas de resumen y filtros por tipo y estado.

### 📱 Celulares (`celulares.html`)
Registro de celulares y líneas móviles: marca, modelo, IMEI, **N° de línea**, operador, plan, **responsable asignado**, área, **estado** (Activo / En stock / En reparación / Suspendido / De baja) y observaciones. Creación y edición en tiempo real.

> **Equipos y Celulares comparten el mismo componente** reutilizable [`js/inventory-module.js`](js/inventory-module.js): un inventario CRUD genérico dirigido por un *descriptor* (columnas, filtros, campos, estadísticas). Crear un inventario nuevo = un descriptor, sin tocar la lógica (principio Abierto/Cerrado).

### 👥 Usuarios (`usuarios.html`) — solo Administrador
Alta y edición de personal: nombre, correo/usuario, **PIN**, **rol** y **equipo de trabajo**, estado activo/inactivo. Estadísticas por rol.

---

## 🧮 Modelo de datos (hojas de Google Sheets)

| Hoja | Para qué | Columnas principales |
|------|----------|----------------------|
| `TICKETS` | Tickets | CODIGO, Nombre, Area, Tipo, Título, Descripción, Prioridad, Estado, **Tecnico asignado**, **Fecha de asignacion**, Solución, fechas… |
| `USUARIOS` | Login + roles | ID, Nombre, Email, PIN, **Rol**, **Equipo**, Activo, Fecha alta |
| `EQUIPOS` | Inventario informático | Codigo, Tipo, Marca, Modelo, N Serie, **Asignado a**, Area, Ubicacion, Estado, Fecha asignacion, Observaciones |
| `Registro_Celulares` | Inventario móvil | Codigo, Marca, Modelo, IMEI, Numero de linea, Operador, Plan, **Asignado a**, Area, Estado, Fecha asignacion, Observaciones |
| `TAREAS` | Tareas asignadas | ID, Titulo, Descripcion, Tipo, **Asignado a**, Asignado por, Estado, Prioridad, Fecha inicio, **Fecha limite**, Ticket relacionado, En calendario, Event ID |
| `CATALOGO_TAREAS` | Parametrización | ID, Nombre, Descripcion, Categoria, Duración estimada (h), Rol sugerido, Activo |
| `HISTORIAL` | Auditoría de tickets | Fecha, CODIGO, Estado anterior, Estado nuevo, Solución, Técnico, Detalle |
| `Config` | Áreas/tipos/prioridades | (existente, compatible con v4) |

> El backend crea cada hoja y sus columnas si no existen, así que **no hay que prepararlas a mano**.

---

## 🚀 Puesta en marcha

1. **Crear el Google Sheet** que será la base de datos (puede estar vacío).
2. **Apps Script:** en el Sheet → *Extensiones → Apps Script*. Pega el contenido de [`backend-apps-script.gs`](backend-apps-script.gs).
3. **Crear las hojas (una vez):** selecciona la función **`setup`** en el menú junto a ▶ *Ejecutar* y pulsa **Ejecutar**. Autoriza los permisos cuando lo pida. Crea todas las hojas (`TICKETS`, `USUARIOS`, `EQUIPOS`, `TAREAS`, `CATALOGO_TAREAS`, `HISTORIAL`) y siembra el admin `admin/1234`. *(Si no lo haces, cada hoja se crea igual la primera vez que se usa su módulo.)*
4. **Script Properties** (Configuración del proyecto → Propiedades del script), opcionales:
   - `PIN_SALT` — sal secreta para el hash de los PIN (**recomendado** ponerla y guardarla).
   - `ADMIN_EMAIL` — correo que recibe aviso de cada ticket nuevo.
   - `DRIVE_FOLDER_ID` — carpeta de Drive para evidencias (ver [`INSTRUCCIONES-EVIDENCIA.md`](INSTRUCCIONES-EVIDENCIA.md)).
   - `CALENDAR_ENABLED` / `CALENDAR_ID` — para la integración con Calendar (futuro).
5. **Desplegar** como *Aplicación web*: ejecutar como **tú**, acceso **Cualquier persona**. Copia la URL `/exec`. *(Si actualizas el código luego: Implementar → Gestionar implementaciones → ✏️ → Versión: **Nueva versión**.)*
6. En [`js/config.js`](js/config.js) pon `DEMO: false` y reemplaza `SCRIPT_URL` por esa URL.
7. Abre `login.html` y entra con **`admin` / `1234`**. Crea tus usuarios reales y cambia el acceso.

### 🧪 Modo DEMO (probar en local sin desplegar nada)
Para ver la app funcionando **sin** desplegar el backend, en [`js/config.js`](js/config.js) deja `DEMO: true`. La app usa un **backend simulado en el navegador** ([`js/demo-backend.js`](js/demo-backend.js)) con datos de prueba en `localStorage`.

- Usuarios de prueba (todos con PIN **`1234`**): **`admin`** (Administrador), `tecnico` (Técnico TI), `lider` (Líder de equipo), `usuario` (Usuario).
- Puedes crear tickets, tareas, equipos y usuarios; se guardan en tu navegador.
- Verás un distintivo **🧪 DEMO** arriba para no confundirlo con producción.
- Para resetear los datos de prueba: en la consola del navegador → `DemoBackend.reset()`.

> Cuando despliegues el backend real, pon **`DEMO: false`** y completa `SCRIPT_URL`.

### Servir los archivos en local
Al ser estático, cualquier servidor sirve. Por ejemplo, dentro de la carpeta del proyecto:
```bash
python -m http.server 8137      # o:  npx serve
```
y abre `http://localhost:8137/login.html`.

---

## 📅 Integración con Google Calendar (preparada para el futuro)

El backend incluye `agendarTarea_()` y las columnas `En calendario` / `Event ID` en `TAREAS`. Está **desactivada por defecto**. Para activarla:

1. Script Properties → `CALENDAR_ENABLED = true` (y opcional `CALENDAR_ID`).
2. Al crear una tarea, marca **"Agendar en Google Calendar"**: se creará el evento usando la fecha de inicio/límite y se guardará su `Event ID`.

---

## 🔒 Seguridad — vulnerabilidades de la v4 resueltas (v5.1)

La v4 documentaba varias vulnerabilidades. Estado actual:

| # | Problema v4 | Estado | Cómo se resolvió |
|---|-------------|--------|------------------|
| 🔴 1 | **PIN en el cliente** (`config.js`, visible en DevTools) | ✅ **Resuelto** | Se eliminó el PIN del cliente. El acceso es por **login** validado en el backend; ya no hay `ADMIN_PIN`. |
| 🔴 2 | **Sin autenticación real en el backend** (cualquiera con la URL podía hacer `update`) | ✅ **Resuelto** | Cada acción de escritura exige un **token de sesión** (emitido en login, en `CacheService`, 6 h) **+ rol** autorizado. Sin token válido, la URL no permite modificar nada. |
| 🟡 3 | **PIN en texto plano** | ✅ **Resuelto** | Los PIN se guardan con **hash SHA-256 + sal** (`PIN_SALT`). Los PIN antiguos se migran solos al primer login. |
| 🟡 4 | **URL del script expuesta** | 🟡 **Mitigado** | Sigue siendo pública (limitación de Apps Script), pero ya no sirve para escribir ni para listar usuarios sin token. |
| 🟡 5 | **Sin rate limiting fuerte** | 🟡 **Parcial** | Apps Script aplica cuotas; el token reduce el abuso. Pendiente un throttle propio (ver roadmap). |
| 🟢 6 | XSS / SQL injection | ✅ **OK** | Todo el HTML se **escapa**; los datos viven en Google Sheets (sin SQL). |

**Autorización por rol (backend `AUTHZ`):** crear/editar usuarios → solo Administrador; tomar/actualizar tickets, inventario y catálogo → Técnico TI / Líder / Admin; crear ticket y avanzar tareas propias → cualquier usuario autenticado.

**Recomendaciones para endurecer más** (entornos sensibles): mover el login a **Google OAuth** del dominio de la empresa, gatear también las lecturas detrás del token, y rotar `PIN_SALT`.

---

## 🌿 Flujo de trabajo con ramas

`main` es **producción** y se mantiene estable. Cada integrante trabaja en **su rama** y promueve los cambios cuando están probados.

| Rama | Uso |
|------|-----|
| `main` | **Producción.** Solo recibe lo ya probado. No se trabaja directo aquí. |
| `marcha-blanca` | **Pruebas / pre-producción.** Integración de mejoras antes de pasar a `main`. |
| `angel`, `jose`, `miguel`, `joshua`, `franco` | Rama personal de cada desarrollador. |

**Ciclo de una mejora:**
1. **Local primero.** Trabaja y prueba en tu máquina (la API de Google funciona igual desde `localhost`, no hay problema).
2. **Sube a tu rama personal.** Ej. Angel → rama `angel`:
   ```bash
   git checkout angel
   git add -A && git commit -m "feat: descripción de la mejora"
   git push origin angel
   ```
3. **Revisión / marcha blanca.** Cuando se ve que no hay problemas, se integra a `marcha-blanca` para probar con los demás.
4. **Producción.** Verificado en marcha blanca → se sube a `main` (producción):
   ```bash
   git checkout main && git merge marcha-blanca && git push origin main
   ```

> Regla práctica: **nunca** se trabaja directo sobre `main`; siempre rama personal → marcha-blanca → main.

---

## 🛣️ Mejoras futuras (roadmap)

**Tickets y tareas**
- [ ] **Google Calendar:** activar el agendado real de tareas (ya preparado, ver sección Calendar).
- [ ] **Vista Kanban** de tickets/tareas por estado (arrastrar y soltar).
- [ ] **SLA y alertas:** marcar en rojo tickets de alta prioridad pendientes > 24 h.
- [ ] **Comentarios internos** del técnico sin cambiar el estado del ticket.
- [ ] **Tareas recurrentes** (mantenimientos periódicos) generadas desde el catálogo.
- [ ] **Notificaciones por correo** en más cambios de estado (no solo "Atendido").

**Equipos**
- [ ] **Historial del equipo** (asignaciones, reparaciones, bajas) y hoja de vida.
- [ ] **Vínculo equipo ↔ ticket/tarea** (un ticket sobre un equipo del inventario).
- [ ] **Alertas de mantenimiento** preventivo por fecha.
- [ ] **Exportar inventario** a Excel/PDF y código QR por equipo.

**Usuarios y seguridad**
- [ ] **Google OAuth** del dominio de la empresa (login con la cuenta corporativa).
- [ ] **Rate limiting** propio por token/usuario.
- [ ] **Bitácora de accesos** (logins, intentos fallidos).
- [ ] **Recuperación / cambio de PIN** por el propio usuario.

**Reportes**
- [ ] **Dashboard por técnico** (tickets resueltos, tiempos, carga de tareas).
- [ ] **Reporte semanal automático** por correo al administrador.
- [ ] **Métricas de tareas** (cumplimiento de fechas límite).

**UX**
- [ ] **Modo oscuro**.
- [ ] **Búsqueda global** desde la barra superior.
- [ ] **PWA / instalable** en el móvil para registrar tickets rápido.

---

## 📦 Estructura de archivos

```
.
├── login.html               ← Acceso (correo/usuario + PIN, por rol)
├── index.html               ← Inicio personalizado
├── registrar.html           ← Crear ticket
├── mis-tickets.html         ← Tickets propios
├── todos-los-tickets.html   ← Dashboard de tickets
├── admin.html               ← Atender / tomar / resolver tickets
├── historial.html           ← Historial de cambios
├── tareas.html              ← Tareas + catálogo parametrizado
├── equipos.html             ← Inventario de equipos
├── celulares.html           ← Registro de celulares / líneas
├── usuarios.html            ← Alta de usuarios y roles (Admin)
├── css/style.css            ← Estilos (incluye roles, tareas, equipos)
├── js/
│   ├── config.js            ← SCRIPT_URL + flag DEMO
│   ├── demo-backend.js      ← Backend simulado para modo DEMO (datos locales)
│   ├── utils.js             ← Utilidades + Sesión/roles + layout por rol
│   ├── login.js             ← Autenticación
│   ├── usuarios.js          ← Módulo de usuarios
│   ├── inventory-module.js  ← Componente CRUD de inventario reutilizable (SOLID)
│   ├── equipos.js           ← Descriptor de inventario: equipos
│   ├── celulares.js         ← Descriptor de inventario: celulares
│   ├── tareas.js            ← Módulo de tareas + catálogo
│   ├── admin.js             ← Atender tickets (tomar/asignar/resolver)
│   ├── registrar.js · mis-tickets.js · ticket.js · dashboard.js
└── backend-apps-script.gs   ← Backend completo (Apps Script v5.1, con seguridad)
```

---

*Sistema de Tickets · Tareas · Equipos — CE · 2025-2026*
