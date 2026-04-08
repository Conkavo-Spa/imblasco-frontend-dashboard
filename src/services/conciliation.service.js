import instance from '../apis/app';

/**
 * API de conciliación bancaria: cotizaciones vs movimientos Fintoc (vía backend).
 * @see imblasco-backend-dashboard/routes/admin/adminConciliationRoutes.js
 */
class ConciliationService {
    /**
     * @param {string} cotizacionId - ej. COT-001
     * @returns {Promise<{ success: boolean, code: string, message: string, data?: object }>}
     */
    getQuotePaymentStatus(cotizacionId) {
        return instance.get(
            `/conciliations/cotizaciones/${encodeURIComponent(cotizacionId)}/payment-status`
        );
    }
}

const conciliationApi = new ConciliationService();
export default conciliationApi;
