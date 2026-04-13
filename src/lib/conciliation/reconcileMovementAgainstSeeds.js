import conciliationApi from '../../services/conciliation.service';

/**
 * Reconcilia un movimiento contra el catálogo de cotizaciones consultando el backend
 * (Fintoc) por cada cotización candidata hasta encontrar la que cierra con este id.
 *
 * @param {object} movement - fila enriquecida o DTO con id y amount
 * @param {Array<object>} seeds - ej. COTIZACIONES_SEED
 * @returns {Promise<object | null>} cotización encontrada o null
 */
export async function reconcileMovementAgainstSeeds(movement, seeds) {
    const movId = movement?.id;
    if (!movId || typeof movement.amount !== 'number') return null;

    const sameAmount = seeds.filter((s) => s.monto === movement.amount);
    const order = sameAmount.length ? sameAmount : [...seeds];

    for (const seed of order) {
        try {
            const res = await conciliationApi.getQuotePaymentStatus(seed.id, {
                fecha: seed.fecha,
                monto: seed.monto,
                hora: seed.hora,
            });
            if (!res?.success) continue;
            const d = res.data;
            if (d?.pagada && d.movimiento?.id === movId) return seed;
        } catch {
            /* siguiente cotización */
        }
    }
    return null;
}
