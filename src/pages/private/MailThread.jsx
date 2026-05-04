import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Checkbox, Empty, Input, List, Modal, Tag, Tooltip, Upload, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined, InfoCircleOutlined, MessageOutlined, PaperClipOutlined } from '@ant-design/icons';
import Sidebar from '../../components/Sidebar';
import EmailConversations from '../../services/EmailConversations';

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
};

/** Quita prefijo data:...;base64, y espacios que suelen venir en MIME/base64. */
const normalizePdfBase64 = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    let s = raw.trim().replace(/\s/g, '');
    const dataIdx = s.indexOf('base64,');
    if (dataIdx !== -1) {
        s = s.slice(dataIdx + 'base64,'.length);
    }
    return s;
};

/** PDF en base64 a nivel conversación o en algún mensaje (prioriza el último con dato). */
const getCotizacionBase64 = (conv) => {
    if (!conv) return null;
    const fromRoot = normalizePdfBase64(conv.pdf_base64);
    if (fromRoot) return fromRoot;
    const msgs = [...(conv.messages || [])].sort(
        (a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0)
    );
    for (let i = msgs.length - 1; i >= 0; i--) {
        const piece = normalizePdfBase64(msgs[i]?.pdf_base64);
        if (piece) return piece;
    }
    return null;
};

const isOutboundAiMessage = (m) => {
    if (!m || m.direction !== 'outbound') return false;
    const meta = m.metadata || {};
    if (m.ai === true || m.isAi === true || m.fromAi === true) return true;
    if (m.source === 'ai' || m.role === 'assistant') return true;
    if (meta.ai === true || meta.source === 'ai' || meta.from === 'assistant') return true;
    return false;
};

/** Último mensaje outbound marcado como IA; si el backend no marca IA, el último outbound del hilo. */
const getLastAiReplyMessageId = (messagesSortedList) => {
    if (!messagesSortedList?.length) return null;
    for (let i = messagesSortedList.length - 1; i >= 0; i--) {
        const m = messagesSortedList[i];
        if (isOutboundAiMessage(m)) return String(m._id ?? '');
    }
    for (let i = messagesSortedList.length - 1; i >= 0; i--) {
        const m = messagesSortedList[i];
        if (m.direction === 'outbound') return String(m._id ?? '');
    }
    return null;
};

