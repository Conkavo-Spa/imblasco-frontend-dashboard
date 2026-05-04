import React from 'react';
import { Badge, Button, List, Tag } from 'antd';
import { EditOutlined, MessageOutlined, RobotOutlined } from '@ant-design/icons';

const MailThreadMessageItem = ({
    message: m,
    formatDate,
    showReplyChoiceRow,
    replyChoiceSlot,
    showViewAiSuggestionButton,
    onViewAiSuggestion,
    onOpenFeedbackAdjust,
    onOpenFeedbackView,
}) => {
    const inbound = m.direction === 'inbound';
    const from = m.from?.email || m.from?.name || '—';
    const hasFeedback = Boolean(String(m.feedback || '').trim());

    return (
        <List.Item>
            <div className="w-full">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        {hasFeedback ? (
                            <Badge dot color="#faad14">
                                <Tag color={inbound ? 'blue' : 'green'}>{inbound ? 'Recibido' : 'Enviado'}</Tag>
                            </Badge>
                        ) : (
                            <Tag color={inbound ? 'blue' : 'green'}>{inbound ? 'Recibido' : 'Enviado'}</Tag>
                        )}
                        <span className="text-gray-800 text-sm">
                            <b>De:</b> {from}
                        </span>
                        {showViewAiSuggestionButton ? (
                            <Button
                                type="link"
                                size="small"
                                className="text-xs px-1 h-7"
                                icon={<RobotOutlined />}
                                onClick={() => onViewAiSuggestion(m)}
                            >
                                Ver sugerencia IA
                            </Button>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!inbound && (
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => onOpenFeedbackAdjust(m)}
                            >
                                Ajustar
                            </Button>
                        )}
                        {hasFeedback && (
                            <Button
                                size="small"
                                icon={<MessageOutlined />}
                                onClick={() => onOpenFeedbackView(m)}
                            >
                                Ver feedback
                            </Button>
                        )}
                        <span className="text-gray-500 text-sm">{formatDate(m.sentAt)}</span>
                    </div>
                </div>
                <div className="mt-2 whitespace-pre-wrap wrap-anywhere max-w-full text-gray-800">{m.content?.text || '—'}</div>
                {showReplyChoiceRow && replyChoiceSlot ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">{replyChoiceSlot}</div>
                ) : null}
            </div>
        </List.Item>
    );
};

export default MailThreadMessageItem;
