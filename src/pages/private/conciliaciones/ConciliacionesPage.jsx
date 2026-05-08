import React, { useMemo, useState, useCallback, useEffect } from 'react';
import PrivatePageShell from '../../../components/PrivatePageShell';
import { Modal, Descriptions, Row, Col, message, Button, Tag, Spin, Table } from 'antd';
import {
    FileTextOutlined,
    BankOutlined,
    CheckCircleOutlined,
    RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMediaQuery } from 'react-responsive';
import { useConciliationTransfers } from '../../../hooks/useConciliationTransfers';
import { useCotizaciones } from '../../../hooks/useCotizaciones';
import { useFacturas } from '../../../hooks/useFacturas';
import { useConciliaciones } from '../../../hooks/useConciliaciones';
import { matchMovementToSeed } from '../../../lib/conciliation/matchMovementToSeed';
import { reconcileMovementAgainstSeeds } from '../../../lib/conciliation/reconcileMovementAgainstSeeds';
import { mergeMovementCounterparty } from '../../../lib/conciliation/mergeMovementCounterparty';
import {
    getDefaultTransferDateRange,
    DEFAULT_TRANSFER_LOOKBACK_DAYS,
} from '../../../lib/conciliation/defaultTransferDateRange';
import { filterTransferenciaRows } from '../../../lib/conciliation/filterTransferenciaRows';
import { formatCLP } from '../../../utils/formatCLP';
import { formatChileRutDisplay } from '../../../lib/conciliation/formatChileRutDisplay';
import ConciliacionesFilters from './ConciliacionesFilters';
import conciliationApi from '../../../services/conciliation.service';
import { SEED_IDS_PRECONCILIADAS_DEMO } from './conciliacionDemo.constants';

function initialsFromName(name) {
    if (!name || typeof name !== 'string') return '—';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    const a = parts[0][0] || '';
    const b = parts.length > 1 ? parts[1][0] || '' : (parts[0][1] || '');
    return (a + b).toUpperCase() || '—';
}

