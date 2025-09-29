# InterPOS

Aplicación de punto de venta para colegio, desarrollada con SvelteKit y Supabase como backend.

## Prerrequisitos

* Node.js v16+ y npm
* Cuenta de Supabase con un proyecto y credenciales (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)
* Tablas en Supabase: `Customers`, `Products`, `Transactions_Orders`, `Transactions_Balance` (ver `.env.example`)

## Instalación

1. Clona el repositorio:

   ```bash
   git clone https://github.com/USER/InterPOS.git
   cd InterPOS/interpos
   ```
2. Instala dependencias:

   ```bash
   npm install
   ```
3. Crea un archivo `.env` en la raíz usando `.env.example` y rellena las variables:

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   AUTH_SECRET=some-long-random-string
   ```
5. Asegúrate de que `.gitignore` incluye:

   ```gitignore
   /node_modules
   /service-account.json
   /.svelte-kit
   /build
   .env
   ```

## Estructura básica

* **src/lib/types.ts**: Interfaces `User`, `Product`, `Transaction`.
* **src/lib/sheet.ts**: Funciones para leer/escribir en Supabase (`getUsers`, `getUserBalance`, ...).
* **src/routes/api/**: Endpoints REST:

  * `/api/users`
  * `/api/products`
  * `/api/transactions`
* **src/routes/**: Páginas Svelte para listar y crear registros.
* **svelte.config.js**: Configuración de Vite para exponer en LAN (`server.host: true`).

## Uso

Ejecuta en desarrollo:

```bash
npm run dev
```

* Local: [http://localhost:5173](http://localhost:5173)
* LAN: http\://\<tu\_ip\_local>:5173

Para producción, despliega en Vercel o en tu VPS usando el adapter correspondiente.

## Buenas prácticas

* Nunca subas `service-account.json` ni `.env` al repositorio.
* Valida tipos con TypeScript.
* Controla errores con `try/catch` en tus endpoints.

---

*Tutorial y configuración básica generados por ChatGPT.*|
