import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Checkbox, Empty, Input, List, Modal, Tag, Tooltip, message } from 'antd';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Sidebar from '../../components/Sidebar';
import AiSuggestedReplyModal from '../../components/mail/AiSuggestedReplyModal';
import MailThreadMessageItem from '../../components/mail/MailThreadMessageItem';
import EmailConversations from '../../services/EmailConversations';
import {
    getCotizacionBase64,
    getPersistedAiSuggestedText,
    shouldShowViewAiSuggestionButton,
} from '../../utils/mailThread';

const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
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
    const [aiSuggestionModalOpen, setAiSuggestionModalOpen] = useState(false);
    const [aiSuggestionModalText, setAiSuggestionModalText] = useState('');

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

    const openAiSuggestionModal = (m) => {
        setAiSuggestionModalText(getPersistedAiSuggestedText(m));
        setAiSuggestionModalOpen(true);
    };

    const closeAiSuggestionModal = () => {
        setAiSuggestionModalOpen(false);
        setAiSuggestionModalText('');
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
                                    onClick={() => {
                                        console.log('Responder', conversation._id);
                                    }}
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
                        renderItem={(m) => (
                                <MailThreadMessageItem
                                    message={m}
                                    formatDate={formatDate}
                                    showViewAiSuggestionButton={shouldShowViewAiSuggestionButton(m)}
                                    onViewAiSuggestion={openAiSuggestionModal}
                                    onOpenFeedbackAdjust={(msg) => {
                                        setSelectedMessageId(String(msg._id));
                                        setFeedbackText(msg.feedback || '');
                                        setIsFeedbackOpen(true);
                                    }}
                                    onOpenFeedbackView={(msg) => {
                                        setSelectedMessageId(String(msg._id));
                                        setFeedbackText(msg.feedback || '');
                                        setIsFeedbackOpen(true);
                                    }}
                                />
                        )}
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

                <AiSuggestedReplyModal
                    open={aiSuggestionModalOpen}
                    onCancel={closeAiSuggestionModal}
                    suggestedText={aiSuggestionModalText}
                />

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

