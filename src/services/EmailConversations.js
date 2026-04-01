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
}

const EmailConversations = new EmailConversationsService();
export default EmailConversations;

