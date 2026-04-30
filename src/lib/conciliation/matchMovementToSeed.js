/**
 * Busca cotización cuyo monto coincida con el monto de la transferencia.
 * No se filtra por fecha: la cotización se emite antes del pago.
 * Si hay múltiples coincidencias, retorna la más reciente.
 *
 * @param {object} movement - DTO Fintoc (amount)
 * @param {Array<{ fecha: string, monto: number }>} seeds
 * @returns {object | null}
 */
export function postDateYmd(movement) {
    if (!movement?.post_date || typeof movement.post_date !== 'string') return '';
    return movement.post_date.slice(0, 10);
}

export function matchMovementToSeed(movement, seeds) {
    const amount = movement.amount;
    if (typeof amount !== 'number') return null;
    const matches = seeds.filter((s) => s.monto === amount);
    if (matches.length === 0) return null;
    // Si hay varias con el mismo monto, preferir la más reciente
    return matches.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))[0];
}
