import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import {
    Table,
    Card,
    Pagination,
    Empty,
    Button,
    DatePicker,
    Badge,
    Tooltip,
    Popconfirm,
    message,
    Modal,
} from 'antd';
// icon removed to fit column width
import useConversations from '../../hooks/useConversations';
import Conversations from '../../services/Conversations';
import { useQueryClient } from '@tanstack/react-query';
import { useMediaQuery } from 'react-responsive';
import { useLocation, useNavigate } from 'react-router-dom';

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

const CHAT_LIST_STATE = 'chat_list_state';
const CHAT_LAST_PAGE = 'chat_last_page';

const hasConversationFeedback = (record) => {
    try {
        if (record?.summary?.hasFeedback === true) return true;
        if (Number(record?.summary?.feedbackCount || 0) > 0) return true;
        if (Number(record?.summary?.messageFeedbackCount || 0) > 0) return true;
        if (record?.hasFeedback === true) return true;
        const msgs = record?.messages;
        if (Array.isArray(msgs) && msgs.some((m) => String(m?.feedback || '').trim())) return true;
    } catch (_) { /* ignore */ }
    return false;
};

const getLastFeedbackText = (record) => {
    try {
        const summary = record?.summary || {};
        const direct =
            summary.lastFeedbackText ||
            summary.lastFeedback ||
            summary.feedback ||
            record?.lastFeedbackText ||
            record?.feedback ||
            null;
        if (direct && String(direct).trim()) return String(direct).trim();

        const msgs = record?.messages;
        if (Array.isArray(msgs) && msgs.length > 0) {
            const withFb = msgs
                .filter((m) => String(m?.feedback || '').trim())
                .sort((a, b) => new Date(a?.sentAt || 0) - new Date(b?.sentAt || 0));
            const last = withFb[withFb.length - 1];
            if (last && String(last.feedback || '').trim()) return String(last.feedback).trim();
        }
    } catch (_) { /* ignore */ }
    return '';
};

const hasGoodAnswer = (record) => {
    try {
        if (record?.isGoodAnswer === true || record?.goodAnswer === true) return true;
        if (record?.summary?.isGoodAnswer === true || record?.summary?.goodAnswer === true) return true;
        if (record?.summary?.hasGoodAnswer === true) return true;
        if (record?.summary?.hasGoodAnswers === true) return true;
        if (Number(record?.summary?.goodAnswerCount || 0) > 0) return true;
    } catch (_) { /* ignore */ }
    return false;
};

const hasCorrected = (record) => {
    try {
        if (record?.isCorrected === true) return true;
        if (record?.summary?.isCorrected === true) return true;
    } catch (_) { /* ignore */ }
    return false;
};

const hasPruebaMessage = (record) => {
    try {
        const preview = String(record?.summary?.lastMessagePreview || '');
        if (/^\s*prueba\b/i.test(preview)) return true;
        const msgs = record?.messages;
        if (Array.isArray(msgs)) {
            return msgs.some((m) => /^\s*prueba\b/i.test(String(m?.content?.text || m?.content || '')));
        }
    } catch (_) { /* ignore */ }
    return false;
};

const FeedbackDots = ({ record }) => {
    const hasFeedback = hasConversationFeedback(record);
    const hasPrueba = hasPruebaMessage(record);
    const good = hasGoodAnswer(record);
    const corrected = hasCorrected(record);
    if (!hasFeedback && !hasPrueba && !good && !corrected) return null;

    const fbTxt = hasFeedback ? getLastFeedbackText(record) : '';
    const fbTitle = fbTxt ? `Feedback: ${fbTxt}` : 'Este chat tiene feedback';

    return (
        <span className="inline-flex items-center gap-1 leading-none">
            {hasFeedback ? (
                <Tooltip title={fbTitle}>
                    <span className="inline-flex leading-none">
                        <Badge className="im-feedback-dot" dot color="#faad14" />
                    </span>
                </Tooltip>
            ) : null}
            {good ? (
                <Tooltip title="Bien respondido">
                    <span className="inline-flex leading-none">
                        <Badge className="im-feedback-dot" dot color="#52c41a" />
                    </span>
                </Tooltip>
            ) : null}
            {corrected ? (
                <Tooltip title="Corregida">
                    <span className="inline-flex leading-none">
                        <Badge className="im-feedback-dot" dot color="#722ed1" />
                    </span>
                </Tooltip>
            ) : null}
            {hasPrueba ? (
                <Tooltip title="Chat de prueba">
                    <span className="inline-flex leading-none">
                        <Badge className="im-feedback-dot" dot color="#1677ff" />
                    </span>
                </Tooltip>
            ) : null}
        </span>
    );
};

