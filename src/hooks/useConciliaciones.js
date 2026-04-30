import { useState, useEffect, useCallback } from 'react';
import conciliationApi from '../services/conciliation.service';

export function useConciliaciones() {
    const [conciliaciones, setConciliaciones] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const res = await conciliationApi.listConciliadas();
            const docs = res?.data?.conciliaciones ?? [];
            setConciliaciones(Array.isArray(docs) ? docs : []);
        } catch (err) {
            console.error('useConciliaciones error:', err);
            setConciliaciones([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    return { conciliaciones, loading, refetch: fetchAll };
}
