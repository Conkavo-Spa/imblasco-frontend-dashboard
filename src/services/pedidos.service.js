import instance from '../apis/app';

class PedidosService {
    guardar(payload) {
        return instance.post('/pedidos', payload);
    }
    getAll() {
        return instance.get('/pedidos');
    }
    getById(id) {
        return instance.get(`/pedidos/${id}`);
    }
    actualizarProductos(id, productos) {
        return instance.patch(`/pedidos/${id}/productos`, { productos });
    }
    getConfirmados() {
        return instance.get('/pedidos/confirmados');
    }
    getEmbarcados() {
        return instance.get('/pedidos/embarcados');
    }
    eliminar(id) {
        return instance.delete(`/pedidos/${id}`);
    }
}

const pedidosApi = new PedidosService();
export default pedidosApi;
