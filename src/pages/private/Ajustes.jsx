import React from 'react';
import Sidebar from '../../components/Sidebar';

const Ajustes = () => {
    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                <h1 className="text-3xl font-extrabold text-[#370776] mb-6">Ajustes</h1>
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#370776]/10">
                    <p className="text-gray-600">Contenido de ajustes aquí...</p>
                </div>
            </div>
        </div>
    );
};

export default Ajustes;

