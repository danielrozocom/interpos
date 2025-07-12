/** Recarga el saldo de un usuario llamando al endpoint API */
export async function rechargeBalance({
  userId,
  quantity,
  newBalance,
  method,
  observations
}: {
  userId: string;
  quantity: number;
  newBalance: number;
  method: string;
  observations?: string;
}) {
  const res = await fetch('/api/sheets/recharge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, quantity, newBalance, method, observations })
  });
  if (!res.ok) throw new Error('Error al registrar la recarga');
  return await res.json();
}
