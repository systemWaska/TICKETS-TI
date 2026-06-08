/**
 * celulares.js v1 - Descriptor del Registro de Celulares (líneas/equipos móviles).
 * Reutiliza InventoryModule. Solo describe QUÉ es un celular.
 * Hoja backend: Registro_Celulares.
 */
window.initCelulares_ = function (root) {
  const nc = s => window.Utils.normalizeClass(s);
  window.InventoryModule({
    title: '📱 Registro de celulares',
    listAction: 'celulares', createAction: 'crearCelular', updateAction: 'actualizarCelular',
    idField: 'Codigo',
    newButtonLabel: '➕ Nuevo celular', modalTitleNew: 'Nuevo celular',
    searchPlaceholder: '🔎 Buscar por código, marca, modelo, IMEI, número o responsable...',
    emptyIcon: '📱', emptyText: 'No hay celulares registrados para los filtros aplicados.',
    searchFields: ['Codigo', 'Marca', 'Modelo', 'IMEI', 'Numero de linea', 'Operador', 'Asignado a', 'Area'],
    needsUsuarios: true,
    columns: [
      { header: 'Código', cls: 'code', value: r => r.Codigo },
      { header: 'Marca / Modelo', value: r => [r.Marca, r.Modelo].filter(Boolean).join(' ') },
      { header: 'IMEI', cls: 'code', value: r => r.IMEI },
      { header: 'N° línea', value: r => r['Numero de linea'] },
      { header: 'Operador', value: r => r.Operador },
      { header: 'Asignado a', value: r => r['Asignado a'] },
      { header: 'Estado', badge: r => r.Estado },
    ],
    filters: [
      { col: 'Operador', label: 'Todos los operadores', source: 'config:operadores' },
      { col: 'Estado', label: 'Todos los estados', source: 'config:estadosCelular' },
    ],
    fields: [
      { param: 'marca', col: 'Marca', label: 'Marca', type: 'text' },
      { param: 'modelo', col: 'Modelo', label: 'Modelo', type: 'text' },
      { param: 'imei', col: 'IMEI', label: 'IMEI', type: 'text' },
      { param: 'numero', col: 'Numero de linea', label: 'N° de línea', type: 'text' },
      { param: 'operador', col: 'Operador', label: 'Operador', type: 'select', source: 'config:operadores' },
      { param: 'plan', col: 'Plan', label: 'Plan', type: 'text' },
      { param: 'asignado', col: 'Asignado a', label: 'Asignado a (responsable)', type: 'datalist', source: 'usuarios' },
      { param: 'area', col: 'Area', label: 'Área', type: 'text' },
      { param: 'estado', col: 'Estado', label: 'Estado *', type: 'select', source: 'config:estadosCelular', required: true },
      { param: 'observaciones', col: 'Observaciones', label: 'Observaciones', type: 'textarea' },
    ],
    stats: [
      { label: 'Total', value: rows => rows.length },
      { label: 'Activos', value: rows => rows.filter(r => nc(r.Estado) === 'activo').length },
      { label: 'En stock', value: rows => rows.filter(r => nc(r.Estado) === 'en-stock').length },
      { label: 'En reparación', value: rows => rows.filter(r => nc(r.Estado) === 'en-reparacion').length },
      { label: 'De baja', value: rows => rows.filter(r => nc(r.Estado) === 'de-baja').length },
    ],
  }).mount(root);
};
