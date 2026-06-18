# Auditoría y consolidación del backend — v5.2 (2026-06-18)

Resultado de una auditoría profunda (multi-agente, con verificación adversarial) del backend
`backend-avanzado.gs` y su integración con el frontend. **26 hallazgos confirmados**, 2 falsos
positivos descartados. Este documento responde: qué hay, qué se agregó, qué funciona de verdad,
qué se corrigió y cómo desplegarlo.

---

## 1. ¿Qué pego en el backend?

**Pega el archivo `backend-avanzado.gs` completo** (v5.2) en el proyecto Apps Script **vinculado**
al Sheet *“Copia de Copia de IT: Control Tasks Flow”* (Extensiones → Apps Script). Es UN solo
archivo que ya incluye **todo**: el sistema base + Celulares + el acceso admin/1234 + las correcciones.

Pasos:
1. En el Sheet → **Extensiones → Apps Script**.
2. Reemplaza el contenido del archivo principal por el de `backend-avanzado.gs` (o pégalo como
   archivo nuevo y borra el viejo). Ya no necesitas pegar `celulares-backend.gs` ni `seed-admin.gs`
   por separado: están integrados.
3. Ejecuta **`setup`** una vez (crea todas las hojas, incluida `Registro_Celulares`).
4. Ejecuta **`configurarAccesoAdmin`** una vez (fija la sal y deja admin/1234 listo).
5. **Implementar → Administrar implementaciones → editar → Nueva versión** (“Ejecutar como: yo”,
   “Acceso: Cualquiera”). La URL `/exec` no cambia.

> El backend es un script **vinculado** (`getActiveSpreadsheet()`, sin ID hardcodeado): escribe en
> el Sheet contenedor. No saques “Copia de” para producción (perderías la sal `PIN_SALT`).

---

## 2. Módulos y funciones — qué funciona realmente

Estado: **✅ funciona** · **🟡 parcial / depende de config** · **⚪ implementado pero sin UI que lo use**

| Módulo | Funciones (acción router) | Estado |
|---|---|---|
| **Setup** | `setup` | ✅ |
| **Helpers** | `ensureSheet_`, `sheetToObjects_`, `rowFromMap_`, `findRowByKey_`, `nextSeqId_`, `colIndexMap_`, `jsonOutput_`, `uniqSorted_` | ✅ |
| **Seguridad** | `hashPin_`, `pinMatches_`, `isHash_`, `pinSalt_`, `makeToken_`, `saveSession_`, `validateToken_`, `requireAuth_`, `sanitizeCell_`, `logout_` (`logout`) | ✅ |
| **Tickets** | `createTicket_` (`create`), `updateTicket_` (`update`), `tomarTicket_` (`tomarTicket`), `uploadEvidencia_` (`uploadEvidencia` 🟡 requiere `DRIVE_FOLDER_ID`) | ✅ |
| **Usuarios/Login** | `login_` (`login`), `listUsuarios_` (`usuarios`), `crearUsuario_` (`crearUsuario`), `actualizarUsuario_` (`actualizarUsuario`) | ✅ |
| **Equipos** | `listEquipos_` (`equipos`), `crearEquipo_` (`crearEquipo`), `actualizarEquipo_` (`actualizarEquipo`) | ✅ |
| **Celulares** *(integrado v5.2)* | `listCelulares_` (`celulares`), `crearCelular_` (`crearCelular`), `actualizarCelular_` (`actualizarCelular`), `setupCelulares` | ✅ |
| **Sub-tareas** *(modelo real de Tareas)* | `listSubTareas_` (`listSubTareas`), `guardarSubTarea_` (`guardarSubTarea`), `adjuntarEvidenciaTarea_` (`adjuntarEvidenciaTarea` ⚪) | ✅ |
| **Catálogo de tareas** | `listCatalogoTareas_` (`catalogo`), `crearCatalogoTarea_` (`crearCatalogoTarea`) | ✅ |
| **Hoja TAREAS** | `listTareas_` (`tareas`), `crearTarea_` (`crearTarea`), `actualizarTarea_` (`actualizarTarea`) | ⚪ existe, pero la UI usa Sub-tareas, no esta hoja |
| **Panel de Control** | `listTareasPanel_` (`listTareasPanel`), `crearTareaPanel_` (`crearTareaPanel`), `actualizarTareaPanel_` (`actualizarTareaPanel`) | ⚪ respeta ARRAYFORMULA; aún sin pantalla |
| **Asignación inteligente / Slots** | `asignarTicketAuto_` (`asignarAuto`), `getSlotsDisponibles_` (`slotsDisponibles`), `estimarHorarioAtencion_`, `generarSlotsDia_` | 🟡 usado al crear ticket con autoasignación; sin pantalla propia |
| **Urgentes** | `registrarUrgente_` | 🟡 se dispara al crear ticket urgente; emails dependen de cuota Gmail |
| **Colaboración tickets** | `confirmarApoyo_`, `colaborarTicket_`, `transferirTicket_`, `revisarCoordinador_` | ⚪ implementado, sin pantalla |
| **Stats admin** | `getStatsAdmin_` (`statsAdmin`) | ⚪ el dashboard calcula KPIs en cliente |
| **Comentarios internos** | `comentarTicket_` (`comentarTicket`) | ⚪ implementado, sin pantalla |
| **Historial equipos** | `logHistorialEquipo_`, `listHistorialEquipo_` (`historialEquipo`) | ✅ se escribe; lectura sin pantalla |
| **Bitácora de accesos** | `logAcceso_`, `listAccesos_` (`accesos`) | ✅ registra logins (lo que viste en `ACCESOS`) |
| **Calendar** | `agendarTarea_` | 🟡 solo si `CALENDAR_ENABLED=true` |
| **Router** | `doGet`, `doPost` | ✅ JSONP + gate AUTHZ |
| **Acceso admin** *(integrado v5.2)* | `configurarAccesoAdmin`, `fijarPinSalt`, `seedAdminUsuario`, `cualSheet` | ✅ |

