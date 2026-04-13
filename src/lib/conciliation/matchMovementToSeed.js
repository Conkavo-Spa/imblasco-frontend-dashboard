/**
 * Alineado con filterMatchingDeposits (backend): fecha contable + monto entero.
 * @param {object} movement - DTO Fintoc (post_date, amount)
 * @param {Array<{ fecha: string, monto: number }>} seeds
 * @returns {object | null} cotización seed o null
 */
export function postDateYmd(movement) {
    if (!movement?.post_date || typeof movement.post_date !== 'string') return '';
    return movement.post_date.slice(0, 10);
}

export function matchMovementToSeed(movement, seeds) {
    const ymd = postDateYmd(movement);
    const amount = movement.amount;
    if (!ymd || typeof amount !== 'number') return null;
    return seeds.find((s) => s.fecha === ymd && s.monto === amount) ?? null;
}
