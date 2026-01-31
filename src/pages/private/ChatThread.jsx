import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Empty, Input, List, Modal, Tag, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined, MessageOutlined } from '@ant-design/icons';
import Sidebar from '../../components/Sidebar';
import Conversations from '../../services/Conversations';

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

const ChatThread = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();

    const initialConversation = location.state?.conversation || null;
    const [conversation, setConversation] = useState(initialConversation);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [isSavingFeedback, setIsSavingFeedback] = useState(false);

    const messagesSorted = useMemo(() => {
        const msgs = conversation?.messages || [];
        return [...msgs].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
    }, [conversation]);

    if (!conversation) {
        return (
            <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
                <Sidebar />
                <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                    <div className="flex flex-col gap-3 mb-6">
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/chat')} className="w-fit">
                            Volver
                        </Button>
                        <h1 className="text-2xl font-extrabold text-[#370776]">
                            Conversación de chat
                        </h1>
                    </div>
                    <Empty
                        description={
                            <div>
                                No tengo el hilo en memoria para <b>{id}</b>.<br />
                                Volvé a <b>Chat</b> y presioná <b>Ver</b> nuevamente.
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    const customer = conversation.participants?.customer;

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                <div className="flex flex-col gap-3 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/chat')} className="w-fit">
                            Volver
                        </Button>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#370776] leading-tight wrap-break-word">
                        {customer?.name || customer?.email || 'Chat'}
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <Card className="shadow border-[#370776]/10" title="Participantes">
                        <div className="mb-3">
                            <div className="font-semibold text-gray-800">Cliente</div>
                            <div className="text-gray-700">No identificado</div>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-800">Agente</div>
                            <div className="text-gray-700">Imblasco</div>
                        </div>
                    </Card>

                    <Card className="shadow border-[#370776]/10" title="Estado">
                        <div className="mt-4 text-gray-600 text-sm">
                            Último: <b>{formatDate(conversation.summary?.lastMessageAt)}</b>
                        </div>
                        <div className="mt-1 text-gray-600 text-sm">
                            Mensajes: <b>{conversation.summary?.messageCount ?? messagesSorted.length}</b>
                        </div>
                    </Card>

                    <Card className="shadow border-[#370776]/10" title="Identificadores">
                        <div className="text-gray-700 text-sm">
                            <div><b>ID:</b> {String(conversation._id)}</div>
                            <div><b>Provider:</b> {conversation.provider || '—'}</div>
                            <div><b>Canal:</b> {conversation.channel || '—'}</div>
                        </div>
                    </Card>
                </div>

                <Card className="shadow border-[#370776]/10" title="Mensajes">
                    <List
                        dataSource={messagesSorted}
                        locale={{ emptyText: 'No hay mensajes' }}
                        renderItem={(m) => {
                            const inbound = m.direction === 'inbound';
                            const from = inbound ? 'Cliente' : 'Imblasco';
                            const hasFeedback = Boolean(String(m.feedback || '').trim());
                            return (
                                <List.Item>
                                    <div className="w-full">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                {hasFeedback ? (
                                                    <Badge dot color="#faad14">
                                                        <Tag color={inbound ? 'blue' : 'green'}>
                                                            {inbound ? 'Recibido' : 'Enviado'}
                                                        </Tag>
                                                    </Badge>
                                                ) : (
                                                    <Tag color={inbound ? 'blue' : 'green'}>
                                                        {inbound ? 'Recibido' : 'Enviado'}
                                                    </Tag>
                                                )}
                                                <span className="text-gray-800 text-sm">
                                                    <b>De:</b> {from}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!inbound && (
                                                    <Button
                                                        size="small"
                                                        icon={<EditOutlined />}
                                                        onClick={() => {
                                                            setSelectedMessageId(String(m._id));
                                                            setFeedbackText(m.feedback || '');
                                                            setIsFeedbackOpen(true);
                                                        }}
                                                    >
                                                        Ajustar
                                                    </Button>
                                                )}
                                                {hasFeedback && (
                                                    <Button
                                                        size="small"
                                                        icon={<MessageOutlined />}
                                                        onClick={() => {
                                                            setSelectedMessageId(String(m._id));
                                                            setFeedbackText(m.feedback || '');
                                                            setIsFeedbackOpen(true);
                                                        }}
                                                    >
                                                        Ver feedback
                                                    </Button>
                                                )}
                                                <span className="text-gray-500 text-sm">
                                                    {formatDate(m.sentAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-2 whitespace-pre-wrap wrap-anywhere max-w-full text-gray-800">
                                            {m.content?.text || '—'}
                                        </div>
                                    </div>
                                </List.Item>
                            );
                        }}
                    />
                </Card>

                <Modal
                    title="Ajustar"
                    open={isFeedbackOpen}
                    onCancel={() => setIsFeedbackOpen(false)}
                    okText="Guardar"
                    cancelText="Cancelar"
                    confirmLoading={isSavingFeedback}
                    onOk={async () => {
                        const txt = String(feedbackText || '').trim();
                        if (!txt) {
                            message.error('Escribe qué no te gustó o qué ajustar.');
                            return;
                        }
                        if (!selectedMessageId) {
                            message.error('No se pudo identificar el mensaje.');
                            return;
                        }
                        setIsSavingFeedback(true);
                        try {
                            const resp = await Conversations.setMessageFeedback(conversation._id, selectedMessageId, txt);
                            if (resp?.success) {
                                message.success(resp.message || 'Feedback guardado');
                                setConversation((prev) => ({
                                    ...prev,
                                    messages: (prev?.messages || []).map((mm) =>
                                        String(mm._id) === String(selectedMessageId)
                                            ? { ...mm, feedback: txt }
                                            : mm
                                    ),
                                }));
                                setIsFeedbackOpen(false);
                            } else {
                                message.warning(resp?.message || 'No se pudo guardar el feedback');
                            }
                        } catch (err) {
                            message.error(err?.response?.data?.message || err.message || 'No se pudo conectar con el servidor');
                        } finally {
                            setIsSavingFeedback(false);
                        }
                    }}
                >
                    <Input.TextArea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Describe qué no te gustó del hilo o qué debería mejorar..."
                        autoSize={{ minRows: 3, maxRows: 8 }}
                    />
                </Modal>
            </div>
        </div>
    );
};

export default ChatThread;

