import conciliationApi from '../../services/conciliation.service';
import { matchMovementToSeed } from './matchMovementToSeed';

/**
 * Concilia un movimiento: busca la cotización con el mismo monto y guarda
 * el par en MongoDB. Retorna la cotización encontrada o null.
 *
 * @param {object} movement - DTO Fintoc con id y amount
 * @param {Array<object>} seeds - cotizaciones cargadas
 * @returns {Promise<object | null>}
 */
export async function reconcileMovementAgainstSeeds(movement, seeds) {
    if (!movement?.id || typeof movement.amount !== 'number') return null;

    const matched = matchMovementToSeed(movement, seeds);
    if (!matched) return null;

    await conciliationApi.saveConciliacion({ movement, cotizacion: matched });
    return matched;
}
