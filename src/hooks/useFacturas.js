import { useState, useEffect, useCallback } from 'react';
import conciliationApi from '../services/conciliation.service';

/**
 * Convierte una factura de MongoDB al shape que espera matchMovementToSeed
 * y reconcileMovementAgainstSeeds.
 */
function mapFactura(doc) {
    const fecha = doc.fecha ? String(doc.fecha).slice(0, 10) : null;
    return {
        id: String(doc.factura),
        cotizacion_ref: doc.cotizacion_ref ?? null,
        cliente: doc.razon_social ?? null,
        rut: doc.rutcli ? String(doc.rutcli) : null,
        fecha,
        hora: null,
        monto: doc.monto ?? null,
        moneda: 'CLP',
    };
}

/**
 * Trae todas las facturas del rango de fechas desde el backend (MongoDB).
 * Pagina automáticamente hasta agotar los resultados.
 *
 * @param {string} since - YYYY-MM-DD
 * @param {string} until - YYYY-MM-DD
 */
export function useFacturas(since, until) {
    const [facturas, setFacturas] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAll = useCallback(async (s, u) => {
        if (!s || !u) return;
        setLoading(true);
        try {
            const all = [];
            let page = 1;
            const limit = 500;

            for (;;) {
                const res = await conciliationApi.listFacturas({ since: s, until: u, page, limit });
                const docs = res?.data?.facturas ?? [];
                all.push(...docs.map(mapFactura));
                if (docs.length < limit) break;
                page += 1;
            }

            setFacturas(all);
        } catch (err) {
            console.error('useFacturas error:', err);
            setFacturas([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll(since, until);
    }, [since, until, fetchAll]);

    return { facturas, loading };
}
