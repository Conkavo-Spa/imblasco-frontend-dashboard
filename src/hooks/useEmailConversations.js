import { useQuery, keepPreviousData } from '@tanstack/react-query';
import EmailConversations from '../services/EmailConversations';

const useEmailConversations = (params = {}) => {
    return useQuery({
        queryKey: ['emails', params],
        queryFn: () => EmailConversations.getAll(params),
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
    });
};

export default useEmailConversations;

