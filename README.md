# InterPOS

Aplicación de punto de venta para colegio, desarrollada con SvelteKit y Google Sheets como base de datos.

## Prerrequisitos

* Node.js v16+ y npm
* Cuenta de servicio de Google Cloud con credenciales JSON
* Hoja de cálculo de Google Sheets con pestañas **Users**, **Products** y **Transactions**, compartida con el `client_email` de la cuenta de servicio

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
3. Crea un archivo `.env` en la raíz con:

   ```dotenv
   GOOGLE_SHEETS_ID=<tu_id_de_hoja>
   ```
4. Coloca tu `service-account.json` (credenciales) junto a `package.json`.
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
* **src/lib/sheets.ts**: Funciones para leer/escribir en Google Sheets (`getUsers`, `addUser`, `getProducts`, ...).
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
