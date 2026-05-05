import instance from '../apis/app';

class EmailConversationsService {
    getAll = (params = {}) =>
        instance.get('/emails', {
            params,
        });

    setMessageFeedback = (conversationId, messageId, feedback) =>
        instance.put(`/emails/${conversationId}/messages/${messageId}/feedback`, { feedback });

    deleteConversation = (conversationId) =>
        instance.delete(`/emails/${conversationId}`);

    setConversationGoodAnswer = (conversationId, isGood) =>
        instance.put(`/emails/${conversationId}/good-answer`, { isGood: isGood === true });

    setConversationCorrected = (conversationId, isCorrected) =>
        instance.put(`/emails/${conversationId}/corrected`, { isCorrected: isCorrected === true });

    /** Registra cot_a_blas en pendiente desde emails_raw (source: system). */
    responderCotABlas = (payload = {}) =>
        instance.post('/emails/cot-a-blas/responder', {
            thread_id: payload.thread_id,
            email_id: payload.email_id,
        });
}

const EmailConversations = new EmailConversationsService();
export default EmailConversations;

