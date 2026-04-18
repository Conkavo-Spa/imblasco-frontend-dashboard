import instance from '../apis/app';

class ComprasService {
    getProductos() {
        return instance.get('/compras/productos');
    }
    buscar(q) {
        return instance.get('/compras/buscar', { params: { q } });
    }
    actualizar() {
        return instance.post('/compras/actualizar');
    }
}

const comprasApi = new ComprasService();
export default comprasApi;
