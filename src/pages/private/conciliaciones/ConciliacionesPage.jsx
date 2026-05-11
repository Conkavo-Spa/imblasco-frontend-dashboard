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

    // Documentos con rango amplio fijo (último año)
    const { cotizaciones } = useCotizaciones(
        dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
        dayjs().format('YYYY-MM-DD')
    );
    const { facturas } = useFacturas(
        dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
        dayjs().format('YYYY-MM-DD')
    );

    const { conciliaciones, loading: loadingHistorial, refetch: refetchHistorial } = useConciliaciones();

    // Estado y selección
    const [mainTab, setMainTab] = useState('pendientes');
    const [estadoFiltro, setEstadoFiltro] = useState('all');
    const [searchText, setSearchText] = useState('');
    const [minMonto, setMinMonto] = useState(null);
    const [maxMonto, setMaxMonto] = useState(null);
    const [bancoFiltro, setBancoFiltro] = useState(null);
    const [selectedCuentaTabKey, setSelectedCuentaTabKey] = useState('all');
    const [selectedMovementId, setSelectedMovementId] = useState(null);
    const [flowStep, setFlowStep] = useState(1);
    const [flashMatch, setFlashMatch] = useState(false);
    const [detalleRow, setDetalleRow] = useState(null);
    const [modalConciliacion, setModalConciliacion] = useState(null);
    const [detalleProductos, setDetalleProductos] = useState(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [cotizacionManualPorMovimientoId, setCotizacionManualPorMovimientoId] = useState({});
    const [conciliandoId, setConciliandoId] = useState(null);
    const [docSeleccionado, setDocSeleccionado] = useState('factura');

    const isNarrow = useMediaQuery({ maxWidth: 1100 });

    // IDs conciliados
    const conciliadosIds = useMemo(() => new Set(conciliaciones.map(c => c.movement_id)), [conciliaciones]);
    const cotizacionesNoId = useMemo(() => new Set(), []);
    const facturasNoId = useMemo(() => new Set(), []);

    conciliaciones.forEach(c => {
        const dt = c.document_type ?? 'cotizacion';
        if (dt !== 'factura' && c.cotizacion_id) cotizacionesNoId.add(String(c.cotizacion_id));
        if (dt === 'factura' && c.factura_id) facturasNoId.add(String(c.factura_id));
    });

    // Filas enriquecidas
    const enrichedRows = useMemo(() => {
        if (!Array.isArray(movements)) return [];
        return movements.filter(m => !conciliadosIds.has(m.id)).map(m => {
            const porSeed = matchMovementToSeed(m, Array.isArray(cotizaciones) ? cotizaciones.filter(c => !cotizacionesNoId.has(c.id)) : []);
            const manual = cotizacionManualPorMovimientoId[m.id] ?? null;
            let cotizacion = manual || (porSeed && SEED_IDS_PRECONCILIADAS_DEMO.has(porSeed.id) ? porSeed : null);
            const counterparty = mergeMovementCounterparty(m.sender_account, m.recipient_account);
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
    }, [movements, cotizacionManualPorMovimientoId, conciliadosIds, cotizacionesNoId, cotizaciones]);

    const cuentaTabs = useMemo(() => {
        const names = [...new Set(enrichedRows.map((r) => r.bank_name).filter(Boolean))].sort();
        return [
            { key: 'all', label: 'Todos', subtitle: 'Todas las cuentas' },
            ...names.map((name) => ({ key: name, label: name, subtitle: 'Cuenta Corriente' })),
        ];
    }, [enrichedRows]);

    useEffect(() => {
        if (!cuentaTabs.some((t) => t.key === selectedCuentaTabKey)) {
            setSelectedCuentaTabKey('all');
        }
    }, [cuentaTabs, selectedCuentaTabKey]);

    const scopedRows = useMemo(() => {
        return !selectedCuentaTabKey || selectedCuentaTabKey === 'all'
            ? enrichedRows
            : enrichedRows.filter((r) => r.bank_name === selectedCuentaTabKey);
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
        () => [...filteredRows.filter((r) => r.cotizacion)].sort((a, b) => String(b.post_date || '').localeCompare(String(a.post_date || ''))),
        [filteredRows]
    );

    useEffect(() => {
        if (selectedMovementId && !pendientesLista.some((r) => r.id === selectedMovementId)) {
            setSelectedMovementId(null);
            setFlowStep(1);
        }
    }, [pendientesLista, selectedMovementId]);

    const selectedRow = useMemo(
        () => pendientesLista.find((r) => r.id === selectedMovementId) ?? null,
        [pendientesLista, selectedMovementId]
    );

    // Sugerencias
    const sugerenciaFactura = useMemo(() => {
        if (!selectedRow) return null;
        const nf = Array.isArray(facturas) ? facturas.filter((f) => !facturasNoId.has(f.id)) : [];
        return matchMovementToSeed(selectedRow, nf);
    }, [selectedRow, facturas, facturasNoId]);

    const sugerenciaSeed = useMemo(() => {
        if (!selectedRow) return null;
        const nc = Array.isArray(cotizaciones) ? cotizaciones.filter((c) => !cotizacionesNoId.has(c.id)) : [];
        return matchMovementToSeed(selectedRow, nc);
    }, [selectedRow, cotizaciones, cotizacionesNoId]);

    useEffect(() => {
        if (selectedRow) {
            if (sugerenciaFactura && !sugerenciaSeed) setDocSeleccionado('factura');
            else if (!sugerenciaFactura && sugerenciaSeed) setDocSeleccionado('cotizacion');
        }
    }, [selectedRow, sugerenciaFactura, sugerenciaSeed]);

    // Documentos sin conciliar
    const noConciliadas = useMemo(() => {
        const result = [];
        if (Array.isArray(facturas)) {
            result.push(...facturas.filter(f => !facturasNoId.has(f.id)).map(f => ({ ...f, _type: 'factura' })));
        }
        if (Array.isArray(cotizaciones)) {
            result.push(...cotizaciones.filter(c => !cotizacionesNoId.has(c.id)).map(c => ({ ...c, _type: 'cotizacion' })));
        }
        return result.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    }, [facturas, cotizaciones, facturasNoId, cotizacionesNoId]);

    // Sugerencias para detalle modal
    const detalleFactura = useMemo(() => {
        if (!detalleRow) return null;
        const nf = Array.isArray(facturas) ? facturas.filter((f) => !facturasNoId.has(f.id)) : [];
        return matchMovementToSeed(detalleRow, nf);
    }, [detalleRow, facturas, facturasNoId]);

    const detalleSeed = useMemo(() => {
        if (!detalleRow) return null;
        const nc = Array.isArray(cotizaciones) ? cotizaciones.filter((c) => !cotizacionesNoId.has(c.id)) : [];
        return matchMovementToSeed(detalleRow, nc);
    }, [detalleRow, cotizaciones, cotizacionesNoId]);

    // Handlers
    const handleSelectRow = useCallback((row) => {
        setSelectedMovementId(row.id);
        setFlowStep(2);
    }, []);

    const handleConciliar = useCallback(async () => {
        const record = selectedRow;
        if (!record?.id) return;

        let selectedDoc = docSeleccionado === 'factura' ? sugerenciaFactura : sugerenciaSeed;
        if (!selectedDoc) {
            message.warning(`No hay ${docSeleccionado} seleccionada.`);
            return;
        }

        setFlowStep(3);
        setConciliandoId(record.id);
        try {
            const seeds = docSeleccionado === 'factura' ? facturas : cotizaciones;
            const found = await reconcileMovementAgainstSeeds(record, seeds);
            if (found) {
                const payload = { movement: record, document_type: docSeleccionado };
                if (docSeleccionado === 'factura') payload.factura = selectedDoc;
                else payload.cotizacion = selectedDoc;
                await conciliationApi.saveConciliacion(payload);
                setCotizacionManualPorMovimientoId(p => ({ ...p, [record.id]: found }));
                setFlashMatch(true);
                setTimeout(() => setFlashMatch(false), 700);
                message.success('Conciliación registrada');
                setSelectedMovementId(null);
                setFlowStep(1);
                setDocSeleccionado('factura');
                refetchHistorial();
            } else {
                message.warning('No se encontró coincidencia.');
                setFlowStep(2);
            }
        } catch (err) {
            message.error(err.response?.data?.message || err.message || 'Error al conciliar.');
            setFlowStep(2);
        } finally {
            setConciliandoId(null);
        }
    }, [selectedRow, docSeleccionado, sugerenciaFactura, sugerenciaSeed, facturas, cotizaciones]);

    const handleDesdeChange = useCallback((d) => {
        if (!d || !dateRange?.[1]) return;
        if (d.isAfter(dateRange[1], 'day')) {
            message.warning('La fecha Desde no puede ser posterior a Hasta.');
            return;
        }
        setDateRange([d, dateRange[1]]);
        setRange(d.format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'));
    }, [dateRange, setRange]);

    const handleHastaChange = useCallback((d) => {
        if (!d || !dateRange?.[0]) return;
        if (d.isBefore(dateRange[0], 'day')) {
            message.warning('La fecha Hasta no puede ser anterior a Desde.');
            return;
        }
        setDateRange([dateRange[0], d]);
        setRange(dateRange[0].format('YYYY-MM-DD'), d.format('YYYY-MM-DD'));
    }, [dateRange, setRange]);

    const handleOpenModalDetalle = useCallback(async (conciliacion) => {
        setModalConciliacion(conciliacion);
        setDetalleProductos(null);
        setLoadingDetalle(true);
        try {
            const docId = (conciliacion.document_type ?? 'cotizacion') === 'factura' ? conciliacion.factura_id : conciliacion.cotizacion_id;
            if (docId) {
                const res = await conciliationApi.getCotizacionDetalle(docId);
                setDetalleProductos(res.data?.success ? res.data.data : { error: 'No se pudieron cargar' });
            }
        } catch (err) {
            console.error('Error:', err);
            setDetalleProductos({ error: 'Error al cargar' });
        } finally {
            setLoadingDetalle(false);
        }
    }, []);

    const subheader = import.meta.env.VITE_CONCILIACIONES_HEADER_SUB?.trim?.() || '';
    const formatDateTime = (v) => !v ? '—' : new Date(v).toLocaleString('es-CL');
    const formatCot = (ymd) => !ymd ? '—' : new Date(`${ymd}T12:00:00`).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dash = (v) => v != null && String(v).trim() !== '' ? String(v).trim() : '—';

    const pendientesCount = pendientesLista.length;
    const conciliadasCount = conciliadasLista.length;
    const rightTitle = !selectedRow ? '— Selecciona una transferencia' : sugerenciaFactura || sugerenciaSeed ? `${(sugerenciaFactura ? 1 : 0) + (sugerenciaSeed ? 1 : 0)} coincidencia${sugerenciaFactura && sugerenciaSeed ? 's' : ''}` : '— Sin coincidencia';

    const detalle = detalleRow;
    const cotizacionRow = detalle?.cotizacion ?? null;
    const sourceAccount = detalle ? mergeMovementCounterparty(detalle.sender_account, detalle.recipient_account) : null;

    return (
        <PrivatePageShell>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-3xl font-extrabold text-[#370776]">Conciliaciones</h1>
                    {subheader && <p className="mt-1 max-w-2xl truncate text-sm text-gray-600">{subheader}</p>}
                </div>
                <span className="shrink-0 self-start rounded-full bg-[#EAF5EE] px-3 py-1 font-mono text-xs font-semibold text-[#1A6B3C] sm:mt-2">
                    {pendientesCount} pendientes
                </span>
            </div>

            <p className="mb-4 text-xs text-gray-600">
                Se cargan abonos de los últimos {DEFAULT_TRANSFER_LOOKBACK_DAYS} días (rango contable: {since} — {until}).
            </p>

            <div className="mb-5 flex gap-2 border-b border-[#E4E4DF]">
                {['pendientes', 'historial', 'no_conciliadas'].map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setMainTab(tab)}
                        className={`px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                            mainTab === tab ? 'border-[#1A6B3C] text-[#1A6B3C]' : 'border-transparent text-[#6B6B65] hover:text-[#1A1A18]'
                        }`}
                    >
                        {tab === 'pendientes' ? 'Pendientes' : tab === 'historial' ? 'Historial conciliado' : 'Sin Conciliar'}
                        {tab === 'pendientes' && pendientesCount > 0 && <span className="ml-2 bg-[#FEF3C7] text-[#B45309] rounded-full px-1.5 py-0.5 text-[10px] font-bold">{pendientesCount}</span>}
                        {tab === 'historial' && conciliaciones.length > 0 && <span className="ml-2 bg-[#DCFCE7] text-[#16A34A] rounded-full px-1.5 py-0.5 text-[10px] font-bold">{conciliaciones.length}</span>}
                        {tab === 'no_conciliadas' && noConciliadas.length > 0 && <span className="ml-2 bg-[#FEE2E2] text-[#DC2626] rounded-full px-1.5 py-0.5 text-[10px] font-bold">{noConciliadas.length}</span>}
                    </button>
                ))}
            </div>

            {mainTab === 'historial' && (
                <div className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                    <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                        <span className="text-[11.5px] font-bold uppercase text-[#1A1A18]">Transferencias conciliadas</span>
                        <span className="font-mono text-[11px] text-[#A8A8A2]">{conciliaciones.length} registros</span>
                    </div>
                    {loadingHistorial ? <div className="p-8 text-center text-sm text-[#6B6B65]">Cargando…</div> : conciliaciones.length === 0 ? <div className="p-10 text-center text-sm text-[#6B6B65]">Sin conciliaciones.</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[12px]">
                                <thead className="border-b border-[#E4E4DF] bg-[#FAFAF8] text-[10px] font-bold uppercase text-[#A8A8A2]">
                                    <tr>
                                        <th className="px-4 py-2">Fecha</th>
                                        <th className="px-4 py-2">Banco</th>
                                        <th className="px-4 py-2">Tipo</th>
                                        <th className="px-4 py-2">N° Doc</th>
                                        <th className="px-4 py-2">Cliente</th>
                                        <th className="px-4 py-2">RUT</th>
                                        <th className="px-4 py-2 text-right">Monto</th>
                                        <th className="px-4 py-2">Fecha</th>
                                        <th className="px-4 py-2 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {conciliaciones.map((c) => {
                                        const dt = c.document_type ?? 'cotizacion';
                                        const isF = dt === 'factura';
                                        return (
                                            <tr key={c._id} className="border-b border-[#E4E4DF] hover:bg-[#FAFAF8]">
                                                <td className="px-4 py-2.5 font-mono text-[#6B6B65]">{c.fecha_movimiento ?? '—'}</td>
                                                <td className="px-4 py-2.5 text-[#6B6B65]">{c.bank_name ?? '—'}</td>
                                                <td className="px-4 py-2.5"><span className="inline-flex rounded px-2 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: isF ? '#16A34A' : '#1D4ED8' }}>{isF ? 'FAC' : 'COT'}</span></td>
                                                <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: isF ? '#16A34A' : '#1D4ED8' }}>{isF ? c.factura_id : c.cotizacion_id ?? '—'}</td>
                                                <td className="px-4 py-2.5 text-[#1A1A18]">{c.cliente ?? '—'}</td>
                                                <td className="px-4 py-2.5 font-mono text-[#6B6B65]">{formatChileRutDisplay(c.rut)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono font-semibold">{typeof c.monto === 'number' ? formatCLP(c.monto) : '—'}</td>
                                                <td className="px-4 py-2.5 text-[#A8A8A2]">{c.createdAt ? new Date(c.createdAt).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <button type="button" onClick={() => setDetalleRow(c)} className="inline-flex items-center justify-center rounded px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[#1A6B3C] hover:bg-[#155630]">
                                                        <RightOutlined className="mr-1" />
                                                        Detalle
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {mainTab === 'no_conciliadas' && (
                <div className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                    <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                        <span className="text-[11.5px] font-bold uppercase text-[#1A1A18]">Sin conciliar</span>
                        <span className="font-mono text-[11px] text-[#A8A8A2]">{noConciliadas.length}</span>
                    </div>
                    {noConciliadas.length === 0 ? <div className="p-10 text-center text-sm text-[#6B6B65]">Todas conciliadas ✓</div> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-[12px]">
                                <thead className="border-b border-[#E4E4DF] bg-[#FAFAF8] text-[10px] font-bold uppercase text-[#A8A8A2]">
                                    <tr>
                                        <th className="px-4 py-2">Tipo</th>
                                        <th className="px-4 py-2">N° Doc</th>
                                        <th className="px-4 py-2">Fecha</th>
                                        <th className="px-4 py-2">Cliente</th>
                                        <th className="px-4 py-2">RUT</th>
                                        <th className="px-4 py-2 text-right">Monto</th>
                                        <th className="px-4 py-2 text-right">Días</th>
                                        <th className="px-4 py-2">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {noConciliadas.map((doc, idx) => {
                                        const dias = dayjs().diff(dayjs(doc.fecha), 'day');
                                        const isF = doc._type === 'factura';
                                        return (
                                            <tr key={`${doc._type}-${doc.id}-${idx}`} className="border-b border-[#E4E4DF] hover:bg-[#FAFAF8]">
                                                <td className="px-4 py-2.5"><span className="inline-flex rounded px-2 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: isF ? '#16A34A' : '#1D4ED8' }}>{isF ? 'FAC' : 'COT'}</span></td>
                                                <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: isF ? '#16A34A' : '#1D4ED8' }}>{doc.id}</td>
                                                <td className="px-4 py-2.5 font-mono text-[#6B6B65]">{doc.fecha ?? '—'}</td>
                                                <td className="px-4 py-2.5">{doc.cliente ?? '—'}</td>
                                                <td className="px-4 py-2.5 font-mono text-[#6B6B65]">{formatChileRutDisplay(doc.rut)}</td>
                                                <td className="px-4 py-2.5 text-right font-mono font-semibold">{typeof doc.monto === 'number' ? formatCLP(doc.monto) : '—'}</td>
                                                <td className="px-4 py-2.5 text-right font-mono text-[#6B6B65]">{dias}</td>
                                                <td className="px-4 py-2.5"><span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: dias > 30 ? '#EA580C' : '#DC2626' }}>{dias > 30 ? 'Vencida' : 'Sin pago'}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {mainTab === 'pendientes' && (
                <>
                    <div className="mb-2 text-[10px] font-bold uppercase text-[#A8A8A2]">Banco</div>
                    <div className="mb-4 flex flex-wrap gap-2">
                        {cuentaTabs.map((tab) => (
                            <button key={tab.key} type="button" onClick={() => setSelectedCuentaTabKey(tab.key)} className={`flex max-w-[240px] flex-1 items-center gap-2.5 rounded-lg border px-4 py-2.5 text-left transition-colors sm:min-w-[180px] ${selectedCuentaTabKey === tab.key ? 'border-[#1A6B3C] bg-[#EAF5EE]' : 'border-[#CDCDC7] hover:border-[#1A6B3C]'}`}>
                                <BankOutlined className={selectedCuentaTabKey === tab.key ? 'text-[#1A6B3C]' : 'text-[#6B6B65]'} />
                                <div className="min-w-0">
                                    <div className="truncate text-[12.5px] font-semibold">{tab.label}</div>
                                    <div className="text-[10px] text-[#A8A8A2]">{tab.subtitle}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <ConciliacionesFilters dateRange={dateRange} onDesdeChange={handleDesdeChange} onHastaChange={handleHastaChange} estadoFiltro={estadoFiltro} onEstadoFiltroChange={setEstadoFiltro} searchText={searchText} onSearchChange={setSearchText} minMonto={minMonto} maxMonto={maxMonto} onMinMontoChange={setMinMonto} onMaxMontoChange={setMaxMonto} bancoFiltro={bancoFiltro} onBancoFiltroChange={setBancoFiltro} bancoOptions={bancoOptions} onRefresh={refetch} loading={loading} />

                    <div className="mb-3.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase">
                        <span className={flowStep === 1 ? 'flex items-center gap-1.5 text-[#1A6B3C]' : 'text-[#A8A8A2]'}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            1 · Selecciona
                        </span>
                        <RightOutlined className="text-[#A8A8A2]" />
                        <span className={flowStep === 2 ? 'flex items-center gap-1.5 text-[#1A6B3C]' : 'text-[#A8A8A2]'}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            2 · Sugiere
                        </span>
                        <RightOutlined className="text-[#A8A8A2]" />
                        <span className={flowStep === 3 ? 'flex items-center gap-1.5 text-[#1A6B3C]' : 'text-[#A8A8A2]'}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                            3 · Concilia
                        </span>
                    </div>

                    <div className={`gap-0 ${isNarrow ? 'flex flex-col' : 'grid items-start grid-cols-[1fr_56px_1fr]'}`}>
                        <section className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                            <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                                <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase text-[#1A1A18]">
                                    <BankOutlined />
                                    Cartola
                                </span>
                                <span className="font-mono text-[11px] text-[#A8A8A2]">{pendientesCount} pendientes</span>
                            </div>
                            <div className="max-h-[min(52vh,560px)] overflow-y-auto">
                                {loading && !pendientesLista.length ? <div className="p-8 text-center text-sm text-[#6B6B65]">Cargando…</div> : pendientesLista.length === 0 ? <div className="p-10 text-center text-sm text-[#6B6B65]">Sin transferencias.</div> : pendientesLista.map((row) => (
                                    <button key={row.id} type="button" onClick={() => handleSelectRow(row)} className={`flex w-full items-center gap-3 border-b border-[#E4E4DF] px-4 py-3 text-left transition-colors border-l-[3px] ${selectedMovementId === row.id ? 'border-l-[#1A6B3C] bg-[#EAF5EE]' : 'border-l-transparent hover:bg-[#F5F5F2]'}`}>
                                        <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${selectedMovementId === row.id ? 'bg-[#1A6B3C] text-white' : 'bg-[#E4E4DF] text-[#6B6B65]'}`}>
                                            {initialsFromName(row.counterpartyName)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[12.5px] font-semibold text-[#1A1A18]">{row.counterpartyName || '—'}</div>
                                            <div className="mt-0.5 font-mono text-[10.5px] text-[#6B6B65]">{formatChileRutDisplay(row.counterpartyRut)}</div>
                                            <div className="mt-0.5 font-mono text-[10px] text-[#A8A8A2]">{formatContable(row.post_date)}</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="font-mono text-[13px] font-semibold text-[#1A1A18]">{typeof row.amount === 'number' ? formatCLP(row.amount) : '—'}</div>
                                            <div className="mt-0.5">{getMovementTypeTag(row.type)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <div className={`flex flex-col items-center justify-start px-1 ${isNarrow ? 'hidden' : 'flex pt-16'}`}>
                            <div className={`w-0.5 rounded-sm bg-gradient-to-b from-[#1A6B3C] to-[#6EE7A0] transition-all duration-300 ${selectedRow ? 'h-12' : 'h-0'}`} />
                            <span className={`mt-1 text-lg font-bold text-[#1A6B3C] transition-opacity ${selectedRow ? 'opacity-100' : 'opacity-0'}`}>→</span>
                        </div>

                        <section className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                            <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                                <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase text-[#1A1A18]">
                                    <FileTextOutlined />
                                    Documentos
                                </span>
                                <span className="font-mono text-[11px] text-[#A8A8A2]">{rightTitle}</span>
                            </div>

                            <div className="min-h-[min(52vh,560px)] overflow-y-auto p-4">
                                {!selectedRow ? <div className="flex flex-col items-center px-6 py-14 text-center text-[#A8A8A2]"><FileTextOutlined className="mb-3.5 text-[52px] opacity-25" /><p className="text-[12.5px]">Selecciona una transferencia.</p></div> : sugerenciaFactura || sugerenciaSeed ? (
                                    <div className="space-y-4">
                                        {sugerenciaFactura && (
                                            <div className="rounded-lg border border-[#86EFAC] border-l-[3px] border-l-[#16A34A] bg-[#F0FDF4] p-4">
                                                <div className="flex items-start gap-3">
                                                    <input type="radio" id="doc-factura" name="doc-selection" value="factura" checked={docSeleccionado === 'factura'} onChange={(e) => setDocSeleccionado(e.target.value)} className="mt-1 cursor-pointer" />
                                                    <label htmlFor="doc-factura" className="flex-1 cursor-pointer">
                                                        <div className="mb-1.5 inline-block rounded border border-[#86EFAC] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#16A34A]">FAC {sugerenciaFactura.id}</div>
                                                        <div className="text-[13px] font-semibold text-[#1A1A18]">{sugerenciaFactura.cliente || '—'}</div>
                                                        <div className="mt-0.5 font-mono text-[10.5px] text-[#6B6B65]">{formatChileRutDisplay(sugerenciaFactura.rut)}</div>
                                                        <div className="mt-1 text-[10.5px] text-[#A8A8A2]">Emitida {formatCot(sugerenciaFactura.fecha)}</div>
                                                        <div className="mt-2 text-right">
                                                            <div className="font-mono text-lg font-bold text-[#16A34A]">{typeof sugerenciaFactura.monto === 'number' ? formatCLP(sugerenciaFactura.monto) : '—'}</div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        {sugerenciaSeed && (
                                            <div className="rounded-lg border border-[#BFDBFE] border-l-[3px] border-l-[#1D4ED8] bg-[#EFF6FF] p-4">
                                                <div className="flex items-start gap-3">
                                                    <input type="radio" id="doc-cotizacion" name="doc-selection" value="cotizacion" checked={docSeleccionado === 'cotizacion'} onChange={(e) => setDocSeleccionado(e.target.value)} className="mt-1 cursor-pointer" />
                                                    <label htmlFor="doc-cotizacion" className="flex-1 cursor-pointer">
                                                        <div className="mb-1.5 inline-block rounded border border-[#BFDBFE] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#1D4ED8]">COT {sugerenciaSeed.id}</div>
                                                        <div className="text-[13px] font-semibold text-[#1A1A18]">{sugerenciaSeed.cliente || '—'}</div>
                                                        <div className="mt-0.5 font-mono text-[10.5px] text-[#6B6B65]">{formatChileRutDisplay(sugerenciaSeed.rut)}</div>
                                                        <div className="mt-1 text-[10.5px] text-[#A8A8A2]">Emitida {formatCot(sugerenciaSeed.fecha)}</div>
                                                        <div className="mt-2 text-right">
                                                            <div className="font-mono text-lg font-bold text-[#1D4ED8]">{typeof sugerenciaSeed.monto === 'number' ? formatCLP(sugerenciaSeed.monto) : '—'}</div>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <Button type="primary" className="h-10 flex-1 border-none bg-[#1A6B3C] font-bold" icon={<CheckCircleOutlined />} loading={conciliandoId === selectedRow.id} disabled={conciliandoId !== null && conciliandoId !== selectedRow.id} onClick={handleConciliar}>
                                                Conciliar
                                            </Button>
                                            <Button onClick={() => setDetalleRow(selectedRow)}>Ver detalle</Button>
                                        </div>
                                    </div>
                                ) : <div className="flex flex-col items-center px-6 py-14 text-center text-[#A8A8A2]"><FileTextOutlined className="mb-3.5 text-[52px] opacity-25" /><p className="text-[12.5px]">Sin documentos encontrados.</p></div>}
                            </div>
                        </section>
                    </div>
                </>
            )}

            <Modal title={detalle ? `Transferencia${detalle.id ? ` · ${detalle.id}` : ''}` : 'Detalle'} open={!!detalle} onCancel={() => setDetalleRow(null)} footer={null} width={880} styles={{ body: { paddingTop: 12 } }}>
                {detalle && (
                    <Row gutter={[24, 24]}>
                        <Col xs={24} md={12}>
                            <h3 className="mb-3 border-b border-[#1A6B3C]/20 pb-2 text-sm font-bold text-[#1A6B3C]">Banco</h3>
                            <Descriptions size="small" column={1} bordered>
                                <Descriptions.Item label="ID">{dash(detalle.id)}</Descriptions.Item>
                                <Descriptions.Item label="Monto">{typeof detalle.amount === 'number' ? `${formatCLP(detalle.amount)} ${detalle.currency || ''}`.trim() : '—'}</Descriptions.Item>
                                <Descriptions.Item label="Fecha contable">{formatDateTime(detalle.post_date)}</Descriptions.Item>
                                <Descriptions.Item label="Tipo">{detalle.type || '—'}</Descriptions.Item>
                            </Descriptions>
                        </Col>
                        <Col xs={24} md={12} className="md:border-l md:border-[#1A6B3C]/15 md:pl-6">
                            <h3 className="mb-3 border-b border-[#1A6B3C]/20 pb-2 text-sm font-bold text-[#1A6B3C]">Documento</h3>
                            {cotizacionRow ? (
                                <Descriptions size="small" column={1} bordered>
                                    <Descriptions.Item label="ID">{dash(cotizacionRow.id)}</Descriptions.Item>
                                    <Descriptions.Item label="Cliente">{dash(cotizacionRow.cliente)}</Descriptions.Item>
                                    <Descriptions.Item label="Monto">{typeof cotizacionRow.monto === 'number' ? formatCLP(cotizacionRow.monto) : '—'}</Descriptions.Item>
                                </Descriptions>
                            ) : detalleFactura || detalleSeed ? (
                                <div className="space-y-3">
                                    {detalleFactura && (
                                        <div className="rounded-lg border border-[#86EFAC] bg-[#F0FDF4] p-3">
                                            <div className="mb-2 inline-block rounded border border-[#86EFAC] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#16A34A]">FAC {detalleFactura.id}</div>
                                            <div className="text-sm font-semibold text-[#1A1A18]">{detalleFactura.cliente || '—'}</div>
                                            <div className="mt-1 font-mono text-[11px] text-[#6B6B65]">{formatChileRutDisplay(detalleFactura.rut)}</div>
                                            <div className="mt-1 font-mono text-sm font-bold text-[#16A34A]">{typeof detalleFactura.monto === 'number' ? formatCLP(detalleFactura.monto) : '—'}</div>
                                        </div>
                                    )}
                                    {detalleSeed && (
                                        <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                                            <div className="mb-2 inline-block rounded border border-[#BFDBFE] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#1D4ED8]">COT {detalleSeed.id}</div>
                                            <div className="text-sm font-semibold text-[#1A1A18]">{detalleSeed.cliente || '—'}</div>
                                            <div className="mt-1 font-mono text-[11px] text-[#6B6B65]">{formatChileRutDisplay(detalleSeed.rut)}</div>
                                            <div className="mt-1 font-mono text-sm font-bold text-[#1D4ED8]">{typeof detalleSeed.monto === 'number' ? formatCLP(detalleSeed.monto) : '—'}</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-[#A8A8A2]">Sin información</p>
                            )}
                        </Col>
                    </Row>
                )}
            </Modal>
        </PrivatePageShell>
    );
}
