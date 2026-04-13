import instance from '../apis/app';

/**
 * API de conciliación bancaria: cotizaciones vs movimientos Fintoc (vía backend).
 * @see imblasco-backend-dashboard/routes/admin/adminConciliationRoutes.js
 */
class ConciliationService {
    /**
     * @param {{ since: string, until: string }} range - YYYY-MM-DD inclusive
     */
    listMovements(range) {
        const { since, until } = range;
        return instance.get('/conciliations/movements', {
            params: { since, until },
        });
    }

    /**
     * @param {string} cotizacionId - ej. COT-001
     * @param {{ fecha: string, monto: number, hora?: string }} payload - fecha YYYY-MM-DD
     */
    getQuotePaymentStatus(cotizacionId, payload) {
        const { fecha, monto, hora } = payload;
        return instance.get(
            `/conciliations/cotizaciones/${encodeURIComponent(cotizacionId)}/payment-status`,
            { params: { fecha, monto, hora: hora ?? '' } }
        );
    }
}

const conciliationApi = new ConciliationService();
export default conciliationApi;
