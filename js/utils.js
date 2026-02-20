/**
 * utils.js v2.0 - Sistema de Tickets TI
 */

window.Utils = {
  escapeHtml: (str) => {
    if (!str && str !== 0) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  },
  normalizeClass: (text) => {
    return String(text||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g,"-").replace(/[^a-z0-9\-]/g,"").trim();
  },
  normalizeTicket: (t) => {
    const o = t && typeof t === 'object' ? t : {};
    const pick = (keys) => { for (const k of keys) { if (o[k]!==undefined&&o[k]!==null&&String(o[k]).trim()!=="") return o[k]; } return ""; };
    return {
      codigo:          String(pick(["CODIGO","Codigo","codigo","ID","Id","id"])||"").trim(),
      nombre:          String(pick(["Nombre","nombre","Usuario","usuario"])||"").trim(),
      area:            String(pick(["Area","area"])||"").trim(),
      tipo:            String(pick(["Tipo","tipo"])||"").trim(),
      titulo:          String(pick(["Titulo del requerimiento","Título del requerimiento","Titulo","titulo"])||"").trim(),
      descripcion:     String(pick(["Descripcion","Descripción","descripcion"])||"").trim(),
      prioridad:       String(pick(["Prioridad","prioridad"])||"").trim(),
      estado:          String(pick(["Estado","estado"])||"").trim(),
      evidencia:       String(pick(["Evidencia","evidencia"])||"").trim(),
      solucion:        String(pick(["Solucion","Solución","solucion"])||"").trim(),
      detalleSolucion: String(pick(["Detalle de la solucion","Detalle de la solución","detalle","detalleSolucion"])||"").trim(),
      fechaIngreso:    pick(["Fecha de ingreso de ticket","Fecha ingreso","fechaIngreso","Fecha"])||"",
      fechaCierre:     pick(["Fecha de cierre","fechaCierre","fecha_cierre"])||"",
      _raw: o,
    };
  },
  formatDate: (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  },
  formatDateShort: (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'});
  },
  renderBadges: (estado, prioridad) => {
    const u = window.Utils;
    let html = `<span class="badge ${u.normalizeClass(estado)}">${u.escapeHtml(estado)}</span>`;
    if (prioridad && prioridad!=="-" && prioridad!=="---") html += ` <span class="badge ${u.normalizeClass(prioridad)}">${u.escapeHtml(prioridad)}</span>`;
    return html;
  },
  tiempoResolucion: (a, b) => {
    if (!a || !b) return null;
    const da = new Date(a), db = new Date(b);
    if (isNaN(da.getTime())||isNaN(db.getTime())) return null;
    const diff = db - da, dias = Math.floor(diff/(1000*60*60*24)), horas = Math.floor((diff%(1000*60*60*24))/(1000*60*60));
    if (dias > 0) return `${dias}d ${horas}h`; return `${horas}h`;
  },
  exportCSV: (tickets, filename='tickets.csv') => {
    const h = ['Código','Nombre','Área','Tipo','Título','Prioridad','Estado','Fecha Ingreso','Fecha Cierre','Solución','Detalle Solución'];
    const rows = tickets.map(t=>[
      t.codigo,t.nombre,t.area,t.tipo,t.titulo,t.prioridad,t.estado,
      t.fechaIngreso ? new Date(t.fechaIngreso).toLocaleString('es-PE') : '',
      t.fechaCierre  ? new Date(t.fechaCierre).toLocaleString('es-PE')  : '',
      t.solucion,t.detalleSolucion
    ].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','));
    const csv = '\uFEFF'+[h.join(','),...rows].join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
    URL.revokeObjectURL(url);
  },
  toast: (message, type='info') => {
    let container = document.querySelector('.toast-container');
    if (!container) { container=document.createElement('div'); container.className='toast-container'; document.body.appendChild(container); }
    const icons = {success:'✅',error:'❌',info:'ℹ️'};
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]||'ℹ️'}</span> <span>${window.Utils.escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(()=>el.remove(), 4300);
  },
  jsonpRequest: function(url, params={}, timeoutMs=15000) {
    return new Promise((resolve, reject) => {
      const cbName = `cb_${Date.now()}_${Math.floor(Math.random()*100000)}`;
      const script = document.createElement("script");
      const fullUrl = new URL(url);
      Object.keys(params).forEach(k=>{ const v=params[k]; if(v!==undefined&&v!==null&&v!=="") fullUrl.searchParams.append(k,String(v)); });
      fullUrl.searchParams.append('callback',cbName);
      script.src = fullUrl.toString(); script.async = true;
      let done = false;
      const cleanup = () => { if(script.parentNode) script.parentNode.removeChild(script); try{delete window[cbName];}catch(_){window[cbName]=undefined;} };
      const timer = setTimeout(()=>{ if(done)return; done=true; cleanup(); reject(new Error("Timeout JSONP")); }, timeoutMs);
      window[cbName] = (data) => { if(done)return; done=true; clearTimeout(timer); cleanup(); resolve(data); };
      script.onerror = () => { if(done)return; done=true; clearTimeout(timer); cleanup(); reject(new Error("Error JSONP")); };
      document.head.appendChild(script);
    });
  }
};

