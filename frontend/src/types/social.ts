/**
 * TypeScript types for social features (followers/following).
 */

export interface FollowStatus {
  following: boolean;
  followers_count: number;
  following_count: number;
}

export interface UserBasic {
  id: string;
  full_name: string;
  email?: string;
  followers_count: number;
  following_count: number;
  seller_verification_status?: 'not_verified' | 'pending' | 'verified' | 'rejected';
  created_at: string;
  followed_at?: string; // When the follow relationship was created
}

export interface FollowersResponse {
  followers: UserBasic[];
  meta: PaginationMeta;
}

export interface FollowingResponse {
  following: UserBasic[];
  meta: PaginationMeta;
}

export interface UserSearchResponse {
  users: UserBasic[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}
