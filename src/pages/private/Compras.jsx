import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Table, Input, Button, Drawer, Tag, Spin, Badge, Tabs, Empty, Collapse, Modal, message, Pagination, Tooltip, Upload } from 'antd';
import { ShoppingOutlined, CloseOutlined, DeleteOutlined, WarningOutlined, HistoryOutlined, DownloadOutlined, CheckCircleOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import Sidebar from '../../components/Sidebar';
import { useCompras } from '../../hooks/useCompras';
import { usePedidos, useEmbarcados, useConfirmados } from '../../hooks/usePedidos';
import comprasApi from '../../services/compras.service';
import pedidosApi from '../../services/pedidos.service';
import * as XLSX from 'xlsx';

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
    pendiente:  { label: 'Pendiente',  bg: 'bg-gray-50',    border: 'border-gray-200',   text: 'text-gray-400'   },
    enDisputa:  { label: 'En disputa', bg: 'bg-yellow-50',  border: 'border-yellow-300', text: 'text-yellow-600' },
    confirmado: { label: 'X Embarcar', bg: 'bg-green-50',   border: 'border-green-300',  text: 'text-green-600'  },
    embarcado:  { label: 'Embarcado',  bg: 'bg-blue-50',    border: 'border-blue-300',   text: 'text-blue-600'   },
    incompleto: { label: 'Incompleto', bg: 'bg-orange-50',  border: 'border-orange-300', text: 'text-orange-600' },
    recibido:   { label: 'Recibido',   bg: 'bg-purple-50',  border: 'border-purple-300', text: 'text-purple-600' },
};

// ── Historial Tab ─────────────────────────────────────────────────────────────

