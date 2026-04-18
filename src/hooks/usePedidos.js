import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import pedidosApi from '../services/pedidos.service';

export function usePedidos() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchPedidos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await pedidosApi.getAll();
            setPedidos(res?.data ?? []);
        } catch (err) {
            message.error(err.response?.data?.message || 'Error al cargar historial.');
            setPedidos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPedidos();
    }, [fetchPedidos]);

    return { pedidos, loading, refetch: fetchPedidos };
}

export function useConfirmados() {
    const [confirmados, setConfirmados] = useState({});
    const [loading, setLoading] = useState(false);

    const fetchConfirmados = useCallback(async () => {
        setLoading(true);
        try {
            const res = await pedidosApi.getConfirmados();
            setConfirmados(res?.data ?? {});
        } catch {
            setConfirmados({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfirmados();
    }, [fetchConfirmados]);

    return { confirmados, refetchConfirmados: fetchConfirmados };
}

export function useEmbarcados() {
    const [embarcados, setEmbarcados] = useState({});
    const [loading, setLoading] = useState(false);

    const fetchEmbarcados = useCallback(async () => {
        setLoading(true);
        try {
            const res = await pedidosApi.getEmbarcados();
            setEmbarcados(res?.data ?? {});
        } catch {
            setEmbarcados({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmbarcados();
    }, [fetchEmbarcados]);

    return { embarcados, loadingEmbarcados: loading, refetchEmbarcados: fetchEmbarcados };
}
