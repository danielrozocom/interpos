# Migración a Formato ISO 8601

## Resumen de Cambios

Se ha migrado completamente el sistema para usar el formato ISO 8601 para fechas y horas, eliminando el formato personalizado anterior que causaba problemas de parsing.

## Cambios Implementados

### 1. Archivos de Utilidades Actualizados

#### `src/lib/date-utils.ts`
- Agregada función `getCurrentISODateTime()` para generar timestamps ISO 8601
- Actualizada función `formatDate()` para manejar ISO 8601
- Agregada función `toISOLocal()` para conversión a zona horaria local

#### `src/lib/config.ts`
- Simplificada función `formatDate()` para usar ISO 8601 como entrada
- Agregada función `getCurrentISODate()` que devuelve ISO 8601
- Agregada función `getCurrentISODateOnly()` para solo fecha

### 2. APIs del Backend Actualizados

#### `src/routes/api/sheets/users/update/+server.ts`
- **ANTES**: Dos columnas separadas (dateOnly, timeOnly)
- **AHORA**: Una columna con DateTime en formato ISO 8601
- **Rango**: `A:H` (8 columnas)

#### `src/routes/api/sheets/users/recharge/+server.ts`
- **ANTES**: Dos columnas separadas (dateOnly, timeOnly)
- **AHORA**: Una columna con DateTime en formato ISO 8601
- **Rango**: `A:H` (8 columnas)

#### `src/routes/api/sheets/transactions/+server.ts`
- **ANTES**: Dos columnas separadas (date, time)
- **AHORA**: Una columna con DateTime en formato ISO 8601
- **Rango**: `A:F` (6 columnas)

#### `src/routes/api/sheets/history/+server.ts`
- **ANTES**: Leía columnas separadas (Date, Time)
- **AHORA**: Lee una columna DateTime en ISO 8601
- **Rango**: `A:H` (8 columnas)

### 3. Frontend Actualizado

#### `src/routes/check-balance/+page.svelte`
- Función `parseCustomDate()` reemplazada con `parseISODate()`
- Tabla actualizada para mostrar una sola columna "Fecha y Hora"
- Procesamiento simplificado usando `transaction.DateTime`

#### `src/routes/history/+page.svelte`
- Función `parseCustomDate()` actualizada para manejar ISO 8601
- Tabla actualizada para mostrar una sola columna "Fecha y Hora"
- Ordenamiento simplificado usando parsing nativo de Date()

## Nueva Estructura de Datos

### Hoja "Transactions - Balance" (8 columnas)
```
A: DateTime (ISO 8601)    - "2025-07-16T14:30:45.123Z"
B: UserID                 - "12345"
C: Name                   - "Juan Pérez"
D: Quantity               - "-5000" o "10000"
E: PrevBalance           - "15000"
F: NewBalance            - "10000"
G: Method                - "Efectivo", "Transferencia", etc.
H: Observation(s)        - "Compra #000001"
```

### Hoja "Transactions - Orders" (6 columnas)
```
A: DateTime (ISO 8601)    - "2025-07-16T14:30:45.123Z"
B: OrderID               - "'000001"
C: UserID                - "12345"
D: UserName              - "Juan Pérez"
E: Quantity              - "5000"
F: Products              - "Producto A; Producto B"
```

## Beneficios de ISO 8601

1. **Parsing Confiable**: JavaScript nativamente parsea ISO 8601 sin ambigüedades
2. **Zona Horaria**: Incluye información de zona horaria
3. **Ordenamiento**: Ordenamiento lexicográfico funciona correctamente
4. **Estándar Internacional**: RFC 3339 / ISO 8601 es un estándar mundial
5. **Precisión**: Incluye milisegundos para mayor precisión

## Migración de Datos Existentes

Los datos existentes en formato anterior seguirán funcionando gracias a:
- La función `formatDate()` maneja ambos formatos
- Fallback a fecha actual si el parsing falla
- Logs detallados para debugging

## Formato de Ejemplo

- **ANTES**: `"15/jul/2025"` + `"2:30:45p.m."`
- **AHORA**: `"2025-07-15T14:30:45.123Z"`

## Testing

Para verificar que el sistema funciona correctamente:

1. Crear una nueva transacción (venta o recarga)
2. Verificar que aparece en el historial con fecha correcta
3. Verificar que el ordenamiento funciona (más reciente primero)
4. Verificar que la consulta de saldo muestra fechas formateadas correctamente

## Notas Importantes

- Las fechas se almacenan en UTC (Z al final)
- La función `formatDate()` convierte a tiempo local para mostrar
- Todos los nuevos registros usan ISO 8601 automáticamente
- El sistema es compatible con datos existentes
