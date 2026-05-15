/**
 * Normaliza un RUT para comparación: elimina puntos, guiones y espacios.
 * "76.223.983-3" → "762239833"
 */
function normalizeRut(rut) {
    if (!rut) return null;
    return String(rut).replace(/[\.\-\s]/g, '').toLowerCase();
}

/**
 * Extrae el RUT del emisor de un movimiento Fintoc.
 * Busca en sender_account primero, luego recipient_account.
 */
function movementRut(movement) {
    return normalizeRut(
        movement?.sender_account?.holder_id ??
        movement?.recipient_account?.holder_id ??
        null
    );
}

/**
 * Busca el documento (cotización o factura) cuyo monto Y rut coincidan con el movimiento.
 * Si el movimiento no tiene RUT (ej: cheques), cae a coincidencia solo por monto.
 * Si hay múltiples coincidencias, retorna el más reciente.
 *
 * @param {object} movement - DTO Fintoc (amount, sender_account, recipient_account)
 * @param {Array<{ monto: number, rut: string, fecha: string }>} seeds
 * @returns {object | null}
 */
export function matchMovementToSeed(movement, seeds) {
    const amount = movement?.amount;
    if (typeof amount !== 'number') return null;

    const movRut = movementRut(movement);

    const matches = seeds.filter((s) => {
        if (s.monto !== amount) return false;
        const seedRut = normalizeRut(s.rut);
        // Si ambos tienen RUT, deben coincidir
        if (movRut && seedRut) return movRut === seedRut;
        // Si alguno no tiene RUT (cheques sin sender_account), acepta por monto
        return true;
    });

    if (matches.length === 0) return null;
    return matches.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))[0];
}

export function postDateYmd(movement) {
    if (!movement?.post_date || typeof movement.post_date !== 'string') return '';
    return movement.post_date.slice(0, 10);
}
