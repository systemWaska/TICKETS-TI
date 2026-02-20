# Sistema de Tickets TI - v2.0

## Mejoras en esta versión

### 🎨 Diseño
- Sidebar de navegación lateral fija (reemplaza la barra de navegación horizontal)
- Paleta de colores profesional con tokens CSS
- Tipografía DM Sans + DM Mono para códigos
- Badges de color para estados y prioridades
- Layout responsive con sidebar colapsable en móvil

### 📊 Dashboard (todos-los-tickets.html)
- **4 KPIs nuevos**: tiempo promedio de resolución, tasa de resolución, tickets del mes, incidencias críticas
- Gráfico de barras por área + gráfico donut por tipo
- Filtros avanzados (área, tipo, estado, prioridad, búsqueda libre)
- **Exportación CSV** de tickets filtrados

### 🔧 Panel Admin (admin.html)
- Layout de doble panel: lista de tickets + formulario
- **Búsqueda en tiempo real** con filtro instantáneo
- Tickets ordenados por prioridad/urgencia
- Log de cambios de sesión visible
- Toast notifications al guardar

### 📋 Mis Tickets (mis-tickets.html)
- Indicador de **días abierto** y **tiempo de resolución**
- Exportación CSV
- Filtro de búsqueda por código y título
- Modal con detalle completo mejorado

### ⚙️ Técnico
- `utils.js` incluye sidebar compartido (evita duplicación de HTML)
- Toast system centralizado
- `exportCSV()` helper reutilizable
- Función `tiempoResolucion()` para calcular duración de atención

## Configuración
1. Actualiza `js/config.js` con tu URL de Apps Script
2. Sube los archivos a GitHub Pages
3. El backend (Apps Script) no requiere cambios

