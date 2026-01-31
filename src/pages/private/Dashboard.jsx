import React from 'react';
import Sidebar from '../../components/Sidebar';

const Dashboard = () => {
    // Obtener información del usuario
    const getUserInfo = () => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user;
        } catch {
            return { name: 'Usuario', email: '' };
        }
    };

    const user = getUserInfo();

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Contenido principal */}
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                {/* Título y bienvenida */}
                <div className="mb-6">
                    <h1 className="text-3xl font-extrabold text-[#370776] mb-2">Imblasco Dashboard</h1>
                    <p className="text-gray-700">Bienvenido, <span className="font-semibold text-[#370776]">{user.name || 'Usuario'}</span></p>
                </div>

                {/* Tarjetas de métricas */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Tarjeta 1: Ventas Totales */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-[#370776]/10">
                        <h2 className="text-xl font-semibold text-[#370776]">Ventas Totales</h2>
                        <p className="text-3xl font-bold text-gray-900 mt-2">$12,345</p>
                        <p className="text-sm text-gray-600 mt-1"><span className="text-[#5DD62C] font-semibold">+5.2%</span> vs último mes</p>
                    </div>

                    {/* Tarjeta 2: Pedidos Completados */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-[#370776]/10">
                        <h2 className="text-xl font-semibold text-[#370776]">Pedidos Completados</h2>
                        <p className="text-3xl font-bold text-gray-900 mt-2">189</p>
                        <p className="text-sm text-gray-600 mt-1"><span className="text-[#5DD62C] font-semibold">+10%</span> vs último mes</p>
                    </div>

                    {/* Tarjeta 3: Tasa de Conversión */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-[#370776]/10">
                        <h2 className="text-xl font-semibold text-[#370776]">Tasa de Conversión</h2>
                        <p className="text-3xl font-bold text-gray-900 mt-2">8.5%</p>
                        <p className="text-sm text-gray-600 mt-1"><span className="text-[#5DD62C] font-semibold">+1.3%</span> vs último mes</p>
                    </div>
                </div>

                {/* Información del usuario */}
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#370776]/10">
                    <h2 className="text-xl font-semibold text-[#370776] mb-4">Información de Sesión</h2>
                    <div className="space-y-2">
                        <p className="text-gray-600">
                            <span className="font-semibold">Nombre:</span> {user.name || 'N/A'}
                        </p>
                        <p className="text-gray-600">
                            <span className="font-semibold">Email:</span> {user.email || 'N/A'}
                        </p>
                        <p className="text-gray-600">
                            <span className="font-semibold">Estado:</span>
                            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                                Activo
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

