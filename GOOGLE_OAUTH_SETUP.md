# Configuración de Google OAuth para InterPOS

## Problema identificado
El botón "Iniciar Sesión" no funciona porque faltan las credenciales de Google OAuth en el archivo `.env`.

## Solución: Configurar Google OAuth

### Paso 1: Crear credenciales de Google
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. En el menú lateral, ve a "APIs y servicios" > "Credenciales"
4. Haz clic en "Crear credenciales" > "ID de cliente de OAuth 2.0"
5. Selecciona "Aplicación web"
6. Configura las URLs de redirección autorizadas:
   - Para desarrollo: `http://localhost:5174/auth/callback`
   - Para desarrollo (puerto alternativo): `http://localhost:5173/auth/callback` 
   - Para producción: `https://tu-dominio.com/auth/callback`

### Paso 2: Configurar Supabase
1. Ve a tu panel de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a "Authentication" > "Providers"
4. Habilita "Google" como proveedor
5. Ingresa el Client ID y Client Secret que obtuviste de Google
6. Configura la URL de redirección: `https://zkgursjiitjqhicyfcym.supabase.co/auth/v1/callback`

### Paso 3: Actualizar variables de entorno
Edita el archivo `.env` y reemplaza:
```bash
GOOGLE_CLIENT_ID=TU_GOOGLE_CLIENT_ID_AQUI
GOOGLE_CLIENT_SECRET=TU_GOOGLE_CLIENT_SECRET_AQUI
```

Con los valores reales que obtuviste de Google Cloud Console.

### Paso 4: Reiniciar el servidor
Después de actualizar el `.env`, reinicia el servidor de desarrollo:
```bash
npm run dev
```

## Verificación
1. Ve a http://localhost:5174/api/_admin/config-check para verificar que las variables están configuradas
2. Haz clic en "Iniciar Sesión" en la aplicación
3. Debería abrirse el modal y al hacer clic en "Continuar con Google" debería redirigir a Google

## Archivos modificados
- `.env` - Agregadas variables de Google OAuth y VITE_* para el cliente
- `src/routes/+layout.svelte` - Mejorado manejo de errores en login
- `src/routes/auth/callback/+server.ts` - Nuevo endpoint para manejar callback de OAuth
- `src/routes/api/_admin/config-check/+server.ts` - Endpoint para verificar configuración

## Próximos pasos después de la configuración
Una vez configurado Google OAuth:
1. Probar el flujo completo de login
2. Verificar que los usuarios se crean correctamente en la tabla `profiles`
3. Probar el acceso a rutas admin con usuarios autorizados