const Chat = () => {
    const loadInitialState = () => {
        try {
            const raw = sessionStorage.getItem(CHAT_LIST_STATE);
            if (!raw) return { page: 1, date: null, scrollY: 0 };
            const obj = JSON.parse(raw);
            return {
                page: Number(obj.page) > 0 ? Number(obj.page) : 1,
                date: obj.date || null,
                scrollY: Number.isFinite(obj.scrollY) ? Number(obj.scrollY) : 0,
            };
        } catch (_) {
            return { page: 1, date: null, scrollY: 0 };
        }
    };

    const initial = loadInitialState();
    const scrollRef = useRef(null);

    // Obtiene el elemento que realmente scrollea (tabla, contenedor o documento)
    const getScrollElement = () => {
        // 1) Cuerpo de tabla de AntD si existe
        const tableBody = document.querySelector('.ant-table-body');
        if (tableBody && tableBody.scrollHeight > tableBody.clientHeight) return tableBody;
        // 2) Nuestro contenedor principal con overflow-y-auto
        if (scrollRef.current && scrollRef.current.scrollHeight > scrollRef.current.clientHeight) return scrollRef.current;
        // 3) Fallback: documento
        return document.scrollingElement || document.documentElement || document.body;
    };

    const getBestScrollTop = () => {
        const tableBody = document.querySelector('.ant-table-body');
        const refEl = scrollRef.current;
        const docEl = document.scrollingElement || document.documentElement || document.body;
        return Math.max(
            tableBody ? tableBody.scrollTop : 0,
            refEl ? refEl.scrollTop : 0,
            docEl ? docEl.scrollTop : 0
        );
    };
    // Página inicial desde query ?page=..., fallback a session/1
    const getInitialPageFromQuery = () => {
        try {
            const q = new URLSearchParams(location.search || '');
            const p = Number(q.get('page') || '0');
            if (Number.isFinite(p) && p > 0) return p;
        } catch (_) {}
        return initial.page || 1;
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [dateFilter, setDateFilter] = useState(initial.date);

    const isMobile = useMediaQuery({ maxWidth: 768 });
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();

    const canDelete = (() => {
        try {
            const raw = localStorage.getItem('user');
            const u = raw ? JSON.parse(raw) : null;
            return u?.email === 'cesar.barahona@conkavo.cl';
        } catch (_) {
            return false;
        }
    })();

    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportFrom, setExportFrom] = useState(null);
    const [exportTo, setExportTo] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const from = exportFrom ? exportFrom.format('YYYY-MM-DD') : undefined;
            const to = exportTo ? exportTo.format('YYYY-MM-DD') : undefined;
            const resp = await Conversations.exportConversations(from, to);
            const docs = resp?.data?.data ?? resp?.data ?? [];
            const blob = new Blob([JSON.stringify(docs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const filename = `chats_${from || 'inicio'}_${to || 'hoy'}.json`;
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            message.success(`Descargado: ${filename}`);
            setIsExportOpen(false);
        } catch (err) {
            message.error(err?.response?.data?.message || 'No se pudo exportar');
        } finally {
            setIsExporting(false);
        }
    };

    const { data, isLoading } = useConversations({ channel: 'chat', page: 1, limit: 100 });

    // Sincronizar currentPage con la query cada vez que cambie la URL
    useEffect(() => {
        try {
            const q = new URLSearchParams(location.search || '');
            const p = Number(q.get('page') || '1');
            setCurrentPage(Number.isFinite(p) && p > 0 ? p : 1);
        } catch (_) {
            setCurrentPage(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    // Restaurar scroll del contenedor tras montar
    useEffect(() => {
        const y = Number(initial.scrollY) || 0;
        if (y) {
            setTimeout(() => {
                const el = getScrollElement();
                if (el) el.scrollTop = y;
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const conversations = data?.data?.docs ?? [];
    const dataToRender = useMemo(() => {
        const target = toYMD(dateFilter);
        if (!target) return conversations;
        return conversations.filter((item) => {
            const ymd = toYMD(item.summary?.lastMessageAt);
            return !!ymd && ymd === target;
        });
    }, [conversations, dateFilter]);

    const itemsPerPage = 5;
    const paginatedData = dataToRender.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const columns = [
        {
            title: <span className="whitespace-nowrap">Cliente</span>,
            key: 'customer',
            width: 160,
            ellipsis: true,
            render: (_, record) => {
                // Datos de cliente enviados por backend
                const customer =
                    record?.participants?.customer ||
                    {}; // posible ubicación enviada por backend
                const customerName =
                    customer?.name ||
                    record?.summary?.customerName ||
                    null;
                const customerEmail =
                    customer?.email ||
                    record?.summary?.customerEmail ||
                    null;

                const identified = customerName || customerEmail;
                if (identified) return identified;

                // Regla solicitada: solo para el usuario cesar, mostrar IP si no hay datos
                try {
                    const raw = localStorage.getItem('user');
                    const user = raw ? JSON.parse(raw) : null;
                    if (user?.email === 'cesar.barahona@conkavo.cl') {
                        return record?.summary?.lastSeenIp || String(record?._id || 'No identificado');
                    }
                } catch (_) { /* ignore */ }

                return 'No identificado';
            },
        },
        {
            title: <span className="whitespace-nowrap">Último mensaje</span>,
            key: 'preview',
            ellipsis: true,
            render: (_, record) => {
                const preview = record.summary?.lastMessagePreview;
                const txt = preview ? `${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''}` : '—';
                return <span>{txt}</span>;
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
            title: <span className="whitespace-nowrap">Detalle</span>,
            key: 'actions',
            width: 160,
            align: 'center',
            render: (_, record) => (
                <div className="flex items-center justify-center gap-2 leading-none">
                    <FeedbackDots record={record} />
                    <Button
                        type="primary"
                        size="small"
                        style={{ maxWidth: '100%' }}
                        onClick={() => {
                            try { sessionStorage.setItem(CHAT_LAST_PAGE, String(currentPage)); } catch (_) {}
                            const nextState = {
                                state: {
                                    conversation: record,
                                    from: {
                                        pathname: location.pathname,
                                        page: currentPage,
                                    },
                                },
                            };
                            navigate(`/chat/${String(record._id)}?fromPage=${currentPage}`, nextState);
                        }}
                    >
                        Detalle
                    </Button>
                    {canDelete ? (
                        <Popconfirm
                            title="Eliminar hilo"
                            description="¿Seguro que quieres eliminar esta conversación?"
                            okText="Eliminar"
                            cancelText="Cancelar"
                            okButtonProps={{ danger: true }}
                            onConfirm={async () => {
                                try {
                                    await Conversations.deleteConversation(String(record._id));
                                    message.success('Hilo eliminado');
                                    queryClient.invalidateQueries({ queryKey: ['conversations'] });
                                } catch (err) {
                                    message.error(err?.response?.data?.message || err.message || 'No se pudo eliminar');
                                }
                            }}
                        >
                            <Button danger size="small">
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
            <div ref={scrollRef} className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto overflow-x-auto pb-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-extrabold text-[#370776]">Chats</h1>
                    {canDelete ? (
                        <Button onClick={() => setIsExportOpen(true)}>
                            Exportar JSON
                        </Button>
                    ) : null}
                </div>

                <Modal
                    title="Exportar hilos a JSON"
                    open={isExportOpen}
                    onCancel={() => setIsExportOpen(false)}
                    okText="Descargar"
                    cancelText="Cancelar"
                    confirmLoading={isExporting}
                    onOk={handleExport}
                >
                    <div className="flex flex-col gap-4 py-2">
                        <div>
                            <div className="mb-1 text-gray-700">Desde:</div>
                            <DatePicker
                                value={exportFrom}
                                onChange={(val) => setExportFrom(val)}
                                className="w-full"
                                placeholder="Fecha inicio (opcional)"
                            />
                        </div>
                        <div>
                            <div className="mb-1 text-gray-700">Hasta:</div>
                            <DatePicker
                                value={exportTo}
                                onChange={(val) => setExportTo(val)}
                                className="w-full"
                                placeholder="Fecha fin (opcional)"
                            />
                        </div>
                        <div className="text-gray-500 text-sm">
                            Si no seleccionas fechas, se exportan todos los hilos.
                        </div>
                    </div>
                </Modal>

                <div className="mb-6 flex flex-col sm:flex-row gap-3">
                    <DatePicker
                        placeholder="Filtrar por fecha"
                        allowClear
                        className="w-full sm:w-[240px]"
                        onChange={(val) => {
                            setCurrentPage(1);
                            setDateFilter(val);
                        }}
                        value={dateFilter}
                    />
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
                                    try {
                                        const q = new URLSearchParams(location.search || '');
                                        q.set('page', String(page));
                                        navigate(`/chat?${q.toString()}`, { replace: true });
                                    } catch (_) {}
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
                                                title={
                                                    <span className="flex items-center gap-2">
                                                        <FeedbackDots record={conv} />
                                                        <span>No identificado</span>
                                                    </span>
                                                }
                                                bordered
                                                className="shadow border-[#370776]/20"
                                            >
                                                <p>
                                                    <b>Último mensaje:</b>{' '}
                                                    <span>
                                                        {(conv.summary?.lastMessagePreview || '—').slice(0, 120)}
                                                        {(conv.summary?.lastMessagePreview?.length || 0) > 120 ? '…' : ''}
                                                    </span>
                                                </p>
                                                <p>
                                                    <b>Fecha:</b> {formatDate(conv.summary?.lastMessageAt)}
                                                </p>
                                                <p>
                                                    <b>Mensajes:</b> {conv.summary?.messageCount ?? 0}
                                                </p>
                                                <div className="mt-3">
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        style={{ maxWidth: '100%' }}
                                                        onClick={() => {
                                                            try { sessionStorage.setItem(CHAT_LAST_PAGE, String(currentPage)); } catch (_) {}
                                                            const nextState = {
                                                                state: {
                                                                    conversation: conv,
                                                                    from: {
                                                                        pathname: location.pathname,
                                                                        page: currentPage,
                                                                    },
                                                                },
                                                            };
                                                            navigate(`/chat/${String(conv._id)}?fromPage=${currentPage}`, nextState);
                                                        }}
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
                                    <Empty description="No hay conversaciones de chat" />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Chat;

