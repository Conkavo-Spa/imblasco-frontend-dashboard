import { matchMovementToSeed } from './matchMovementToSeed';

/**
 * Función pura: busca el documento que coincide con el movimiento (monto + RUT).
 * NO guarda la conciliación — eso lo hace el caller (handleConciliar).
 *
 * @param {object} movement - DTO Fintoc con id y amount
 * @param {Array<object>} seeds - cotizaciones o facturas cargadas
 * @returns {object | null} - el documento coincidente o null
 */
export async function reconcileMovementAgainstSeeds(movement, seeds) {
    if (!movement?.id || typeof movement.amount !== 'number') return null;
    return matchMovementToSeed(movement, seeds);
}
