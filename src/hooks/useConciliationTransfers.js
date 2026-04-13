import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import conciliationApi from '../services/conciliation.service';

/**
 * Abonos Fintoc en un rango [since, until] inclusive (YYYY-MM-DD).
 */
export function useConciliationTransfers(initialSince, initialUntil) {
    const [since, setSince] = useState(initialSince);
    const [until, setUntil] = useState(initialUntil);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchMovements = useCallback(async (s, u) => {
        setLoading(true);
        try {
                       // instance (axios) devuelve ya el JSON del backend, no el wrapper de Axios.
            const res = await conciliationApi.listMovements({ since: s, until: u });
            const list = res?.data?.movements ?? [];
            setMovements(Array.isArray(list) ? list : []);
        } catch (err) {
            const body = err.response?.data;
            message.error(
                body?.message || err.message || 'Error al cargar movimientos bancarios.'
            );
            setMovements([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!since || !until) return;
        fetchMovements(since, until);
    }, [since, until, fetchMovements]);

    const setRange = useCallback((nextSince, nextUntil) => {
        setSince(nextSince);
        setUntil(nextUntil);
    }, []);

    const refetch = useCallback(() => {
        if (since && until) fetchMovements(since, until);
    }, [since, until, fetchMovements]);

    return {
        movements,
        loading,
        since,
        until,
        setRange,
        refetch,
    };
}
