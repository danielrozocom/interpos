InterPOS - Gestión de Tipos de Impuestos

Archivos creados:
- `src/routes/taxes/+page.svelte` : UI para listar/crear/editar/eliminar tipos de impuestos.
- `src/routes/api/sheets/taxes/+server.ts` : endpoint GET para listar tipos.
- `src/routes/api/sheets/taxes/save/+server.ts` : endpoint POST para crear/actualizar.
- `src/routes/api/sheets/taxes/delete/+server.ts` : endpoint POST para eliminar.

SQL para crear la tabla (Postgres / Supabase):

CREATE TABLE public."Taxes" (
  "ID" bigserial PRIMARY KEY,
  "Code" text UNIQUE NOT NULL,
  "Name" text NOT NULL,
  "Mode" text NOT NULL CHECK ("Mode" IN ('PERCENT','AMOUNT')),
  "DefaultValue" numeric NOT NULL,
  "Description" text NULL
);

Cómo probar localmente:
1. Ejecuta el servidor de desarrollo: npm run dev (o el comando que uses en el proyecto).
2. Abre la app y navega a /taxes.
3. Usa el botón "Agregar tipo" para crear un nuevo tipo. Para `PERCENT` el campo acepta formatos flexibles: `19`, `19%` o `0.19` — internamente se guardará como decimal (ej: `0.19`). Para `AMOUNT` ingresa el monto entero (ej: `300`).
4. Edita o elimina tipos desde la tabla.

Notas:
- Los endpoints usan `sbServer` (cliente de Supabase) como en otros endpoints del proyecto. Asegúrate de tener las credenciales/variables de entorno para que funcione.
- Validaciones básicas se aplican en el frontend y en el endpoint (mode y campos obligatorios).