window.jsonpRequest = (url,params,t)=>window.Utils.jsonpRequest(url,params||{},t);
window.normalizeTicket = window.Utils.normalizeTicket;
window.escapeHtml = window.Utils.escapeHtml;
window.escapeHtml_ = window.Utils.escapeHtml;
window.escapeHtml_1 = window.Utils.escapeHtml;

/* ── SIDEBAR SHARED ──────────────────────────────────── */
function renderSidebar(active) {
  const pages = [
    {href:'index.html',icon:'🏠',label:'Inicio',id:'index'},
    {href:'registrar.html',icon:'➕',label:'Registrar Ticket',id:'registrar'},
    {href:'mis-tickets.html',icon:'📋',label:'Mis Tickets',id:'mis-tickets'},
    {href:'todos-los-tickets.html',icon:'📊',label:'Dashboard',id:'dashboard'},
    {href:'admin.html',icon:'🔧',label:'Panel Admin',id:'admin'},
  ];
  return `
    <div class="sidebar-brand">
      <div class="brand-icon">🎫</div>
      <div class="brand-name">Tickets TI</div>
      <div class="brand-sub">Sistema de gestión</div>
    </div>
    <nav class="sidebar-nav">
      <span class="nav-label">Menú</span>
      ${pages.map(p=>`<a href="${p.href}" class="nav-item${active===p.id?' active':''}">${p.icon} ${p.label}</a>`).join('')}
    </nav>
    <div class="sidebar-footer"><small>© 2025 Sistema TI</small></div>
  `;
}

function initLayout(active, title, subtitle) {
  const body = document.body;
  const orig = body.innerHTML;
  body.innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <div class="app-wrapper">
      <aside class="sidebar" id="sidebar">${renderSidebar(active)}</aside>
      <div class="main-content">
        <header class="topbar">
          <div class="topbar-left">
            <button class="sidebar-toggle" id="sidebarToggle">☰</button>
            <div>
              <div class="topbar-title">${title||'Sistema de Tickets TI'}</div>
              ${subtitle?`<div class="topbar-sub">${subtitle}</div>`:''}
            </div>
          </div>
          <div class="topbar-right">
            <div class="connection-pill loading" id="connectionPill">
              <span class="connection-dot"></span>
              <span id="connectionText">Conectando...</span>
            </div>
          </div>
        </header>
        <div class="page" id="pageContent">${orig}</div>
        <footer class="footer"><p>© 2025 Sistema de Tickets TI · Google Sheets Backend</p></footer>
      </div>
    </div>
    <div class="toast-container"></div>
  `;
  const toggle=document.getElementById('sidebarToggle'), sidebar=document.getElementById('sidebar'), overlay=document.getElementById('sidebarOverlay');
  if(toggle) { toggle.addEventListener('click',()=>{sidebar.classList.toggle('open');overlay.classList.toggle('open');}); overlay.addEventListener('click',()=>{sidebar.classList.remove('open');overlay.classList.remove('open');}); }
}

function setConnectionPill_(state, text) {
  const pill=document.getElementById('connectionPill'), t=document.getElementById('connectionText');
  if(!pill||!t) return;
  pill.classList.remove('loading','ok','error'); pill.classList.add(state); t.textContent=text;
}

async function checkBackendConnection_() {
  try {
    const cfg = await window.Utils.jsonpRequest(`${window.CONFIG.SCRIPT_URL}?action=config`,{},12000);
    if(cfg&&cfg.status==='success'){setConnectionPill_('ok','Conectado');return cfg;}
    setConnectionPill_('error','Sin conexión');
  } catch { setConnectionPill_('error','Sin conexión'); }
  return null;
}
