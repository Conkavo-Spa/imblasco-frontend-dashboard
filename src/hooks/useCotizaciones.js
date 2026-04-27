import { useState, useEffect, useCallback } from 'react';
import conciliationApi from '../services/conciliation.service';

/**
 * Convierte una cotizacion de MongoDB al shape que espera matchMovementToSeed
 * y reconcileMovementAgainstSeeds.
 */
function mapCotizacion(doc) {
    const fecha = doc.fecha ? String(doc.fecha).slice(0, 10) : null;
    return {
        id: String(doc.cotizacion),
        cliente: doc.razon_social ?? doc.cliente?.razon_social ?? null,
        rut: doc.rutcli ? String(doc.rutcli) : null,
        fecha,
        hora: null,
        monto: doc.monto ?? doc.totales?.totgen ?? null,
        moneda: 'CLP',
        totales: doc.totales ?? null,
    };
}

/**
 * Trae todas las cotizaciones del rango de fechas desde el backend (MongoDB).
 * Pagina automáticamente hasta agotar los resultados.
 *
 * @param {string} since - YYYY-MM-DD
 * @param {string} until - YYYY-MM-DD
 */
export function useCotizaciones(since, until) {
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAll = useCallback(async (s, u) => {
        if (!s || !u) return;
        setLoading(true);
        try {
            const all = [];
            let page = 1;
            const limit = 500;

            for (;;) {
                const res = await conciliationApi.listCotizaciones({ since: s, until: u, page, limit });
                const docs = res?.data?.cotizaciones ?? [];
                all.push(...docs.map(mapCotizacion));
                if (docs.length < limit) break;
                page += 1;
            }

            setCotizaciones(all);
        } catch (err) {
            console.error('useCotizaciones error:', err);
            setCotizaciones([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll(since, until);
    }, [since, until, fetchAll]);

    return { cotizaciones, loading };
}
