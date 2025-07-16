# Cambios Necesarios en las Hojas de Google Sheets

Para implementar la nueva columna "Name" después de "UserID", necesitas hacer los siguientes cambios manualmente en tu hoja de Google Sheets:

## 1. Hoja "Transactions - Balance"

### Estructura Actual:
```
A: Date
B: UserID  
C: Quantity
D: PrevBalance
E: NewBalance
F: Method
G: Observation(s)
```

### Nueva Estructura Requerida:
```
A: Date
B: UserID
C: Name          <- NUEVA COLUMNA
D: Quantity
E: PrevBalance
F: NewBalance
G: Method
H: Observation(s)
```

### Pasos para actualizar:
1. Abre tu hoja de Google Sheets
2. Ve a la hoja "Transactions - Balance"
3. Haz clic derecho en la columna C (Quantity)
4. Selecciona "Insertar 1 columna a la izquierda"
5. En la celda C1, escribe "Name"

## 2. Hoja "Transactions - Orders"

### Estructura Actual:
```
A: Date
B: OrderID
C: UserID
D: Quantity
E: Products
```

### Nueva Estructura Requerida:
```
A: Date
B: OrderID
C: UserID
D: Name          <- NUEVA COLUMNA
E: Quantity
F: Products
```

### Pasos para actualizar:
1. Ve a la hoja "Transactions - Orders"
2. Haz clic derecho en la columna D (Quantity)
3. Selecciona "Insertar 1 columna a la izquierda"
4. En la celda D1, escribe "Name"

## 3. Cambios en el Código (Ya Implementados)

✅ **APIs Actualizadas:**
- `/api/sheets/transactions` - Ahora incluye name (userName → name)
- `/api/sheets/recharge` - Ahora incluye userName  
- `/api/sheets/users/recharge` - Ahora incluye userName
- `/api/sheets/history` - Ahora lee la nueva columna Name

✅ **Frontend Actualizado:**
- `sell/+page.svelte` - Ahora envía userName a la API de transacciones

## 4. Notas Importantes

- **Datos Existentes:** Los registros existentes en las hojas tendrán la columna "Name" vacía inicialmente
- **Nuevos Registros:** A partir de ahora, todos los nuevos registros incluirán automáticamente el nombre del usuario
- **Compatibilidad:** El código maneja casos donde el nombre puede estar vacío para mantener compatibilidad con datos existentes

## 5. Verificación

Después de hacer los cambios en las hojas:

### Para Transactions - Balance (Recargas):
1. Ve a tu hoja "Transactions - Balance"
2. Verifica que la columna C tenga el encabezado "Name"
3. Realiza una nueva recarga a un usuario
4. Verifica que aparezca el nombre en la columna C de "Transactions - Balance"

### Para Transactions - Orders (Ventas):
1. Ve a tu hoja "Transactions - Orders" 
2. Verifica que la columna D tenga el encabezado "Name"
3. Realiza una nueva venta
4. Verifica que aparezca el nombre en la columna D de "Transactions - Orders"

### Para Historial:
1. Consulta el historial de un usuario para verificar que se muestre el nombre

### Troubleshooting:
Si el nombre no aparece en "Transactions - Balance":
- Verifica que insertaste la columna "Name" en la posición correcta (columna C)
- Verifica que el encabezado sea exactamente "Name" (case sensitive)
- Verifica que el usuario tenga un nombre en la hoja "Users"

## 6. Rollback (Si es necesario)

Si necesitas revertir los cambios:
1. Elimina las columnas "Name" de ambas hojas
2. Revierte los cambios en el código usando Git
