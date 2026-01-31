import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import {
    Table,
    Input,
    Card,
    Pagination,
    Empty,
    Button,
    Tag,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import useEmailConversations from '../../hooks/useEmailConversations';
import { useMediaQuery } from 'react-responsive';
import { useNavigate } from 'react-router-dom';

const { Search } = Input;

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

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

const Mails = () => {
    const [searchText, setSearchText] = useState('');
    const [filteredData, setFilteredData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    const isMobile = useMediaQuery({ maxWidth: 768 });
    const navigate = useNavigate();

    const { data, isLoading } = useEmailConversations({ page: 1, limit: 100 });

    const conversations = data?.data?.docs ?? [];
    const dataToRender = searchText ? filteredData : conversations;

    const itemsPerPage = 5;
    const paginatedData = dataToRender.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const columns = [
        {
            title: 'Asunto',
            dataIndex: 'subject',
            key: 'subject',
            ellipsis: true,
            render: (val) => val || '—',
        },
        {
            title: 'Cliente',
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
            title: 'Último mensaje',
            key: 'preview',
            ellipsis: true,
            render: (_, record) => {
                const preview = record.summary?.lastMessagePreview;
                return preview ? `${preview.slice(0, 60)}${preview.length > 60 ? '…' : ''}` : '—';
            },
        },
        {
            title: 'Fecha',
            key: 'lastMessageAt',
            width: 140,
            render: (_, record) => formatDate(record.summary?.lastMessageAt),
        },
        {
            title: 'Mensajes',
            key: 'messageCount',
            width: 90,
            align: 'center',
            render: (_, record) => record.summary?.messageCount ?? 0,
        },
        {
            title: 'Clasificación',
            key: 'classification',
            width: 150,
            render: (_, record) => humanizeDict(CLASIFICACIONES, record.clasificacion),
        },
        {
            title: 'Acción',
            key: 'action',
            width: 110,
            render: (_, record) => humanizeDict(ACTIONS, record.accion),
        },
        {
            title: 'Estado',
            key: 'state',
            width: 110,
            render: (_, record) => {
                const stRaw = record.estado || record.status?.state;
                const st = humanizeDict(THREAD_STATES, stRaw);
                if (!st) return '—';
                const color =
                    stRaw === 'RESUELTO' ? 'green'
                        : stRaw === 'ERROR' ? 'red'
                            : 'blue';
                return (
                    <Tag color={color}>
                        {st}
                    </Tag>
                );
            },
        },
        {
            title: 'Detalle',
            key: 'actions',
            width: 110,
            align: 'center',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    style={{ maxWidth: '100%' }}
                    onClick={() => navigate(`/mails/${String(record._id)}`, { state: { conversation: record } })}
                >
                    Detalle
                </Button>
            ),
        },
    ];

    const handleBuscar = (value) => {
        setCurrentPage(1);
        setSearchText(value || '');
        if (!value?.trim()) {
            setFilteredData([]);
            return;
        }
        const q = value.toLowerCase().trim();
        const filtered = conversations.filter((item) => {
            const subject = (item.subject || '').toLowerCase();
            const customerName = (item.participants?.customer?.name || '').toLowerCase();
            const customerEmail = (item.participants?.customer?.email || '').toLowerCase();
            const preview = (item.summary?.lastMessagePreview || '').toLowerCase();
            return (
                subject.includes(q) ||
                customerName.includes(q) ||
                customerEmail.includes(q) ||
                preview.includes(q)
            );
        });
        setFilteredData(filtered);
    };

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto overflow-x-auto pb-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-extrabold text-[#370776]">Mails</h1>
                </div>

                <div className="mb-6">
                    <Search
                        placeholder="Buscar por asunto, cliente o mensaje..."
                        allowClear
                        enterButton={<SearchOutlined />}
                        size="large"
                        onSearch={handleBuscar}
                        onChange={(e) => handleBuscar(e.target.value)}
                    />
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
                                                    <b>Último mensaje:</b>{' '}
                                                    {(conv.summary?.lastMessagePreview || '—').slice(0, 80)}
                                                    {(conv.summary?.lastMessagePreview?.length || 0) > 80 ? '…' : ''}
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
