import instance from '../apis/app';

class EmailConversationsService {
    getAll = (params = {}) =>
        instance.get('/emails', {
            params,
        });

    setMessageFeedback = (conversationId, messageId, feedback) =>
        instance.put(`/emails/${conversationId}/messages/${messageId}/feedback`, { feedback });
}

const EmailConversations = new EmailConversationsService();
export default EmailConversations;

