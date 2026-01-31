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
}

const Conversations = new ConversationsService();
export default Conversations;
