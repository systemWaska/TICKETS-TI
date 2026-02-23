/**
 * utils.js v4 - Sistema de Tickets TI
 * Fix definitivo de initLayout: mueve nodos DOM en lugar de reemplazar innerHTML
 * para preservar todos los event listeners ya registrados.
 */

/* ── UTILS OBJECT ─────────────────────────────────────── */
window.Utils = {
  escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  },
  normalizeClass(text) {
    return String(text||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"-").replace(/[^a-z0-9\-]/g,"").trim();
  },
  normalizeTicket(t) {
    const o = (t && typeof t === 'object') ? t : {};
    const pick = (...keys) => { for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && String(v).trim() !== "") return v; } return ""; };
    return {
      codigo:          String(pick("CODIGO","Codigo","codigo","ID")       ||"").trim(),
      nombre:          String(pick("Nombre","nombre","Usuario","usuario")  ||"").trim(),
      area:            String(pick("Area","area","Área")                   ||"").trim(),
      tipo:            String(pick("Tipo","tipo")                          ||"").trim(),
      titulo:          String(pick("Titulo del requerimiento","Título del requerimiento","Titulo","titulo")||"").trim(),
      descripcion:     String(pick("Descripcion","Descripción","descripcion")||"").trim(),
      prioridad:       String(pick("Prioridad","prioridad")                ||"").trim(),
      estado:          String(pick("Estado","estado")                      ||"").trim(),
      evidencia:       String(pick("Evidencia","evidencia")                ||"").trim(),
      solucion:        String(pick("Solucion","Solución","solucion")       ||"").trim(),
      detalleSolucion: String(pick("Detalle de la solucion","Detalle de la solución","detalleSolucion")||"").trim(),
      fechaIngreso:    pick("Fecha de ingreso de ticket","fechaIngreso","Fecha") ||"",
      fechaCierre:     pick("Fecha de cierre","fechaCierre","fecha_cierre")      ||"",
      tecnico:         String(pick("Tecnico asignado","tecnico")           ||"").trim(),
      _raw: o,
    };
  },
  formatDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  },
  formatDateShort(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});
  },
  renderBadges(estado, prioridad, tipo) {
    const U = window.Utils;
    let h = `<span class="badge ${U.normalizeClass(estado||'')}">${U.escapeHtml(estado||'-')}</span>`;
    if (prioridad && prioridad !== "-" && prioridad !== "---")
      h += ` <span class="badge ${U.normalizeClass(prioridad)}">${U.escapeHtml(prioridad)}</span>`;
    if (tipo && tipo !== "-" && tipo !== "---")
      h += ` <span class="badge ${U.normalizeClass(tipo)}">${U.escapeHtml(tipo)}</span>`;
    return h;
  },
  tiempoResolucion(a, b) {
    if (!a || !b) return null;
    const da = new Date(a), db = new Date(b);
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
    const diff = db - da;
    const dias  = Math.floor(diff / (1000*60*60*24));
    const horas = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    return dias > 0 ? `${dias}d ${horas}h` : `${horas}h`;
  },
  exportCSV(tickets, filename = 'tickets.csv') {
    const h = ['Código','Nombre','Área','Tipo','Título','Prioridad','Estado','Fecha Ingreso','Fecha Cierre','Solución','Detalle Solución'];
    const q = v => `"${String(v||'').replace(/"/g,'""')}"`;
    const rows = tickets.map(t => [
      t.codigo, t.nombre, t.area, t.tipo, t.titulo, t.prioridad, t.estado,
      t.fechaIngreso ? new Date(t.fechaIngreso).toLocaleString('es-PE') : '',
      t.fechaCierre  ? new Date(t.fechaCierre).toLocaleString('es-PE')  : '',
      t.solucion, t.detalleSolucion
    ].map(q).join(','));
    const blob = new Blob(['\uFEFF' + [h.join(','), ...rows].join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
  toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${window.Utils.escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4300);
  },
  jsonpRequest(url, params = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const cbName = `cb_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
      const script = document.createElement('script');
      const fullUrl = new URL(url);
      Object.entries(params).forEach(([k,v]) => {
        if (v !== undefined && v !== null && v !== '') fullUrl.searchParams.append(k, String(v));
      });
      fullUrl.searchParams.append('callback', cbName);
      script.src = fullUrl.toString();
      script.async = true;
      let done = false;
      const cleanup = () => {
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[cbName]; } catch(_) { window[cbName] = undefined; }
      };
      const timer = setTimeout(() => {
        if (done) return; done = true; cleanup();
        reject(new Error('Timeout: el servidor no respondió en ' + (timeoutMs/1000) + 's'));
      }, timeoutMs);
      window[cbName] = (data) => {
        if (done) return; done = true; clearTimeout(timer); cleanup(); resolve(data);
      };
      script.onerror = () => {
        if (done) return; done = true; clearTimeout(timer); cleanup();
        reject(new Error('Error de red al conectar con el servidor'));
      };
      document.head.appendChild(script);
    });
  },
};

// Aliases globales de compatibilidad
window.jsonpRequest   = (...a) => window.Utils.jsonpRequest(...a);
window.normalizeTicket = t => window.Utils.normalizeTicket(t);
window.escapeHtml      = s => window.Utils.escapeHtml(s);
window.escapeHtml_     = s => window.Utils.escapeHtml(s);

/* ── SIDEBAR HTML ─────────────────────────────────────── */
function _sidebarHTML(active, isAdmin) {
  const pagesUser = [
    { href:'index.html',             icon:'🏠', label:'Inicio',          id:'index'      },
    { href:'registrar.html',         icon:'➕', label:'Registrar Ticket', id:'registrar'  },
    { href:'mis-tickets.html',       icon:'📋', label:'Mis Tickets',      id:'mis-tickets'},
    { href:'todos-los-tickets.html', icon:'📊', label:'Dashboard',        id:'dashboard'  },
  ];
  const pagesAdmin = [
    { href:'index.html',             icon:'🏠', label:'Inicio',           id:'index'      },
    { href:'todos-los-tickets.html', icon:'📊', label:'Dashboard',        id:'dashboard'  },
    { href:'admin.html',             icon:'🔧', label:'Panel Admin',       id:'admin'      },
    { href:'historial.html',         icon:'📜', label:'Historial',         id:'historial'  },
  ];
  const pages = isAdmin ? pagesAdmin : pagesUser;
  return `
    <div class="sidebar-brand">
      <div class="brand-icon">${isAdmin ? '🔧' : '🎫'}</div>
      <div class="brand-name">${isAdmin ? 'Admin TI' : 'Tickets TI'}</div>
      <div class="brand-sub">${isAdmin ? 'Panel Administrador' : 'Sistema de gestión'}</div>
    </div>
    <nav class="sidebar-nav">
      <span class="nav-label">Menú</span>
      ${pages.map(p=>`<a href="${p.href}" class="nav-item${active===p.id?' active':''}">${p.icon} ${p.label}</a>`).join('')}
    </nav>
    <div class="sidebar-footer"><small>© 2025 Sistema TI</small></div>`;
}

/* ── initLayout (FIX DEFINITIVO) ──────────────────────── */
/**
 * Mueve los nodos existentes del <body> al wrapper de contenido
 * sin destruirlos → los event listeners se preservan intactos.
 */
function initLayout(activeId, title, subtitle, isAdmin = false) {
  // 1. Recolectar nodos actuales
  const existingNodes = [];
  while (document.body.firstChild) {
    existingNodes.push(document.body.removeChild(document.body.firstChild));
  }

  // 2. Construir estructura
  const overlay = Object.assign(document.createElement('div'), { className:'sidebar-overlay', id:'sidebarOverlay' });

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar'; sidebar.id = 'sidebar';
  sidebar.innerHTML = _sidebarHTML(activeId, isAdmin);

  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <div class="topbar-left">
      <button class="sidebar-toggle" id="sidebarToggle" aria-label="Menú">☰</button>
      <div>
        <div class="topbar-title">${window.Utils.escapeHtml(title || 'Tickets TI')}</div>
        ${subtitle ? `<div class="topbar-sub">${window.Utils.escapeHtml(subtitle)}</div>` : ''}
      </div>
    </div>
    <div class="topbar-right">
      ${isAdmin ? `<span class="admin-badge">🔐 Admin</span>` : ''}
      <div class="connection-pill loading" id="connectionPill">
        <span class="connection-dot"></span>
        <span id="connectionText">Conectando...</span>
      </div>
    </div>`;

  // 3. Reubicar nodos originales (event listeners intactos)
  const page = document.createElement('div');
  page.className = 'page'; page.id = 'pageContent';
  existingNodes.forEach(n => page.appendChild(n));

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = '<p>© 2025 Sistema de Tickets TI · Google Sheets Backend</p>';

  const mainContent = document.createElement('div');
  mainContent.className = 'main-content';
  mainContent.appendChild(topbar);
  mainContent.appendChild(page);
  mainContent.appendChild(footer);

  const wrapper = document.createElement('div');
  wrapper.className = 'app-wrapper';
  wrapper.appendChild(sidebar);
  wrapper.appendChild(mainContent);

  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';

  document.body.appendChild(overlay);
  document.body.appendChild(wrapper);
  document.body.appendChild(toastContainer);

  // 4. Sidebar toggle (mobile)
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
}

/* ── CONNECTION PILL ──────────────────────────────────── */
function _setPill(state, text) {
  const pill = document.getElementById('connectionPill');
  const txt  = document.getElementById('connectionText');
  if (!pill || !txt) return;
  pill.classList.remove('loading','ok','error');
  pill.classList.add(state);
  txt.textContent = text;
}

async function checkBackendConnection_() {
  try {
    const cfg = await window.Utils.jsonpRequest(
      window.CONFIG.SCRIPT_URL + '?action=config', {}, 12000
    );
    if (cfg && cfg.status === 'success') {
      _setPill('ok', 'Conectado');
      return cfg;
    }
    _setPill('error', 'Sin conexión');
  } catch {
    _setPill('error', 'Sin conexión');
  }
  return null;
}
