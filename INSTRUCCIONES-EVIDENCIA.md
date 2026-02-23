# 📸 Cómo habilitar la subida de fotos/evidencia

## ¿Dónde se guardan las imágenes?

Las imágenes se guardan en **Google Drive**, en una carpeta que tú creas.
El Apps Script sube la imagen y guarda el link automáticamente en la columna "Evidencia" del ticket.

---

## Pasos para configurarlo

### 1. Crear la carpeta en Drive
1. Abre [drive.google.com](https://drive.google.com)
2. Crea una carpeta nueva, por ejemplo: **"Evidencias Tickets TI"**
3. Haz clic derecho en la carpeta → **Compartir**
4. Cambia a: *"Cualquier persona con el enlace"* → **Viewer**
5. Copia el **ID de la carpeta** desde la URL:
   ```
   https://drive.google.com/drive/folders/ESTE_ES_EL_ID
   ```

### 2. Configurar Apps Script
1. Abre tu Google Sheet → **Extensiones → Apps Script**
2. Clic en el engranaje ⚙️ → **Propiedades del proyecto (Script Properties)**
3. Agregar propiedad:
   - Nombre: `DRIVE_FOLDER_ID`
   - Valor: el ID que copiaste en el paso anterior
4. Guardar y **redesplegar** el WebApp (nueva versión)

### 3. Probar desde el frontend
El formulario de registro ya tiene el campo de evidencia listo.
Al seleccionar una imagen, el frontend la convierte a Base64 y la envía al Apps Script.
El Apps Script la sube a Drive y guarda el link en el ticket.

---

## Restricciones
- Máximo **5MB** por imagen
- Formatos soportados: JPG, PNG, GIF, WEBP
- Las imágenes son accesibles para **cualquier persona con el link**
  (apropiado para uso interno en empresa)

## ¿Qué pasa si no se configura DRIVE_FOLDER_ID?
El campo de evidencia simplemente no enviará la imagen.
El ticket se registra normalmente sin evidencia.

---

## Sobre el PIN del Admin

El PIN por defecto es **1234**.
Para cambiarlo, edita `js/config.js`:
```javascript
const CONFIG = {
  SCRIPT_URL: "tu_url_aqui",
  ADMIN_PIN: "tu_nuevo_pin",  // ← Cambia esto
};
```

**Nota de seguridad:** Este PIN es del lado del cliente (frontend).
Para mayor seguridad, el PIN también se puede validar en el servidor
activando `ADMIN_PIN` en las Script Properties del Apps Script.

