import React, { useMemo, useState, useCallback } from 'react';
import Sidebar from '../../../components/Sidebar';
import { Card, Table, Modal, Descriptions, Row, Col, message } from 'antd';
import dayjs from 'dayjs';
import { COTIZACIONES_SEED } from '../../../data/cotizacionesSeed';
import { useConciliationTransfers } from '../../../hooks/useConciliationTransfers';
import { matchMovementToSeed } from '../../../lib/conciliation/matchMovementToSeed';
import { reconcileMovementAgainstSeeds } from '../../../lib/conciliation/reconcileMovementAgainstSeeds';
import { mergeMovementCounterparty } from '../../../lib/conciliation/mergeMovementCounterparty';
import {
    getDefaultTransferDateRange,
    DEFAULT_TRANSFER_LOOKBACK_DAYS,
} from '../../../lib/conciliation/defaultTransferDateRange';
import { filterTransferenciaRows } from '../../../lib/conciliation/filterTransferenciaRows';
import { buildTransferenciasTableColumns } from './buildTransferenciasTableColumns';
import ConciliacionesFilters from './ConciliacionesFilters';
import { formatCLP } from '../../../utils/formatCLP';

/**
 * Pantalla: transferencias bancarias (Fintoc) con validación contra cotizaciones seed.
 */
