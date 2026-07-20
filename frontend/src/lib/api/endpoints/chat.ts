import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface Conversation {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_avatar?: string;
  listing_id?: string;
  listing_title?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
}

export interface SendMessageRequest {
  conversation_id: string;
  content: string;
}

export const chatApi = {
  getConversations() {
    return apiClient
      .get<ApiResponse<Conversation[]>>('/chat/conversations')
      .then((r) => r.data);
  },

  getConversation(conversationId: string) {
    return apiClient
      .get<ApiResponse<Conversation>>(`/chat/conversations/${conversationId}`)
      .then((r) => r.data);
  },

  getMessages(conversationId: string, params: { page?: number; page_size?: number } = {}) {
    return apiClient
      .get<ApiResponse<ChatMessage[]>>(`/chat/conversations/${conversationId}/messages`, { params })
      .then((r) => r.data);
  },

  sendMessage(data: SendMessageRequest) {
    return apiClient
      .post<ApiResponse<ChatMessage>>('/chat/messages', data)
      .then((r) => r.data);
  },

  markAsRead(conversationId: string) {
    return apiClient
      .post<ApiResponse<unknown>>(`/chat/conversations/${conversationId}/read`, {})
      .then((r) => r.data);
  },

  startConversation(participantId: string, listingId?: string) {
    return apiClient
      .post<ApiResponse<Conversation>>('/chat/conversations', {
        participant_id: participantId,
        listing_id: listingId,
      })
      .then((r) => r.data);
  },
};

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...chatKeys.all, 'conversation', id] as const,
  messages: (conversationId: string, params?: object) => 
    [...chatKeys.all, 'messages', conversationId, params] as const,
};
