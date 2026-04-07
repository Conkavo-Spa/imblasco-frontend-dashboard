import React, { useEffect, useMemo, useState } from 'react';
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
    Badge,
    Tooltip,
    Popconfirm,
    message,
} from 'antd';
import useEmailConversations from '../../hooks/useEmailConversations';
import { useMediaQuery } from 'react-responsive';
import { useNavigate, useLocation } from 'react-router-dom';
import EmailConversations from '../../services/EmailConversations';

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

// --- Helpers para puntos de estado ---
const hasMailFeedback = (record) => {
    if (record?.summary?.hasFeedback) return true;
    const msgs = record?.messages || [];
    return msgs.some((m) => Boolean(String(m.feedback || '').trim()));
};
const getLatestMailFeedbackText = (record) => {
    if (record?.summary?.lastFeedbackText) return record.summary.lastFeedbackText;
    const msgs = [...(record?.messages || [])].reverse();
    for (const m of msgs) {
        const t = String(m.feedback || '').trim();
        if (t) return t;
    }
    return '';
};
const hasPruebaMail = (record) => {
    const msgs = record?.messages || [];
    return msgs.some((m) => {
        const txt = String(m.content?.text || m.body || '').trimStart();
        return txt.toUpperCase().startsWith('PRUEBA');
    });
};
const hasMailGoodAnswer = (record) =>
    record?.summary?.hasGoodAnswer === true || record?.isGoodAnswer === true;

const MailFeedbackDots = ({ record }) => {
    const hasFeedback = hasMailFeedback(record);
    const hasPrueba = hasPruebaMail(record);
    const hasGoodAnswer = hasMailGoodAnswer(record);
    if (!hasFeedback && !hasPrueba && !hasGoodAnswer) return null;
    const fbTxt = getLatestMailFeedbackText(record);
    const fbTitle = fbTxt ? `Feedback: ${fbTxt}` : 'Este mail tiene feedback';
    return (
        <span className="inline-flex items-center gap-1 leading-none">
            {hasFeedback ? (
                <Tooltip title={fbTitle}>
                    <span className="inline-flex leading-none">
                        <Badge className="im-feedback-dot" dot color="#faad14" />
                    </span>
                </Tooltip>
            ) : null}
            {hasGoodAnswer ? (
                <Tooltip title="Bien respondido">
                    <span className="inline-flex leading-none">
                        <Badge className="im-feedback-dot" dot color="#52c41a" />
                    </span>
                </Tooltip>
            ) : null}
            {hasPrueba ? (
                <Tooltip title="Mail de prueba">
                    <span className="inline-flex leading-none">
                        <Badge className="im-feedback-dot" dot color="#1677ff" />
                    </span>
                </Tooltip>
            ) : null}
        </span>
    );
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
    const location = useLocation();

    // Sincronizar currentPage con ?page= de la URL
    useEffect(() => {
        const q = new URLSearchParams(location.search || '');
        const p = Number(q.get('page') || '1');
        const page = Number.isFinite(p) && p > 0 ? p : 1;
        setCurrentPage(page);
    }, [location.search]);

    const isCesar = useMemo(() => {
        try {
            const raw = localStorage.getItem('user');
            const user = raw ? JSON.parse(raw) : null;
            return user?.email === 'cesar.barahona@conkavo.cl';
        } catch (_) {
            return false;
        }
    }, []);

    const handleMailDelete = async (id) => {
        try {
            await EmailConversations.deleteConversation(String(id));
            message.success('Hilo eliminado');
            navigate('/mails', { replace: true });
        } catch (err) {
            message.error(err?.response?.data?.message || 'No se pudo eliminar');
        }
    };

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
            width: 200,
            ellipsis: true,
            render: (val) => <span style={{ fontSize: 9 }}>{val || '—'}</span>,
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
            width: isCesar ? 170 : 120,
            align: 'center',
            render: (_, record) => (
                <div className="flex items-center justify-center gap-2 leading-none">
                    <MailFeedbackDots record={record} />
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => {
                            const q = new URLSearchParams(location.search || '');
                            q.set('fromPage', String(currentPage));
                            navigate(`/mails/${String(record._id)}?${q.toString()}`, { state: { conversation: record } });
                        }}
                    >
                        Detalle
                    </Button>
                    {isCesar ? (
                        <Popconfirm
                            title="¿Eliminar este hilo?"
                            description="Esta acción no se puede deshacer."
                            onConfirm={() => handleMailDelete(record._id)}
                            okText="Eliminar"
                            cancelText="Cancelar"
                            okButtonProps={{ danger: true }}
                        >
                            <Button type="link" danger size="small">
                                Eliminar
                            </Button>
                        </Popconfirm>
                    ) : null}
                </div>
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
                            pagination={{
                                pageSize: itemsPerPage,
                                current: currentPage,
                                onChange: (page) => {
                                    setCurrentPage(page);
                                    const q = new URLSearchParams(location.search || '');
                                    q.set('page', String(page));
                                    navigate(`/mails?${q.toString()}`, { replace: true });
                                },
                            }}
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
                                                <div className="mt-3 flex items-center gap-2">
                                                    <MailFeedbackDots record={conv} />
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        onClick={() => {
                                                            const q = new URLSearchParams(location.search || '');
                                                            q.set('fromPage', String(currentPage));
                                                            navigate(`/mails/${String(conv._id)}?${q.toString()}`, { state: { conversation: conv } });
                                                        }}
                                                    >
                                                        Detalle
                                                    </Button>
                                                    {isCesar ? (
                                                        <Popconfirm
                                                            title="¿Eliminar este hilo?"
                                                            description="Esta acción no se puede deshacer."
                                                            onConfirm={() => handleMailDelete(conv._id)}
                                                            okText="Eliminar"
                                                            cancelText="Cancelar"
                                                            okButtonProps={{ danger: true }}
                                                        >
                                                            <Button type="link" danger size="small">
                                                                Eliminar
                                                            </Button>
                                                        </Popconfirm>
                                                    ) : null}
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
