export interface ChatResponseItem {
  type: number;
  content: string;
  agent_name?: string;
  result_json?: string;
}

export interface ChatMessage {
  role?: string;
  content?: string;
  timestamp?: number;
}

export interface ConversationEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
}
