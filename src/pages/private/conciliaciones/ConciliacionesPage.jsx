import React, { useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { Card, Table, Modal, Descriptions } from 'antd';
import { COTIZACIONES_SEED } from '../../../data/cotizacionesSeed';
import { useConciliationQuoteCheck } from '../../../hooks/useConciliationQuoteCheck';
import { buildConciliacionesTableColumns } from './buildTableColumns';
import { formatCLP } from '../../../utils/formatCLP';

/**
 * Pantalla: conciliación de cotizaciones contra movimientos bancarios (Fintoc).
 */
export default function ConciliacionesPage() {
    const [detalleCotizacionId, setDetalleCotizacionId] = React.useState(null);
    const { checkingId, estadoPorCotizacion, movimientoPorCotizacion, checkQuote } =
        useConciliationQuoteCheck();

    const detalle = detalleCotizacionId
        ? movimientoPorCotizacion[detalleCotizacionId]
        : null;

    const columns = useMemo(
        () =>
            buildConciliacionesTableColumns({
                checkingId,
                estadoPorCotizacion,
                movimientoPorCotizacion,
                onRevisar: checkQuote,
                onVerDetalle: setDetalleCotizacionId,
            }),
        [checkingId, estadoPorCotizacion, movimientoPorCotizacion, checkQuote]
    );

    const sourceAccount = detalle?.sender_account || detalle?.recipient_account || null;

    const formatDateTime = (value) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('es-CL');
    };

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
            <Modal
                title={`Detalle transferencia${detalleCotizacionId ? ` · ${detalleCotizacionId}` : ''}`}
                open={!!detalleCotizacionId}
                onCancel={() => setDetalleCotizacionId(null)}
                footer={null}
            >
                {detalle ? (
                    <Descriptions size="small" column={1} bordered>
                        <Descriptions.Item label="ID movimiento">
                            {detalle.id || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Monto">
                            {typeof detalle.amount === 'number'
                                ? `${formatCLP(detalle.amount)} ${detalle.currency || ''}`.trim()
                                : '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Fecha contable">
                            {formatDateTime(detalle.post_date)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Fecha/hora transacción">
                            {formatDateTime(detalle.transaction_date)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Nombre">
                            {sourceAccount?.holder_name || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="RUT">
                            {sourceAccount?.holder_id || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Cuenta">
                            {sourceAccount?.number || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Banco">
                            {sourceAccount?.institution_name || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Tipo">
                            {detalle.type || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Descripción">
                            {detalle.description || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Comentario">
                            {detalle.comment || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Referencia">
                            {detalle.reference_id || '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Documento">
                            {detalle.document_number || '—'}
                        </Descriptions.Item>
                    </Descriptions>
                ) : null}
            </Modal>
        </div>
    );
}
