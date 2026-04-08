import { useState, useCallback } from 'react';
import { message } from 'antd';
import conciliationApi from '../services/conciliation.service';

/** @typedef {'pendiente' | 'conciliada' | 'sin_match'} EstadoRevisionCotizacion */

/**
 * Estado UI para revisar cotizaciones contra el banco (Fintoc vía backend).
 */
export function useConciliationQuoteCheck() {
    const [checkingId, setCheckingId] = useState(null);
    /** @type {[Record<string, EstadoRevisionCotizacion>, function]} */
    const [estadoPorCotizacion, setEstadoPorCotizacion] = useState({});

    const checkQuote = useCallback(async (cotizacionId) => {
        try {
            setCheckingId(cotizacionId);
            const res = await conciliationApi.getQuotePaymentStatus(cotizacionId);
            if (res.data?.pagada) {
                setEstadoPorCotizacion((prev) => ({
                    ...prev,
                    [cotizacionId]: 'conciliada',
                }));
                message.success(
                    res.message || 'Cotización conciliada con un movimiento bancario.'
                );
            } else {
                setEstadoPorCotizacion((prev) => ({
                    ...prev,
                    [cotizacionId]: 'sin_match',
                }));
                message.warning(res.message || 'No se encontró pago coincidente.');
            }
        } catch (err) {
            const body = err.response?.data;
            message.error(
                body?.message ||
                    err.message ||
                    'Error al consultar el estado de pago.'
            );
        } finally {
            setCheckingId(null);
        }
    }, []);

    return {
        checkingId,
        estadoPorCotizacion,
        checkQuote,
    };
}
