# Configuración del Service Role Key para Eliminación de Usuarios

## ⚠️ IMPORTANTE - LEE ESTO PRIMERO

Para poder eliminar usuarios completamente de la base de datos (incluyendo auth.users), necesitas configurar el **Service Role Key** de Supabase.

## 📋 Pasos para Configurar:

### 1. Obtener tu Service Role Key

1. Ve a tu **Dashboard de Supabase**: https://supabase.com/dashboard
2. Selecciona tu proyecto: **ocrtkgcitqxgbwgtzhwd**
3. En el menú lateral, ve a **Settings** (⚙️)
4. Haz clic en **API**
5. Desplázate hasta la sección **Project API keys**
6. Copia el valor de **`service_role` (secret)**
   - ⚠️ **NUNCA compartas esta clave públicamente**
   - ⚠️ **NO la subas a GitHub**
   - ⚠️ **Solo úsala en el lado del servidor o en admin**

### 2. Configurar la Clave en el Código

1. Abre el archivo: `supabaseAdmin.js`
2. Busca la línea:
   ```javascript
   const supabaseServiceRoleKey = 'YOUR_SERVICE_ROLE_KEY_HERE'
   ```
3. Reemplaza `'YOUR_SERVICE_ROLE_KEY_HERE'` con tu clave real
4. Guarda el archivo

### 3. Verificar que Funciona

1. Recarga la página del admin (F5)
2. Crea algunos usuarios de prueba
3. Intenta eliminarlos con el botón "Eliminar Sujetos de Prueba"
4. Abre la consola (F12) y verifica que NO aparezcan errores de "User not allowed"
5. Los usuarios deberían eliminarse completamente

## ✅ Resultado Esperado

Después de configurar correctamente, cuando elimines usuarios de prueba verás en la consola:

```
[DELETE TEST USERS] Starting deletion process...
[DELETE TEST USERS] Found 5 test users to delete
[DELETE TEST USERS] Deleting user: TestUser_Alpha_1234 (xxx-xxx-xxx)
[DELETE TEST USERS] ✅ Deleted TestUser_Alpha_1234
...
[DELETE TEST USERS] Deletion complete: 5 deleted, 0 errors
```

Y los usuarios se eliminarán completamente de:
- ✅ Tabla `predictions`
- ✅ Tabla `profiles`
- ✅ Tabla `auth.users`

## 🔒 Seguridad

**IMPORTANTE**: El Service Role Key tiene permisos completos sobre tu base de datos. Por eso:

1. **NUNCA** la compartas con nadie
2. **NUNCA** la subas a repositorios públicos de GitHub
3. Solo úsala en código de administrador
4. Si la expones accidentalmente, **revócala inmediatamente** desde el dashboard de Supabase

## 🆘 Solución de Problemas

### Error: "Invalid API key"
- Verifica que copiaste la clave completa
- Asegúrate de que no haya espacios al inicio o final
- Confirma que estás usando el `service_role` key, NO el `anon` key

### Error: "User not allowed"
- Significa que aún estás usando el cliente normal en lugar del admin
- Verifica que importaste `supabaseAdmin` en `admin.js`
- Asegúrate de haber guardado los cambios en `supabaseAdmin.js`

### Los usuarios aún aparecen después de eliminar
- Recarga la página con Ctrl + Shift + R (limpia caché)
- Verifica en Supabase Dashboard → Authentication → Users si realmente se eliminaron
- Revisa la consola para ver si hubo errores durante la eliminación