**Lo que funciona end-to-end hoy (con UI):** login con roles, tickets (crear/atender/tomar),
equipos, celulares, usuarios, sub-tareas por persona, calendario, catálogo, bitácora de accesos.
**Lo “⚪ sin-usar”** está listo en el backend pero todavía no tiene pantalla en el frontend
(panel de coordinación, stats server-side, comentarios, transferencias): son la base para próximas
pantallas, no errores.

---

## 3. Qué se estuvo agregando (evolución)

- **Seguridad v5.1**: PIN con hash SHA-256 + sal, tokens de sesión (CacheService 6 h), gate `AUTHZ` por rol.
- **Panel de Control**: lectura/escritura de la hoja respetando columnas ARRAYFORMULA (3, 4, 9).
- **Sub-tareas “Tasks - <persona>”**: el modelo que realmente usan Tareas y Calendario.
- **Sprint 0**: asignación inteligente por carga, slots de 15 min, tickets urgentes con alerta, transferencia/colaboración, stats.
- **Sprint 1**: comentarios internos del ticket.
- **Sprint 3**: historial de equipos.
- **Sprint 4**: bitácora de accesos (`ACCESOS`).
- **v5.2 (esta auditoría)**: Celulares integrado + acceso admin + 26 correcciones (abajo).

---

## 4. Bugs corregidos en v5.2

| ID | Bug | Corrección |
|---|---|---|
| B1 | El contador de cambios de estado subía aunque el estado no cambiara | Se condiciona a que realmente cambie |
| B4 | Actualizaciones y comentarios sin `LockService` (pérdida de datos en concurrencia) | `LockService` en `actualizarUsuario_/Equipo_/Tarea_/TareaPanel_` y `comentarTicket_` |
| B5 | Una acción desconocida devolvía la lista de tickets como “éxito” silencioso | El router responde **error** ante acción no reconocida |
| B7 | 4 funciones de tickets no validaban la columna CODIGO | Guard añadido (error claro en vez de excepción opaca) |
| B8 | Tareas mostraba estados de la hoja TAREAS (“Completada/En revisión”) en vez de los de sub-tareas | Catálogo `estadosSubTarea` propio en backend + frontend alineado |
| B9 | No detectaba duplicados si la fecha quedaba como texto | Respaldo de parseo de fecha |
| B10 | `slotsDisponibles`/`asignarAuto` eran públicas | Movidas a `AUTHZ` (ver seguridad) |

*(Descartados como falsos positivos: supuesto desfase de zona horaria UTC — no aplica en Perú UTC−5; y un off-by-one inexistente en `findRowByKey_`.)*

---

## 5. Seguridad

**Aplicado en v5.2:**
- **A2/S1** — Las **lecturas sensibles ahora exigen token** de sesión (tickets, historial, tareas,
  catálogo, sub-tareas, panel, equipos, celulares, historial de equipos). `slotsDisponibles` y
  `asignarAuto` exigen rol técnico/líder, y este último **ya no devuelve el email** del técnico.
- **S5/S9** — **Anti-inyección de fórmulas** (`sanitizeCell_`) en todas las escrituras y en la
  bitácora de accesos (un atacante ya no puede meter `=IMPORTXML(...)` por un campo de texto).
- **S3** — **Rate-limit de login**: bloqueo tras 8 intentos fallidos en 15 min.
- **S2** — Acción **`logout`** real (invalida el token), y tokens generados sin `Math.random`.
- **S6** — `uploadEvidencia` valida que el archivo sea imagen (lista blanca de tipos).
- **S8** — `doPost` con cuerpo JSON ya se enruta y autoriza correctamente.

**Recomendado a futuro (no aplicado para no romper el flujo actual):**
- **S3/S4** — Migrar de PIN de 4 dígitos a PIN ≥ 6 u obligar cambio en el primer login; dejar de
  aceptar PIN en texto plano en la hoja (hoy se acepta y se migra a hash, como red de seguridad).
- **S2** — Revalidar el rol contra `USUARIOS` en cada acción crítica (hoy el rol vive en el token
  hasta 6 h; si degradas a alguien, su sesión activa conserva permisos hasta expirar).
- **S6** — Servir evidencias por proxy autenticado en lugar de enlace público de Drive.
- **S7** — Rate-limit también en creación de tickets/evidencias (anti-spam).
- **Compartir el Sheet como “Lector”**, no como editor público.

---

## 6. SOLID y documentación

- Reuso de `bloquearRango_` (DRY) en el cálculo de slots.
- **Todas las funciones quedaron documentadas** con bloque `/** ... */` (propósito, parámetros, retorno).
- Refactors mayores propuestos pero **no aplicados** por seguridad (no cambiar lógica que funciona):
  extraer `findSubTareaRow_`, unificar el cierre `setIf_`, y trocear `getStatsAdmin_`/`createTicket_`.

---

## 7. Verificación

- Sintaxis validada con `node --check` (OK) tras cada fase; llaves balanceadas; sin funciones duplicadas.
- Prueba en vivo en modo demo: login admin/1234, estados de Tareas correctos, CRUD de Celulares (3→4),
  sin errores de consola.
- El backend GAS no se puede ejecutar fuera de Google; su verificación es estática + contrato con el frontend.
