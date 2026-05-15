import { useState, useEffect, useCallback } from 'react';
import conciliationApi from '../services/conciliation.service';

const PAGE_SIZE = 50;

export function useConciliaciones() {
    const [allConciliaciones, setAllConciliaciones] = useState([]);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [loading, setLoading] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            // Carga hasta el límite máximo del servidor (1000) en un solo llamado
            // para que conciliadosIds siempre tenga todos los IDs y la cartola filtre correctamente
            const res = await conciliationApi.listConciliadas({ page: 1, limit: 1000 });
            const docs = res?.data?.conciliaciones ?? [];
            setAllConciliaciones(Array.isArray(docs) ? docs : []);
        } catch (err) {
            console.error('useConciliaciones error:', err);
            setAllConciliaciones([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const refetch = useCallback(() => {
        setVisibleCount(PAGE_SIZE);
        fetchAll();
    }, [fetchAll]);

    const loadMore = useCallback(() => {
        setVisibleCount(prev => prev + PAGE_SIZE);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const total = allConciliaciones.length;
    const conciliaciones = allConciliaciones.slice(0, visibleCount);

    return {
        conciliaciones,         // slice visible (para mostrar en historial)
        allConciliaciones,      // todos (para filtrar la cartola)
        loading,
        loadingMore: false,
        total,
        hasMore: visibleCount < total,
        refetch,
        loadMore,
    };
}
