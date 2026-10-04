export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
  model?: string;
  thinking?: string;
  error?: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  model: string | null;
  updatedAt: number;
}

export interface Chat extends ChatSummary {
  messages: ChatMessage[];
}

export interface PublicUser {
  id: number;
  username: string;
  isAdmin: boolean;
  approved: boolean;
  createdAt: number;
}

export interface ModelInfo {
  name: string;
  size: number;
  params?: string;
  quant?: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  default: string | null;
}

export interface ModelConfig {
  enabled: string[];
  default: string | null;
}

export interface AdminState {
  installed: ModelInfo[];
  config: ModelConfig;
  users: PublicUser[];
}

export interface AuthStatus {
  needsSetup: boolean;
  canSetup: boolean;
}

export interface RegisterResponse {
  status: "active" | "pending";
}

export interface ChatChunk {
  message?: { role: Role; content?: string; thinking?: string };
  done?: boolean;
  error?: string;
}

export interface PullProgress {
  status: string;
  total?: number;
  completed?: number;
  error?: string;
}

export interface ApiError {
  error: string;
}
