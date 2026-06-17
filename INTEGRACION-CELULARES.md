# Integrar Celulares en el backend AVANZADO

Tu backend avanzado (Panel de Control, asignación inteligente, SLA, etc.) **no tenía**
el módulo de Celulares. Para agregarlo:

## 1) Agrega el archivo `celulares-backend.gs`
En el proyecto Apps Script → **+** → **Secuencia de comandos** → nómbralo `celulares` →
pega el contenido de [`celulares-backend.gs`](celulares-backend.gs).

## 2) Parche en `backend-apps-script.gs` (4 puntos)

**a) Config** — dentro de `buildConfigPayload_`, en el `return {...}`, después de
`estadosEquipo: ESTADOS_EQUIPO_DEFAULT,` agrega:
```js
    operadores: OPERADORES_DEFAULT,
    estadosCelular: ESTADOS_CELULAR_DEFAULT,
```

**b) AUTHZ** — en el objeto `const AUTHZ = {...}`, junto a las de equipos, agrega:
```js
  crearCelular:       ["Técnico TI", "Líder de equipo"],
  actualizarCelular:  ["Técnico TI", "Líder de equipo"],
```
*(La lista `celulares` queda pública, igual que `equipos`.)*

**c) Router** — en el `switch (action)` de `doGet`, junto a los `case` de equipos:
```js
      case "celulares":         return jsonOutput_(listCelulares_(), callback);
      case "crearCelular":      return jsonOutput_(crearCelular_(p), callback);
      case "actualizarCelular": return jsonOutput_(actualizarCelular_(p), callback);
```

**d) setup()** — dentro de `function setup()`, antes del `const msg`, agrega:
```js
  ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
```

## 3) Re-despliega y corre setup
- **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva → Implementar.**
- Ejecuta **`setup`** (o `setupCelulares`) una vez → crea la hoja `Registro_Celulares`.

## 4) Frontend
Ya está en el repo (rama `angel`): `celulares.html`, `js/celulares.js`,
`js/inventory-module.js` (con **carga masiva**) y `calendario.html`/`js/calendario.js`.
El menú ya incluye **Celulares** y **Calendario**. Solo asegúrate de desplegar el
frontend actualizado (github.io) y que `js/config.js` apunte a tu `/exec`.

> ⚠️ Recuerda: el despliegue debe tener acceso **"Cualquier persona"** o el
> frontend público no podrá llamarlo (rebota al login del dominio).
