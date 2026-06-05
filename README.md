# 🛠️ Sistema de Tickets, Tareas y Equipos — CE · v5.0

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

### 👥 Usuarios (`usuarios.html`) — solo Administrador
Alta y edición de personal: nombre, correo/usuario, **PIN**, **rol** y **equipo de trabajo**, estado activo/inactivo. Estadísticas por rol.

---

## 🧮 Modelo de datos (hojas de Google Sheets)

| Hoja | Para qué | Columnas principales |
|------|----------|----------------------|
| `TICKETS` | Tickets | CODIGO, Nombre, Area, Tipo, Título, Descripción, Prioridad, Estado, **Tecnico asignado**, **Fecha de asignacion**, Solución, fechas… |
| `USUARIOS` | Login + roles | ID, Nombre, Email, PIN, **Rol**, **Equipo**, Activo, Fecha alta |
| `EQUIPOS` | Inventario | Codigo, Tipo, Marca, Modelo, N Serie, **Asignado a**, Area, Ubicacion, Estado, Fecha asignacion, Observaciones |
| `TAREAS` | Tareas asignadas | ID, Titulo, Descripcion, Tipo, **Asignado a**, Asignado por, Estado, Prioridad, Fecha inicio, **Fecha limite**, Ticket relacionado, En calendario, Event ID |
| `CATALOGO_TAREAS` | Parametrización | ID, Nombre, Descripcion, Categoria, Duración estimada (h), Rol sugerido, Activo |
| `HISTORIAL` | Auditoría de tickets | Fecha, CODIGO, Estado anterior, Estado nuevo, Solución, Técnico, Detalle |
| `Config` | Áreas/tipos/prioridades | (existente, compatible con v4) |

> El backend crea cada hoja y sus columnas si no existen, así que **no hay que prepararlas a mano**.

---

## 🚀 Puesta en marcha

1. **Crear el Google Sheet** que será la base de datos (puede estar vacío).
2. **Apps Script:** en el Sheet → *Extensiones → Apps Script*. Pega el contenido de [`backend-apps-script.gs`](backend-apps-script.gs).
3. **Script Properties** (Configuración del proyecto → Propiedades del script), opcionales:
   - `ADMIN_EMAIL` — correo que recibe aviso de cada ticket nuevo.
   - `DRIVE_FOLDER_ID` — carpeta de Drive para evidencias (ver [`INSTRUCCIONES-EVIDENCIA.md`](INSTRUCCIONES-EVIDENCIA.md)).
   - `CALENDAR_ENABLED` / `CALENDAR_ID` — para la integración con Calendar (futuro).
4. **Desplegar** como *Aplicación web*: ejecutar como **tú**, acceso **Cualquier persona**. Copia la URL `/exec`.
5. En [`js/config.js`](js/config.js) reemplaza `SCRIPT_URL` por esa URL.
6. Abre `login.html` y entra con **`admin` / `1234`**. Crea tus usuarios reales y cambia el acceso.

### Probar localmente
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

## 🔒 Notas de seguridad

- El **login** se valida en el backend contra `USUARIOS` (mejor que el PIN del cliente de v4), pero el PIN se guarda en texto en la hoja: úsalo como control interno, no como seguridad fuerte. Para mayor robustez, migrar a **Google OAuth** del dominio de la empresa.
- La URL del Apps Script es pública; quien la conozca puede llamarla. Para entornos sensibles, agregar un **token** compartido validado en cada acción.
- Todo el HTML de salida se **escapa** (sin XSS); los datos viven en Google Sheets (sin SQL injection).

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
├── usuarios.html            ← Alta de usuarios y roles (Admin)
├── css/style.css            ← Estilos (incluye roles, tareas, equipos)
├── js/
│   ├── config.js            ← SCRIPT_URL del backend
│   ├── utils.js             ← Utilidades + Sesión/roles + layout por rol
│   ├── login.js             ← Autenticación
│   ├── usuarios.js          ← Módulo de usuarios
│   ├── equipos.js           ← Módulo de inventario
│   ├── tareas.js            ← Módulo de tareas + catálogo
│   ├── admin.js             ← Atender tickets (tomar/asignar/resolver)
│   ├── registrar.js · mis-tickets.js · ticket.js · dashboard.js
└── backend-apps-script.gs   ← Backend completo (Apps Script v5.0)
```

---

*Sistema de Tickets · Tareas · Equipos — CE · 2025-2026*
