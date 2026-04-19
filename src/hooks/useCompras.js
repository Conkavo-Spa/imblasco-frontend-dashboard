import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import comprasApi from '../services/compras.service';

export function useCompras() {
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actualizadoEl, setActualizadoEl] = useState(null);

    const fetchProductos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await comprasApi.getProductos();
            const lista = res?.data?.productos ?? [];
            setProductos(Array.isArray(lista) ? lista : []);
            setActualizadoEl(res?.data?.actualizadoEl ?? null);
        } catch (err) {
            const body = err.response?.data;
            message.error(body?.message || err.message || 'Error al cargar productos.');
            setProductos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProductos();
    }, [fetchProductos]);

    return { productos, loading, refetch: fetchProductos, actualizadoEl };
}
