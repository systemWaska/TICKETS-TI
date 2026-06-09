/**
 * demo-backend.js — Backend de DEMOSTRACIÓN (datos locales en el navegador)
 * ════════════════════════════════════════════════════════════════════
 * Permite probar TODO el sistema en local SIN desplegar Google Apps Script.
 * Se activa con CONFIG.DEMO === true. Los datos viven en localStorage, así
 * que persisten en tu navegador (puedes crear usuarios, tickets, etc.).
 *
 * Diseño (SOLID):
 *  - DemoStore   → ÚNICA responsabilidad: persistir/sembrar colecciones.
 *  - DemoBackend → ÚNICA responsabilidad: enrutar acciones (espejo de la API
 *                  real) apoyándose en DemoStore. Abierto a nuevas acciones
 *                  sin tocar el transporte (utils.jsonpRequest delega aquí).
 *
 * No usa hashing ni tokens reales: es solo para ver la app funcionando.
 * ════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  // ── Parámetros (mismos que el backend real) ─────────────────────────
  const ROLES          = ['Administrador', 'Técnico TI', 'Líder de equipo', 'Usuario'];
  const ESTADOS        = ['Pendiente', 'En atención', 'Bloqueado por recursos', 'Pausado', 'Bloqueado', 'Atendido', 'Anulado'];
  const ESTADOS_TAREA  = ['Pendiente', 'En desarrollo', 'Terminado', 'Cancelada'];
  const TIPOS_EQUIPO   = ['PC de escritorio', 'Laptop', 'Monitor', 'Impresora', 'Servidor', 'Teléfono IP', 'Tablet', 'Periférico', 'Red', 'Otro'];
  const ESTADOS_EQUIPO = ['Operativo', 'En stock', 'En reparación', 'Asignado', 'De baja'];
  const OPERADORES     = ['Claro', 'Movistar', 'Entel', 'Bitel', 'Otro'];
  const ESTADOS_CELULAR = ['Activo', 'En stock', 'En reparación', 'Suspendido', 'De baja'];
  const AREAS          = ['TI', 'Contabilidad', 'Ventas', 'Almacén', 'Gerencia'];
  const TIPOS          = ['Requerimiento', 'Incidencia', 'Evento'];
  const PRIORIDADES    = ['Alta', 'Media', 'Baja'];

  // ════════════════════════════════════════════════════════
  // DemoStore — persistencia y siembra de datos
  // ════════════════════════════════════════════════════════
  const DemoStore = {
    KEY: 'demo_db_v1',
    _db: null,

    load() {
      if (this._db) return this._db;
      try { this._db = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (_) { this._db = null; }
      if (!this._db) { this._db = this._seed(); this.save(); }
      return this._db;
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this._db)); } catch (_) {} },
    reset() { try { localStorage.removeItem(this.KEY); } catch (_) {} this._db = null; return this.load(); },

    col(name) { return this.load()[name] || []; },
    setCol(name, rows) { this.load()[name] = rows; this.save(); },

    /** Siguiente ID tipo PREFIX-001 sobre una columna. */
    nextId(rows, campo, prefix) {
      let max = 0;
      rows.forEach(r => { const m = String(r[campo] || '').match(new RegExp(`^${prefix}-(\\d+)$`, 'i')); if (m) max = Math.max(max, +m[1]); });
      return `${prefix}-${String(max + 1).padStart(3, '0')}`;
    },

    _seed() {
      const hoy = new Date();
      const dias = n => new Date(hoy.getTime() - n * 86400000).toISOString();
      return {
        USUARIOS: [
          { ID: 'USR-001', Nombre: 'Administrador',  Email: 'admin',   PIN: '1234', Rol: 'Administrador',   Equipo: 'TI',     Activo: 'Sí', 'Fecha alta': dias(30) },
          { ID: 'USR-002', Nombre: 'Tito Técnico',   Email: 'tecnico', PIN: '1234', Rol: 'Técnico TI',      Equipo: 'TI',     Activo: 'Sí', 'Fecha alta': dias(20) },
          { ID: 'USR-003', Nombre: 'Lía Líder',      Email: 'lider',   PIN: '1234', Rol: 'Líder de equipo', Equipo: 'TI',     Activo: 'Sí', 'Fecha alta': dias(20) },
          { ID: 'USR-004', Nombre: 'Pedro Empleado', Email: 'usuario', PIN: '1234', Rol: 'Usuario',         Equipo: 'Ventas', Activo: 'Sí', 'Fecha alta': dias(10) },
        ],
        TICKETS: [
          { CODIGO: 'INC-001', Nombre: 'Pedro Empleado', Area: 'Ventas', Tipo: 'Incidencia', 'Titulo del requerimiento': 'No imprime la impresora de Ventas', Descripcion: 'La impresora marca error de papel atascado.', Prioridad: 'Alta', Evidencia: '', Estado: 'Pendiente', 'Fecha de ingreso de ticket': dias(2), 'Fecha de cierre': '', Solucion: '', 'Detalle de la solucion': '', 'Tecnico asignado': '', 'Fecha de asignacion': '' },
          { CODIGO: 'REQ-001', Nombre: 'Pedro Empleado', Area: 'Ventas', Tipo: 'Requerimiento', 'Titulo del requerimiento': 'Solicitud de Office en laptop nueva', Descripcion: 'Instalar Office y configurar correo.', Prioridad: 'Media', Evidencia: '', Estado: 'En atención', 'Fecha de ingreso de ticket': dias(1), 'Fecha de cierre': '', Solucion: '', 'Detalle de la solucion': '', 'Tecnico asignado': 'Tito Técnico', 'Fecha de asignacion': dias(1) },
          { CODIGO: 'INC-002', Nombre: 'Lía Líder', Area: 'TI', Tipo: 'Incidencia', 'Titulo del requerimiento': 'Sin acceso al sistema contable', Descripcion: 'Usuario bloqueado tras cambio de contraseña.', Prioridad: 'Alta', Evidencia: '', Estado: 'Atendido', 'Fecha de ingreso de ticket': dias(5), 'Fecha de cierre': dias(4), Solucion: 'Se reseteó la contraseña', 'Detalle de la solucion': 'Se desbloqueó el usuario en el AD.', 'Tecnico asignado': 'Tito Técnico', 'Fecha de asignacion': dias(5) },
        ],
        TAREAS: [
          { ID: 'TAR-001', Categoria: 'Validacion_Equipos_Moviles', Titulo: 'Inventario físico de celulares activos', Descripcion: '', Observaciones: 'Se tiene el inventario en el área de Producción', Tipo: 'Mantenimiento preventivo', 'Asignado a': 'Tito Técnico', 'Asignado por': 'Lía Líder', Estado: 'En desarrollo', Prioridad: 'Media', 'Fecha inicio': dias(1), 'Fecha limite': dias(-2), 'Ticket relacionado': '', 'Fecha completada': '', 'En calendario': 'No', 'Event ID': '' },
          { ID: 'TAR-002', Categoria: 'Validacion_Equipos_Planta', Titulo: 'Levantamiento de laptops en desuso', Descripcion: '', Observaciones: 'Tarea programada para el 08-06', Tipo: '', 'Asignado a': 'Tito Técnico', 'Asignado por': 'Administrador', Estado: 'Pendiente', Prioridad: 'Alta', 'Fecha inicio': dias(0), 'Fecha limite': dias(-3), 'Ticket relacionado': '', 'Fecha completada': '', 'En calendario': 'No', 'Event ID': '' },
        ],
        EQUIPOS: [
          { Codigo: 'EQ-001', Tipo: 'Laptop', Marca: 'Dell', Modelo: 'Latitude 5430', 'N Serie': 'DL5430-001', 'Asignado a': 'Pedro Empleado', Area: 'Ventas', Ubicacion: 'Piso 1', Estado: 'Asignado', 'Fecha asignacion': dias(15), Observaciones: '' },
          { Codigo: 'EQ-002', Tipo: 'Impresora', Marca: 'HP', Modelo: 'LaserJet M404', 'N Serie': 'HP404-007', 'Asignado a': '', Area: 'Ventas', Ubicacion: 'Piso 1', Estado: 'En reparación', 'Fecha asignacion': '', Observaciones: 'Atasco de papel recurrente' },
          { Codigo: 'EQ-003', Tipo: 'PC de escritorio', Marca: 'Lenovo', Modelo: 'ThinkCentre M70', 'N Serie': 'LN-M70-014', 'Asignado a': '', Area: 'TI', Ubicacion: 'Almacén TI', Estado: 'En stock', 'Fecha asignacion': '', Observaciones: '' },
        ],
        Registro_Celulares: [
          { Codigo: 'CEL-001', Marca: 'Samsung', Modelo: 'Galaxy A54', IMEI: '356789104567890', 'Numero de linea': '987654321', Operador: 'Claro', Plan: 'Postpago 39.90', 'Asignado a': 'Tito Técnico', Area: 'TI', Estado: 'Activo', 'Fecha asignacion': dias(40), Observaciones: '' },
          { Codigo: 'CEL-002', Marca: 'Xiaomi', Modelo: 'Redmi Note 12', IMEI: '356789104511122', 'Numero de linea': '912345678', Operador: 'Movistar', Plan: 'Prepago', 'Asignado a': 'Pedro Empleado', Area: 'Ventas', Estado: 'Activo', 'Fecha asignacion': dias(12), Observaciones: '' },
          { Codigo: 'CEL-003', Marca: 'Motorola', Modelo: 'Moto G73', IMEI: '356789104599887', 'Numero de linea': '', Operador: 'Entel', Plan: '', 'Asignado a': '', Area: 'TI', Estado: 'En stock', 'Fecha asignacion': '', Observaciones: 'Disponible para asignar' },
        ],
        CATALOGO_TAREAS: [
          { ID: 'CAT-001', Nombre: 'Mantenimiento preventivo', Descripcion: 'Limpieza física y revisión de hardware.', Categoria: 'Mantenimiento', 'Duracion estimada (h)': '2', 'Rol sugerido': 'Técnico TI', Activo: 'Sí' },
          { ID: 'CAT-002', Nombre: 'Formateo e instalación', Descripcion: 'Formateo de equipo e instalación de software base.', Categoria: 'Soporte', 'Duracion estimada (h)': '3', 'Rol sugerido': 'Técnico TI', Activo: 'Sí' },
        ],
        HISTORIAL: [],
      };
    },
  };

  // ════════════════════════════════════════════════════════
  // DemoBackend — enrutador de acciones (espejo de la API real)
  // ════════════════════════════════════════════════════════
  const ok  = extra => Object.assign({ ok: true }, extra);
  const err = msg => ({ ok: false, error: msg });
  const nowISO = () => new Date().toISOString();

  const handlers = {
    // ── Config / parámetros ──
    config: () => ({
      status: 'success', areas: AREAS, tipos: TIPOS, prioridades: PRIORIDADES,
      estados: ESTADOS, roles: ROLES, estadosTarea: ESTADOS_TAREA,
      tiposEquipo: TIPOS_EQUIPO, estadosEquipo: ESTADOS_EQUIPO,
      operadores: OPERADORES, estadosCelular: ESTADOS_CELULAR, raw: [], demo: true,
    }),

    // ── Login ──
    login: p => {
      const email = String(p.email || p.usuario || '').trim().toLowerCase();
      const pin = String(p.pin || '').trim();
      if (!email || !pin) return err('Ingresa correo/usuario y PIN.');
      const u = DemoStore.col('USUARIOS').find(r =>
        String(r.Email || '').toLowerCase() === email || String(r.Nombre || '').toLowerCase() === email);
      if (!u) return err('Usuario no encontrado. (Demo: prueba admin / 1234)');
      if (String(u.Activo || '').toLowerCase() === 'no') return err('Usuario inactivo.');
      if (String(u.PIN) !== pin) return err('PIN incorrecto. (Demo: el PIN es 1234)');
      return ok({
        usuario: { id: u.ID, nombre: u.Nombre, email: u.Email, rol: u.Rol || 'Usuario', equipo: u.Equipo || '' },
        token: 'demo-' + Math.random().toString(36).slice(2), ttl: 21600,
      });
    },

    // ── Tickets ──
    tickets: () => DemoStore.col('TICKETS'),
    create: p => {
      const rows = DemoStore.col('TICKETS');
      const pref = { incidencia: 'INC', evento: 'EVE' }[String(p.tipo || '').toLowerCase()] || 'REQ';
      const codigo = DemoStore.nextId(rows, 'CODIGO', pref);
      rows.push({
        CODIGO: codigo, Nombre: p.nombre || '', Area: p.area || '', Tipo: p.tipo || '',
        'Titulo del requerimiento': p.titulo || '', Descripcion: p.descripcion || '',
        Prioridad: p.prioridad || '', Evidencia: '', Estado: 'Pendiente',
        'Fecha de ingreso de ticket': nowISO(), 'Fecha de cierre': '', Solucion: '',
        'Detalle de la solucion': '', 'Tecnico asignado': '', 'Fecha de asignacion': '',
      });
      DemoStore.setCol('TICKETS', rows);
      return { status: 'success', id: codigo, usuario: p.nombre, tipo: p.tipo, titulo: p.titulo };
    },
    update: p => {
      const rows = DemoStore.col('TICKETS');
      const t = rows.find(r => r.CODIGO === p.codigo);
      if (!t) return err(`Ticket "${p.codigo}" no encontrado.`);
      const old = t.Estado;
      t.Estado = p.estado;
      if (p.solucion !== undefined) t.Solucion = p.solucion;
      if (p.detalle !== undefined) t['Detalle de la solucion'] = p.detalle;
      if (p.tecnico) { t['Tecnico asignado'] = p.tecnico; if (!t['Fecha de asignacion']) t['Fecha de asignacion'] = nowISO(); }
      if (['atendido', 'anulado'].includes(String(p.estado).toLowerCase())) t['Fecha de cierre'] = nowISO();
      DemoStore.setCol('TICKETS', rows);
      return ok({ codigo: p.codigo, oldEstado: old, nuevoEstado: p.estado });
    },
    tomarTicket: p => {
      const rows = DemoStore.col('TICKETS');
      const t = rows.find(r => r.CODIGO === p.codigo);
      if (!t) return err(`Ticket "${p.codigo}" no encontrado.`);
      const yaAsig = String(t['Tecnico asignado'] || '').trim();
      if (yaAsig && yaAsig !== p.tecnico && p.forzar !== 'true')
        return Object.assign(err(`Ya está siendo atendido por ${yaAsig}.`), { asignadoA: yaAsig });
      t['Tecnico asignado'] = p.tecnico;
      t['Fecha de asignacion'] = nowISO();
      if (['pendiente', 'bloqueado', 'bloqueado por recursos', 'pausado', ''].includes(String(t.Estado).toLowerCase()))
        t.Estado = 'En atención';
      DemoStore.setCol('TICKETS', rows);
      return ok({ codigo: p.codigo, asignadoA: p.tecnico, estado: t.Estado });
    },
    uploadEvidencia: () => ok({ viewUrl: '', directUrl: '', fileName: 'demo.jpg', demo: true }),
    historial: () => DemoStore.col('HISTORIAL'),

    // ── Usuarios ──
    usuarios: () => DemoStore.col('USUARIOS').map(u => { const o = Object.assign({}, u); delete o.PIN; return o; }),
    crearUsuario: p => {
      const rows = DemoStore.col('USUARIOS');
      if (!String(p.nombre || '').trim()) return err('El nombre es obligatorio.');
      if (!String(p.pin || '').trim()) return err('El PIN es obligatorio.');
      if (p.email && rows.some(u => String(u.Email || '').toLowerCase() === String(p.email).toLowerCase()))
        return err(`Ya existe un usuario con el correo ${p.email}.`);
      const id = DemoStore.nextId(rows, 'ID', 'USR');
      rows.push({ ID: id, Nombre: p.nombre, Email: p.email || '', PIN: String(p.pin), Rol: p.rol || 'Usuario', Equipo: p.equipo || '', Activo: p.activo || 'Sí', 'Fecha alta': nowISO() });
      DemoStore.setCol('USUARIOS', rows);
      return ok({ id, nombre: p.nombre });
    },
    actualizarUsuario: p => {
      const rows = DemoStore.col('USUARIOS');
      const u = rows.find(r => r.ID === p.id);
      if (!u) return err(`Usuario "${p.id}" no encontrado.`);
      ['nombre:Nombre', 'email:Email', 'rol:Rol', 'equipo:Equipo', 'activo:Activo'].forEach(par => {
        const [k, campo] = par.split(':');
        if (p[k] !== undefined && p[k] !== '') u[campo] = p[k];
      });
      if (p.pin !== undefined && String(p.pin).trim() !== '') u.PIN = String(p.pin).trim();
      DemoStore.setCol('USUARIOS', rows);
      return ok({ id: p.id });
    },

    // ── Equipos ──
    equipos: () => DemoStore.col('EQUIPOS'),
    crearEquipo: p => {
      const rows = DemoStore.col('EQUIPOS');
      if (!String(p.tipo || '').trim()) return err('El tipo de equipo es obligatorio.');
      const id = DemoStore.nextId(rows, 'Codigo', 'EQ');
      const asignado = p.asignado || '';
      rows.push({ Codigo: id, Tipo: p.tipo, Marca: p.marca || '', Modelo: p.modelo || '', 'N Serie': p.serie || '', 'Asignado a': asignado, Area: p.area || '', Ubicacion: p.ubicacion || '', Estado: p.estado || (asignado ? 'Asignado' : 'En stock'), 'Fecha asignacion': asignado ? nowISO() : '', Observaciones: p.observaciones || '' });
      DemoStore.setCol('EQUIPOS', rows);
      return ok({ id });
    },
    actualizarEquipo: p => {
      const rows = DemoStore.col('EQUIPOS');
      const e = rows.find(r => r.Codigo === (p.codigo || p.id));
      if (!e) return err(`Equipo "${p.codigo || p.id}" no encontrado.`);
      ['tipo:Tipo', 'marca:Marca', 'modelo:Modelo', 'serie:N Serie', 'area:Area', 'ubicacion:Ubicacion', 'estado:Estado', 'observaciones:Observaciones'].forEach(par => {
        const [k, campo] = par.split(':'); if (p[k] !== undefined) e[campo] = p[k];
      });
      if (p.asignado !== undefined) {
        const prev = e['Asignado a']; e['Asignado a'] = p.asignado;
        if (p.asignado && p.asignado !== prev) e['Fecha asignacion'] = nowISO();
      }
      DemoStore.setCol('EQUIPOS', rows);
      return ok({ id: e.Codigo });
    },

    // ── Celulares (Registro_Celulares) ──
    celulares: () => DemoStore.col('Registro_Celulares'),
    crearCelular: p => {
      const rows = DemoStore.col('Registro_Celulares');
      const id = DemoStore.nextId(rows, 'Codigo', 'CEL');
      const asignado = p.asignado || '';
      rows.push({ Codigo: id, Marca: p.marca || '', Modelo: p.modelo || '', IMEI: p.imei || '', 'Numero de linea': p.numero || '', Operador: p.operador || '', Plan: p.plan || '', 'Asignado a': asignado, Area: p.area || '', Estado: p.estado || (asignado ? 'Activo' : 'En stock'), 'Fecha asignacion': asignado ? nowISO() : '', Observaciones: p.observaciones || '' });
      DemoStore.setCol('Registro_Celulares', rows);
      return ok({ id });
    },
    actualizarCelular: p => {
      const rows = DemoStore.col('Registro_Celulares');
      const c = rows.find(r => r.Codigo === (p.codigo || p.id));
      if (!c) return err(`Celular "${p.codigo || p.id}" no encontrado.`);
      ['marca:Marca', 'modelo:Modelo', 'imei:IMEI', 'numero:Numero de linea', 'operador:Operador', 'plan:Plan', 'area:Area', 'estado:Estado', 'observaciones:Observaciones'].forEach(par => {
        const i = par.indexOf(':'); const k = par.slice(0, i), campo = par.slice(i + 1);
        if (p[k] !== undefined) c[campo] = p[k];
      });
      if (p.asignado !== undefined) {
        const prev = c['Asignado a']; c['Asignado a'] = p.asignado;
        if (p.asignado && p.asignado !== prev) c['Fecha asignacion'] = nowISO();
      }
      DemoStore.setCol('Registro_Celulares', rows);
      return ok({ id: c.Codigo });
    },

    // ── Tareas + catálogo ──
    tareas: p => {
      let rows = DemoStore.col('TAREAS');
      const asig = String(p.asignado || '').trim().toLowerCase();
      if (asig) rows = rows.filter(t => String(t['Asignado a'] || '').trim().toLowerCase() === asig);
      return rows;
    },
    crearTarea: p => {
      const rows = DemoStore.col('TAREAS');
      if (!String(p.titulo || '').trim()) return err('El título de la tarea es obligatorio.');
      if (!String(p.asignado || '').trim()) return err('Debes asignar la tarea a una persona.');
      const id = DemoStore.nextId(rows, 'ID', 'TAR');
      rows.push({ ID: id, Categoria: p.categoria || '', Titulo: p.titulo, Descripcion: p.descripcion || '', Observaciones: p.observaciones || '', Tipo: p.tipo || '', 'Asignado a': p.asignado, 'Asignado por': p.asignadoPor || '', Estado: p.estado || 'Pendiente', Prioridad: p.prioridad || 'Media', 'Fecha inicio': p.fechaInicio || '', 'Fecha limite': p.fechaLimite || '', 'Ticket relacionado': p.ticket || '', 'Fecha completada': '', 'En calendario': p.agendar === 'true' ? 'Sí (demo)' : 'No', 'Event ID': '' });
      DemoStore.setCol('TAREAS', rows);
      return ok({ id });
    },
    actualizarTarea: p => {
      const rows = DemoStore.col('TAREAS');
      const t = rows.find(r => r.ID === p.id);
      if (!t) return err(`Tarea "${p.id}" no encontrada.`);
      ['categoria:Categoria', 'titulo:Titulo', 'descripcion:Descripcion', 'observaciones:Observaciones', 'tipo:Tipo', 'asignado:Asignado a', 'prioridad:Prioridad', 'fechaInicio:Fecha inicio', 'fechaLimite:Fecha limite', 'ticket:Ticket relacionado'].forEach(par => {
        const i = par.indexOf(':'); const k = par.slice(0, i), campo = par.slice(i + 1); if (p[k] !== undefined) t[campo] = p[k];
      });
      if (p.estado !== undefined) { t.Estado = p.estado; if (['terminado', 'completada'].includes(String(p.estado).toLowerCase())) t['Fecha completada'] = nowISO(); }
      DemoStore.setCol('TAREAS', rows);
      return ok({ id: p.id });
    },
    eliminarTarea: p => {
      let rows = DemoStore.col('TAREAS');
      const exists = rows.some(r => r.ID === p.id);
      if (!exists) return err(`Tarea "${p.id}" no encontrada.`);
      rows = rows.filter(r => r.ID !== p.id);
      DemoStore.setCol('TAREAS', rows);
      return ok({ id: p.id });
    },
    catalogo: () => DemoStore.col('CATALOGO_TAREAS'),
    crearCatalogoTarea: p => {
      const rows = DemoStore.col('CATALOGO_TAREAS');
      if (!String(p.nombre || '').trim()) return err('El nombre de la tarea es obligatorio.');
      const id = DemoStore.nextId(rows, 'ID', 'CAT');
      rows.push({ ID: id, Nombre: p.nombre, Descripcion: p.descripcion || '', Categoria: p.categoria || '', 'Duracion estimada (h)': p.duracion || '', 'Rol sugerido': p.rol || '', Activo: p.activo || 'Sí' });
      DemoStore.setCol('CATALOGO_TAREAS', rows);
      return ok({ id });
    },
  };

  // ── API pública: handle(params) → Promise (mismo contrato que jsonpRequest) ──
  window.DemoBackend = {
    handle(params) {
      const action = String((params && params.action) || 'tickets');
      const fn = handlers[action] || handlers.tickets;
      // Pequeña latencia simulada para que se vean los estados de carga.
      return new Promise(resolve => setTimeout(() => {
        try {
          // Se devuelve una COPIA (snapshot), igual que el JSON que llegaría por red:
          // así el frontend nunca muta el store interno por referencia.
          resolve(JSON.parse(JSON.stringify(fn(params || {}))));
        } catch (e) {
          resolve({ ok: false, status: 'error', error: 'Demo: ' + e.message });
        }
      }, 120));
    },
    reset() { return DemoStore.reset(); },
    isActive() { return !!(window.CONFIG && window.CONFIG.DEMO); },
  };
})();
