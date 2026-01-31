import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import {
    Table,
    Card,
    Pagination,
    Empty,
    Button,
} from 'antd';
// icon removed to fit column width
import useConversations from '../../hooks/useConversations';
import { useMediaQuery } from 'react-responsive';
import { useNavigate } from 'react-router-dom';

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

const Chat = () => {
    const [currentPage, setCurrentPage] = useState(1);

    const isMobile = useMediaQuery({ maxWidth: 768 });
    const navigate = useNavigate();

    const { data, isLoading } = useConversations({ channel: 'chat', page: 1, limit: 100 });

    const conversations = data?.data?.docs ?? [];
    const dataToRender = conversations;

    const itemsPerPage = 5;
    const paginatedData = dataToRender.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const columns = [
        {
            title: 'Cliente',
            key: 'customer',
            width: 160,
            ellipsis: true,
            render: () => 'No identificado',
        },
        {
            title: 'Último mensaje',
            key: 'preview',
            ellipsis: true,
            render: (_, record) => {
                const preview = record.summary?.lastMessagePreview;
                return preview ? `${preview.slice(0, 80)}${preview.length > 80 ? '…' : ''}` : '—';
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
            title: 'Detalle',
            key: 'actions',
            width: 110,
            align: 'center',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    style={{ maxWidth: '100%' }}
                    onClick={() => navigate(`/chat/${String(record._id)}`, { state: { conversation: record } })}
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
                    <h1 className="text-3xl font-extrabold text-[#370776]">Chats</h1>
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
                                                title="No identificado"
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
                                                        onClick={() => navigate(`/chat/${String(conv._id)}`, { state: { conversation: conv } })}
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

