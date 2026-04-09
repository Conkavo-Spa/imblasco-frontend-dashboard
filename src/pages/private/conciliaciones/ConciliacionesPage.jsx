import React, { useMemo } from 'react';
import Sidebar from '../../../components/Sidebar';
import { Card, Table, Modal, Descriptions, Row, Col } from 'antd';
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

    const cotizacionRow = useMemo(
        () => COTIZACIONES_SEED.find((c) => c.id === detalleCotizacionId) ?? null,
        [detalleCotizacionId]
    );

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

    const formatCotizacionContable = (fechaYmd) => {
        if (!fechaYmd) return '—';
        const d = new Date(`${fechaYmd}T12:00:00`);
        if (Number.isNaN(d.getTime())) return fechaYmd;
        return d.toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatCotizacionTransaccionEsperada = (fechaYmd, hora) => {
        if (!fechaYmd) return '—';
        if (!hora) return formatCotizacionContable(fechaYmd);
        const [hh, mm] = String(hora).split(':').map((x) => Number.parseInt(x, 10));
        const h = Number.isFinite(hh) ? hh : 0;
        const m = Number.isFinite(mm) ? mm : 0;
        const d = new Date(
            `${fechaYmd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
        );
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('es-CL');
    };

    const dash = (v) =>
        v != null && String(v).trim() !== '' ? String(v).trim() : '—';

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
                title={`Conciliación${detalleCotizacionId ? ` · ${detalleCotizacionId}` : ''}`}
                open={!!detalleCotizacionId}
                onCancel={() => setDetalleCotizacionId(null)}
                footer={null}
                width={880}
                styles={{ body: { paddingTop: 12 } }}
            >
                {detalle && cotizacionRow ? (
                    <Row gutter={[24, 24]}>
                        <Col xs={24} md={12}>
                            <h3 className="text-sm font-bold text-[#370776] mb-3 border-b border-[#370776]/15 pb-2">
                                Datos cotización
                            </h3>
                            <Descriptions size="small" column={1} bordered>
                                <Descriptions.Item label="ID cotización">
                                    {dash(cotizacionRow.id)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Cliente">
                                    {dash(cotizacionRow.cliente)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Monto">
                                    {typeof cotizacionRow.monto === 'number'
                                        ? `${formatCLP(cotizacionRow.monto)} ${cotizacionRow.moneda || 'CLP'}`.trim()
                                        : '—'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Fecha contable">
                                    {formatCotizacionContable(cotizacionRow.fecha)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Fecha/hora transacción">
                                    {formatCotizacionTransaccionEsperada(
                                        cotizacionRow.fecha,
                                        cotizacionRow.hora
                                    )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Titular transferencia">
                                    {dash(cotizacionRow.nombre)}
                                </Descriptions.Item>
                                <Descriptions.Item label="RUT titular">
                                    {dash(cotizacionRow.rut)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Cuenta titular">
                                    {dash(cotizacionRow.cuenta)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Banco titular">
                                    {dash(cotizacionRow.banco)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Tipo">
                                    {dash(cotizacionRow.tipo)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Descripción">
                                    {dash(cotizacionRow.descripcion)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Comentario">
                                    {dash(cotizacionRow.comentario)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Referencia">
                                    {dash(cotizacionRow.referencia)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Documento">
                                    {dash(cotizacionRow.documento)}
                                </Descriptions.Item>
                            </Descriptions>
                        </Col>
                        <Col
                            xs={24}
                            md={12}
                            className="md:border-l md:border-[#370776]/15 md:pl-6"
                        >
                            <h3 className="text-sm font-bold text-[#370776] mb-3 border-b border-[#370776]/15 pb-2">
                                Datos banco
                            </h3>
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
                                    <Descriptions.Item label="Titular transferencia">
                                        {sourceAccount?.holder_name || '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="RUT titular">
                                        {sourceAccount?.holder_id || '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Cuenta titular">
                                        {sourceAccount?.number || '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Banco titular">
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
                        </Col>
                    </Row>
                ) : null}
            </Modal>
        </div>
    );
}
