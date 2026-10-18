export interface ChatStreamEvent {
  type: 'message' | 'done' | 'error';
  data: string;
  requestId: string;
  phase: number;
}
