import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Table, Input, Button, Drawer, Tag, Spin, Badge, Tabs, Empty, Collapse, Modal, message, Pagination, Tooltip, Upload } from 'antd';
import { ShoppingOutlined, CloseOutlined, DeleteOutlined, WarningOutlined, HistoryOutlined, DownloadOutlined, CheckCircleOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import Sidebar from '../../components/Sidebar';
import { useCompras } from '../../hooks/useCompras';
import { usePedidos, useEmbarcados, useConfirmados } from '../../hooks/usePedidos';
import comprasApi from '../../services/compras.service';
import pedidosApi from '../../services/pedidos.service';

const { Search } = Input;

// ── Utilidad de exportación Excel (reutilizable) ──────────────────────────────

async function exportarExcel(productos, fecha) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Pedido');

    const header = ws.addRow(['CODPRO', 'Fecha pedido', 'Producto', 'Cantidad']);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9E0FA' } };

    productos.forEach(p => {
        const row = ws.addRow([p.cod, fecha, p.nombre, p.cantidad]);
        const estado = p.estado ?? (p.enDisputa ? 'enDisputa' : 'pendiente');
        if (estado === 'enDisputa') {
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        }
    });

    ws.columns.forEach(col => {
        let maxLen = 10;
        col.eachCell({ includeEmpty: true }, cell => {
            const len = cell.value ? String(cell.value).length : 0;
            if (len > maxLen) maxLen = len;
        });
        col.width = maxLen + 2;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedido_${fecha}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Config de estados por producto ───────────────────────────────────────────

const ESTADOS = {
    pendiente:  { label: 'Pendiente',  bg: 'bg-gray-50',   border: 'border-gray-200',  text: 'text-gray-400'  },
    enDisputa:  { label: 'En disputa', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-600' },
    confirmado: { label: 'X Embarcar', bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-600'  },
    embarcado:  { label: 'Embarcado',  bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-600'   },
};

// ── Historial Tab ─────────────────────────────────────────────────────────────

const FILTROS_ESTADO = [
    { key: 'todos',      label: 'Todos' },
    { key: 'enDisputa',  label: 'En disputa',  color: 'text-yellow-600' },
    { key: 'confirmado', label: 'Confirmados',  color: 'text-green-600'  },
    { key: 'embarcado',  label: 'Embarcados',   color: 'text-blue-600'   },
];

function HistorialTab({ pedidos, loading, refetch, onEmbarcadoChange }) {
    const [guardando, setGuardando] = useState(null);
    const [eliminando, setEliminando] = useState(null);
    const [exportando, setExportando] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [paginaActual, setPaginaActual] = useState(1);
    const PEDIDOS_POR_PAGINA = 10;

    const pedidosFiltrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        let filtrados = !q ? pedidos : pedidos.filter(p =>
            p.productos.some(x =>
                x.nombre.toLowerCase().includes(q) || x.cod.toLowerCase().includes(q)
            ) || new Date(p.createdAt ?? p.fecha).toLocaleDateString('es-CL').includes(q)
        );
        if (filtroEstado !== 'todos') {
            filtrados = filtrados.filter(p =>
                p.productos.some(x => (x.estado ?? 'pendiente') === filtroEstado)
            );
        }
        return filtrados;
    }, [pedidos, busqueda, filtroEstado]);

    const pedidosPaginados = useMemo(() => {
        const inicio = (paginaActual - 1) * PEDIDOS_POR_PAGINA;
        return pedidosFiltrados.slice(inicio, inicio + PEDIDOS_POR_PAGINA);
    }, [pedidosFiltrados, paginaActual]);

    const cambiarEstado = async (pedido, cod, nuevoEstado) => {
        const actualizados = pedido.productos.map(p => {
            if (p.cod !== cod) return p;
            const actual = p.estado ?? 'pendiente';
            // Si el botón ya está activo, vuelve a pendiente (toggle)
            return { ...p, estado: actual === nuevoEstado ? 'pendiente' : nuevoEstado };
        });
        setGuardando(pedido._id + cod);
        try {
            await pedidosApi.actualizarProductos(pedido._id, actualizados);
            await refetch();
            onEmbarcadoChange?.();
        } catch {
            message.error('No se pudo actualizar el estado.');
        } finally {
            setGuardando(null);
        }
    };

    const handleEliminar = (pedido) => {
        Modal.confirm({
            title: 'Eliminar pedido',
            content: `¿Eliminar el pedido del ${new Date(pedido.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}? Esta acción no se puede deshacer.`,
            okText: 'Eliminar',
            okButtonProps: { danger: true },
            cancelText: 'Cancelar',
            onOk: async () => {
                setEliminando(pedido._id);
                try {
                    await pedidosApi.eliminar(pedido._id);
                    refetch();
                    message.success('Pedido eliminado.');
                } catch {
                    message.error('No se pudo eliminar el pedido.');
                } finally {
                    setEliminando(null);
                }
            },
        });
    };

    const handleReexportar = async (pedido) => {
        const fecha = new Date(pedido.fecha).toISOString().split('T')[0];
        setExportando(pedido._id);
        try {
            const res = await pedidosApi.getById(pedido._id);
            const fresco = res?.data ?? pedido;
            await exportarExcel(fresco.productos, fecha);
        } catch {
            message.error('Error al exportar el pedido.');
        } finally {
            setExportando(null);
        }
    };

    if (loading) return <div className="flex justify-center py-16"><Spin /></div>;

    return (
        <div className="flex flex-col gap-4 pb-5">
            {/* Buscador historial */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4 flex-wrap">
                <Search
                    placeholder="Buscar por producto, código o fecha..."
                    allowClear
                    style={{ flex: 1, minWidth: 220, maxWidth: 400 }}
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setPaginaActual(1); }}
                />
                <div className="flex items-center gap-2 flex-wrap">
                    {FILTROS_ESTADO.map(f => {
                        const active = filtroEstado === f.key;
                        return (
                            <button
                                key={f.key}
                                onClick={() => { setFiltroEstado(f.key); setPaginaActual(1); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                                    ${active
                                        ? 'bg-[#370776] !text-white border-[#370776]'
                                        : `bg-white border-gray-200 hover:border-[#370776] hover:text-[#370776] ${f.color ?? 'text-gray-500'}`
                                    }`}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>
                <span className="ml-auto text-sm font-semibold text-[#121027] shrink-0">
                    {pedidosFiltrados.length} pedido{pedidosFiltrados.length !== 1 ? 's' : ''}
                </span>
            </div>

            {pedidosFiltrados.length === 0 ? (
                <Empty description={pedidos.length === 0 ? 'No hay pedidos guardados aún.' : 'Sin resultados.'} className="py-16" />
            ) : (
                <>
                <Collapse
                    expandIconPosition="end"
                    className="bg-transparent"
                    style={{ border: 'none' }}
                    items={pedidosPaginados.map(p => {
                        const tieneDisputa   = p.productos.some(x => (x.estado ?? 'pendiente') === 'enDisputa');
                        const tieneConfirm   = p.productos.some(x => (x.estado ?? 'pendiente') === 'confirmado');
                        const tieneEmbarcado = p.productos.some(x => (x.estado ?? 'pendiente') === 'embarcado');
                        return {
                            key: p._id,
                            label: (
                                <div className="flex items-center gap-3 w-full min-w-0">
                                    <span className="font-semibold text-[#121027] shrink-0">
                                        {new Date(p.createdAt ?? p.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </span>
                                    <span className="text-xs text-gray-400 shrink-0">
                                        {new Date(p.createdAt ?? p.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {p.productos.length} productos · {p.totalUnidades.toLocaleString('es-CL')} uds.
                                    </span>
                                    {tieneDisputa   && <Tag color="warning">En disputa</Tag>}
                                    {tieneConfirm   && <Tag color="success">Confirmado</Tag>}
                                    {tieneEmbarcado && <Tag color="processing">Embarcado</Tag>}
                                    <div className="ml-auto flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                        <Button
                                            size="small"
                                            icon={<DownloadOutlined />}
                                            loading={exportando === p._id}
                                            onClick={() => handleReexportar(p)}
                                        >
                                            Exportar
                                        </Button>
                                        <Button
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            loading={eliminando === p._id}
                                            onClick={() => handleEliminar(p)}
                                        />
                                    </div>
                                </div>
                            ),
                            children: (
                                <div className="flex flex-col gap-2">
                                    {p.productos.map(prod => {
                                        const estado = prod.estado ?? 'pendiente';
                                        const cfg = ESTADOS[estado] ?? ESTADOS.pendiente;
                                        const busy = guardando === p._id + prod.cod;
                                        const btn = (key, icon, title, color) => {
                                            const active = estado === key;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => cambiarEstado(p, prod.cod, key)}
                                                    disabled={busy}
                                                    title={title}
                                                    className={`shrink-0 rounded-md p-1.5 transition-colors text-base leading-none
                                                        ${active ? color.active : color.idle}
                                                        disabled:opacity-40`}
                                                >
                                                    {icon}
                                                </button>
                                            );
                                        };
                                        return (
                                            <div
                                                key={prod.cod}
                                                className={`flex items-center gap-3 rounded-lg px-4 py-3 border transition-colors ${cfg.bg} ${cfg.border}`}
                                            >
                                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                                    <span className="text-xs text-gray-400 font-semibold">{prod.cod}</span>
                                                    <span className="text-sm text-[#121027] font-medium leading-tight">{prod.nombre}</span>
                                                    <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                                                </div>
                                                <span className="text-lg font-extrabold text-[#370776] shrink-0">
                                                    {prod.cantidad.toLocaleString('es-CL')}
                                                </span>
                                                <div className="flex gap-1 shrink-0">
                                                    {btn('enDisputa',  <WarningOutlined />,      'En disputa',
                                                        { active: 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200', idle: 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50' })}
                                                    {btn('confirmado', <CheckCircleOutlined />,  'X Embarcar (confirmado)',
                                                        { active: 'text-green-500 bg-green-100 hover:bg-green-200', idle: 'text-gray-300 hover:text-green-500 hover:bg-green-50' })}
                                                    {btn('embarcado',  <span title="Embarcado">🚢</span>, 'Embarcado',
                                                        { active: 'text-blue-500 bg-blue-100 hover:bg-blue-200', idle: 'text-gray-300 hover:text-blue-500 hover:bg-blue-50' })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ),
                        };
                    })}
                />
                {pedidosFiltrados.length > PEDIDOS_POR_PAGINA && (
                    <div className="flex justify-center pt-2">
                        <Pagination
                            current={paginaActual}
                            pageSize={PEDIDOS_POR_PAGINA}
                            total={pedidosFiltrados.length}
                            onChange={setPaginaActual}
                            showSizeChanger={false}
                            size="small"
                        />
                    </div>
                )}
                </>
            )}
        </div>
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtN(n) {
    return (n ?? 0).toLocaleString('es-CL');
}

function getCategoria(cod) {
    const pre = String(cod ?? '').trim().substring(0, 3);
    if (['591', '599'].includes(pre)) return 'trofeos';
    if (['601', '602', '603'].includes(pre)) return 'publicitarios';
    if (['501', '502', '560', '582', '586', '999'].includes(pre)) return 'pesca';
    if (pre === '701') return 'timbres';
    return 'otros';
}

const CATEGORIAS = [
    { key: 'todos',         label: 'Todos' },
    { key: 'trofeos',       label: 'Trofeos y Premios' },
    { key: 'publicitarios', label: 'Artículos Publicitarios' },
    { key: 'pesca',         label: 'Pesca' },
    { key: 'timbres',       label: 'Timbres Automáticos' },
    { key: 'otros',         label: 'Otros' },
];


const CY = new Date().getFullYear();

// ── Embarques Tab ─────────────────────────────────────────────────────────────

const { Dragger } = Upload;

function fmtFechaEmb(d) {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function EmbarquesTab() {
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [nombreArchivo, setNombreArchivo] = useState('');
    const [vistaActiva, setVistaActiva] = useState('embarcado');
    const [busquedaEmb, setBusquedaEmb] = useState('');
    const [busquedaPE, setBusquedaPE] = useState('');
    const [busquedaParc, setBusquedaParc] = useState('');

    const handleFile = useCallback((file) => {
        setCargando(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const wb = new ExcelJS.Workbook();
                await wb.xlsx.load(e.target.result);

                const embSheet = wb.worksheets.find(ws => ws.name.toLowerCase() === 'embarcado');
                const peSheet  = wb.worksheets.find(ws => ws.name.toLowerCase().replace(/\s/g, '') === 'porembarcar');

                const parseSheet = (sheet) => {
                    if (!sheet) return [];
                    const rows = [];
                    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                        if (rowNumber === 1) return;
                        const v = row.values;
                        rows.push([v[1], v[2], v[3], v[4], v[5], v[6], v[7]]);
                    });
                    return rows;
                };

                const toDate = (v) => (v instanceof Date ? v : null);

                const embRows = parseSheet(embSheet);
                const peRows  = parseSheet(peSheet);

                const embarcado = embRows.map(r => ({
                    codigo:        r[0],
                    fechaPedido:   toDate(r[1]),
                    descripcion:   String(r[2] || '').trim(),
                    pedido:        Number(r[3]) || 0,
                    fechaEmbarque: toDate(r[4]),
                    factura:       String(r[5] || 'Sin factura').trim(),
                    embarcado:     Number(r[6]) || 0,
                })).filter(r => r.codigo && r.descripcion);

                const porEmbarcar = peRows.map(r => ({
                    codigo:      r[0],
                    fechaPedido: toDate(r[1]),
                    descripcion: String(r[2] || '').trim(),
                    pedido:      Number(r[3]) || 0,
                })).filter(r => r.codigo && r.descripcion);

                if (!embarcado.length && !porEmbarcar.length) {
                    message.error('El archivo no tiene hojas "embarcado" ni "Por Embarcar" con datos.');
                    setCargando(false);
                    return;
                }

                setDatos({ embarcado, porEmbarcar });
                setNombreArchivo(file.name);
                message.success(`${embarcado.length} embarcados · ${porEmbarcar.length} por embarcar`);
            } catch {
                message.error('No se pudo leer el archivo. Verifica el formato.');
            } finally {
                setCargando(false);
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    }, []);

    const gruposEmbarcado = useMemo(() => {
        if (!datos?.embarcado) return [];
        const map = {};
        datos.embarcado.forEach(item => {
            const key = item.factura;
            if (!map[key]) map[key] = { factura: key, fechaEmbarque: item.fechaEmbarque, items: [] };
            map[key].items.push(item);
        });
        return Object.values(map).sort((a, b) => {
            if (!a.fechaEmbarque) return 1;
            if (!b.fechaEmbarque) return -1;
            return b.fechaEmbarque - a.fechaEmbarque;
        });
    }, [datos]);

    const gruposFiltrados = useMemo(() => {
        const q = busquedaEmb.trim().toLowerCase();
        if (!q) return gruposEmbarcado;
        return gruposEmbarcado.map(g => ({
            ...g,
            items: g.items.filter(i =>
                i.descripcion.toLowerCase().includes(q) ||
                String(i.codigo).includes(q) ||
                g.factura.toLowerCase().includes(q)
            ),
        })).filter(g => g.items.length > 0);
    }, [gruposEmbarcado, busquedaEmb]);

    const porEmbarcarFiltrado = useMemo(() => {
        if (!datos?.porEmbarcar) return [];
        const q = busquedaPE.trim().toLowerCase();
        const hoy = Date.now();
        return datos.porEmbarcar
            .filter(i => !q || i.descripcion.toLowerCase().includes(q) || String(i.codigo).includes(q))
            .map(i => ({
                ...i,
                diasEspera: i.fechaPedido ? Math.round((hoy - i.fechaPedido) / 86400000) : 0,
            }))
            .sort((a, b) => b.diasEspera - a.diasEspera);
    }, [datos, busquedaPE]);

    const parciales = useMemo(() => {
        if (!datos?.embarcado || !datos?.porEmbarcar) return [];
        const historial = {};
        datos.embarcado.forEach(item => {
            const cod = String(item.codigo).trim();
            if (!historial[cod]) historial[cod] = { totalRecibido: 0, ultimoEmbarque: null, nEnvios: 0 };
            historial[cod].totalRecibido += (item.embarcado || item.pedido || 0);
            historial[cod].nEnvios++;
            if (item.fechaEmbarque && (!historial[cod].ultimoEmbarque || item.fechaEmbarque > historial[cod].ultimoEmbarque)) {
                historial[cod].ultimoEmbarque = item.fechaEmbarque;
            }
        });
        const hoy = Date.now();
        return datos.porEmbarcar
            .filter(item => historial[String(item.codigo).trim()])
            .map(item => {
                const h = historial[String(item.codigo).trim()];
                return {
                    ...item,
                    totalRecibido: h.totalRecibido,
                    ultimoEmbarque: h.ultimoEmbarque,
                    nEnvios: h.nEnvios,
                    diasEspera: item.fechaPedido ? Math.round((hoy - item.fechaPedido) / 86400000) : 0,
                };
            })
            .sort((a, b) => b.diasEspera - a.diasEspera);
    }, [datos]);

    const parcialesFiltrados = useMemo(() => {
        const q = busquedaParc.trim().toLowerCase();
        if (!q) return parciales;
        return parciales.filter(i => i.descripcion.toLowerCase().includes(q) || String(i.codigo).includes(q));
    }, [parciales, busquedaParc]);

    if (!datos) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
                <Spin spinning={cargando}>
                    <div className="flex flex-col items-center gap-5 w-full max-w-lg">
                        <div className="w-16 h-16 rounded-2xl bg-[#f0ebff] flex items-center justify-center text-3xl select-none">🚢</div>
                        <div className="text-center">
                            <p className="text-base font-bold text-[#121027] mb-1">Seguimiento de embarques</p>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Sube el archivo de importaciones para ver el historial de envíos<br />
                                y los pedidos pendientes de embarque.
                            </p>
                        </div>
                        <Dragger
                            accept=".xls,.xlsx"
                            showUploadList={false}
                            beforeUpload={handleFile}
                            style={{ width: '100%', borderColor: '#370776', borderRadius: 12, background: '#faf8ff' }}
                        >
                            <div className="py-6 px-8 flex flex-col items-center gap-2">
                                <InboxOutlined style={{ color: '#370776', fontSize: 30 }} />
                                <p className="text-sm font-semibold text-[#121027]">Arrastra el archivo aquí</p>
                                <p className="text-xs text-gray-400">o haz click para seleccionar · .xls / .xlsx</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-[#f0ebff] text-[#370776] text-xs font-mono font-semibold">embarcado</span>
                                    <span className="text-gray-300 text-xs">+</span>
                                    <span className="px-2 py-0.5 rounded bg-[#f0ebff] text-[#370776] text-xs font-mono font-semibold">Por Embarcar</span>
                                </div>
                            </div>
                        </Dragger>
                    </div>
                </Spin>
            </div>
        );
    }

    const totalEnvios = gruposEmbarcado.length;
    const totalUdsEmb = datos.embarcado.reduce((s, i) => s + (i.embarcado || i.pedido || 0), 0);
    const totalUdsPE  = datos.porEmbarcar.reduce((s, i) => s + i.pedido, 0);
    const hoyTs       = Date.now();
    const maxEspera   = datos.porEmbarcar.reduce((mx, i) => {
        const d = i.fechaPedido ? Math.round((hoyTs - i.fechaPedido) / 86400000) : 0;
        return d > mx ? d : mx;
    }, 0);

    return (
        <div className="flex flex-col gap-4 pb-5">
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-400">Archivo:</span>
                <span className="text-sm font-semibold text-[#370776] truncate max-w-xs">{nombreArchivo}</span>
                <Upload accept=".xls,.xlsx" showUploadList={false} beforeUpload={handleFile}>
                    <Button size="small">Cambiar archivo</Button>
                </Upload>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                    <p className="text-xs text-gray-400 mb-1">Envíos recibidos</p>
                    <p className="text-2xl font-extrabold text-[#370776] leading-none">{totalEnvios}</p>
                    <p className="text-xs text-gray-400 mt-1">{datos.embarcado.length} productos · {fmtN(totalUdsEmb)} uds.</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                    <p className="text-xs text-gray-400 mb-1">Por embarcar</p>
                    <p className="text-2xl font-extrabold text-orange-500 leading-none">{datos.porEmbarcar.length}</p>
                    <p className="text-xs text-gray-400 mt-1">{fmtN(totalUdsPE)} uds. pendientes</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                    <p className="text-xs text-gray-400 mb-1">Espera más larga</p>
                    <p className={`text-2xl font-extrabold leading-none ${maxEspera <= 0 ? 'text-gray-300' : maxEspera <= 60 ? 'text-green-500' : maxEspera <= 120 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {maxEspera > 0 ? `${maxEspera}d` : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">pedido sin embarcar</p>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'embarcado',   label: '🚢 Embarcados',      count: datos.embarcado.length },
                    { key: 'porEmbarcar', label: '⏳ Por embarcar',     count: datos.porEmbarcar.length },
                    { key: 'parciales',   label: '📦 Envíos parciales', count: parciales.length },
                ].map(v => (
                    <button
                        key={v.key}
                        onClick={() => setVistaActiva(v.key)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all
                            ${vistaActiva === v.key
                                ? 'bg-[#370776] !text-white border-[#370776]'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-[#370776] hover:text-[#370776]'}`}
                    >
                        {v.label}
                        <span className={`text-xs ${vistaActiva === v.key ? '!text-white/70' : 'text-gray-400'}`}>{v.count}</span>
                    </button>
                ))}
            </div>

            {vistaActiva === 'embarcado' && (
                <div className="flex flex-col gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4 flex-wrap">
                        <Search placeholder="Buscar por producto, código o factura..." allowClear style={{ flex: 1, minWidth: 220, maxWidth: 400 }} value={busquedaEmb} onChange={e => setBusquedaEmb(e.target.value)} />
                        <span className="ml-auto text-sm font-semibold text-[#121027] shrink-0">{gruposFiltrados.length} envío{gruposFiltrados.length !== 1 ? 's' : ''}</span>
                    </div>
                    {gruposFiltrados.length === 0 ? <Empty description="Sin resultados." className="py-12" /> : (
                        <Collapse expandIconPosition="end" className="bg-transparent" style={{ border: 'none' }}
                            items={gruposFiltrados.map(g => {
                                const totalUds = g.items.reduce((s, i) => s + (i.embarcado || i.pedido || 0), 0);
                                return {
                                    key: g.factura,
                                    label: (
                                        <div className="flex items-center gap-3 w-full min-w-0">
                                            <span className="font-semibold text-[#121027] shrink-0">{fmtFechaEmb(g.fechaEmbarque)}</span>
                                            <span className="font-mono text-xs font-semibold text-[#370776] shrink-0">{g.factura}</span>
                                            <span className="text-xs text-gray-400">{g.items.length} producto{g.items.length !== 1 ? 's' : ''} · {fmtN(totalUds)} uds.</span>
                                        </div>
                                    ),
                                    children: (
                                        <Table dataSource={g.items.map((item, idx) => ({ ...item, key: idx }))} size="small" bordered pagination={false} rowKey="key"
                                            columns={[
                                                { title: 'Código', dataIndex: 'codigo', width: 110, render: v => <span className="font-mono text-xs font-semibold text-[#370776]">{v}</span> },
                                                { title: 'Descripción', dataIndex: 'descripcion', render: v => <span className="text-sm text-[#121027]">{v}</span> },
                                                { title: 'Fecha pedido', dataIndex: 'fechaPedido', width: 130, align: 'center', render: v => <span className="text-xs text-gray-500">{fmtFechaEmb(v)}</span> },
                                                { title: 'Cantidad', key: 'cantidad', width: 110, align: 'right', render: (_, r) => <span className="text-sm font-bold text-[#370776] tabular-nums">{fmtN(r.embarcado || r.pedido || 0)}</span> },
                                            ]}
                                            rowClassName={() => 'hover:bg-[#f6f2ff]'}
                                        />
                                    ),
                                };
                            })}
                        />
                    )}
                </div>
            )}

            {vistaActiva === 'parciales' && (
                <div className="flex flex-col gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4 flex-wrap">
                        <Search placeholder="Buscar por producto o código..." allowClear style={{ flex: 1, minWidth: 220, maxWidth: 400 }} value={busquedaParc} onChange={e => setBusquedaParc(e.target.value)} />
                        <span className="ml-auto text-sm font-semibold text-[#121027] shrink-0">{parcialesFiltrados.length} producto{parcialesFiltrados.length !== 1 ? 's' : ''} con envío partido</span>
                    </div>
                    {parcialesFiltrados.length === 0 ? <Empty description="Sin resultados." className="py-12" /> : (
                        <div className="overflow-x-auto">
                            <Table dataSource={parcialesFiltrados.map((item, i) => ({ ...item, key: i }))} rowKey="key" size="small" bordered tableLayout="fixed" pagination={{ pageSize: 50, showSizeChanger: false }} scroll={{ x: 'max-content' }}
                                columns={[
                                    { title: 'Código', dataIndex: 'codigo', width: 110, render: v => <span className="font-mono text-xs font-semibold text-[#370776]">{v}</span> },
                                    { title: 'Descripción', dataIndex: 'descripcion', render: v => <span className="text-sm text-[#121027]">{v}</span> },
                                    { title: 'Último embarque', dataIndex: 'ultimoEmbarque', width: 150, align: 'center', render: v => <span className="text-xs text-gray-500">{fmtFechaEmb(v)}</span> },
                                    { title: 'Ya recibido', dataIndex: 'totalRecibido', width: 120, align: 'right', render: v => <span className="text-sm font-bold text-green-600 tabular-nums">{fmtN(v)} uds.</span> },
                                    { title: 'Pendiente', dataIndex: 'pedido', width: 110, align: 'right', render: v => <span className="text-sm font-bold text-orange-500 tabular-nums">{fmtN(v)} uds.</span> },
                                    { title: 'Días esperando', dataIndex: 'diasEspera', width: 130, align: 'center', sorter: (a, b) => a.diasEspera - b.diasEspera, defaultSortOrder: 'descend',
                                        render: v => {
                                            if (!v) return <span className="text-gray-300">—</span>;
                                            const cls = v > 180 ? 'bg-red-100 text-red-700' : v > 120 ? 'bg-orange-100 text-orange-700' : v > 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
                                            return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{v}d</span>;
                                        }
                                    },
                                ]}
                                rowClassName={r => r.diasEspera > 180 ? '!bg-red-50 hover:!bg-red-100' : r.diasEspera > 120 ? '!bg-orange-50 hover:!bg-orange-100' : r.diasEspera > 60 ? '!bg-yellow-50 hover:!bg-yellow-100' : 'hover:bg-[#f6f2ff]'}
                            />
                        </div>
                    )}
                </div>
            )}

            {vistaActiva === 'porEmbarcar' && (
                <div className="flex flex-col gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4 flex-wrap">
                        <Search placeholder="Buscar por producto o código..." allowClear style={{ flex: 1, minWidth: 220, maxWidth: 400 }} value={busquedaPE} onChange={e => setBusquedaPE(e.target.value)} />
                        <div className="ml-auto flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" /> +180d
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-200 ml-1" /> +120d
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-100 border border-yellow-200 ml-1" /> +60d
                            </div>
                            <span className="text-sm font-semibold text-[#121027]">{porEmbarcarFiltrado.length} productos</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <Table dataSource={porEmbarcarFiltrado} rowKey={(_, i) => i} size="small" bordered tableLayout="fixed" pagination={{ pageSize: 50, showSizeChanger: false }} scroll={{ x: 'max-content' }}
                            columns={[
                                { title: 'Código', dataIndex: 'codigo', width: 110, render: v => <span className="font-mono text-xs font-semibold text-[#370776]">{v}</span> },
                                { title: 'Descripción', dataIndex: 'descripcion', render: v => <span className="text-sm text-[#121027]">{v}</span> },
                                { title: 'Fecha pedido', dataIndex: 'fechaPedido', width: 130, align: 'center', render: v => <span className="text-xs text-gray-500">{fmtFechaEmb(v)}</span> },
                                { title: 'Días esperando', dataIndex: 'diasEspera', width: 130, align: 'center', sorter: (a, b) => a.diasEspera - b.diasEspera, defaultSortOrder: 'descend',
                                    render: v => {
                                        if (!v) return <span className="text-gray-300">—</span>;
                                        const cls = v > 180 ? 'bg-red-100 text-red-700' : v > 120 ? 'bg-orange-100 text-orange-700' : v > 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
                                        return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{v}d</span>;
                                    }
                                },
                                { title: 'Cantidad', dataIndex: 'pedido', width: 110, align: 'right', render: v => <span className="text-sm font-bold text-[#370776] tabular-nums">{fmtN(v)}</span> },
                            ]}
                            rowClassName={r => r.diasEspera > 180 ? '!bg-red-50 hover:!bg-red-100' : r.diasEspera > 120 ? '!bg-orange-50 hover:!bg-orange-100' : r.diasEspera > 60 ? '!bg-yellow-50 hover:!bg-yellow-100' : 'hover:bg-[#f6f2ff]'}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Compras() {
    const { productos: rawProductos, loading, actualizadoEl, refetch: refetchProductos } = useCompras();
    const { pedidos, loading: loadingPedidos, refetch: refetchPedidos } = usePedidos();
    const { embarcados, refetchEmbarcados } = useEmbarcados();
    const { confirmados, refetchConfirmados } = useConfirmados();
    const [activeTab, setActiveTab] = useState('nuevo');
    const [actualizando, setActualizando] = useState(false);

    // Estado local de la tabla
    const [filas, setFilas] = useState(null);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('todos');
    const [aPedir, setAPedir] = useState({});
    const [pedidoCods, setPedidoCods] = useState([]);
    const [pedidoInfo, setPedidoInfo] = useState({});

    useEffect(() => {
        if (rawProductos.length > 0) {
            setFilas(rawProductos);
            setAPedir({});
        }
    }, [rawProductos]);

    // Búsqueda unificada
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const searchTimer = useRef(null);

    // Drawer
    const [drawerOpen, setDrawerOpen] = useState(false);

    // ── Búsqueda con debounce ────────────────────────────────────────────────
    useEffect(() => {
        clearTimeout(searchTimer.current);
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        searchTimer.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await comprasApi.buscar(searchQuery.trim());
                setSearchResults(res?.data?.productos ?? []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(searchTimer.current);
    }, [searchQuery]);

    // ── Conteo por categoría (sobre la lista base, sin filtro de búsqueda) ──
    const countsPorCategoria = useMemo(() => {
        const counts = { todos: 0, trofeos: 0, publicitarios: 0, pesca: 0, timbres: 0, otros: 0 };
        (filas ?? []).forEach(p => {
            counts.todos++;
            const cat = getCategoria(p.cod);
            if (counts[cat] !== undefined) counts[cat]++;
        });
        return counts;
    }, [filas]);

    // ── Filas visibles ───────────────────────────────────────────────────────
    const filasFiltradas = useMemo(() => {
        const base = searchQuery.trim() ? searchResults : (filas ?? []);
        if (categoriaSeleccionada === 'todos') return base;
        return base.filter(p => getCategoria(p.cod) === categoriaSeleccionada);
    }, [searchQuery, searchResults, filas, categoriaSeleccionada]);

    // ── Navegar entre inputs con Enter ──────────────────────────────────────
    const handleQtyEnter = useCallback((e) => {
        if (e.key === 'Enter') {
            const all = Array.from(document.querySelectorAll('[data-compras-qty]'));
            const idx = all.indexOf(e.target);
            if (idx >= 0 && idx < all.length - 1) all[idx + 1].focus();
        }
    }, []);

    // ── Limpiar pedido actual ────────────────────────────────────────────────
    const limpiarPedido = useCallback(() => {
        setPedidoCods([]);
        setPedidoInfo({});
        setAPedir({});
    }, []);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleEliminar = useCallback((cod) => {
        setPedidoCods(prev => prev.filter(c => c !== cod));
        setAPedir(prev => ({ ...prev, [cod]: 0 }));
    }, []);

    const handleAPedir = useCallback((cod, valor, productoRef) => {
        const n = Math.max(0, parseInt(valor, 10) || 0);
        setAPedir(prev => ({ ...prev, [cod]: n }));
        if (n > 0) {
            setPedidoCods(prev => prev.includes(cod) ? prev : [...prev, cod]);
            if (productoRef) {
                setPedidoInfo(prev => prev[cod] ? prev : { ...prev, [cod]: productoRef });
            }
        }
    }, []);

    // ── Aplicar sugerencias de la categoría activa ───────────────────────────
    const aplicarSugerenciasCategoria = useCallback(() => {
        const fuente = filasFiltradas.filter(p => (p.sugerencia ?? 0) > 0);
        if (fuente.length === 0) return;

        const ejecutar = () => {
            const nuevosAPedir = {};
            const nuevosCods   = [];
            const nuevaInfo    = {};
            fuente.forEach(p => {
                nuevosAPedir[p.cod] = p.sugerencia;
                nuevosCods.push(p.cod);
                nuevaInfo[p.cod] = p;
            });
            setAPedir(prev => ({ ...prev, ...nuevosAPedir }));
            setPedidoCods(prev => [...new Set([...prev, ...nuevosCods])]);
            setPedidoInfo(prev => ({ ...prev, ...nuevaInfo }));
        };

        // Si está en "Todos", confirmar antes de aplicar masivamente
        if (categoriaSeleccionada === 'todos') {
            Modal.confirm({
                title: 'Aplicar todas las sugerencias',
                content: `Se llenarán los campos "A pedir" de los ${fuente.length} productos visibles con sus sugerencias.`,
                okText: 'Aplicar todo',
                cancelText: 'Cancelar',
                okButtonProps: { style: { background: '#370776', borderColor: '#370776' } },
                onOk: ejecutar,
            });
        } else {
            ejecutar();
        }
    }, [filasFiltradas, categoriaSeleccionada]);

    // ── Actualizar datos desde el ERP ────────────────────────────────────────
    const handleActualizar = useCallback(() => {
        Modal.confirm({
            title: '¿Marcar todos como recibidos?',
            content: 'Esta acción marcará todos los pedidos embarcados como recibidos. No se puede deshacer.',
            okText: 'Sí, marcar recibidos',
            cancelText: 'Cancelar',
            okButtonProps: { danger: true },
            onOk: async () => {
                setActualizando(true);
                try {
                    await comprasApi.actualizar();
                    await Promise.all([refetchProductos(), refetchPedidos(), refetchEmbarcados()]);
                    message.success('Pedidos embarcados marcados como recibidos.');
                } catch (err) {
                    message.error(err.response?.data?.message || 'No se pudo actualizar. Verifica la conexión con la base de datos.');
                } finally {
                    setActualizando(false);
                }
            },
        });
    }, [refetchProductos, refetchPedidos, refetchEmbarcados]);

    // ── Aviso al cerrar/recargar pestaña con pedido sin exportar ────────────
    useEffect(() => {
        const handler = e => {
            if (pedidoCods.length > 0) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [pedidoCods.length]);

    // ── Export con confirmación ──────────────────────────────────────────────
    const handleExport = useCallback(() => {
        const exportables = pedidoCods
            .map(cod => pedidoInfo[cod])
            .filter(p => p && (aPedir[p.cod] ?? 0) > 0);

        if (exportables.length === 0) return;

        const totalUds = exportables.reduce((s, p) => s + aPedir[p.cod], 0);

        Modal.confirm({
            title: 'Confirmar pedido',
            content: `Se exportarán ${exportables.length} producto${exportables.length !== 1 ? 's' : ''} con ${totalUds.toLocaleString('es-CL')} unidades en total. El pedido quedará guardado en el historial.`,
            okText: 'Confirmar y exportar',
            cancelText: 'Revisar',
            okButtonProps: { style: { background: '#370776', borderColor: '#370776' } },
            onOk: async () => {
                const fecha = new Date().toISOString().split('T')[0];
                const productosPayload = exportables.map(p => ({
                    cod: p.cod,
                    nombre: p.nombre,
                    cantidad: aPedir[p.cod],
                    estado: 'pendiente',
                }));

                try {
                    await exportarExcel(productosPayload, fecha);
                    message.success('Pedido exportado correctamente.');
                } catch {
                    message.error('Error al generar el archivo Excel.');
                    return;
                }

                try {
                    const totalUnidades = productosPayload.reduce((s, p) => s + p.cantidad, 0);
                    await pedidosApi.guardar({ productos: productosPayload, totalUnidades });
                    refetchPedidos();
                } catch {
                    message.warning('El pedido se exportó pero no se pudo guardar en el historial.');
                }

                // Preguntar si limpiar el pedido actual
                Modal.confirm({
                    title: 'Pedido exportado',
                    content: '¿Deseas limpiar el pedido actual para comenzar uno nuevo?',
                    okText: 'Sí, limpiar',
                    cancelText: 'Mantener',
                    onOk: () => {
                        limpiarPedido();
                        setDrawerOpen(false);
                    },
                });
            },
        });
    }, [pedidoCods, pedidoInfo, aPedir, refetchPedidos, limpiarPedido]);

    // ── Columnas ─────────────────────────────────────────────────────────────
    const columns = [
        // ── Código ────────────────────────────────────────────────────────────
        {
            title: 'Código',
            dataIndex: 'cod', key: 'cod', width: 88,
            render: val => (
                <span className="font-mono text-xs font-semibold text-[#370776] tracking-tight">
                    {val}
                </span>
            ),
        },
        // ── Producto ──────────────────────────────────────────────────────────
        {
            title: 'Producto',
            dataIndex: 'nombre', key: 'nombre', width: 200, ellipsis: true,
            render: val => (
                <Tooltip title={val} placement="topLeft" mouseEnterDelay={0.5}>
                    <span className="text-sm font-medium text-[#121027] leading-tight">{val}</span>
                </Tooltip>
            ),
        },
        // ── Años: cy-3 y cy-2 son historia, cy-1 es referencia, cy es acción
        {
            title: <span className="text-gray-400 font-medium">{CY - 3}</span>,
            dataIndex: `y${CY - 3}`, key: `y${CY - 3}`, width: 78, align: 'right',
            render: val => (
                <span className="text-xs text-gray-400 tabular-nums">{fmtN(val)}</span>
            ),
        },
        {
            title: <span className="text-gray-400 font-medium">{CY - 2}</span>,
            dataIndex: `y${CY - 2}`, key: `y${CY - 2}`, width: 78, align: 'right',
            render: val => (
                <span className="text-xs text-gray-400 tabular-nums">{fmtN(val)}</span>
            ),
        },
        {
            title: <span className="text-gray-600 font-semibold">{CY - 1}</span>,
            dataIndex: `y${CY - 1}`, key: `y${CY - 1}`, width: 82, align: 'right',
            render: val => (
                <span className="text-sm font-semibold text-gray-700 tabular-nums">{fmtN(val)}</span>
            ),
        },
        {
            title: <span className="text-[#370776] font-bold">{CY}</span>,
            dataIndex: `y${CY}`, key: `y${CY}`, width: 82, align: 'right',
            render: val => (
                <span className="text-sm font-bold text-[#370776] tabular-nums">{fmtN(val)}</span>
            ),
        },
        // ── Stock ─────────────────────────────────────────────────────────────
        {
            title: 'Stock',
            dataIndex: 'stock', key: 'stock', width: 100, align: 'right',
            render: val => (
                <span className="text-sm font-semibold text-gray-700 tabular-nums">
                    {fmtN(val ?? 0)}
                </span>
            ),
        },
        // ── X Embarcar y Embarcado ────────────────────────────────────────────
        {
            title: 'X Embarcar',
            key: 'porEmbarcar', width: 92, align: 'right',
            render: (_, record) => {
                const total = (record.porEmbarcar ?? 0) + (confirmados[record.cod] ?? 0);
                return total > 0
                    ? <span className="text-sm font-semibold text-gray-600 tabular-nums">{fmtN(total)}</span>
                    : <span className="text-xs text-gray-300">—</span>;
            },
        },
        {
            title: 'Embarcado',
            key: 'embarcado', width: 92, align: 'right',
            render: (_, record) => {
                const val = embarcados[record.cod] ?? 0;
                return val > 0
                    ? <span className="text-sm font-semibold text-blue-500 tabular-nums">{fmtN(val)}</span>
                    : <span className="text-xs text-gray-300">—</span>;
            },
        },
        // ── Sugerencia ────────────────────────────────────────────────────────
        {
            title: 'Sugerencia',
            dataIndex: 'sugerencia', key: 'sugerencia', width: 108, align: 'center',
            render: (val, record) => (
                val > 0
                    ? (
                        <Tooltip title="Click para aplicar sugerencia">
                            <button
                                onClick={() => handleAPedir(record.cod, val, record)}
                                className="inline-flex items-center justify-center rounded-md bg-[#f0ebff] hover:bg-[#e0d4ff] px-2.5 py-1 text-sm font-bold text-[#370776] tabular-nums min-w-[72px] transition-colors cursor-pointer"
                            >
                                {fmtN(val)}
                            </button>
                        </Tooltip>
                    )
                    : <span className="text-xs text-gray-300">—</span>
            ),
        },
        // ── A pedir ───────────────────────────────────────────────────────────
        {
            title: 'A pedir',
            key: 'aPedir', width: 110, align: 'center',
            render: (_, record) => (
                <input
                    type="number" min="0"
                    data-compras-qty
                    value={aPedir[record.cod] ?? 0}
                    onChange={e => handleAPedir(record.cod, e.target.value, record)}
                    onFocus={e => e.target.select()}
                    onKeyDown={handleQtyEnter}
                    className="w-20 text-center border border-gray-300 rounded-md px-1 py-0.5 text-sm font-bold outline-none focus:border-[#370776] focus:ring-2 focus:ring-[#370776]/20 tabular-nums"
                    style={{ color: '#121027' }}
                />
            ),
        },
    ];

    const productosConCantidad = pedidoCods.map(cod => pedidoInfo[cod]).filter(Boolean);

    const statusLabel = searchQuery.trim()
        ? { text: `${filasFiltradas.length} resultado${filasFiltradas.length !== 1 ? 's' : ''}`, sub: `para "${searchQuery.trim()}"` }
        : { text: `${filasFiltradas.length} producto${filasFiltradas.length !== 1 ? 's' : ''} a pedir`, sub: 'según stock y proyección' };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />

            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto overflow-x-auto pb-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[#370776]">Compras</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Productos que necesitan reposición según stock y proyección de ventas
                        </p>
                    </div>
                    {activeTab === 'nuevo' && (
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                {pedidoCods.length > 0 && (
                                    <Button
                                        icon={<CloseOutlined />}
                                        onClick={() => Modal.confirm({
                                            title: 'Limpiar pedido',
                                            content: 'Se quitarán todos los productos del pedido actual.',
                                            okText: 'Limpiar',
                                            cancelText: 'Cancelar',
                                            okButtonProps: { danger: true },
                                            onOk: limpiarPedido,
                                        })}
                                    >
                                        Limpiar
                                    </Button>
                                )}
                                <Badge count={productosConCantidad.length} color="#370776" offset={[-4, 4]}>
                                    <Button
                                        type="primary"
                                        icon={<ShoppingOutlined />}
                                        style={{ background: '#370776', borderColor: '#370776' }}
                                        onClick={() => setDrawerOpen(true)}
                                    >
                                        Generar pedido
                                    </Button>
                                </Badge>
                            </div>
                            {pedidoCods.length > 0 && (
                                <span className="text-xs text-gray-500 pr-1">
                                    {pedidoCods.reduce((sum, cod) => sum + (aPedir[cod] > 0 ? aPedir[cod] : 0), 0).toLocaleString('es-CL')} uds. totales
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={[
                            {
                                key: 'nuevo',
                                label: <span className="font-medium">Nuevo pedido</span>,
                                children: (
                                    <div className="flex flex-col gap-4 pb-5">
                                        <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4">
                                            <Search
                                                placeholder="Buscar por nombre o código en todo el catálogo..."
                                                allowClear
                                                style={{ flex: 1, maxWidth: 480 }}
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                onSearch={val => setSearchQuery(val)}
                                                loading={searchLoading}
                                            />
                                            {!searchQuery.trim() && (
                                                <Button
                                                    onClick={aplicarSugerenciasCategoria}
                                                    disabled={loading || filasFiltradas.length === 0}
                                                    style={{ borderColor: '#370776', color: '#370776' }}
                                                >
                                                    {categoriaSeleccionada === 'todos'
                                                        ? 'Aplicar todas las sugerencias'
                                                        : `Aplicar sugerencias — ${CATEGORIAS.find(c => c.key === categoriaSeleccionada)?.label}`
                                                    }
                                                </Button>
                                            )}
                                            <div className="ml-auto shrink-0 flex items-center gap-3">
                                                <div className="text-right">
                                                    <div className="text-sm font-semibold text-[#121027]">{statusLabel.text}</div>
                                                    <div className="text-xs text-gray-400">{statusLabel.sub}</div>
                                                    {actualizadoEl && (
                                                        <div className="text-xs text-gray-300 mt-0.5">
                                                            datos: {new Date(actualizadoEl).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button
                                                    icon={<ReloadOutlined />}
                                                    loading={actualizando}
                                                    onClick={handleActualizar}
                                                    title="Marcar pedidos embarcados como recibidos"
                                                    size="small"
                                                >
                                                    Marcar recibidos
                                                </Button>
                                            </div>
                                        </div>
                                        {/* Toggle categorías */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {CATEGORIAS.map(cat => {
                                                const active = categoriaSeleccionada === cat.key;
                                                const count  = countsPorCategoria[cat.key] ?? 0;
                                                return (
                                                    <button
                                                        key={cat.key}
                                                        onClick={() => setCategoriaSeleccionada(cat.key)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                                                            ${active
                                                                ? 'bg-[#370776] !text-white border-[#370776]'
                                                                : 'bg-white text-gray-500 border-gray-200 hover:border-[#370776] hover:text-[#370776]'
                                                            }`}
                                                    >
                                                        {cat.label}
                                                        {cat.key !== 'todos' && (
                                                            <span className={`tabular-nums ${active ? '!text-white/70' : 'text-gray-400'}`}>
                                                                {count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="overflow-x-auto">
                                            <Spin spinning={loading || searchLoading}>
                                                <Table
                                                    dataSource={filasFiltradas}
                                                    columns={columns}
                                                    rowKey="cod"
                                                    size="small"
                                                    bordered
                                                    tableLayout="fixed"
                                                    pagination={{ pageSize: 50, showSizeChanger: false }}
                                                    scroll={{ x: 'max-content' }}
                                                    onRow={() => ({ style: { cursor: 'default' } })}
                                                    rowClassName={(record) => pedidoCods.includes(record.cod) ? '!bg-[#e8dcff] hover:!bg-[#ddd0ff]' : 'hover:bg-[#f6f2ff]'}
                                                />
                                            </Spin>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'historial',
                                label: (
                                    <span className="font-medium flex items-center gap-1">
                                        <HistoryOutlined /> Historial
                                    </span>
                                ),
                                children: (
                                    <HistorialTab
                                        pedidos={pedidos}
                                        loading={loadingPedidos}
                                        refetch={refetchPedidos}
                                        onEmbarcadoChange={() => { refetchEmbarcados(); refetchConfirmados(); refetchProductos(); }}
                                    />
                                ),
                            },
                            {
                                key: 'embarques',
                                label: <span className="font-medium">🚢 Embarques</span>,
                                children: <EmbarquesTab />,
                            },
                        ]}
                    />
            </div>

            {/* Drawer — resumen del pedido */}
            <Drawer
                title={
                    <div>
                        <div className="font-bold text-[#121027]">Resumen del pedido</div>
                        <div className="text-xs text-gray-500 font-normal mt-0.5">
                            {productosConCantidad.length} producto{productosConCantidad.length !== 1 ? 's' : ''} agregado{productosConCantidad.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                }
                placement="right"
                width={500}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                closeIcon={<CloseOutlined />}
                footer={
                    <div className="flex flex-col gap-3">
                        {productosConCantidad.length > 0 && (
                            <div className="flex justify-between text-sm px-1">
                                <span className="text-gray-500">
                                    {productosConCantidad.length} producto{productosConCantidad.length !== 1 ? 's' : ''}
                                </span>
                                <span className="font-semibold text-[#121027]">
                                    {pedidoCods.reduce((sum, cod) => sum + (aPedir[cod] > 0 ? aPedir[cod] : 0), 0).toLocaleString('es-CL')} uds. totales
                                </span>
                            </div>
                        )}
                        <Button
                            type="primary"
                            block
                            size="large"
                            style={{ background: '#370776', borderColor: '#370776' }}
                            disabled={productosConCantidad.length === 0}
                            onClick={handleExport}
                        >
                            Exportar Excel
                        </Button>
                    </div>
                }
            >
                {productosConCantidad.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                        No hay productos con cantidad asignada.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {productosConCantidad.map(p => (
                            <div
                                key={p.cod}
                                className="flex items-center gap-3 rounded-lg px-4 py-3 border bg-gray-50 border-gray-200"
                            >
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="text-xs text-gray-400 font-semibold">{p.cod}</span>
                                    <span className="text-sm text-[#121027] font-medium leading-tight">{p.nombre}</span>
                                </div>
                                <input
                                    type="number" min="0"
                                    value={aPedir[p.cod] ?? 0}
                                    onChange={e => handleAPedir(p.cod, e.target.value)}
                                    onFocus={e => e.target.select()}
                                    className="w-20 text-center border border-gray-300 rounded-md px-2 py-1 text-lg font-extrabold outline-none focus:border-[#370776] focus:ring-2 focus:ring-[#370776]/20 shrink-0"
                                    style={{ color: '#370776' }}
                                />
                                <button
                                    onClick={() => handleEliminar(p.cod)}
                                    className="shrink-0 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md p-1 transition-colors"
                                    title="Quitar del pedido"
                                >
                                    <DeleteOutlined />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </Drawer>
        </div>
    );
}
