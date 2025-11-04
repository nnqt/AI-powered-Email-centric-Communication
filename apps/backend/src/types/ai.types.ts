export interface ThreadMessage {
  text: string;
  from?: string;
}

export interface SummarizeRequest {
  thread: ThreadMessage[];
}

export interface SummarizeResponse {
  summary: string;
  status: string;
  model: string;
}

export interface ErrorResponse {
  error: string;
  status: number;
  timestamp: string;
  details?: string;
}