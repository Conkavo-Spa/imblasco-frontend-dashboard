import React, { useMemo, useState, useCallback, useEffect } from 'react';
import PrivatePageShell from '../../../components/PrivatePageShell';
import { Modal, Descriptions, Row, Col, message, Button } from 'antd';
import {
    FileTextOutlined,
    BankOutlined,
    CheckCircleOutlined,
    RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMediaQuery } from 'react-responsive';
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
import { formatCLP } from '../../../utils/formatCLP';
import { formatChileRutDisplay } from '../../../lib/conciliation/formatChileRutDisplay';
import ConciliacionesFilters from './ConciliacionesFilters';
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
    const [cotizacionManualPorMovimientoId, setCotizacionManualPorMovimientoId] =
        useState({});
    const [conciliandoId, setConciliandoId] = useState(null);

    const isNarrow = useMediaQuery({ maxWidth: 1100 });

    const enrichedRows = useMemo(() => {
        return movements.map((m) => {
            const porSeed = matchMovementToSeed(m, COTIZACIONES_SEED);
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
    }, [movements, cotizacionManualPorMovimientoId]);

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

    const sugerenciaSeed = useMemo(() => {
        if (!selectedRow) return null;
        return matchMovementToSeed(selectedRow, COTIZACIONES_SEED);
    }, [selectedRow]);

    const handleSelectRow = useCallback((row) => {
        setSelectedMovementId(row.id);
        setFlowStep(2);
    }, []);

    const handleConciliar = useCallback(async () => {
        const record = selectedRow;
        const mid = record?.id;
        if (!mid || !record) return;
        setFlowStep(3);
        setConciliandoId(mid);
        try {
            const found = await reconcileMovementAgainstSeeds(record, COTIZACIONES_SEED);
            if (found) {
                setCotizacionManualPorMovimientoId((prev) => ({
                    ...prev,
                    [mid]: found,
                }));
                setFlashMatch(true);
                window.setTimeout(() => setFlashMatch(false), 700);
                message.success('Conciliación registrada correctamente');
                setSelectedMovementId(null);
                setFlowStep(1);
            } else {
                message.warning(
                    'No se encontró cotización que cierre con este movimiento en Fintoc.'
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
    }, [selectedRow]);

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
        : sugerenciaSeed
          ? '1 coincidencia encontrada'
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
                        contable y monto del catálogo; al conciliar se valida contra Fintoc.
                    </p>

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
                            2 · Agente sugiere factura
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
                                                <div className="mt-0.5 text-[10px] text-[#A8A8A2]">
                                                    {row.type || 'Transferencia'}
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

                        {/* Factura sugerida */}
                        <section className="overflow-hidden rounded-lg border border-[#E4E4DF] bg-white">
                            <div className="flex items-center justify-between border-b border-[#E4E4DF] bg-[#FAFAF8] px-4 py-3">
                                <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[#1A1A18]">
                                    <FileTextOutlined />
                                    Factura sugerida
                                </span>
                                <span className="max-w-[55%] truncate text-right font-mono text-[11px] text-[#A8A8A2]">
                                    {rightTitle}
                                </span>
                            </div>

                            <div className="min-h-[min(52vh,560px)] p-4">
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

                                {selectedRow && sugerenciaSeed ? (
                                    <div
                                        className={[
                                            'rounded-lg border border-[#BFDBFE] border-l-[3px] border-l-[#1D4ED8] bg-[#EFF6FF] p-4 transition-colors',
                                            flashMatch ? '!border-[#22C55E] !bg-[#DCFCE7]' : '',
                                        ].join(' ')}
                                    >
                                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="mb-1.5 inline-block rounded border border-[#BFDBFE] bg-white px-2 py-0.5 font-mono text-xs font-bold text-[#1D4ED8]">
                                                    {sugerenciaSeed.id}
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
                                                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FEF3C7] px-2 py-0.5 text-[10.5px] font-semibold text-[#B45309]">
                                                    <span
                                                        className="inline-block h-[5px] w-[5px] rounded-full bg-current"
                                                        aria-hidden
                                                    />
                                                    Pendiente pago
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono text-lg font-bold text-[#1D4ED8]">
                                                    {typeof sugerenciaSeed.monto === 'number'
                                                        ? formatCLP(sugerenciaSeed.monto)
                                                        : '—'}
                                                </div>
                                                <div className="mt-0.5 text-[10px] text-[#A8A8A2]">
                                                    Total factura
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 border-t border-[#BFDBFE] pt-2.5">
                                            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#A8A8A2]">
                                                Ítems
                                            </div>
                                            <div className="space-y-0">
                                                {(sugerenciaSeed.lineItems?.length
                                                    ? sugerenciaSeed.lineItems
                                                    : [
                                                          {
                                                              label:
                                                                  sugerenciaSeed.descripcion ||
                                                                  'Concepto',
                                                              monto: sugerenciaSeed.monto,
                                                          },
                                                      ]
                                                ).map((item, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex justify-between gap-3 border-b border-[#E4E4DF] py-1 text-[11.5px] text-[#6B6B65] last:border-b-0"
                                                    >
                                                        <span className="min-w-0 flex-1 truncate">
                                                            {item.label}
                                                        </span>
                                                        <span className="shrink-0 font-mono font-medium text-[#1A1A18]">
                                                            {typeof item.monto === 'number'
                                                                ? formatCLP(item.monto)
                                                                : '—'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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

                                {selectedRow && !sugerenciaSeed ? (
                                    <div className="flex flex-col items-center px-6 py-14 text-center text-[#A8A8A2]">
                                        <FileTextOutlined
                                            className="mb-3.5 text-[52px] opacity-25"
                                        />
                                        <p className="max-w-sm text-[12.5px] leading-relaxed">
                                            <strong className="text-[#6B6B65]">
                                                Sin factura encontrada
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
        </PrivatePageShell>
    );
}
