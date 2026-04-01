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
} from 'antd';
// icon removed to fit column width
import useConversations from '../../hooks/useConversations';
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
                return preview ? `${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''}` : '—';
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
            width: 110,
            align: 'center',
            render: (_, record) => (
                <Badge dot={hasConversationFeedback(record)} color="#faad14" offset={[2, 0]}>
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
                </Badge>
            ),
        },
    ];

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div ref={scrollRef} className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto overflow-x-auto pb-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-extrabold text-[#370776]">Chats</h1>
                </div>

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
                                                        {hasConversationFeedback(conv) ? <Badge dot color="#faad14" /> : null}
                                                        <span>No identificado</span>
                                                    </span>
                                                }
                                                bordered
                                                className="shadow border-[#370776]/20"
                                            >
                                                <p>
                                                    <b>Último mensaje:</b>{' '}
                                                    {(conv.summary?.lastMessagePreview || '—').slice(0, 120)}
                                                    {(conv.summary?.lastMessagePreview?.length || 0) > 120 ? '…' : ''}
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

