import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Collapse,
    Input,
    Progress,
    Row,
    Space,
    Tag,
    Typography,
    Upload,
    message,
} from 'antd';
import {
    CloudUploadOutlined,
    LikeOutlined,
    DislikeOutlined,
    LoadingOutlined,
    SendOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const FineTuning = () => {
    // Cliente-friendly: "Mejoras" (sin jerga)
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPct, setUploadPct] = useState(0);
    const uploadTimerRef = useRef(null);

    const [status, setStatus] = useState('idle'); // idle | updating | ready
    const [statusPct, setStatusPct] = useState(0);
    const statusTimerRef = useRef(null);

    const [prompt, setPrompt] = useState('');
    const [thread, setThread] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [feedback, setFeedback] = useState(null); // null | up | down
    const [feedbackNote, setFeedbackNote] = useState('');

    useEffect(() => {
        return () => {
            if (uploadTimerRef.current) window.clearInterval(uploadTimerRef.current);
            if (statusTimerRef.current) window.clearInterval(statusTimerRef.current);
        };
    }, []);

    const simulateUpload = async () => {
        setIsUploading(true);
        setUploadPct(0);
        if (uploadTimerRef.current) window.clearInterval(uploadTimerRef.current);

        let pct = 0;
        uploadTimerRef.current = window.setInterval(() => {
            pct += Math.max(3, Math.floor(Math.random() * 12));
            if (pct >= 100) {
                pct = 100;
                window.clearInterval(uploadTimerRef.current);
                uploadTimerRef.current = null;
                setIsUploading(false);
                message.success('Material cargado (simulado)');
                startUpdating();
            }
            setUploadPct(pct);
        }, 120);
    };

    const startUpdating = () => {
        if (statusTimerRef.current) window.clearInterval(statusTimerRef.current);

        setStatus('updating');
        setStatusPct(0);

        let pct = 0;
        statusTimerRef.current = window.setInterval(() => {
            pct += Math.max(2, Math.floor(Math.random() * 9));
            if (pct >= 100) {
                pct = 100;
                window.clearInterval(statusTimerRef.current);
                statusTimerRef.current = null;
                setStatus('ready');
                message.success('Conocimiento actualizado (simulado)');
            }
            setStatusPct(pct);
        }, 180);
    };

    const userName = useMemo(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user.name || 'Diego';
        } catch {
            return 'Diego';
        }
    }, []);

    const quickSuggestions = useMemo(() => ([
        'Genera un mail de bienvenida para un cliente nuevo.',
        'Responde una consulta sobre horarios de atención.',
        'Escribe una respuesta amable pidiendo información adicional.',
    ]), []);

    const simulateAnswer = async () => {
        const text = prompt.trim();
        if (!text) return;

        setFeedback(null);
        setFeedbackNote('');
        setIsGenerating(true);

        const nextThread = [
            ...thread,
            { role: 'user', content: text, id: `u-${Date.now()}` },
        ];
        setThread(nextThread);
        setPrompt('');

        await new Promise(resolve => setTimeout(resolve, 650));

        const answer = `¡Perfecto, ${userName}! (demo)\n\nGracias por tu mensaje. Te ayudo encantado:\n- Confirmo lo solicitado.\n- Te indico los próximos pasos.\n\n¿Quieres que lo dejemos en tono más formal o más cercano?`;

        setThread(prev => ([...prev, { role: 'assistant', content: answer, id: `a-${Date.now()}` }]));
        setIsGenerating(false);
    };

    return (
        <div className="flex h-screen bg-[#f6f2ff] overflow-hidden">
            <Sidebar />
            <div className="flex-1 pt-16 px-4 lg:pt-8 lg:px-8 overflow-y-auto pb-8">
                <div className="flex flex-col gap-2 mb-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <Title level={2} style={{ margin: 0, color: '#370776' }}>Mejorar respuestas</Title>
                            <Text type="secondary">Sube material, prueba respuestas y deja feedback. (Demo sin conexión)</Text>
                        </div>
                        <Space wrap>
                            <Tag color="purple">Imblasco</Tag>
                            <Badge count={status === 'ready' ? 'Listo' : status === 'updating' ? 'Actualizando…' : 'Sin cambios'} style={{ backgroundColor: '#370776' }} />
                            <Tag color={status === 'ready' ? 'green' : 'gold'}>{status === 'ready' ? 'Conocimiento actualizado' : 'Pendiente'}</Tag>
                        </Space>
                    </div>
                </div>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                        <Card
                            className="rounded-2xl"
                            bordered
                            style={{ borderColor: 'rgba(55,7,118,0.10)' }}
                            title="1) Sube tu material"
                        >
                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Qué puedes subir"
                                    description="PDFs, documentos, FAQs, o plantillas de mails. Nosotros lo usamos para mejorar respuestas. (Demo)"
                                />

                                <Dragger
                                    multiple
                                    beforeUpload={() => false}
                                    showUploadList={false}
                                    disabled={isUploading}
                                    style={{ background: 'rgba(55,7,118,0.03)', borderRadius: 16 }}
                                >
                                    <p className="ant-upload-drag-icon">
                                        <CloudUploadOutlined style={{ color: '#370776' }} />
                                    </p>
                                    <p className="ant-upload-text">Arrastra archivos aquí</p>
                                    <p className="ant-upload-hint">O haz click para seleccionarlos. (No se sube nada, es demo)</p>
                                </Dragger>

                                <Button
                                    type="primary"
                                    icon={isUploading ? <LoadingOutlined /> : <CloudUploadOutlined />}
                                    loading={isUploading}
                                    onClick={simulateUpload}
                                >
                                    Simular carga
                                </Button>

                                {(isUploading || uploadPct > 0) && (
                                    <div>
                                        <Text strong>Progreso</Text>
                                        <Progress
                                            percent={uploadPct}
                                            strokeColor="#5DD62C"
                                            trailColor="rgba(55,7,118,0.10)"
                                        />
                                    </div>
                                )}
                            </Space>
                        </Card>
                    </Col>

                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Card
                                className="rounded-2xl"
                                bordered
                                style={{ borderColor: 'rgba(55,7,118,0.10)' }}
                                title="2) Prueba una respuesta"
                            >
                                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                    <Space wrap>
                                        {quickSuggestions.map(s => (
                                            <Button key={s} size="small" onClick={() => setPrompt(s)}>
                                                {s}
                                            </Button>
                                        ))}
                                    </Space>

                                    <div className="rounded-2xl bg-white border border-[#370776]/10 p-4 max-h-[320px] overflow-auto">
                                        {thread.length === 0 ? (
                                            <Text type="secondary">Escribe una consulta para ver una respuesta demo.</Text>
                                        ) : (
                                            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                                                {thread.map(m => (
                                                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        <div
                                                            className={`max-w-[90%] whitespace-pre-line rounded-2xl px-4 py-3 shadow-sm ${
                                                                m.role === 'user'
                                                                    ? 'bg-[#370776] text-white'
                                                                    : 'bg-[#f6f2ff] text-[#121027] border border-[#370776]/10'
                                                            }`}
                                                        >
                                                            {m.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </Space>
                                        )}
                                    </div>

                                    <Input.TextArea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Escribe aquí…"
                                        autoSize={{ minRows: 2, maxRows: 4 }}
                                    />

                                    <Button
                                        type="primary"
                                        icon={isGenerating ? <LoadingOutlined /> : <SendOutlined />}
                                        loading={isGenerating}
                                        onClick={simulateAnswer}
                                    >
                                        Generar respuesta (demo)
                                    </Button>

                                    <Card size="small" style={{ borderRadius: 16, background: 'rgba(55,7,118,0.03)' }} title="3) Feedback (rápido)">
                                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                            <Space wrap>
                                                <Button
                                                    icon={<LikeOutlined />}
                                                    type={feedback === 'up' ? 'primary' : 'default'}
                                                    onClick={() => {
                                                        setFeedback('up');
                                                        message.success('¡Gracias! (demo)');
                                                    }}
                                                >
                                                    Me sirvió
                                                </Button>
                                                <Button
                                                    icon={<DislikeOutlined />}
                                                    type={feedback === 'down' ? 'primary' : 'default'}
                                                    onClick={() => {
                                                        setFeedback('down');
                                                        message.info('Ok, lo revisaremos (demo)');
                                                    }}
                                                >
                                                    No me sirvió
                                                </Button>
                                            </Space>
                                            <Input
                                                value={feedbackNote}
                                                onChange={(e) => setFeedbackNote(e.target.value)}
                                                placeholder="Comentario opcional (ej: más formal / más corto / incluir saludo)"
                                            />
                                            <Button
                                                onClick={() => {
                                                    message.success('Feedback enviado (demo)');
                                                    setFeedback(null);
                                                    setFeedbackNote('');
                                                }}
                                            >
                                                Enviar feedback
                                            </Button>
                                        </Space>
                                    </Card>
                                </Space>
                            </Card>

                            <Card
                                className="rounded-2xl"
                                bordered
                                style={{ borderColor: 'rgba(55,7,118,0.10)' }}
                                title="Estado"
                            >
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                    {status === 'idle' && (
                                        <Alert
                                            type="warning"
                                            showIcon
                                            message="Aún no hay cambios aplicados"
                                            description="Sube material o deja feedback para mejorar las respuestas."
                                        />
                                    )}
                                    {status === 'updating' && (
                                        <>
                                            <Alert
                                                type="info"
                                                showIcon
                                                message="Actualizando conocimiento…"
                                                description="Esto puede tardar unos minutos. (Demo)"
                                            />
                                            <Progress
                                                percent={statusPct}
                                                strokeColor="#5DD62C"
                                                trailColor="rgba(55,7,118,0.10)"
                                            />
                                        </>
                                    )}
                                    {status === 'ready' && (
                                        <Alert
                                            type="success"
                                            showIcon
                                            message="Listo"
                                            description="Las respuestas ya reflejan el material y feedback reciente. (Demo)"
                                        />
                                    )}

                                    <Collapse
                                        items={[
                                            {
                                                key: 'tips',
                                                label: 'Consejos',
                                                children: (
                                                    <ul className="list-disc pl-5 text-gray-600 space-y-2">
                                                        <li>Evita subir datos sensibles (RUT, teléfonos, direcciones).</li>
                                                        <li>Si una respuesta no te gusta, usa 👍/👎 y agrega un comentario.</li>
                                                        <li>Los documentos más útiles: FAQs, políticas, plantillas de mails.</li>
                                                    </ul>
                                                ),
                                            },
                                        ]}
                                    />
                                </Space>
                            </Card>
                        </Space>
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default FineTuning;

