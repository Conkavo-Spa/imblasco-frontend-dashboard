import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Conversations from '../services/Conversations';

const useConversations = (params = {}) => {
    return useQuery({
        queryKey: ['conversations', params],
        queryFn: () => Conversations.getAll(params),
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
    });
};

export default useConversations;
