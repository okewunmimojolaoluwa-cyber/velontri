import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  FollowStatus,
  FollowersResponse,
  FollowingResponse,
  UserSearchResponse,
} from '@/types/social';

/**
 * Social API client - Followers/Following functionality.
 */
export const socialApi = {
  /**
   * Follow a user.
   */
  followUser(userId: string) {
    return apiClient
      .post<ApiResponse<FollowStatus>>(`/users/${userId}/follow`)
      .then((r) => r.data);
  },

  /**
   * Unfollow a user.
   */
  unfollowUser(userId: string) {
    return apiClient
      .delete<ApiResponse<FollowStatus>>(`/users/${userId}/follow`)
      .then((r) => r.data);
  },

  /**
   * Check follow status for a specific user.
   */
  getFollowStatus(userId: string) {
    return apiClient
      .get<ApiResponse<FollowStatus>>(`/users/${userId}/follow-status`)
      .then((r) => r.data);
  },

  /**
   * Get a user's followers with pagination.
   */
  getFollowers(userId: string, page: number = 1, pageSize: number = 20) {
    return apiClient
      .get<ApiResponse<FollowersResponse>>(`/users/${userId}/followers`, {
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data);
  },

  /**
   * Get users that a user follows with pagination.
   */
  getFollowing(userId: string, page: number = 1, pageSize: number = 20) {
    return apiClient
      .get<ApiResponse<FollowingResponse>>(`/users/${userId}/following`, {
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data);
  },

  /**
   * Get authenticated user's followers.
   */
  getMyFollowers(page: number = 1, pageSize: number = 20) {
    return apiClient
      .get<ApiResponse<FollowersResponse>>('/me/followers', {
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data);
  },

  /**
   * Get users that authenticated user follows.
   */
  getMyFollowing(page: number = 1, pageSize: number = 20) {
    return apiClient
      .get<ApiResponse<FollowingResponse>>('/me/following', {
        params: { page, page_size: pageSize },
      })
      .then((r) => r.data);
  },

  /**
   * Search for users/sellers by name.
   */
  searchUsers(query: string, page: number = 1, pageSize: number = 20) {
    return apiClient
      .get<ApiResponse<UserSearchResponse>>('/users/search', {
        params: { q: query, page, page_size: pageSize },
      })
      .then((r) => r.data);
  },
};

/**
 * Query keys for React Query caching.
 */
export const socialKeys = {
  all: ['social'] as const,
  followStatus: (userId: string) => [...socialKeys.all, 'follow-status', userId] as const,
  followers: (userId: string, page: number) => [...socialKeys.all, 'followers', userId, page] as const,
  following: (userId: string, page: number) => [...socialKeys.all, 'following', userId, page] as const,
  myFollowers: (page: number) => [...socialKeys.all, 'my-followers', page] as const,
  myFollowing: (page: number) => [...socialKeys.all, 'my-following', page] as const,
  search: (query: string, page: number) => [...socialKeys.all, 'search', query, page] as const,
};
