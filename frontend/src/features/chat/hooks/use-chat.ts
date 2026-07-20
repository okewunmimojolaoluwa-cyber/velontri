import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, chatKeys } from '@/lib/api/endpoints';

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: () => chatApi.getConversations(),
  });
}

export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => chatApi.getConversation(conversationId),
    enabled: Boolean(conversationId),
  });
}

export function useMessages(conversationId: string, params: { page?: number; page_size?: number } = {}) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId, params),
    queryFn: () => chatApi.getMessages(conversationId, params),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { conversation_id: string; content: string }) => chatApi.sendMessage(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.conversation_id) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => chatApi.markAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { participant_id: string; listing_id?: string }) =>
      chatApi.startConversation(data.participant_id, data.listing_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}