export default function ConciliacionesPage() {
    const initialRange = useMemo(() => getDefaultTransferDateRange(), []);

    const [dateRange, setDateRange] = useState(() => [
        dayjs(initialRange.since),
        dayjs(initialRange.until),
    ]);

    const { movements, loading, setRange, refetch } = useConciliationTransfers(
        initialRange.since,
        initialRange.until
    );

    const [estadoFiltro, setEstadoFiltro] = useState('all');
    const [searchText, setSearchText] = useState('');
    const [minMonto, setMinMonto] = useState(null);
    const [maxMonto, setMaxMonto] = useState(null);
    const [bancoFiltro, setBancoFiltro] = useState(null);

    const [detalleRow, setDetalleRow] = useState(null);
    /** Vínculo tras botón Conciliar (validación vía API / Fintoc) */
    const [cotizacionManualPorMovimientoId, setCotizacionManualPorMovimientoId] =
        useState({});
    const [conciliandoId, setConciliandoId] = useState(null);

    const enrichedRows = useMemo(() => {
        return movements.map((m) => {
            const porSeed = matchMovementToSeed(m, COTIZACIONES_SEED);
            const cotizacion =
                porSeed ?? cotizacionManualPorMovimientoId[m.id] ?? null;
            const counterparty = mergeMovementCounterparty(
                m.sender_account,
                m.recipient_account
            );
            return {
                ...m,
                cotizacion,
                counterparty,
                // Tabla = solo datos del movimiento (Fintoc). La cotización es otra columna / modal.
                counterpartyName: counterparty?.holder_name ?? null,
                counterpartyRut: counterparty?.holder_id ?? null,
                counterpartyBank: counterparty?.institution_name ?? null,
                counterpartyAccount: counterparty?.number ?? null,
            };
        });
    }, [movements, cotizacionManualPorMovimientoId]);

    const bancoOptions = useMemo(() => {
        const set = new Set();
        for (const r of enrichedRows) {
            if (r.counterpartyBank) set.add(r.counterpartyBank);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    }, [enrichedRows]);

    const filteredRows = useMemo(() => {
        return filterTransferenciaRows(enrichedRows, {
            estado: estadoFiltro,
            search: searchText,
            minMonto,
            maxMonto,
            banco: bancoFiltro,
        });
    }, [enrichedRows, estadoFiltro, searchText, minMonto, maxMonto, bancoFiltro]);

    const handleConciliar = useCallback(async (record) => {
        const mid = record.id;
        if (!mid) return;
        setConciliandoId(mid);
        try {
            const found = await reconcileMovementAgainstSeeds(
                record,
                COTIZACIONES_SEED
            );
            if (found) {
                setCotizacionManualPorMovimientoId((prev) => ({
                    ...prev,
                    [mid]: found,
                }));
                message.success(
                    `Conciliado con cotización ${found.id} (validado en banco).`
                );
            } else {
                message.warning(
                    'No se encontró cotización que cierre con este movimiento en Fintoc.'
                );
            }
        } catch (err) {
            const body = err.response?.data;
            message.error(
                body?.message ||
                    err.message ||
                    'Error al conciliar. Intente de nuevo.'
            );
        } finally {
            setConciliandoId(null);
        }
    }, []);

    const columns = useMemo(
        () =>
            buildTransferenciasTableColumns({
                onVerDetalle: setDetalleRow,
                onConciliar: handleConciliar,
                conciliandoId,
            }),
        [handleConciliar, conciliandoId]
    );

    const handleDateRangeChange = (dates) => {
        if (!dates?.[0] || !dates?.[1]) return;
        setDateRange(dates);
        setRange(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
    };

    const detalle = detalleRow;
    const cotizacionRow = detalle?.cotizacion ?? null;
    const sourceAccount = detalle
        ? mergeMovementCounterparty(
              detalle.sender_account,
              detalle.recipient_account
          )
        : null;

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
                        Por defecto se cargan las transferencias de los últimos{' '}
                        {DEFAULT_TRANSFER_LOOKBACK_DAYS} días (todas las contrapartes /
                        bancos del extracto). Cada fila se valida contra el catálogo seed
                        por fecha contable y monto. Ajuste fechas y filtros según necesite.
                    </p>
                </div>

                <ConciliacionesFilters
                    dateRange={dateRange}
                    onDateRangeChange={handleDateRangeChange}
                    estadoFiltro={estadoFiltro}
                    onEstadoFiltroChange={setEstadoFiltro}
                    searchText={searchText}
                    onSearchChange={setSearchText}
                    minMonto={minMonto}
                    maxMonto={maxMonto}
                    onMinMontoChange={setMinMonto}
                    onMaxMontoChange={setMaxMonto}
                    bancoFiltro={bancoFiltro}
                    onBancoFiltroChange={setBancoFiltro}
                    bancoOptions={bancoOptions}
                    onRefresh={refetch}
                    loading={loading}
                />

                <Card className="shadow-lg border border-[#370776]/10 rounded-2xl">
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={filteredRows}
                        loading={loading}
                        pagination={{
                            pageSize: 15,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '15', '25', '50'],
                            showTotal: (total) =>
                                `${total} transferencia${total === 1 ? '' : 's'}`,
                        }}
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        rowClassName={(record) =>
                            record.cotizacion
                                ? 'bg-emerald-50/90 hover:bg-emerald-50!'
                                : 'bg-amber-50/80 hover:bg-amber-50!'
                        }
                    />
                </Card>
            </div>
            <Modal
                title={
                    detalle
                        ? `Transferencia${detalle.id ? ` · ${detalle.id}` : ''}`
                        : 'Detalle'
                }
                open={!!detalle}
                onCancel={() => setDetalleRow(null)}
                footer={null}
                width={880}
                styles={{ body: { paddingTop: 12 } }}
            >
                {detalle ? (
                    <Row gutter={[24, 24]}>
                        <Col xs={24} md={12}>
                            <h3 className="text-sm font-bold text-[#370776] mb-3 border-b border-[#370776]/15 pb-2">
                                Datos banco
                            </h3>
                            <Descriptions size="small" column={1} bordered>
                                <Descriptions.Item label="ID movimiento">
                                    {dash(detalle.id)}
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
                        <Col
                            xs={24}
                            md={12}
                            className="md:border-l md:border-[#370776]/15 md:pl-6"
                        >
                            <h3 className="text-sm font-bold text-[#370776] mb-3 border-b border-[#370776]/15 pb-2">
                                Cotización (seed)
                            </h3>
                            {cotizacionRow ? (
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
                            ) : (
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    No hay cotización en el catálogo seed que coincida con esta
                                    transferencia por{' '}
                                    <strong>fecha contable</strong> y <strong>monto</strong>{' '}
                                    (misma regla que el match automático en servidor).
                                </p>
                            )}
                        </Col>
                    </Row>
                ) : null}
            </Modal>
        </div>
    );
}
