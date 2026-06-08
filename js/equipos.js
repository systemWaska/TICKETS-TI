/**
 * equipos.js v6 - Descriptor del inventario de EQUIPOS informáticos.
 * Toda la lógica vive en InventoryModule (reutilizable). Aquí solo se describe
 * QUÉ es un equipo: columnas, filtros, campos del formulario y estadísticas.
 */
window.initEquipos_ = function (root) {
  const nc = s => window.Utils.normalizeClass(s);
  window.InventoryModule({
    title: '💻 Inventario de equipos',
    listAction: 'equipos', createAction: 'crearEquipo', updateAction: 'actualizarEquipo',
    idField: 'Codigo',
    newButtonLabel: '➕ Nuevo equipo', modalTitleNew: 'Nuevo equipo',
    searchPlaceholder: '🔎 Buscar por código, marca, modelo, serie o responsable...',
    emptyIcon: '💻', emptyText: 'No hay equipos para los filtros aplicados.',
    searchFields: ['Codigo', 'Marca', 'Modelo', 'N Serie', 'Asignado a', 'Area'],
    needsUsuarios: true,
    columns: [
      { header: 'Código', cls: 'code', value: r => r.Codigo },
      { header: 'Tipo', value: r => r.Tipo },
      { header: 'Marca / Modelo', value: r => [r.Marca, r.Modelo].filter(Boolean).join(' ') },
      { header: 'N° Serie', cls: 'code', value: r => r['N Serie'] },
      { header: 'Asignado a', value: r => r['Asignado a'] },
      { header: 'Ubicación', value: r => [r.Area, r.Ubicacion].filter(Boolean).join(' · ') },
      { header: 'Estado', badge: r => r.Estado },
    ],
    filters: [
      { col: 'Tipo', label: 'Todos los tipos', source: 'config:tiposEquipo' },
      { col: 'Estado', label: 'Todos los estados', source: 'config:estadosEquipo' },
    ],
    fields: [
      { param: 'tipo', col: 'Tipo', label: 'Tipo de equipo *', type: 'select', source: 'config:tiposEquipo', required: true },
      { param: 'marca', col: 'Marca', label: 'Marca', type: 'text' },
      { param: 'modelo', col: 'Modelo', label: 'Modelo', type: 'text' },
      { param: 'serie', col: 'N Serie', label: 'N° de serie', type: 'text' },
      { param: 'asignado', col: 'Asignado a', label: 'Asignado a (responsable)', type: 'datalist', source: 'usuarios' },
      { param: 'area', col: 'Area', label: 'Área', type: 'text' },
      { param: 'ubicacion', col: 'Ubicacion', label: 'Ubicación', type: 'text' },
      { param: 'estado', col: 'Estado', label: 'Estado *', type: 'select', source: 'config:estadosEquipo', required: true },
      { param: 'observaciones', col: 'Observaciones', label: 'Observaciones', type: 'textarea' },
    ],
    stats: [
      { label: 'Total', value: rows => rows.length },
      { label: 'Operativos', value: rows => rows.filter(r => nc(r.Estado) === 'operativo').length },
      { label: 'Asignados', value: rows => rows.filter(r => nc(r.Estado) === 'asignado').length },
      { label: 'En stock', value: rows => rows.filter(r => nc(r.Estado) === 'en-stock').length },
      { label: 'En reparación', value: rows => rows.filter(r => nc(r.Estado) === 'en-reparacion').length },
    ],
  }).mount(root);
};
