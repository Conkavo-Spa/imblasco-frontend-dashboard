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
    /** @type {[Record<string, object>, function]} */
    const [movimientoPorCotizacion, setMovimientoPorCotizacion] = useState({});

    /**
     * @param {{ id: string, fecha: string, monto: number, hora?: string }} record
     */
    const checkQuote = useCallback(async (record) => {
        const cotizacionId = record.id;
        try {
            setCheckingId(cotizacionId);
            const res = await conciliationApi.getQuotePaymentStatus(cotizacionId, {
                fecha: record.fecha,
                monto: record.monto,
                hora: record.hora,
            });
            if (res.data?.pagada) {
                setEstadoPorCotizacion((prev) => ({
                    ...prev,
                    [cotizacionId]: 'conciliada',
                }));
                if (res.data?.movimiento) {
                    setMovimientoPorCotizacion((prev) => ({
                        ...prev,
                        [cotizacionId]: res.data.movimiento,
                    }));
                }
                message.success(
                    res.message || 'Cotización conciliada con un movimiento bancario.'
                );
            } else {
                setEstadoPorCotizacion((prev) => ({
                    ...prev,
                    [cotizacionId]: 'sin_match',
                }));
                setMovimientoPorCotizacion((prev) => {
                    const next = { ...prev };
                    delete next[cotizacionId];
                    return next;
                });
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
        movimientoPorCotizacion,
        checkQuote,
    };
}
