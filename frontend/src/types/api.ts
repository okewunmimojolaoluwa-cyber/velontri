export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: PaginationMeta | null;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  field: string | null;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  request_id: string;
}

export class VelontriApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field: string | null = null,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'VelontriApiError';
  }

  get isRetryable(): boolean {
    return (
      this.code === 'TOKEN_EXPIRED' ||
      this.status === 502 ||
      this.status === 503 ||
      this.status === 504
    );
  }
}
