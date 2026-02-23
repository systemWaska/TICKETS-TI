# 🎫 Sistema de Tickets TI — v4.0

## 📁 Estructura de interfaces

El sistema tiene **DOS interfaces separadas** según el tipo de usuario:

### 👤 Interfaz de Usuario (empleados)
| Página | URL | Descripción |
|--------|-----|-------------|
| Inicio | `index.html` | Página principal con accesos rápidos |
| Registrar | `registrar.html` | Crear ticket nuevo |
| Mis Tickets | `mis-tickets.html` | Ver tickets propios |
| Dashboard | `todos-los-tickets.html` | Vista general (solo lectura) |
| Detalle | `ticket.html?id=INC-001` | Ver un ticket específico |

### 🔐 Interfaz de Administrador (equipo TI)
| Página | URL | Descripción |
|--------|-----|-------------|
| Admin Home | `admin-index.html` | Dashboard con métricas y últimos tickets |
| Panel Admin | `admin.html` | Gestionar y actualizar tickets (requiere PIN) |
| Historial | `historial.html` | Log de cada cambio de estado |

---

## 🔐 Cómo cambiar el PIN del Panel Admin

El PIN se configura en **`js/config.js`**:

```javascript
window.CONFIG = {
  SCRIPT_URL: "https://script.google.com/...",
  ADMIN_PIN:  "1234",   // ← Cambia esto al PIN que quieras
};
```

**Importante:** El PIN actual es `1234`. Cámbialo antes de poner en producción.

---

## ⚠️ Análisis de Seguridad: ¿Qué tan hackeable es?

### Vulnerabilidades actuales (IMPORTANTES)

1. **🔴 PIN en el cliente (frontend)**
   - El PIN está en `config.js`, que es descargable por cualquier persona que abra las DevTools
   - Un usuario técnico puede abrir la consola y ejecutar:
     ```javascript
     CONFIG.ADMIN_PIN  // Ve el PIN directamente
     ```
   - **Solución real:** Validar el PIN en el backend (Apps Script), no en el browser

2. **🔴 Sin autenticación real en el backend**
   - La URL del Apps Script es pública; cualquiera que la conozca puede llamarla directamente
   - Pueden actualizar cualquier ticket enviando una petición manualmente:
     ```
     https://tu-script.../exec?action=update&codigo=INC-001&estado=Atendido&solucion=xxx
     ```
   - **Solución:** Agregar un token secreto al backend que valide cada petición

3. **🟡 URL del script expuesta**
   - Está en `config.js`, visible para todos. Cualquiera puede hacer llamadas directas

4. **🟡 Sin rate limiting robusto**
   - Aunque Apps Script tiene límites, no hay protección contra spam masivo de tickets

5. **🟢 Lo que SÍ está bien**
   - Los datos están en Google Sheets (no en un servidor propio)
   - No hay SQL Injection posible
   - Se escapa el HTML en todos los outputs (no hay XSS)
   - JSONP con callbacks aleatorios (protección básica)

### Mejoras de seguridad prioritarias

**Corto plazo (sin cambiar arquitectura):**
- Cambia el PIN a algo más largo y menos obvio (ej: "TI2025#Admin")
- Agrega un token secreto en el Apps Script que se verifique en cada request de `update`
- No compartas la URL del script públicamente

**Mediano plazo:**
- Usar Google OAuth para que solo cuentas del dominio @tuempresa.com puedan acceder al admin
- Registrar intentos fallidos de PIN en el Apps Script
- Agregar una capa de Cloudflare o un servidor intermedio como proxy

---

## ✅ Qué más se podría agregar

### Alta prioridad
- [ ] **Autenticación con Google** — Solo usuarios del dominio empresa accedan al admin
- [ ] **Notificaciones por correo** al cambiar a "En atención" o "Bloqueado" (además de "Atendido")
- [ ] **Asignación de técnico** visible desde el panel y en el ticket
- [ ] **Comentarios internos** — El técnico puede agregar notas sin cambiar estado
- [ ] **SLA / alertas de vencimiento** — Ticket pendiente >24h en alta prioridad se marca en rojo

### Funcionalidades útiles
- [ ] **Vista Kanban** — Columnas por estado para ver el flujo de trabajo
- [ ] **Búsqueda global** — Desde el topbar, buscar cualquier ticket en cualquier página
- [ ] **Estadísticas por técnico** — Cuántos tickets resolvió cada persona del equipo TI
- [ ] **Reporte automático** — Correo semanal al admin con resumen de la semana
- [ ] **Duplicar ticket** — Si el mismo problema afecta a varias personas
- [ ] **Tickets relacionados** — Vincular tickets del mismo incidente

### Mejoras de UX
- [ ] **Modo oscuro** — Toggle en el topbar
- [ ] **Filtro por fecha** — Rango de fechas en el dashboard
- [ ] **Notificación de nuevo ticket** — Push notification en el navegador del admin
- [ ] **Auto-completar título** — Sugerencias basadas en tickets anteriores similares

---

## 📦 Archivos incluidos

```
tickets-final/
├── index.html              ← Inicio usuario
├── registrar.html          ← Crear ticket (con alerta SweetAlert2)
├── mis-tickets.html        ← Ver tickets con filtros
├── ticket.html             ← Detalle de un ticket
├── todos-los-tickets.html  ← Dashboard general
├── admin.html              ← Panel admin (requiere PIN)
├── admin-index.html        ← Dashboard admin con métricas
├── historial.html          ← Historial de cambios
├── css/style.css           ← Estilos completos
├── js/
│   ├── config.js           ← URL y PIN (editar aquí)
│   ├── utils.js            ← Utilidades compartidas + initLayout
│   ├── registrar.js        ← Lógica de registro con SweetAlert2
│   ├── mis-tickets.js      ← Lista con filtros y modal
│   ├── admin.js            ← Panel admin con PIN guard
│   ├── ticket.js           ← Vista detalle individual
│   └── dashboard.js        ← Gráficos y métricas
├── backend-apps-script.gs  ← Código del backend (Apps Script)
└── INSTRUCCIONES-EVIDENCIA.md ← Cómo configurar subida de fotos
```