function formatContable(postDate) {
    if (!postDate) return '—';
    const ymd =
        typeof postDate === 'string' && postDate.length >= 10
            ? postDate.slice(0, 10)
            : null;
    if (!ymd) return '—';
    const d = new Date(`${ymd}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function formatFooterRange(dateRange) {
    const a = dateRange?.[0];
    const b = dateRange?.[1];
    if (!a || !b) return '—';
    const opts = { day: '2-digit', month: 'short', year: 'numeric' };
    return `${a.toDate().toLocaleString('es-CL', opts)} — ${b.toDate().toLocaleString('es-CL', opts)}`;
}

function getMovementTypeTag(type) {
    const typeNorm = String(type || '').toLowerCase().trim();
    const configs = {
        transfer: { label: 'Transferencia', color: 'blue' },
        check: { label: 'Cheque', color: 'orange' },
        deposit: { label: 'Depósito', color: 'green' },
        credit: { label: 'Crédito', color: 'cyan' },
        other: { label: 'Otro', color: 'default' },
    };
    const config = configs[typeNorm] || { label: typeNorm || 'Transferencia', color: 'default' };
    return <Tag color={config.color}>{config.label}</Tag>;
}

/**
 * Pantalla de conciliaciones: cartola (abonos) + sugerencia seed + validación Fintoc al conciliar.
 */
export default function ConciliacionesPage() {
    const initialRange = useMemo(() => getDefaultTransferDateRange(), []);
    const [dateRange, setDateRange] = useState(() => [
        dayjs(initialRange.since),
        dayjs(initialRange.until),
    ]);

    const { movements, loading, setRange, refetch, since, until } = useConciliationTransfers(
        initialRange.since,
        initialRange.until
    );

    // Cotizaciones y Facturas: rango amplio (último año) independiente del rango de movimientos.
    // El pago llega semanas/meses después de emitir el documento.
    const documentosSince = useMemo(() => dayjs().subtract(1, 'year').format('YYYY-MM-DD'), []);
    const documentosUntil = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
    const { cotizaciones } = useCotizaciones(documentosSince, documentosUntil);
    const { facturas } = useFacturas(documentosSince, documentosUntil);

    const { conciliaciones, loading: loadingHistorial, refetch: refetchHistorial } = useConciliaciones();

    // IDs ya conciliados para filtrar pendientes
    const conciliadosMovementIds = useMemo(
        () => new Set(conciliaciones.map((c) => c.movement_id)),
        [conciliaciones]
    );
    const conciliadasCotizacionIds = useMemo(
        () => new Set(conciliaciones.filter((c) => (c.document_type ?? 'cotizacion') !== 'factura').map((c) => String(c.cotizacion_id)).filter(Boolean)),
        [conciliaciones]
    );
    const conciliadasFacturaIds = useMemo(
        () => new Set(conciliaciones.filter((c) => (c.document_type ?? 'cotizacion') === 'factura').map((c) => String(c.factura_id)).filter(Boolean)),
        [conciliaciones]
    );

    // Cotizaciones y Facturas que NO han sido conciliadas
    const noConciliadas = useMemo(() => {
        const noCotizaciones = cotizaciones.filter((c) => !conciliadasCotizacionIds.has(c.id));
        const noFacturas = facturas.filter((f) => !conciliadasFacturaIds.has(f.id));
        const combined = [
            ...noFacturas.map((f) => ({ ...f, _type: 'factura' })),
            ...noCotizaciones.map((c) => ({ ...c, _type: 'cotizacion' })),
        ];
        return combined.sort((a, b) => {
            const da = String(a.fecha || '');
            const db = String(b.fecha || '');
            return db.localeCompare(da);
        });
    }, [cotizaciones, facturas, conciliadasCotizacionIds, conciliadasFacturaIds]);

    const [mainTab, setMainTab] = useState('pendientes'); // 'pendientes' | 'historial' | 'no_conciliadas'
    const [estadoFiltro, setEstadoFiltro] = useState('all');
    const [searchText, setSearchText] = useState('');
    const [minMonto, setMinMonto] = useState(null);
    const [maxMonto, setMaxMonto] = useState(null);
    const [bancoFiltro, setBancoFiltro] = useState(null);

    // Modal de detalle de conciliación
    const [modalConciliacion, setModalConciliacion] = useState(null);
    const [detalleProductos, setDetalleProductos] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);

    const [selectedCuentaTabKey, setSelectedCuentaTabKey] = useState('all');
    const [selectedMovementId, setSelectedMovementId] = useState(null);
    const [flowStep, setFlowStep] = useState(1);
    const [flashMatch, setFlashMatch] = useState(false);

    const [detalleRow, setDetalleRow] = useState(null);
    const [cotizacionManualPorMovimientoId, setCotizacionManualPorMovimientoId] =
        useState({});
    const [conciliandoId, setConciliandoId] = useState(null);
    const [docSeleccionado, setDocSeleccionado] = useState('factura'); // 'factura' | 'cotizacion'

    const isNarrow = useMediaQuery({ maxWidth: 1100 });

    const enrichedRows = useMemo(() => {
        return movements
            .filter((m) => !conciliadosMovementIds.has(m.id))
            .map((m) => {
                const porSeed = matchMovementToSeed(m, cotizaciones.filter((c) => !conciliadasCotizacionIds.has(c.id)));
                const manual = cotizacionManualPorMovimientoId[m.id] ?? null;
                let cotizacion = manual;
                if (
                    !cotizacion &&
                    porSeed &&
                    SEED_IDS_PRECONCILIADAS_DEMO.has(porSeed.id)
                ) {
                    cotizacion = porSeed;
                }
                const counterparty = mergeMovementCounterparty(
                    m.sender_account,
                    m.recipient_account
                );
                return {
                    ...m,
                    cotizacion,
                    counterparty,
                    counterpartyName: counterparty?.holder_name ?? null,
                    counterpartyRut: counterparty?.holder_id ?? null,
                    counterpartyBank: counterparty?.institution_name ?? null,
                    counterpartyAccount: counterparty?.number ?? null,
                };
            });
    }, [movements, cotizacionManualPorMovimientoId, conciliadosMovementIds, conciliadasCotizacionIds, cotizaciones]);

    const cuentaTabs = useMemo(() => {
        const names = [...new Set(enrichedRows.map((r) => r.bank_name).filter(Boolean))].sort();
        const all = { key: 'all', label: 'Todos', subtitle: 'Todas las cuentas' };
        const banks = names.map((name) => ({ key: name, label: name, subtitle: 'Cuenta Corriente' }));
        return [all, ...banks];
    }, [enrichedRows]);

    useEffect(() => {
        const valid = cuentaTabs.some((t) => t.key === selectedCuentaTabKey);
        if (!valid) setSelectedCuentaTabKey('all');
    }, [cuentaTabs, selectedCuentaTabKey]);

    const scopedRows = useMemo(() => {
        if (!selectedCuentaTabKey || selectedCuentaTabKey === 'all') return enrichedRows;
        return enrichedRows.filter((r) => r.bank_name === selectedCuentaTabKey);
    }, [enrichedRows, selectedCuentaTabKey]);

    const bancoOptions = useMemo(() => cuentaTabs.filter((t) => t.key !== 'all'), [cuentaTabs]);

    const filteredRows = useMemo(() => {
        return filterTransferenciaRows(scopedRows, {
            estado: estadoFiltro,
            search: searchText,
            minMonto,
            maxMonto,
            banco: bancoFiltro,
        });
    }, [scopedRows, estadoFiltro, searchText, minMonto, maxMonto, bancoFiltro]);

    const pendientesLista = useMemo(
        () => filteredRows.filter((r) => !r.cotizacion),
        [filteredRows]
    );
    const conciliadasLista = useMemo(
        () =>
            [...filteredRows.filter((r) => r.cotizacion)].sort((a, b) => {
                const da = String(a.post_date || '');
                const db = String(b.post_date || '');
                return db.localeCompare(da);
            }),
        [filteredRows]
    );

    // Auto-select document when only one option exists
    useEffect(() => {
        if (selectedRow) {
            const hasFactura = !!sugerenciaFactura;
            const hasCotizacion = !!sugerenciaSeed;

            if (hasFactura && !hasCotizacion) {
                setDocSeleccionado('factura');
            } else if (!hasFactura && hasCotizacion) {
                setDocSeleccionado('cotizacion');
            }
            // If both exist, keep user's selection; if neither, selection doesn't matter
        }
    }, [selectedRow, sugerenciaFactura, sugerenciaSeed]);

    useEffect(() => {
        if (
            selectedMovementId &&
            !pendientesLista.some((r) => r.id === selectedMovementId)
        ) {
            setSelectedMovementId(null);
            setFlowStep(1);
        }
    }, [pendientesLista, selectedMovementId]);

    const pendientesCount = pendientesLista.length;
    const conciliadasCount = conciliadasLista.length;

    const selectedRow = useMemo(
        () => pendientesLista.find((r) => r.id === selectedMovementId) ?? null,
        [pendientesLista, selectedMovementId]
    );

    const sugerenciaFactura = useMemo(() => {
        if (!selectedRow) return null;
        return matchMovementToSeed(selectedRow, facturas.filter((f) => !conciliadasFacturaIds.has(f.id)));
    }, [selectedRow, facturas, conciliadasFacturaIds]);

    const sugerenciaSeed = useMemo(() => {
        if (!selectedRow) return null;
        return matchMovementToSeed(selectedRow, cotizaciones.filter((c) => !conciliadasCotizacionIds.has(c.id)));
    }, [selectedRow, cotizaciones, conciliadasCotizacionIds]);

    const handleSelectRow = useCallback((row) => {
        setSelectedMovementId(row.id);
        setFlowStep(2);
    }, []);

    const handleConciliar = useCallback(async () => {
        const record = selectedRow;
        const mid = record?.id;
        if (!mid || !record) return;

        let selectedDoc = null;
        let documentType = docSeleccionado;

        if (docSeleccionado === 'factura' && sugerenciaFactura) {
            selectedDoc = sugerenciaFactura;
        } else if (docSeleccionado === 'cotizacion' && sugerenciaSeed) {
            selectedDoc = sugerenciaSeed;
        }

        if (!selectedDoc) {
            message.warning(`No hay ${docSeleccionado} seleccionada para conciliar.`);
            return;
        }

        setFlowStep(3);
        setConciliandoId(mid);
        try {
            const seedsToUse = documentType === 'factura' ? facturas : cotizaciones;
            const found = await reconcileMovementAgainstSeeds(record, seedsToUse);

            if (found) {
                const payload = {
                    movement: record,
                    document_type: documentType,
                };

                if (documentType === 'factura') {
                    payload.factura = selectedDoc;
                } else {
                    payload.cotizacion = selectedDoc;
                }

                await conciliationApi.saveConciliacion(payload);

                setCotizacionManualPorMovimientoId((prev) => ({
                    ...prev,
                    [mid]: found,
                }));
                setFlashMatch(true);
                window.setTimeout(() => setFlashMatch(false), 700);
                message.success('Conciliación registrada correctamente');
                setSelectedMovementId(null);
                setFlowStep(1);
                setDocSeleccionado('factura');
                refetchHistorial();
            } else {
                message.warning(
                    `No se encontró ${documentType === 'factura' ? 'factura' : 'cotización'} que cierre con este movimiento en Fintoc.`
                );
                setFlowStep(2);
            }
        } catch (err) {
            const body = err.response?.data;
            message.error(
                body?.message ||
                    err.message ||
                    'Error al conciliar. Intente de nuevo.'
            );
            setFlowStep(2);
        } finally {
            setConciliandoId(null);
        }
    }, [selectedRow, docSeleccionado, sugerenciaFactura, sugerenciaSeed, facturas, cotizaciones]);

    const handleDesdeChange = useCallback((d) => {
        if (!d) return;
        const hasta = dateRange?.[1];
        if (!hasta) return;
        if (d.isAfter(hasta, 'day')) {
            message.warning('La fecha Desde no puede ser posterior a Hasta.');
            return;
        }
        setDateRange([d, hasta]);
        setRange(d.format('YYYY-MM-DD'), hasta.format('YYYY-MM-DD'));
    }, [dateRange, setRange]);

    const handleHastaChange = useCallback((d) => {
        if (!d) return;
        const desde = dateRange?.[0];
        if (!desde) return;
        if (d.isBefore(desde, 'day')) {
            message.warning('La fecha Hasta no puede ser anterior a Desde.');
            return;
        }
        setDateRange([desde, d]);
        setRange(desde.format('YYYY-MM-DD'), d.format('YYYY-MM-DD'));
    }, [dateRange, setRange]);

    const handleOpenModalDetalle = useCallback(async (conciliacion) => {
        setModalConciliacion(conciliacion);
        setDetalleProductos(null);
        setLoadingDetalle(true);
        try {
            const response = await conciliationApi.getCotizacionDetalle(conciliacion.cotizacion_id);
            if (response.data?.success) {
                setDetalleProductos(response.data.data);
            } else {
                setDetalleProductos({ error: 'No se pudieron cargar los detalles' });
            }
        } catch (error) {
            console.error('Error al cargar detalle:', error);
            setDetalleProductos({ error: 'Error al cargar detalles' });
        } finally {
            setLoadingDetalle(false);
        }
    }, []);

    const subheader =
        import.meta.env.VITE_CONCILIACIONES_HEADER_SUB?.trim?.() || '';

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

    const detalle = detalleRow;
    const cotizacionRow = detalle?.cotizacion ?? null;
    const sourceAccount = detalle
        ? mergeMovementCounterparty(
              detalle.sender_account,
              detalle.recipient_account
          )
        : null;

    const rightTitle = !selectedRow
        ? '— Selecciona una transferencia'
        : sugerenciaFactura || sugerenciaSeed
          ? `${(sugerenciaFactura ? 1 : 0) + (sugerenciaSeed ? 1 : 0)} coincidencia${(sugerenciaFactura && sugerenciaSeed) ? 's' : ''} encontrada${(sugerenciaFactura && sugerenciaSeed) ? 's' : ''}`
          : '— Sin coincidencia';

    return (
        <PrivatePageShell>
                    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-3xl font-extrabold text-[#370776]">
                                Conciliaciones
                            </h1>
                            {subheader ? (
                                <p className="mt-1 max-w-2xl truncate text-sm text-gray-600">
                                    {subheader}
                                </p>
                            ) : null}
                        </div>
                        <span className="shrink-0 self-start rounded-full bg-[#EAF5EE] px-3 py-1 font-mono text-xs font-semibold text-[#1A6B3C] sm:mt-2">
                            {pendientesCount} pendientes
                        </span>
                    </div>

                    <p className="mb-4 text-xs text-gray-600">
                        Se cargan abonos de los últimos {DEFAULT_TRANSFER_LOOKBACK_DAYS}{' '}
                        días (rango contable: {since} — {until}). La sugerencia usa fecha
                        contable y monto de la cotización; al conciliar se valida contra Fintoc.
                    </p>

                    {/* Tabs principales */}
                    <div className="mb-5 flex gap-2 border-b border-[#E4E4DF]">
                        <button
                            type="button"
                            onClick={() => setMainTab('pendientes')}
                            className={[
                                'px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors',
                                mainTab === 'pendientes'
                                    ? 'border-[#1A6B3C] text-[#1A6B3C]'
                                    : 'border-transparent text-[#6B6B65] hover:text-[#1A1A18]',
                            ].join(' ')}
                        >
                            Pendientes
                            {pendientesCount > 0 && (
                                <span className="ml-2 rounded-full bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-bold text-[#B45309]">
                                    {pendientesCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMainTab('historial')}
                            className={[
                                'px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors',
                                mainTab === 'historial'
                                    ? 'border-[#1A6B3C] text-[#1A6B3C]'
                                    : 'border-transparent text-[#6B6B65] hover:text-[#1A1A18]',
                            ].join(' ')}
                        >
                            Historial conciliado
                            {conciliaciones.length > 0 && (
                                <span className="ml-2 rounded-full bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-bold text-[#16A34A]">
                                    {conciliaciones.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setMainTab('no_conciliadas')}
                            className={[
                                'px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors',
                                mainTab === 'no_conciliadas'
                                    ? 'border-[#1A6B3C] text-[#1A6B3C]'
                                    : 'border-transparent text-[#6B6B65] hover:text-[#1A1A18]',
                            ].join(' ')}
                        >
                            Sin Conciliar
                            {noConciliadas.length > 0 && (
                                <span className="ml-2 rounded-full bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">
                                    {noConciliadas.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {mainTab === 'historial' ? (
                        <div className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                            <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                                <span className="text-[11.5px] font-bold uppercase tracking-wide text-[#1A1A18]">
                                    Transferencias conciliadas
                                </span>
                                <span className="font-mono text-[11px] text-[#A8A8A2]">
                                    {conciliaciones.length} registros
                                </span>
                            </div>
                            {loadingHistorial ? (
                                <div className="p-8 text-center text-sm text-[#6B6B65]">Cargando historial…</div>
                            ) : conciliaciones.length === 0 ? (
                                <div className="p-10 text-center text-sm text-[#6B6B65]">
                                    Aún no hay conciliaciones registradas.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[12px]">
                                        <thead className="border-b border-[#E4E4DF] bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-wide text-[#A8A8A2]">
                                            <tr>
                                                <th className="px-4 py-2">Fecha pago</th>
                                                <th className="px-4 py-2">Banco</th>
                                                <th className="px-4 py-2">Tipo</th>
                                                <th className="px-4 py-2">N° Documento</th>
                                                <th className="px-4 py-2">Cliente</th>
                                                <th className="px-4 py-2">RUT</th>
                                                <th className="px-4 py-2 text-right">Monto</th>
                                                <th className="px-4 py-2">Conciliado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {conciliaciones.map((c) => {
                                                const docType = c.document_type ?? 'cotizacion';
                                                const isFactura = docType === 'factura';
                                                const docId = isFactura ? c.factura_id : c.cotizacion_id;
                                                const docTypeLabel = isFactura ? 'FAC' : 'COT';
                                                const docTypeColor = isFactura ? '#16A34A' : '#1D4ED8';
                                                return (
                                                    <tr
                                                        key={c._id}
                                                        onClick={() => handleOpenModalDetalle(c)}
                                                        className="cursor-pointer border-b border-[#E4E4DF] hover:bg-[#FAFAF8] transition-colors"
                                                    >
                                                        <td className="px-4 py-2.5 font-mono text-[#6B6B65]">
                                                            {c.fecha_movimiento ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-[#6B6B65]">
                                                            {c.bank_name ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span
                                                                className="inline-flex rounded px-2 py-1 text-[10px] font-semibold text-white"
                                                                style={{ backgroundColor: docTypeColor }}
                                                            >
                                                                {docTypeLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: docTypeColor }}>
                                                            {docId ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-[#1A1A18]">
                                                            {c.cliente ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-[#6B6B65]">
                                                        {formatChileRutDisplay(c.rut)}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#1A1A18]">
                                                        {typeof c.monto === 'number' ? formatCLP(c.monto) : '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[#A8A8A2]">
                                                        {c.createdAt
                                                            ? new Date(c.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
                                                            : '—'}
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {mainTab === 'no_conciliadas' ? (
                        <div className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                            <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                                <span className="text-[11.5px] font-bold uppercase tracking-wide text-[#1A1A18]">
                                    Facturas y cotizaciones sin conciliar
                                </span>
                                <span className="font-mono text-[11px] text-[#A8A8A2]">
                                    {noConciliadas.length} registros
                                </span>
                            </div>
                            {(cotizaciones.length === 0 || facturas.length === 0) && conciliaciones.length === 0 ? (
                                <div className="p-8 text-center text-sm text-[#6B6B65]">Cargando documentos…</div>
                            ) : noConciliadas.length === 0 ? (
                                <div className="p-10 text-center text-sm text-[#6B6B65]">
                                    Todas las facturas y cotizaciones han sido conciliadas. ✓
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[12px]">
                                        <thead className="border-b border-[#E4E4DF] bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-wide text-[#A8A8A2]">
                                            <tr>
                                                <th className="px-4 py-2">Tipo</th>
                                                <th className="px-4 py-2">N° Documento</th>
                                                <th className="px-4 py-2">Fecha emisión</th>
                                                <th className="px-4 py-2">Cliente</th>
                                                <th className="px-4 py-2">RUT</th>
                                                <th className="px-4 py-2 text-right">Monto</th>
                                                <th className="px-4 py-2 text-right">Días sin pago</th>
                                                <th className="px-4 py-2">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {noConciliadas.map((doc, idx) => {
                                                const diasSinPago = dayjs().diff(dayjs(doc.fecha), 'day');
                                                const estado = diasSinPago > 30 ? 'Vencida' : 'Sin pago';
                                                const estadoColor = diasSinPago > 30 ? '#EA580C' : '#DC2626';
                                                const docType = doc._type ?? 'cotizacion';
                                                const isFactura = docType === 'factura';
                                                const tipoBadgeColor = isFactura ? '#16A34A' : '#1D4ED8';
                                                const tipoLabel = isFactura ? 'FAC' : 'COT';
                                                return (
                                                    <tr key={`${docType}-${doc.id}-${idx}`} className="border-b border-[#E4E4DF] hover:bg-[#FAFAF8]">
                                                        <td className="px-4 py-2.5">
                                                            <span
                                                                className="inline-flex rounded px-2 py-1 text-[10px] font-semibold text-white"
                                                                style={{ backgroundColor: tipoBadgeColor }}
                                                            >
                                                                {tipoLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: tipoBadgeColor }}>
                                                            {doc.id ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-[#6B6B65]">
                                                            {doc.fecha ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-[#1A1A18]">
                                                            {doc.cliente ?? '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-[#6B6B65]">
                                                            {formatChileRutDisplay(doc.rut)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#1A1A18]">
                                                            {typeof doc.monto === 'number' ? formatCLP(doc.monto) : '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-mono text-[#6B6B65]">
                                                            {diasSinPago}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span
                                                                className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                                                                style={{ backgroundColor: estadoColor }}
                                                            >
                                                                {estado}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {mainTab === 'pendientes' ? (<>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#A8A8A2]">
                        Selecciona el banco a revisar
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                        {cuentaTabs.map((tab) => {
                            const active = selectedCuentaTabKey === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setSelectedCuentaTabKey(tab.key)}
                                    className={[
                                        'flex max-w-[240px] flex-1 items-center gap-2.5 rounded-lg border px-4 py-2.5 text-left transition-colors sm:min-w-[180px]',
                                        active
                                            ? 'border-[#1A6B3C] bg-[#EAF5EE] shadow-[0_0_0_3px_rgba(26,107,60,0.08)]'
                                            : 'border-[#CDCDC7] bg-white hover:border-[#1A6B3C] hover:bg-[#EAF5EE]',
                                    ].join(' ')}
                                >
                                    <div
                                        className={[
                                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                                            active ? 'bg-[#1A6B3C]' : 'bg-[#E4E4DF]',
                                        ].join(' ')}
                                    >
                                        <BankOutlined
                                            className={active ? 'text-white' : 'text-[#6B6B65]'}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div
                                            className={[
                                                'truncate text-[12.5px] font-semibold leading-tight',
                                                active ? 'text-[#1A6B3C]' : 'text-[#1A1A18]',
                                            ].join(' ')}
                                        >
                                            {tab.label}
                                        </div>
                                        <div className="mt-0.5 truncate font-mono text-[10.5px] text-[#A8A8A2]">
                                            {tab.subtitle}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <ConciliacionesFilters
                        dateRange={dateRange}
                        onDesdeChange={handleDesdeChange}
                        onHastaChange={handleHastaChange}
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

                    <div className="mb-3.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                        <span
                            className={
                                flowStep === 1 ? 'flex items-center gap-1.5 text-[#1A6B3C]' : 'text-[#A8A8A2]'
                            }
                        >
                            <span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                                aria-hidden
                            />
                            1 · Selecciona transferencia
                        </span>
                        <RightOutlined className="text-[#A8A8A2]" />
                        <span
                            className={
                                flowStep === 2 ? 'flex items-center gap-1.5 text-[#1A6B3C]' : 'text-[#A8A8A2]'
                            }
                        >
                            <span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                                aria-hidden
                            />
                            2 · Agente sugiere documento
                        </span>
                        <RightOutlined className="text-[#A8A8A2]" />
                        <span
                            className={
                                flowStep === 3 ? 'flex items-center gap-1.5 text-[#1A6B3C]' : 'text-[#A8A8A2]'
                            }
                        >
                            <span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                                aria-hidden
                            />
                            3 · Verificar y conciliar
                        </span>
                    </div>

                    <div
                        className={[
                            'gap-0',
                            isNarrow ? 'flex flex-col' : 'grid items-start',
                            isNarrow ? '' : 'grid-cols-[1fr_56px_1fr]',
                        ].join(' ')}
                    >
                        {/* Cartola */}
                        <section className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                            <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                                <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#1A1A18]">
                                    <BankOutlined />
                                    Cartola bancaria
                                </span>
                                <span className="font-mono text-[11px] text-[#A8A8A2]">
                                    {pendientesCount} pendientes
                                </span>
                            </div>
                            <div className="max-h-[min(52vh,560px)] overflow-y-auto">
                                {loading && !pendientesLista.length ? (
                                    <div className="p-8 text-center text-sm text-[#6B6B65]">
                                        Cargando transferencias…
                                    </div>
                                ) : null}
                                {!loading && pendientesLista.length === 0 ? (
                                    <div className="p-10 text-center text-sm text-[#6B6B65]">
                                        No hay transferencias pendientes con los filtros
                                        actuales.
                                    </div>
                                ) : null}
                                {pendientesLista.map((row) => {
                                    const sel = selectedMovementId === row.id;
                                    return (
                                        <button
                                            key={row.id}
                                            type="button"
                                            onClick={() => handleSelectRow(row)}
                                            className={[
                                                'flex w-full items-center gap-3 border-b border-[#E4E4DF] px-4 py-3 text-left transition-colors',
                                                'border-l-[3px] border-l-transparent hover:bg-[#F5F5F2]',
                                                sel
                                                    ? 'border-l-[#1A6B3C] bg-[#EAF5EE]'
                                                    : '',
                                            ].join(' ')}
                                        >
                                            <div
                                                className={[
                                                    'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                                                    sel
                                                        ? 'bg-[#1A6B3C] text-white'
                                                        : 'bg-[#E4E4DF] text-[#6B6B65]',
                                                ].join(' ')}
                                            >
                                                {initialsFromName(row.counterpartyName)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[12.5px] font-semibold text-[#1A1A18]">
                                                    {row.counterpartyName || '—'}
                                                </div>
                                                <div className="mt-0.5 font-mono text-[10.5px] font-medium text-[#6B6B65]">
                                                    {formatChileRutDisplay(row.counterpartyRut)}
                                                </div>
                                                <div className="mt-0.5 font-mono text-[10px] text-[#A8A8A2]">
                                                    {formatContable(row.post_date)}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <div className="font-mono text-[13px] font-semibold text-[#1A1A18]">
                                                    {typeof row.amount === 'number'
                                                        ? formatCLP(row.amount)
                                                        : '—'}
                                                </div>
                                                <div className="mt-0.5">
                                                    {getMovementTypeTag(row.type)}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {estadoFiltro !== 'sin_cotizacion' && conciliadasLista.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2 border-y border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5">
                                        <CheckCircleOutlined className="text-[#16A34A]" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#16A34A]">
                                            Conciliadas
                                        </span>
                                        <span className="rounded-full border border-[#BBF7D0] bg-[#DCFCE7] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#16A34A]">
                                            {conciliadasCount}
                                        </span>
                                    </div>
                                    <div className="max-h-[220px] overflow-y-auto">
                                        {conciliadasLista.map((row) => (
                                            <div
                                                key={row.id}
                                                className="flex items-center gap-3 border-b border-[#E4E4DF] px-4 py-2.5 last:border-b-0"
                                            >
                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#BBF7D0] bg-[#DCFCE7] text-[9px] font-bold text-[#16A34A]">
                                                    {initialsFromName(row.counterpartyName)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-xs font-medium text-[#6B6B65]">
                                                        {row.counterpartyName || '—'}
                                                    </div>
                                                    <div className="mt-0.5 font-mono text-[10px] text-[#A8A8A2]">
                                                        {formatChileRutDisplay(row.counterpartyRut)} ·{' '}
                                                        {row.cotizacion?.id || '—'}
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 flex-col items-end gap-1">
                                                    <span className="font-mono text-xs text-[#6B6B65]">
                                                        {typeof row.amount === 'number'
                                                            ? formatCLP(row.amount)
                                                            : '—'}
                                                    </span>
                                                    <span className="inline-flex items-center gap-0.5 rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] font-semibold text-[#16A34A]">
                                                        <CheckCircleOutlined className="text-[9px]" />
                                                        Conciliada
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : null}

                            <div className="flex justify-between border-t border-[#E4E4DF] bg-[#FAFAF8] px-4 py-2.5 text-[11.5px] text-[#A8A8A2]">
                                <span>{formatFooterRange(dateRange)}</span>
                                <span className="text-[#B45309]">
                                    <strong className="font-semibold text-[#B45309]">
                                        {pendientesCount}
                                    </strong>{' '}
                                    pendientes
                                </span>
                            </div>
                        </section>

                        {/* Conector */}
                        <div
                            className={[
                                'flex flex-col items-center justify-start px-1',
                                isNarrow ? 'hidden' : 'flex pt-16',
                            ].join(' ')}
                            aria-hidden
                        >
                            <div
                                className={[
                                    'w-0.5 rounded-sm bg-gradient-to-b from-[#1A6B3C] to-[#6EE7A0] transition-all duration-300',
                                    selectedRow ? 'h-12' : 'h-0',
                                ].join(' ')}
                            />
                            <span
                                className={[
                                    'mt-1 text-lg font-bold text-[#1A6B3C] transition-opacity',
                                    selectedRow ? 'opacity-100' : 'opacity-0',
                                ].join(' ')}
                            >
                                →
                            </span>
                        </div>

                        {/* Documentos sugeridos - Factura y Cotización */}
                        <section className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                            <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                                <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#1A1A18]">
                                    <FileTextOutlined />
                                    Documentos sugeridos
                                </span>
                                <span className="max-w-[55%] truncate text-right font-mono text-[11px] text-[#A8A8A2]">
                                    {rightTitle}
                                </span>
                            </div>

                            <div className="min-h-[min(52vh,560px)] overflow-y-auto p-4">
                                {!selectedRow ? (
                                    <div className="flex flex-col items-center px-6 py-14 text-center text-[#A8A8A2]">
                                        <FileTextOutlined
                                            className="mb-3.5 text-[52px] opacity-25"
                                        />
                                        <p className="max-w-sm text-[12.5px] leading-relaxed">
                                            <strong className="text-[#6B6B65]">
                                                Selecciona una transferencia
                                            </strong>
                                            <br />
                                            El agente buscará la factura correspondiente
                                            automáticamente.
                                        </p>
                                    </div>
                                ) : null}

                                {selectedRow && (sugerenciaFactura || sugerenciaSeed) ? (
                                    <div className="space-y-4">
                                        {/* Factura sugerida */}
                                        {sugerenciaFactura ? (
                                            <div className="rounded-lg border border-[#86EFAC] border-l-[3px] border-l-[#16A34A] bg-[#F0FDF4] p-4">
                                                <div className="mb-3 flex items-start gap-3">
                                                    <input
                                                        type="radio"
                                                        id="doc-factura"
                                                        name="doc-selection"
                                                        value="factura"
                                                        checked={docSeleccionado === 'factura'}
                                                        onChange={(e) => setDocSeleccionado(e.target.value)}
                                                        className="mt-1 cursor-pointer"
                                                    />
                                                    <label htmlFor="doc-factura" className="flex-1 cursor-pointer">
                                                        <div className="mb-1.5 inline-block rounded border border-[#86EFAC] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#16A34A]">
                                                            FAC {sugerenciaFactura.id}
                                                        </div>
                                                        <div className="text-[13px] font-semibold text-[#1A1A18]">
                                                            {sugerenciaFactura.cliente || '—'}
                                                        </div>
                                                        <div className="mt-0.5 font-mono text-[10.5px] font-medium text-[#6B6B65]">
                                                            {formatChileRutDisplay(sugerenciaFactura.rut)}
                                                        </div>
                                                        <div className="mt-1 text-[10.5px] text-[#A8A8A2]">
                                                            Emitida {formatCotizacionContable(sugerenciaFactura.fecha)}
                                                        </div>
                                                        <div className="mt-2 text-right">
                                                            <div className="font-mono text-lg font-bold text-[#16A34A]">
                                                                {typeof sugerenciaFactura.monto === 'number'
                                                                    ? formatCLP(sugerenciaFactura.monto)
                                                                    : '—'}
                                                            </div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        ) : null}

                                        {/* Cotización sugerida */}
                                        {sugerenciaSeed ? (
                                            <div className="rounded-lg border border-[#BFDBFE] border-l-[3px] border-l-[#1D4ED8] bg-[#EFF6FF] p-4">
                                                <div className="mb-3 flex items-start gap-3">
                                                    <input
                                                        type="radio"
                                                        id="doc-cotizacion"
                                                        name="doc-selection"
                                                        value="cotizacion"
                                                        checked={docSeleccionado === 'cotizacion'}
                                                        onChange={(e) => setDocSeleccionado(e.target.value)}
                                                        className="mt-1 cursor-pointer"
                                                    />
                                                    <label htmlFor="doc-cotizacion" className="flex-1 cursor-pointer">
                                                        <div className="mb-1.5 inline-block rounded border border-[#BFDBFE] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#1D4ED8]">
                                                            COT {sugerenciaSeed.id}
                                                        </div>
                                                        <div className="text-[13px] font-semibold text-[#1A1A18]">
                                                            {sugerenciaSeed.cliente || '—'}
                                                        </div>
                                                        <div className="mt-0.5 font-mono text-[10.5px] font-medium text-[#6B6B65]">
                                                            {formatChileRutDisplay(sugerenciaSeed.rut)}
                                                        </div>
                                                        <div className="mt-1 text-[10.5px] text-[#A8A8A2]">
                                                            Emitida {formatCotizacionContable(sugerenciaSeed.fecha)}
                                                        </div>
                                                        <div className="mt-2 text-right">
                                                            <div className="font-mono text-lg font-bold text-[#1D4ED8]">
                                                                {typeof sugerenciaSeed.monto === 'number'
                                                                    ? formatCLP(sugerenciaSeed.monto)
                                                                    : '—'}
                                                            </div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <Button
                                                type="primary"
                                                className="h-10 flex-1 border-none bg-[#1A6B3C] font-bold hover:!bg-[#2E9459]"
                                                icon={<CheckCircleOutlined />}
                                                loading={conciliandoId === selectedRow.id}
                                                disabled={
                                                    conciliandoId !== null &&
                                                    conciliandoId !== selectedRow.id
                                                }
                                                onClick={handleConciliar}
                                            >
                                                Conciliar
                                            </Button>
                                            <Button onClick={() => setDetalleRow(selectedRow)}>
                                                Ver detalle
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}

                                {selectedRow && !sugerenciaFactura && !sugerenciaSeed ? (
                                    <div className="flex flex-col items-center px-6 py-14 text-center text-[#A8A8A2]">
                                        <FileTextOutlined
                                            className="mb-3.5 text-[52px] opacity-25"
                                        />
                                        <p className="max-w-sm text-[12.5px] leading-relaxed">
                                            <strong className="text-[#6B6B65]">
                                                Sin documentos encontrados
                                            </strong>
                                            <br />
                                            El agente no encontró coincidencia por fecha contable
                                            y monto en el catálogo actual.
                                        </p>
                                        <Button className="mt-4" onClick={() => setDetalleRow(selectedRow)}>
                                            Ver movimiento
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    </div>

            </>) : null}

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
                            <h3 className="mb-3 border-b border-[#1A6B3C]/20 pb-2 text-sm font-bold text-[#1A6B3C]">
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
                            className="md:border-l md:border-[#1A6B3C]/15 md:pl-6"
                        >
                            <h3 className="mb-3 border-b border-[#1A6B3C]/20 pb-2 text-sm font-bold text-[#1A6B3C]">
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
                                <p className="text-sm leading-relaxed text-gray-600">
                                    No hay cotización en el catálogo seed que coincida con esta
                                    transferencia por <strong>fecha contable</strong> y{' '}
                                    <strong>monto</strong> (misma regla que el match automático).
                                </p>
                            )}
                        </Col>
                    </Row>
                ) : null}
            </Modal>

            {/* Modal de detalle de conciliación */}
            <Modal
                title={`Detalle de Conciliación #${modalConciliacion?.cotizacion_id ?? '—'}`}
                open={!!modalConciliacion}
                onCancel={() => {
                    setModalConciliacion(null);
                    setDetalleProductos(null);
                }}
                width={900}
                footer={null}
            >
                {modalConciliacion && (
                    <Spin spinning={loadingDetalle}>
                        <div className="space-y-6">
                            {/* Sección movimiento bancario */}
                            <div>
                                <h3 className="mb-3 font-semibold text-gray-800">Movimiento Bancario</h3>
                                <Descriptions size="small" column={2}>
                                    <Descriptions.Item label="Monto">
                                        {typeof modalConciliacion.monto === 'number'
                                            ? formatCLP(modalConciliacion.monto)
                                            : '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Fecha">
                                        {modalConciliacion.fecha_movimiento ?? '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Banco">
                                        {modalConciliacion.bank_name ?? '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Descripción">
                                        {modalConciliacion.movement?.description ?? '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Pagador" span={2}>
                                        {modalConciliacion.movement?.sender_account?.holder_name ??
                                            modalConciliacion.cliente ??
                                            '—'}
                                    </Descriptions.Item>
                                </Descriptions>
                            </div>

                            {/* Sección cotización */}
                            <div>
                                <h3 className="mb-3 font-semibold text-gray-800">Cotización/Nota</h3>
                                <Descriptions size="small" column={2}>
                                    <Descriptions.Item label="Número">
                                        {modalConciliacion.cotizacion_id ?? '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Cliente">
                                        {modalConciliacion.cliente ?? '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="RUT">
                                        {formatChileRutDisplay(modalConciliacion.rut)}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Fecha">
                                        {modalConciliacion.cotizacion?.fecha ?? '—'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Total Venta" span={2}>
                                        {typeof modalConciliacion.cotizacion?.monto === 'number'
                                            ? formatCLP(modalConciliacion.cotizacion.monto)
                                            : '—'}
                                    </Descriptions.Item>
                                </Descriptions>
                            </div>

                            {/* Tabla de productos */}
                            <div>
                                <h3 className="mb-3 font-semibold text-gray-800">Productos/Items</h3>
                                {detalleProductos?.error ? (
                                    <div className="rounded bg-red-50 p-3 text-sm text-red-600">
                                        {detalleProductos.error}
                                    </div>
                                ) : detalleProductos?.detalle && Array.isArray(detalleProductos.detalle) ? (
                                    <Table
                                        columns={[
                                            {
                                                title: 'Descripción',
                                                dataIndex: 'descripcion',
                                                key: 'descripcion',
                                            },
                                            {
                                                title: 'Cantidad',
                                                dataIndex: 'cantidad',
                                                key: 'cantidad',
                                                align: 'right',
                                                width: 100,
                                            },
                                            {
                                                title: 'Precio Unit.',
                                                dataIndex: 'precio',
                                                key: 'precio',
                                                align: 'right',
                                                width: 120,
                                                render: (v) =>
                                                    typeof v === 'number' ? formatCLP(v) : '—',
                                            },
                                            {
                                                title: 'Total',
                                                dataIndex: 'total',
                                                key: 'total',
                                                align: 'right',
                                                width: 120,
                                                render: (v) =>
                                                    typeof v === 'number' ? formatCLP(v) : '—',
                                            },
                                        ]}
                                        dataSource={detalleProductos.detalle.map((item, i) => ({
                                            key: i,
                                            ...item,
                                        }))}
                                        pagination={false}
                                        size="small"
                                    />
                                ) : (
                                    <div className="rounded bg-gray-50 p-3 text-sm text-gray-600">
                                        No hay detalle de productos
                                    </div>
                                )}
                            </div>
                        </div>
                    </Spin>
                )}
            </Modal>
        </PrivatePageShell>
    );
}
