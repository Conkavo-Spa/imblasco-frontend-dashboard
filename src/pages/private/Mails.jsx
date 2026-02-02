import React, { useMemo, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import {
    Table,
    Input,
    DatePicker,
    Select,
    Card,
    Pagination,
    Empty,
    Button,
    Tag,
} from 'antd';
import useEmailConversations from '../../hooks/useEmailConversations';
import { useMediaQuery } from 'react-responsive';
import { useNavigate } from 'react-router-dom';

// Diccionarios para valores "técnicos" → texto amigable
const CLASIFICACIONES = {
    SOLICITUD_INFORMACION_GENERAL: 'Información General',
    SOLICITUD_INFORMACION_PRODUCTOS: 'Información de productos',
    ENVIAR_COTIZACION: 'Solicita cotizacion',
    NO_CLASIFICADA: 'No clasificado',
};

const ACTIONS = {
    COTIZAR: 'Cotizar',
    RESPONDER_INFO: 'Responder información',
    ESPERAR_DATOS_CLIENTE: 'Esperar datos cliente',
    NO_RESPONDIDA: 'No respondida',
};

const THREAD_STATES = {
    ABIERTO: 'Abierto',
    CONSULTA_PENDIENTE: 'Pendiente Imblasco',
    LISTO_PARA_COTIZAR: 'Cotizable',
    PENDIENTE_DATOS_CLIENTE: 'Pendiente datos cliente',
    RESUELTO: 'Resuelto',
    ERROR: 'Error.',
};

const humanizeDict = (dict, value) => {
    const v = String(value ?? '').trim();
    if (!v) return '—';
    return dict[v] || v;
};

const toYMD = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (typeof value === 'object' && typeof value.format === 'function') {
        // AntD DatePicker returns a Dayjs instance by default
        return value.format('YYYY-MM-DD');
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

const Mails = () => {
    const [emailQuery, setEmailQuery] = useState('');
    const [dateFilter, setDateFilter] = useState(null);
    const [clasificacionFilter, setClasificacionFilter] = useState('');
    const [accionFilter, setAccionFilter] = useState('');
    const [estadoFilter, setEstadoFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const isMobile = useMediaQuery({ maxWidth: 768 });
    const navigate = useNavigate();

    const { data, isLoading } = useEmailConversations({ page: 1, limit: 100 });

    const conversations = data?.data?.docs ?? [];
    const dataToRender = useMemo(() => {
        const qEmail = String(emailQuery || '').trim().toLowerCase();
        const targetYmd = toYMD(dateFilter);

        return conversations.filter((item) => {
            const customerEmail = String(item.participants?.customer?.email || '').toLowerCase();
            const clasificacionRaw = String(item.clasificacion || '').trim();
            const accionRaw = String(item.accion || '').trim();
            const estadoRaw = String(item.estado || item.status?.state || '').trim();
            const itemYmd = toYMD(item.summary?.lastMessageAt);

            if (qEmail && !customerEmail.includes(qEmail)) return false;
            if (targetYmd && (!itemYmd || itemYmd !== targetYmd)) return false;
            if (clasificacionFilter && clasificacionRaw !== clasificacionFilter) return false;
            if (accionFilter && accionRaw !== accionFilter) return false;
            if (estadoFilter && estadoRaw !== estadoFilter) return false;

            return true;
        });
    }, [conversations, emailQuery, dateFilter, clasificacionFilter, accionFilter, estadoFilter]);

    const itemsPerPage = 5;
    const paginatedData = dataToRender.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const columns = [
        {
            title: <span className="whitespace-nowrap">Asunto</span>,
            dataIndex: 'subject',
            key: 'subject',
            ellipsis: true,
            render: (val) => val || '—',
        },
        {
            title: <span className="whitespace-nowrap">Cliente</span>,
            key: 'customer',
            width: 200,
            ellipsis: true,
            render: (_, record) => {
                const c = record.participants?.customer;
                if (!c) return '—';
                return (
                    <span>
                        {c.name || '—'}<br />
                        <small className="text-gray-500">{c.email || ''}</small>
                    </span>
                );
            },
        },
        {
            title: <span className="whitespace-nowrap">Fecha</span>,
            key: 'lastMessageAt',
            width: 140,
            render: (_, record) => formatDate(record.summary?.lastMessageAt),
        },
        {
            title: <span className="whitespace-nowrap">Mensajes</span>,
            key: 'messageCount',
            width: 90,
            align: 'center',
            render: (_, record) => record.summary?.messageCount ?? 0,
        },
        {
            title: <span className="whitespace-nowrap">Clasificación</span>,
            key: 'classification',
            width: 150,
            render: (_, record) => humanizeDict(CLASIFICACIONES, record.clasificacion),
        },
        {
            title: <span className="whitespace-nowrap">Acción</span>,
            key: 'action',
            width: 110,
            render: (_, record) => humanizeDict(ACTIONS, record.accion),
        },
        {
            title: <span className="whitespace-nowrap">Estado</span>,
            key: 'state',
            width: 110,
            ellipsis: true,
            render: (_, record) => {
                const stRaw = record.estado || record.status?.state;
                const st = humanizeDict(THREAD_STATES, stRaw);
                if (!st) return '—';
                const color =
                    stRaw === 'RESUELTO' ? 'green'
                        : stRaw === 'ERROR' ? 'red'
                            : 'blue';
                return (
                    <div className="max-w-full overflow-hidden">
                        <Tag
                            color={color}
                            className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-middle"
                            style={{ maxWidth: '100%', display: 'inline-block' }}
                        >
                            {st}
                        </Tag>
                    </div>
                );
            },
        },
        {
            title: <span className="whitespace-nowrap">Detalle</span>,
            key: 'actions',
            width: 110,
            align: 'center',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    style={{ width: '100%', maxWidth: '100%' }}
                    onClick={() => navigate(`/mails/${String(record._id)}`, { state: { conversation: record } })}
                >
                    Detalle
                </Button>
            ),
        },
    ];

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto overflow-x-auto pb-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-extrabold text-[#370776]">Mails</h1>
                </div>

                <div className="mb-6 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            placeholder="Correo del cliente"
                            allowClear
                            value={emailQuery}
                            onChange={(e) => {
                                setCurrentPage(1);
                                setEmailQuery(e.target.value);
                            }}
                            className="w-full sm:w-[320px]"
                        />

                        <DatePicker
                            placeholder="Fecha"
                            allowClear
                            value={dateFilter}
                            onChange={(val) => {
                                setCurrentPage(1);
                                setDateFilter(val);
                            }}
                            className="w-full sm:w-[220px]"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Select
                            allowClear
                            value={clasificacionFilter || undefined}
                            placeholder="Clasificación"
                            className="w-full sm:w-[260px]"
                            onChange={(val) => {
                                setCurrentPage(1);
                                setClasificacionFilter(val || '');
                            }}
                            options={Object.entries(CLASIFICACIONES).map(([value, label]) => ({ value, label }))}
                        />

                        <Select
                            allowClear
                            value={accionFilter || undefined}
                            placeholder="Acción"
                            className="w-full sm:w-[220px]"
                            onChange={(val) => {
                                setCurrentPage(1);
                                setAccionFilter(val || '');
                            }}
                            options={Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))}
                        />

                        <Select
                            allowClear
                            value={estadoFilter || undefined}
                            placeholder="Estado"
                            className="w-full sm:w-[220px]"
                            onChange={(val) => {
                                setCurrentPage(1);
                                setEstadoFilter(val || '');
                            }}
                            options={Object.entries(THREAD_STATES).map(([value, label]) => ({ value, label }))}
                        />

                        <Button
                            onClick={() => {
                                setCurrentPage(1);
                                setEmailQuery('');
                                setDateFilter(null);
                                setClasificacionFilter('');
                                setAccionFilter('');
                                setEstadoFilter('');
                            }}
                        >
                            Limpiar
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {!isMobile ? (
                        <Table
                            dataSource={dataToRender}
                            columns={columns}
                            loading={isLoading}
                            pagination={{ pageSize: itemsPerPage }}
                            bordered
                            tableLayout="fixed"
                            size="small"
                            className="text-[12px]"
                            rowKey="_id"
                        />
                    ) : (
                        <>
                            {paginatedData.length > 0 ? (
                                <>
                                    <div className="flex flex-col gap-4">
                                        {paginatedData.map((conv) => (
                                            <Card
                                                key={conv._id}
                                                title={conv.subject || 'Sin asunto'}
                                                bordered
                                                className="shadow border-[#370776]/20"
                                            >
                                                <p>
                                                    <b>Cliente:</b>{' '}
                                                    {conv.participants?.customer?.name || '—'}{' '}
                                                    {conv.participants?.customer?.email && (
                                                        <span className="text-gray-600">
                                                            ({conv.participants.customer.email})
                                                        </span>
                                                    )}
                                                </p>
                                                <p>
                                                    <b>Fecha:</b> {formatDate(conv.summary?.lastMessageAt)}
                                                </p>
                                                <p>
                                                    <b>Mensajes:</b> {conv.summary?.messageCount ?? 0}
                                                </p>
                                                <p>
                                                    <b>Clasificación:</b> {humanizeDict(CLASIFICACIONES, conv.clasificacion)}
                                                </p>
                                                <p>
                                                    <b>Acción:</b> {humanizeDict(ACTIONS, conv.accion)}
                                                </p>
                                                <p>
                                                    <b>Estado:</b> {humanizeDict(THREAD_STATES, conv.estado ?? conv.status?.state)}
                                                </p>
                                                <div className="mt-3">
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        style={{ maxWidth: '100%' }}
                                                        onClick={() => navigate(`/mails/${String(conv._id)}`, { state: { conversation: conv } })}
                                                    >
                                                        Detalle
                                                    </Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                    <div className="flex justify-center mt-4">
                                        <Pagination
                                            current={currentPage}
                                            pageSize={itemsPerPage}
                                            total={dataToRender.length}
                                            onChange={(page) => setCurrentPage(page)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-center items-center min-h-[300px]">
                                    <Empty description="No hay conversaciones de email" />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Mails;
