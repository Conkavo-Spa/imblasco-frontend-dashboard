import React, { useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { Card, Table } from 'antd';
import { COTIZACIONES_SEED } from '../../../data/cotizacionesSeed';
import { useConciliationQuoteCheck } from '../../../hooks/useConciliationQuoteCheck';
import { buildConciliacionesTableColumns } from './buildTableColumns';

/**
 * Pantalla: conciliación de cotizaciones contra movimientos bancarios (Fintoc).
 */
export default function ConciliacionesPage() {
    const { checkingId, estadoPorCotizacion, checkQuote } =
        useConciliationQuoteCheck();

    const columns = useMemo(
        () =>
            buildConciliacionesTableColumns({
                checkingId,
                estadoPorCotizacion,
                onRevisar: checkQuote,
            }),
        [checkingId, estadoPorCotizacion, checkQuote]
    );

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-extrabold text-[#370776] mb-1">
                        Conciliaciones
                    </h1>
                    <p className="text-gray-600 text-sm">
                        Cotizaciones de prueba (montos y fechas alineados con
                        movimientos sandbox Fintoc). Revise contra el banco con
                        el botón &quot;Revisar&quot;.
                    </p>
                </div>
                <Card className="shadow-lg border border-[#370776]/10 rounded-2xl">
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={COTIZACIONES_SEED}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        rowClassName={(record) =>
                            estadoPorCotizacion[record.id] === 'conciliada'
                                ? 'bg-emerald-50/90 hover:bg-emerald-50!'
                                : estadoPorCotizacion[record.id] === 'sin_match'
                                  ? 'bg-amber-50/80 hover:bg-amber-50!'
                                  : ''
                        }
                    />
                </Card>
            </div>
        </div>
    );
}