const MailThread = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();

    const initialConversation = location.state?.conversation || null;
    const [conversation, setConversation] = useState(initialConversation);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [selectedMessageId, setSelectedMessageId] = useState(null);
    const [isSavingFeedback, setIsSavingFeedback] = useState(false);
    const [isSavingGoodAnswer, setIsSavingGoodAnswer] = useState(false);
    const [isGoodAnswerDisabled, setIsGoodAnswerDisabled] = useState(false);
    const [isSavingCorrected, setIsSavingCorrected] = useState(false);
    const [isCorrectedDisabled, setIsCorrectedDisabled] = useState(false);
    const [openCotizacionModal, setOpenCotizacionModal] = useState(false);
    const [cotizacionPdfUrl, setCotizacionPdfUrl] = useState(null);
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [replyFileList, setReplyFileList] = useState([]);
    const [isSendingReply, setIsSendingReply] = useState(false);

    // Limpiar modales al desmontar
    useEffect(() => {
        return () => {
            try {
                Modal.destroyAll();
                document.body.classList.remove('ant-modal-open');
            } catch {
                /* noop */
            }
        };
    }, []);

    // Volver a la página correcta
    const goBack = () => {
        try {
            const q = new URLSearchParams(location.search || '');
            const qp = Number(q.get('fromPage') || '0');
            if (Number.isFinite(qp) && qp > 0) {
                navigate(`/mails?page=${qp}`, { replace: true });
                return;
            }
        } catch {
            /* noop */
        }
        navigate('/mails', { replace: true });
    };

    const handleGoodAnswerChange = async (e) => {
        const next = e.target.checked;
        setConversation((prev) => ({
            ...prev,
            isGoodAnswer: next,
            summary: { ...(prev?.summary || {}), hasGoodAnswer: next },
        }));
        setIsSavingGoodAnswer(true);
        try {
            const resp = await EmailConversations.setConversationGoodAnswer(conversation._id, next);
            const ok = resp?.data?.success ?? resp?.success;
            if (ok) {
                message.success(resp?.data?.message || resp?.message || 'Actualizado');
            } else {
                message.warning(resp?.data?.message || resp?.message || 'No se pudo guardar');
                setConversation((prev) => ({
                    ...prev,
                    isGoodAnswer: !next,
                    summary: { ...(prev?.summary || {}), hasGoodAnswer: !next },
                }));
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                message.warning('El backend aún no soporta "Bien respondido" para mails.');
                setIsGoodAnswerDisabled(true);
            } else {
                message.error(err?.response?.data?.message || err.message || 'Error al guardar');
            }
            setConversation((prev) => ({
                ...prev,
                isGoodAnswer: !next,
                summary: { ...(prev?.summary || {}), hasGoodAnswer: !next },
            }));
        } finally {
            setIsSavingGoodAnswer(false);
        }
    };

    const handleVerCotizacion = () => {
        const cot = getCotizacionBase64(conversation);

        if (!cot) {
            message.warning('No hay cotización disponible');
            return;
        }

        try {
            const binary = atob(cot);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                array[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([array], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setCotizacionPdfUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return url;
            });
            setOpenCotizacionModal(true);
        } catch {
            message.error('No se pudo leer el PDF (Base64 inválido).');
        }
    };

    const closeCotizacionModal = () => {
        setOpenCotizacionModal(false);
        setCotizacionPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
    };

    const messagesSorted = useMemo(() => {
        const msgs = conversation?.messages || [];
        return [...msgs].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
    }, [conversation]);

    const hasCotizacionPdf = useMemo(
        () => Boolean(getCotizacionBase64(conversation)),
        [conversation]
    );

    const lastAiReplyMessageId = useMemo(
        () => getLastAiReplyMessageId(messagesSorted),
        [messagesSorted]
    );

    const handleEnviarRespuestaSugerida = () => {
        console.log('Enviar respuesta sugerida', conversation?._id);
    };

    const closeReplyModal = () => {
        setIsReplyModalOpen(false);
        setReplyBody('');
        setReplyFileList([]);
    };

    const handleResponderManualmente = () => {
        setReplyBody('');
        setReplyFileList([]);
        setIsReplyModalOpen(true);
    };

    const handleReplyUploadChange = ({ fileList }) => {
        setReplyFileList(fileList);
    };

    const handleSendManualReply = async () => {
        const text = String(replyBody || '').trim();
        if (!text && replyFileList.length === 0) {
            message.warning('Escribí el cuerpo del correo o adjuntá al menos un archivo.');
            return;
        }
        setIsSendingReply(true);
        try {
            const fd = new FormData();
            fd.append('text', text);
            replyFileList.forEach((item) => {
                const file = item.originFileObj ?? item;
                if (file instanceof File) {
                    fd.append('attachments', file);
                }
            });
            const resp = await EmailConversations.sendManualReply(conversation._id, fd);
            const data = resp?.data;
            if (data?.success === false) {
                message.warning(data?.message || 'No se pudo enviar la respuesta');
                return;
            }
            message.success(data?.message || resp?.message || 'Respuesta enviada');
            closeReplyModal();
        } catch (err) {
            if (err?.response?.status === 404) {
                message.warning(
                    'El servidor aún no implementa POST /emails/:id/reply. Cuando esté listo, el envío funcionará desde aquí.'
                );
            } else {
                message.error(err?.response?.data?.message || err.message || 'Error al enviar la respuesta');
            }
        } finally {
            setIsSendingReply(false);
        }
    };

    if (!conversation) {
        return (
            <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
                <Sidebar />
                <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
                            Volver
                        </Button>
                        <h1 className="text-2xl font-extrabold text-[#370776]">
                            Hilo de conversación
                        </h1>
                    </div>
                    <Empty
                        description={
                            <div>
                                No tengo el hilo en memoria para <b>{id}</b>.<br />
                                Volvé a <b>Mails</b> y presioná <b>Ver</b> nuevamente.
                            </div>
                        }
                    />
                </div>
            </div>
        );
    }

    const customer = conversation.participants?.customer;
    const agent = conversation.participants?.agent;

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                <div className="flex flex-col gap-3 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button icon={<ArrowLeftOutlined />} onClick={goBack} className="w-fit">
                            Volver
                        </Button>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#370776] leading-tight wrap-break-word">
                        {conversation.subject || 'Sin asunto'}
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <Card className="shadow border-[#370776]/10" title="Participantes">
                        <div className="mb-3">
                            <div className="font-semibold text-gray-800">Cliente</div>
                            <div className="text-gray-700">{customer?.name || '—'}</div>
                            <div className="text-gray-500 text-sm">{customer?.email || ''}</div>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-800">Agente</div>
                            <div className="text-gray-700">{agent?.name || '—'}</div>
                            <div className="text-gray-500 text-sm">{agent?.email || ''}</div>
                        </div>
                    </Card>

                    <Card className="shadow border-[#370776]/10" title="Estado">
                        <div className="flex flex-wrap gap-2">
                            <Tag color={conversation.status?.state === 'closed' ? 'green' : 'blue'}>
                                {conversation.status?.state || '—'}
                            </Tag>
                            <Tag color="purple">{conversation.status?.stage || '—'}</Tag>
                            <Tag color="gold">{conversation.status?.priority || '—'}</Tag>
                        </div>
                        <div className="mt-4 text-gray-600 text-sm">
                            Último: <b>{formatDate(conversation.summary?.lastMessageAt)}</b>
                        </div>
                        <div className="mt-1 text-gray-600 text-sm">
                            Mensajes: <b>{conversation.summary?.messageCount ?? messagesSorted.length}</b>
                            {' · '}
                            No leídos: <b>{conversation.summary?.unreadCount ?? 0}</b>
                        </div>
                        <div className="mt-4 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={conversation.isGoodAnswer === true || conversation.summary?.hasGoodAnswer === true}
                                    onChange={handleGoodAnswerChange}
                                    disabled={isSavingGoodAnswer || isGoodAnswerDisabled}
                                >
                                    Bien respondido
                                </Checkbox>

                                <Button
                                    type="default"
                                    size="middle"
                                    onClick={handleVerCotizacion}
                                    disabled={!hasCotizacionPdf}
                                >
                                    Ver Cotización
                                </Button>

                                <Button
                                    type="primary"
                                    size="middle"
                                    style={{
                                        backgroundColor: '#52c41a',
                                        borderColor: '#52c41a'
                                    }}
                                    onClick={handleResponderManualmente}
                                >
                                    Responder
                                </Button>



                                {isGoodAnswerDisabled ? (
                                    <Tooltip title="Tu backend aún no soporta 'Bien respondido' para mails o hubo un error.">
                                        <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                                    </Tooltip>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={conversation.isCorrected === true || conversation.summary?.isCorrected === true}
                                    onChange={async (e) => {
                                        const next = e.target.checked;
                                        setConversation((prev) => ({
                                            ...prev,
                                            isCorrected: next,
                                            summary: { ...(prev?.summary || {}), isCorrected: next },
                                        }));
                                        setIsSavingCorrected(true);
                                        try {
                                            const resp = await EmailConversations.setConversationCorrected(conversation._id, next);
                                            const ok = resp?.data?.success ?? resp?.success;
                                            if (ok) {
                                                message.success(resp?.data?.message || resp?.message || 'Actualizado');
                                            } else {
                                                message.warning(resp?.data?.message || resp?.message || 'No se pudo guardar');
                                                setConversation((prev) => ({
                                                    ...prev,
                                                    isCorrected: !next,
                                                    summary: { ...(prev?.summary || {}), isCorrected: !next },
                                                }));
                                            }
                                        } catch (err) {
                                            if (err?.response?.status === 404) {
                                                message.warning('El backend aún no soporta "Corregido" para mails.');
                                                setIsCorrectedDisabled(true);
                                            } else {
                                                message.error(err?.response?.data?.message || err.message || 'Error al guardar');
                                            }
                                            setConversation((prev) => ({
                                                ...prev,
                                                isCorrected: !next,
                                                summary: { ...(prev?.summary || {}), isCorrected: !next },
                                            }));
                                        } finally {
                                            setIsSavingCorrected(false);
                                        }
                                    }}
                                    disabled={isSavingCorrected || isCorrectedDisabled}
                                >
                                    Corregido
                                </Checkbox>
                                {isCorrectedDisabled ? (
                                    <Tooltip title="Tu backend aún no soporta 'Corregido' para mails o hubo un error.">
                                        <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                                    </Tooltip>
                                ) : null}
                            </div>
                        </div>
                    </Card>

                    <Card className="shadow border-[#370776]/10" title="Identificadores">
                        <div className="text-gray-700 text-sm">
                            <div><b>ID:</b> {String(conversation._id)}</div>
                            <div><b>Thread:</b> {conversation.external?.threadId || '—'}</div>
                            <div><b>Mailbox:</b> {conversation.external?.mailbox || '—'}</div>
                            <div><b>Provider:</b> {conversation.provider || '—'}</div>
                        </div>
                    </Card>
                </div>

                <Card className="shadow border-[#370776]/10" title="Mensajes">
                    <List
                        dataSource={messagesSorted}
                        locale={{ emptyText: 'No hay mensajes' }}
                        renderItem={(m) => {
                            const inbound = m.direction === 'inbound';
                            const from = m.from?.email || m.from?.name || '—';
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
                                        {lastAiReplyMessageId &&
                                        String(m._id) === lastAiReplyMessageId ? (
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="primary"
                                                    onClick={handleEnviarRespuestaSugerida}
                                                >
                                                    Enviar respuesta sugerida
                                                </Button>
                                                <Button onClick={handleResponderManualmente}>
                                                    Responder manualmente
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                </List.Item>
                            );
                        }}
                    />
                </Card>

                <Modal
                    title="Cotización"
                    open={openCotizacionModal}
                    onCancel={closeCotizacionModal}
                    footer={null}
                    width="min(96vw, 960px)"
                    styles={{ body: { padding: 0, height: '75vh' } }}
                    destroyOnClose
                >
                    {cotizacionPdfUrl ? (
                        <iframe
                            title="Cotización PDF"
                            src={cotizacionPdfUrl}
                            className="w-full h-full min-h-[70vh] border-0"
                        />
                    ) : null}
                </Modal>

                <Modal
                    title="Responder correo"
                    open={isReplyModalOpen}
                    onCancel={closeReplyModal}
                    width={640}
                    destroyOnClose
                    footer={
                        <div className="flex justify-end gap-2">
                            <Button onClick={closeReplyModal}>Cancelar</Button>
                            <Button type="primary" loading={isSendingReply} onClick={handleSendManualReply}>
                                Enviar respuesta
                            </Button>
                        </div>
                    }
                >
                    <div className="mb-3 text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">Para: </span>
                        {conversation.participants?.customer?.email || '—'}
                    </div>
                    <Input.TextArea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Escribí tu respuesta..."
                        autoSize={{ minRows: 8, maxRows: 16 }}
                        className="mb-4"
                    />
                    <Upload
                        fileList={replyFileList}
                        beforeUpload={() => false}
                        onChange={handleReplyUploadChange}
                        multiple
                    >
                        <Button icon={<PaperClipOutlined />}>Adjuntar archivos</Button>
                    </Upload>
                    <p className="mt-2 text-xs text-gray-500">
                        Los adjuntos se envían junto al texto cuando el backend reciba el envío.
                    </p>
                </Modal>

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
                            const resp = await EmailConversations.setMessageFeedback(conversation._id, selectedMessageId, txt);
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

export default MailThread;

