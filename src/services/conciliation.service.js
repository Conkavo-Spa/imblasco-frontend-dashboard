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
        return instance.get('/conciliations/movements-from-json', {
            params: { since, until },
        });
    }

    /**
     * @param {{ since?: string, until?: string, page?: number, limit?: number }} params
     */
    listCotizaciones(params = {}) {
        return instance.get('/conciliations/cotizaciones', { params });
    }

    /**
     * @param {{ movement: object, cotizacion: object }} payload
     */
    saveConciliacion(payload) {
        return instance.post('/conciliations/conciliar', payload);
    }

    listConciliadas(params = {}) {
        return instance.get('/conciliations/historial', { params });
    }

    /**
     * @param {string} cotizacionId
     * @param {{ fecha: string, monto: number, hora?: string }} payload
     */
    getQuotePaymentStatus(cotizacionId, payload) {
        const { fecha, monto, hora } = payload;
        return instance.get(
            `/conciliations/cotizaciones/${encodeURIComponent(cotizacionId)}/payment-status`,
            { params: { fecha, monto, hora: hora ?? '' } }
        );
    }

    /**
     * @param {string | number} cotizacionId
     * @returns Cotización completa con array detalle (productos)
     */
    getCotizacionDetalle(cotizacionId) {
        return instance.get(
            `/conciliations/cotizaciones/${encodeURIComponent(cotizacionId)}/detalle`
        );
    }
}

const conciliationApi = new ConciliationService();
export default conciliationApi;
