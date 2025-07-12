// src/lib/sheets.ts
/** Obtiene los usuarios desde el endpoint API */
export async function getUsers() {
  const res = await fetch('/api/sheets/users');
  if (!res.ok) throw new Error('Error al obtener usuarios');
  return await res.json();
}
