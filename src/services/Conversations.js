import instance from '../apis/app';

/**
 * Servicio de conversaciones (hilos email/chat).
 * Endpoint pendiente en backend: GET /conversations?channel=email&page=1&limit=10
 */
class ConversationsService {
    getAll = (params = {}) =>
        instance.get('/conversations', {
            params: { channel: 'email', ...params },
        });

    setFeedback = (id, feedback) =>
        instance.put(`/conversations/${id}/feedback`, { feedback });

    setMessageFeedback = (conversationId, messageId, feedback) =>
        instance.put(`/conversations/${conversationId}/messages/${messageId}/feedback`, { feedback });

    setMessageGoodAnswer = (conversationId, messageId, isGood) =>
        instance.put(`/conversations/${conversationId}/messages/${messageId}/good-answer`, { isGood: isGood === true });

    setConversationGoodAnswer = (conversationId, isGood) =>
        instance.put(`/conversations/${conversationId}/good-answer`, { isGood: isGood === true });

    deleteConversation = (conversationId) =>
        instance.delete(`/conversations/${conversationId}`);

    exportConversations = (from, to) =>
        instance.get('/conversations/export', { params: { channel: 'chat', from, to } });
}

const Conversations = new ConversationsService();
export default Conversations;