const FILTROS_ESTADO = [
    { key: 'todos',      label: 'Todos' },
    { key: 'enDisputa',  label: 'En disputa',  color: 'text-yellow-600' },
    { key: 'confirmado', label: 'Confirmados',  color: 'text-green-600'  },
    { key: 'embarcado',  label: 'Embarcados',   color: 'text-blue-600'   },
    { key: 'incompleto', label: 'Incompleto',   color: 'text-orange-600' },
    { key: 'recibido',   label: 'Recibidos',    color: 'text-purple-600' },
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
        const BLOQUEADOS = ['incompleto', 'recibido'];
        const actualizados = pedido.productos.map(p => {
            if (p.cod !== cod) return p;
            const actual = p.estado ?? 'pendiente';
            if (BLOQUEADOS.includes(actual)) return p;
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
                        const tieneIncompleto = p.productos.some(x => (x.estado ?? 'pendiente') === 'incompleto');
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
                                    {tieneDisputa    && <Tag color="warning">En disputa</Tag>}
                                    {tieneConfirm    && <Tag color="success">Confirmado</Tag>}
                                    {tieneEmbarcado  && <Tag color="processing">Embarcado</Tag>}
                                    {tieneIncompleto && <Tag color="orange">Incompleto</Tag>}
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
                                        const bloqueado = ['incompleto', 'recibido'].includes(estado);
                                        const btn = (key, icon, title, color) => {
                                            const active = estado === key;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => cambiarEstado(p, prod.cod, key)}
                                                    disabled={busy || bloqueado}
                                                    title={bloqueado ? 'Estado final, no editable' : title}
                                                    className={`shrink-0 rounded-md p-1.5 transition-colors text-base leading-none
                                                        ${active ? color.active : color.idle}
                                                        disabled:opacity-40 disabled:cursor-not-allowed`}
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
                                                {estado === 'incompleto' && prod.cantidadRecibida != null ? (
                                                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                        <span className="text-sm font-extrabold text-green-600">
                                                            ✅ {prod.cantidadRecibida.toLocaleString('es-CL')} uds.
                                                        </span>
                                                        <span className="text-sm font-extrabold text-orange-500">
                                                            ⚠️ {(prod.cantidad - prod.cantidadRecibida).toLocaleString('es-CL')} faltante
                                                        </span>
                                                    </div>
                                                ) : estado === 'recibido' ? (
                                                    <span className="text-sm font-extrabold text-purple-600 shrink-0">
                                                        ✅ {(prod.cantidadRecibida ?? prod.cantidad).toLocaleString('es-CL')} uds.
                                                    </span>
                                                ) : (
                                                    <span className="text-lg font-extrabold text-[#370776] shrink-0">
                                                        {prod.cantidad.toLocaleString('es-CL')}
                                                    </span>
                                                )}
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

const FAMILIA_A_CATEGORIA = {
    'PESCA':                   'pesca',
    'TROFEOS':                 'trofeos',
    'ARTICULOS PUBLICITARIOS': 'publicitarios',
    'TIMBRES':                 'timbres',
};
function getCategoriaDeProducto(p) {
    return FAMILIA_A_CATEGORIA[p?.familia] ?? 'otros';
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


function EmbarquesTab({ pedidos = [], refetchPedidos, refetchEmbarcados, refetchConfirmados, refetchProductos }) {
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [nombreArchivo, setNombreArchivo] = useState('');
    const [vistaActiva, setVistaActiva] = useState('embarcado');
    const [busquedaEmb, setBusquedaEmb] = useState('');
    const [busquedaPE, setBusquedaPE] = useState('');
    const [subVistaEmb, setSubVistaEmb]       = useState('factura');
    const [primeraCarga, setPrimeraCarga]     = useState(false);
    const [seleccionados, setSeleccionados]   = useState(new Set());
    const [confirmando, setConfirmando]       = useState(false);
    const [busquedaConc, setBusquedaConc]     = useState('');

    const handleFile = useCallback((file) => {
        setCargando(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const names = wb.SheetNames;
                const embName = names.find(n => n.toLowerCase() === 'embarcado');
                const peName  = names.find(n => n.toLowerCase().replace(/\s/g, '') === 'porembarcar');

                const parseSheet = (name) =>
                    name ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) : [];

                const embRows = parseSheet(embName);
                const peRows  = parseSheet(peName);

                const embarcado = embRows.slice(1).map(r => ({
                    codigo:        r[0],
                    fechaPedido:   r[1] instanceof Date ? r[1] : null,
                    descripcion:   String(r[2] || '').trim(),
                    pedido:        Number(r[3]) || 0,
                    fechaEmbarque: r[4] instanceof Date ? r[4] : null,
                    factura:       String(r[5] || 'Sin factura').trim(),
                    embarcado:     Number(r[6]) || 0,
                })).filter(r => r.codigo && r.descripcion);

                const porEmbarcar = peRows.slice(1).map(r => ({
                    codigo:      r[0],
                    fechaPedido: r[1] instanceof Date ? r[1] : null,
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
                setPrimeraCarga(true);
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

    // ── Por embarcar desde dashboard (pedidos confirmados) ───────────────────
    const porEmbarcarDashboard = useMemo(() => {
        const map = {};
        pedidos.forEach(pedido => {
            pedido.productos.forEach(prod => {
                if (prod.estado !== 'confirmado') return;
                const cod = String(prod.cod).trim();
                if (!map[cod]) map[cod] = {
                    codigo: cod,
                    descripcion: prod.nombre,
                    pedido: 0,
                    fechaPedido: pedido.createdAt ? new Date(pedido.createdAt) : null,
                };
                map[cod].pedido += prod.cantidad;
                const d = pedido.createdAt ? new Date(pedido.createdAt) : null;
                if (d && (!map[cod].fechaPedido || d < map[cod].fechaPedido)) map[cod].fechaPedido = d;
            });
        });
        return Object.values(map).sort((a, b) => (b.pedido || 0) - (a.pedido || 0));
    }, [pedidos]);

    const porEmbarcarDashboardFiltrado = useMemo(() => {
        const q = busquedaPE.trim().toLowerCase();
        const hoy = Date.now();
        return porEmbarcarDashboard
            .filter(i => !q || i.descripcion.toLowerCase().includes(q) || String(i.codigo).includes(q))
            .map(i => ({
                ...i,
                diasEspera: i.fechaPedido ? Math.round((hoy - i.fechaPedido) / 86400000) : 0,
            }))
            .sort((a, b) => b.diasEspera - a.diasEspera);
    }, [porEmbarcarDashboard, busquedaPE]);

    // ── Por producto: agrupa embarcados por código (para sub-vista) ─────────
    const porProducto = useMemo(() => {
        if (!datos?.embarcado) return [];
        const map = {};
        datos.embarcado.forEach(item => {
            const cod = String(item.codigo).trim();
            if (!map[cod]) map[cod] = { cod, descripcion: item.descripcion, totalRecibido: 0, facturasSet: new Set(), ultimoEmbarque: null };
            map[cod].totalRecibido += (item.embarcado || item.pedido || 0);
            map[cod].facturasSet.add(item.factura);
            if (item.fechaEmbarque && (!map[cod].ultimoEmbarque || item.fechaEmbarque > map[cod].ultimoEmbarque)) {
                map[cod].ultimoEmbarque = item.fechaEmbarque;
            }
        });
        return Object.values(map)
            .map(({ facturasSet, ...p }) => ({ ...p, nEnvios: facturasSet.size }))
            .sort((a, b) => b.totalRecibido - a.totalRecibido);
    }, [datos]);

    const porProductoFiltrado = useMemo(() => {
        const q = busquedaEmb.trim().toLowerCase();
        if (!q) return porProducto;
        return porProducto.filter(p => p.descripcion.toLowerCase().includes(q) || p.cod.toLowerCase().includes(q));
    }, [porProducto, busquedaEmb]);

    // ── Conciliación: cruce Excel vs pedidos activos de la BD ────────────────
    const conciliacion = useMemo(() => {
        if (!datos?.embarcado || !pedidos?.length) return [];
        const excelMap = {};
        datos.embarcado.forEach(item => {
            const cod = String(item.codigo).trim();
            excelMap[cod] = (excelMap[cod] || 0) + (item.embarcado || item.pedido || 0);
        });
        const matches = {};
        pedidos.forEach(pedido => {
            pedido.productos.forEach(prod => {
                if (!['pendiente', 'confirmado', 'embarcado', 'incompleto'].includes(prod.estado ?? 'pendiente')) return;
                if (!excelMap[prod.cod]) return;
                if (!matches[prod.cod]) {
                    matches[prod.cod] = { cod: prod.cod, nombre: prod.nombre, totalPedido: 0, cantidadExcel: excelMap[prod.cod] };
                }
                matches[prod.cod].totalPedido += prod.estado === 'incompleto'
                    ? prod.cantidad - (prod.cantidadRecibida ?? 0)
                    : prod.cantidad;
            });
        });
        return Object.values(matches);
    }, [datos, pedidos]);

    const conciliacionFiltrada = useMemo(() => {
        const q = busquedaConc.trim().toLowerCase();
        if (!q) return conciliacion;
        return conciliacion.filter(c => c.nombre.toLowerCase().includes(q) || String(c.cod).includes(q));
    }, [conciliacion, busquedaConc]);

    // ── Auto-navegación al cargar un archivo nuevo ───────────────────────────
    useEffect(() => {
        if (!primeraCarga) return;
        setVistaActiva(conciliacion.length > 0 ? 'conciliacion' : 'embarcado');
        setPrimeraCarga(false);
    }, [primeraCarga, conciliacion]);

    const handleConfirmarRecibidos = useCallback(async () => {
        setConfirmando(true);
        try {
            const items = conciliacion
                .filter(c => seleccionados.has(c.cod))
                .map(c => ({ cod: c.cod, cantidadRecibida: c.cantidadExcel }));
            await pedidosApi.confirmarRecibidos(items);
            message.success(`${items.length} producto${items.length !== 1 ? 's' : ''} marcado${items.length !== 1 ? 's' : ''} como recibido${items.length !== 1 ? 's' : ''}`);
            refetchPedidos?.();
            refetchEmbarcados?.();
            refetchConfirmados?.();
            refetchProductos?.();
            setSeleccionados(new Set());
            setVistaActiva('embarcado');
        } catch {
            message.error('No se pudo actualizar los estados.');
        } finally {
            setConfirmando(false);
        }
    }, [conciliacion, seleccionados, refetchPedidos, refetchEmbarcados, refetchConfirmados, refetchProductos]);

    // ── Empty state ──────────────────────────────────────────────────────────
    if (!datos) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
                <Spin spinning={cargando}>
                    <div className="flex flex-col items-center gap-5 w-full max-w-lg">
                        <div className="w-16 h-16 rounded-2xl bg-[#f0ebff] flex items-center justify-center text-3xl select-none">
                            🚢
                        </div>
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

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalEnvios   = gruposEmbarcado.length;
    const totalUdsEmb   = datos.embarcado.reduce((s, i) => s + (i.embarcado || i.pedido || 0), 0);
    const totalUdsPE    = datos.porEmbarcar.reduce((s, i) => s + i.pedido, 0);
    const totalUdsPEDash = porEmbarcarDashboard.reduce((s, i) => s + i.pedido, 0);
    const totalPE       = datos.porEmbarcar.length + porEmbarcarDashboard.length;
    const hoyTs         = Date.now();
    const maxEspera     = [...datos.porEmbarcar, ...porEmbarcarDashboard].reduce((mx, i) => {
        const d = i.fechaPedido ? Math.round((hoyTs - i.fechaPedido) / 86400000) : 0;
        return d > mx ? d : mx;
    }, 0);

    return (
        <div className="flex flex-col gap-4 pb-5">
            {/* Bar: archivo cargado */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-400">Archivo:</span>
                <span className="text-sm font-semibold text-[#370776] truncate max-w-xs">{nombreArchivo}</span>
                <Upload accept=".xls,.xlsx" showUploadList={false} beforeUpload={handleFile}>
                    <Button size="small">Cambiar archivo</Button>
                </Upload>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                    <p className="text-xs text-gray-400 mb-1">Envíos recibidos</p>
                    <p className="text-2xl font-extrabold text-[#370776] leading-none">{totalEnvios}</p>
                    <p className="text-xs text-gray-400 mt-1">{datos.embarcado.length} productos · {fmtN(totalUdsEmb)} uds.</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                    <p className="text-xs text-gray-400 mb-1">Por embarcar</p>
                    <p className="text-2xl font-extrabold text-orange-500 leading-none">{totalPE}</p>
                    <p className="text-xs text-gray-400 mt-1">{fmtN(totalUdsPE + totalUdsPEDash)} uds. pendientes</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
                    <p className="text-xs text-gray-400 mb-1">Espera más larga</p>
                    <p className={`text-2xl font-extrabold leading-none ${maxEspera <= 0 ? 'text-gray-300' : maxEspera <= 60 ? 'text-green-500' : maxEspera <= 120 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {maxEspera > 0 ? `${maxEspera}d` : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">pedido sin embarcar</p>
                </div>
            </div>

            {/* Toggle vista */}
            <div className="flex gap-2 flex-wrap">
                {[
                    { key: 'embarcado',   label: '🚢 Embarcados',   count: datos.embarcado.length },
                    { key: 'porEmbarcar', label: '⏳ Por embarcar',  count: totalPE },
                    ...(conciliacion.length > 0 ? [{ key: 'conciliacion', label: '✅ Conciliación', count: conciliacion.length }] : []),
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

            {/* ── EMBARCADOS ── */}
            {vistaActiva === 'embarcado' && (
                <div className="flex flex-col gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4 flex-wrap">
                        <Search
                            placeholder={subVistaEmb === 'factura' ? 'Buscar por producto, código o factura...' : 'Buscar por producto o código...'}
                            allowClear
                            style={{ flex: 1, minWidth: 220, maxWidth: 400 }}
                            value={busquedaEmb}
                            onChange={e => setBusquedaEmb(e.target.value)}
                        />
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 shrink-0">
                            {[{ key: 'factura', label: 'Por factura' }, { key: 'producto', label: 'Por producto' }].map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => setSubVistaEmb(s.key)}
                                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all
                                        ${subVistaEmb === s.key ? 'bg-white text-[#370776] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        <span className="text-sm font-semibold text-[#121027] shrink-0">
                            {subVistaEmb === 'factura'
                                ? `${gruposFiltrados.length} envío${gruposFiltrados.length !== 1 ? 's' : ''}`
                                : `${porProductoFiltrado.length} producto${porProductoFiltrado.length !== 1 ? 's' : ''}`}
                        </span>
                    </div>

                    {/* Sub-vista: Por factura */}
                    {subVistaEmb === 'factura' && (
                        gruposFiltrados.length === 0 ? (
                            <Empty description="Sin resultados." className="py-12" />
                        ) : (
                            <Collapse
                                expandIconPosition="end"
                                className="bg-transparent"
                                style={{ border: 'none' }}
                                items={gruposFiltrados.map(g => {
                                    const totalUds = g.items.reduce((s, i) => s + (i.embarcado || i.pedido || 0), 0);
                                    return {
                                        key: g.factura,
                                        label: (
                                            <div className="flex items-center gap-3 w-full min-w-0">
                                                <span className="font-semibold text-[#121027] shrink-0">{fmtFechaEmb(g.fechaEmbarque)}</span>
                                                <span className="font-mono text-xs font-semibold text-[#370776] shrink-0">{g.factura}</span>
                                                <span className="text-xs text-gray-400">
                                                    {g.items.length} producto{g.items.length !== 1 ? 's' : ''} · {fmtN(totalUds)} uds.
                                                </span>
                                            </div>
                                        ),
                                        children: (
                                            <Table
                                                dataSource={g.items.map((item) => ({ ...item, key: `${item.factura ?? g.factura}-${item.codigo}` }))}
                                                size="small" bordered pagination={false} rowKey="key"
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
                        )
                    )}

                    {/* Sub-vista: Por producto */}
                    {subVistaEmb === 'producto' && (
                        porProductoFiltrado.length === 0 ? (
                            <Empty description="Sin resultados." className="py-12" />
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                                    <span className="text-xs font-semibold text-gray-500 flex-1">Producto</span>
                                    <span className="text-xs font-semibold text-gray-500 w-20 text-center">Envíos</span>
                                    <span className="text-xs font-semibold text-gray-500 w-28 text-right">Total recibido</span>
                                    <span className="text-xs font-semibold text-gray-500 w-32 text-right">Último embarque</span>
                                </div>
                                {porProductoFiltrado.map(p => (
                                    <div key={p.cod} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-[#f6f2ff] transition-colors">
                                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                            <span className="text-xs text-gray-400 font-mono font-semibold">{p.cod}</span>
                                            <span className="text-sm text-[#121027] font-medium leading-tight truncate">{p.descripcion}</span>
                                        </div>
                                        <div className="w-20 flex justify-center">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.nEnvios > 1 ? 'bg-[#f0ebff] text-[#370776]' : 'bg-gray-100 text-gray-500'}`}>
                                                {p.nEnvios} envío{p.nEnvios !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <span className="text-sm font-bold text-[#370776] tabular-nums w-28 text-right">{fmtN(p.totalRecibido)} uds.</span>
                                        <span className="text-xs text-gray-500 w-32 text-right">{fmtFechaEmb(p.ultimoEmbarque)}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* ── POR EMBARCAR ── */}
            {vistaActiva === 'porEmbarcar' && (
                <div className="flex flex-col gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-4 flex-wrap">
                        <Search
                            placeholder="Buscar por producto o código..."
                            allowClear
                            style={{ flex: 1, minWidth: 220, maxWidth: 400 }}
                            value={busquedaPE}
                            onChange={e => setBusquedaPE(e.target.value)}
                        />
                        <div className="ml-auto flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200" /> +180d
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-200 ml-1" /> +120d
                                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-100 border border-yellow-200 ml-1" /> +60d
                            </div>
                            <span className="text-sm font-semibold text-[#121027]">
                                {porEmbarcarDashboardFiltrado.length + porEmbarcarFiltrado.length} productos
                            </span>
                        </div>
                    </div>

                    {/* Sección: confirmados en dashboard */}
                    {porEmbarcarDashboardFiltrado.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 px-1">
                                <span className="text-xs font-bold text-[#370776] uppercase tracking-wide">Dashboard</span>
                                <span className="text-xs text-gray-400">· {porEmbarcarDashboardFiltrado.length} producto{porEmbarcarDashboardFiltrado.length !== 1 ? 's' : ''} confirmados aguardando embarque</span>
                            </div>
                            <div className="overflow-x-auto">
                                <Table
                                    dataSource={porEmbarcarDashboardFiltrado}
                                    rowKey="codigo"
                                    size="small"
                                    bordered
                                    tableLayout="fixed"
                                    pagination={{ pageSize: 50, showSizeChanger: false }}
                                    scroll={{ x: 'max-content' }}
                                    columns={[
                                        {
                                            title: 'Código',
                                            dataIndex: 'codigo', width: 110,
                                            render: v => <span className="font-mono text-xs font-semibold text-[#370776]">{v}</span>,
                                        },
                                        {
                                            title: 'Descripción',
                                            dataIndex: 'descripcion',
                                            render: v => <span className="text-sm text-[#121027]">{v}</span>,
                                        },
                                        {
                                            title: 'Fecha confirmación',
                                            dataIndex: 'fechaPedido', width: 150, align: 'center',
                                            render: v => <span className="text-xs text-gray-500">{fmtFechaEmb(v)}</span>,
                                        },
                                        {
                                            title: 'Días esperando',
                                            dataIndex: 'diasEspera', width: 130, align: 'center',
                                            sorter: (a, b) => a.diasEspera - b.diasEspera,
                                            defaultSortOrder: 'descend',
                                            render: v => {
                                                if (!v) return <span className="text-gray-300">—</span>;
                                                const cls = v > 180 ? 'bg-red-100 text-red-700'
                                                    : v > 120 ? 'bg-orange-100 text-orange-700'
                                                    : v > 60  ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-green-100 text-green-700';
                                                return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{v}d</span>;
                                            },
                                        },
                                        {
                                            title: 'Cantidad',
                                            dataIndex: 'pedido', width: 110, align: 'right',
                                            render: v => <span className="text-sm font-bold text-[#370776] tabular-nums">{fmtN(v)}</span>,
                                        },
                                    ]}
                                    rowClassName={(r) =>
                                        r.diasEspera > 180 ? '!bg-red-50 hover:!bg-red-100'
                                        : r.diasEspera > 120 ? '!bg-orange-50 hover:!bg-orange-100'
                                        : r.diasEspera > 60  ? '!bg-yellow-50 hover:!bg-yellow-100'
                                        : 'hover:bg-[#f6f2ff]'
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* Sección: por embarcar desde Excel */}
                    {porEmbarcarFiltrado.length > 0 && (
                        <div className="flex flex-col gap-2">
                            {porEmbarcarDashboardFiltrado.length > 0 && (
                                <div className="flex items-center gap-2 px-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Excel</span>
                                    <span className="text-xs text-gray-400">· {porEmbarcarFiltrado.length} producto{porEmbarcarFiltrado.length !== 1 ? 's' : ''} en el sistema del cliente</span>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <Table
                                    dataSource={porEmbarcarFiltrado}
                                    rowKey="codigo"
                                    size="small"
                                    bordered
                                    tableLayout="fixed"
                                    pagination={{ pageSize: 50, showSizeChanger: false }}
                                    scroll={{ x: 'max-content' }}
                                    columns={[
                                        {
                                            title: 'Código',
                                            dataIndex: 'codigo', width: 110,
                                            render: v => <span className="font-mono text-xs font-semibold text-[#370776]">{v}</span>,
                                        },
                                        {
                                            title: 'Descripción',
                                            dataIndex: 'descripcion',
                                            render: v => <span className="text-sm text-[#121027]">{v}</span>,
                                        },
                                        {
                                            title: 'Fecha pedido',
                                            dataIndex: 'fechaPedido', width: 130, align: 'center',
                                            render: v => <span className="text-xs text-gray-500">{fmtFechaEmb(v)}</span>,
                                        },
                                        {
                                            title: 'Días esperando',
                                            dataIndex: 'diasEspera', width: 130, align: 'center',
                                            sorter: (a, b) => a.diasEspera - b.diasEspera,
                                            defaultSortOrder: 'descend',
                                            render: v => {
                                                if (!v) return <span className="text-gray-300">—</span>;
                                                const cls = v > 180 ? 'bg-red-100 text-red-700'
                                                    : v > 120 ? 'bg-orange-100 text-orange-700'
                                                    : v > 60  ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-green-100 text-green-700';
                                                return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{v}d</span>;
                                            },
                                        },
                                        {
                                            title: 'Cantidad',
                                            dataIndex: 'pedido', width: 110, align: 'right',
                                            render: v => <span className="text-sm font-bold text-[#370776] tabular-nums">{fmtN(v)}</span>,
                                        },
                                    ]}
                                    rowClassName={(r) =>
                                        r.diasEspera > 180 ? '!bg-red-50 hover:!bg-red-100'
                                        : r.diasEspera > 120 ? '!bg-orange-50 hover:!bg-orange-100'
                                        : r.diasEspera > 60  ? '!bg-yellow-50 hover:!bg-yellow-100'
                                        : 'hover:bg-[#f6f2ff]'
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {porEmbarcarDashboardFiltrado.length === 0 && porEmbarcarFiltrado.length === 0 && (
                        <Empty description="Sin productos por embarcar." className="py-12" />
                    )}
                </div>
            )}

            {/* ── CONCILIACIÓN ── */}
            {vistaActiva === 'conciliacion' && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Search
                            placeholder="Buscar por nombre o código..."
                            allowClear
                            style={{ maxWidth: 320 }}
                            value={busquedaConc}
                            onChange={e => setBusquedaConc(e.target.value)}
                        />
                        <div className="ml-auto flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                                {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
                            </span>
                            <Button
                                type="primary"
                                style={{ background: '#370776', borderColor: '#370776' }}
                                disabled={seleccionados.size === 0}
                                loading={confirmando}
                                onClick={handleConfirmarRecibidos}
                            >
                                Confirmar recibidos
                            </Button>
                        </div>
                    </div>

                    {conciliacionFiltrada.length === 0 ? (
                        <Empty description="Sin coincidencias." className="py-12" />
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                                <input
                                    type="checkbox"
                                    checked={conciliacionFiltrada.length > 0 && conciliacionFiltrada.every(c => seleccionados.has(c.cod))}
                                    onChange={e => {
                                        if (e.target.checked) setSeleccionados(new Set(conciliacionFiltrada.map(c => c.cod)));
                                        else setSeleccionados(new Set());
                                    }}
                                    className="w-4 h-4 accent-[#370776]"
                                />
                                <span className="text-xs font-semibold text-gray-500 flex-1">Producto</span>
                                <span className="text-xs font-semibold text-gray-500 w-24 text-right">Pedido</span>
                                <span className="text-xs font-semibold text-gray-500 w-24 text-right">Excel</span>
                                <span className="text-xs font-semibold text-gray-500 w-24 text-right">Diferencia</span>
                            </div>
                            {conciliacionFiltrada.map(c => {
                                const diff = c.cantidadExcel - c.totalPedido;
                                const checked = seleccionados.has(c.cod);
                                return (
                                    <div
                                        key={c.cod}
                                        onClick={() => setSeleccionados(prev => {
                                            const next = new Set(prev);
                                            checked ? next.delete(c.cod) : next.add(c.cod);
                                            return next;
                                        })}
                                        className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors
                                            ${checked ? 'bg-[#f0ebff]' : 'hover:bg-gray-50'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {}}
                                            className="w-4 h-4 accent-[#370776] pointer-events-none"
                                        />
                                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                            <span className="text-xs text-gray-400 font-mono font-semibold">{c.cod}</span>
                                            <span className="text-sm text-[#121027] font-medium leading-tight truncate">{c.nombre}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 w-24 text-right tabular-nums">{fmtN(c.totalPedido)}</span>
                                        <span className="text-sm font-semibold text-[#370776] w-24 text-right tabular-nums">{fmtN(c.cantidadExcel)}</span>
                                        <span className={`text-sm font-bold w-24 text-right tabular-nums ${diff >= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                                            {diff >= 0 ? '+' : ''}{fmtN(diff)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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

    const initialLoadDone = useRef(false);
    useEffect(() => {
        if (rawProductos.length > 0) {
            setFilas(rawProductos);
            if (!initialLoadDone.current) {
                setAPedir({});
                initialLoadDone.current = true;
            }
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
            const cat = getCategoriaDeProducto(p);
            if (counts[cat] !== undefined) counts[cat]++;
        });
        return counts;
    }, [filas]);

    // ── Filas visibles ───────────────────────────────────────────────────────
    const filasFiltradas = useMemo(() => {
        const base = searchQuery.trim() ? searchResults : (filas ?? []);
        if (categoriaSeleccionada === 'todos') return base;
        return base.filter(p => getCategoriaDeProducto(p) === categoriaSeleccionada);
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
        const fuente = filasFiltradas.filter(p => (p.sugerencia ?? 0) > 0 && !p.descartado);
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
            dataIndex: 'nombre', key: 'nombre', width: 220,
            render: (val, record) => (
                <Tooltip title={val} placement="topLeft" mouseEnterDelay={0.5}>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-sm font-medium leading-tight truncate ${record.descartado ? 'text-gray-400' : 'text-[#121027]'}`}>{val}</span>
                        {record.descartado && (
                            <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', flexShrink: 0, marginInlineEnd: 0 }}>
                                Descartado
                            </Tag>
                        )}
                    </div>
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

    const productosConCantidad = pedidoCods.map(cod => pedidoInfo[cod]).filter(p => p && (aPedir[p.cod] ?? 0) > 0);

    const statusLabel = useMemo(() => {
        if (searchQuery.trim()) {
            return { text: `${filasFiltradas.length} resultado${filasFiltradas.length !== 1 ? 's' : ''}`, sub: `para "${searchQuery.trim()}"` };
        }
        const prioritarios  = filasFiltradas.filter(p => !p.descartado).length;
        const descartadosN  = filasFiltradas.filter(p =>  p.descartado).length;
        const sub = descartadosN > 0
            ? `según stock y proyección · ${descartadosN} descartado${descartadosN !== 1 ? 's' : ''} al final`
            : 'según stock y proyección';
        return { text: `${prioritarios} producto${prioritarios !== 1 ? 's' : ''} a pedir`, sub };
    }, [searchQuery, filasFiltradas]);

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
                                                    rowClassName={(record) => {
                                                        if (pedidoCods.includes(record.cod)) return '!bg-[#e8dcff] hover:!bg-[#ddd0ff]';
                                                        if (record.descartado) return '!bg-gray-50 opacity-60 hover:!opacity-100';
                                                        return 'hover:bg-[#f6f2ff]';
                                                    }}
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
                                children: <EmbarquesTab pedidos={pedidos} refetchPedidos={refetchPedidos} refetchEmbarcados={refetchEmbarcados} refetchConfirmados={refetchConfirmados} refetchProductos={refetchProductos} />,
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
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-medium leading-tight ${p.descartado ? 'text-gray-400' : 'text-[#121027]'}`}>{p.nombre}</span>
                                        {p.descartado && <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', flexShrink: 0, marginInlineEnd: 0 }}>Descartado</Tag>}
                                    </div>
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
