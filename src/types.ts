export type ApiProviderId = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'custom';

export type TestType = 'ping' | 'models' | 'prompt';

export interface ProviderDefinition {
  id: ApiProviderId;
  name: string;
  category: 'llm' | 'custom';
  placeholder: string;
  keyPrefix?: string;
  defaultModel: string;
  availableModels: string[];
  docsUrl: string;
  helpTip: string;
  color: string;
}

export interface DiagnosticInfo {
  type: 'ok' | 'auth_error' | 'quota_error' | 'permission_error' | 'network_error' | 'not_found' | 'server_error';
  title: string;
  suggestion: string;
  helpUrl?: string;
}

export interface ModelItem {
  id: string;
  name?: string;
  description?: string;
  category?: 'chat' | 'multimodal' | 'embedding' | 'reasoning' | 'audio' | 'other';
  status?: 'active' | 'preview' | 'legacy' | 'restricted';
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedMethods?: string[];
  ownedBy?: string;
  contextWindow?: number;
  probeStatus?: 'idle' | 'checking' | 'healthy' | 'unhealthy' | 'rate_limited';
  probeLatencyMs?: number;
  probeMessage?: string;
}

export interface TestResult {
  id: string;
  timestamp: string;
  provider: ApiProviderId;
  maskedKey: string;
  testType: TestType;
  success: boolean;
  statusCode: number;
  statusText: string;
  latencyMs: number;
  message: string;
  models?: string[];
  modelDetails?: ModelItem[];
  promptResult?: string;
  headers?: Record<string, string>;
  rawResponse?: any;
  diagnostic: DiagnosticInfo;
}

export interface BatchItemResult {
  index: number;
  key: string;
  maskedKey: string;
  success: boolean;
  statusCode: number;
  latencyMs: number;
  message: string;
  diagnosticType: DiagnosticInfo['type'];
  diagnosticTitle: string;
}

export interface BatchSummary {
  total: number;
  valid: number;
  invalid: number;
  rateLimited: number;
  error: number;
}

export interface CustomApiConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  authHeader: string; // e.g. "Authorization: Bearer <key>" or "x-api-key: <key>"
  customHeaders: { key: string; value: string }[];
  body: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  latencyMs?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  error?: boolean;
  diagnostic?: DiagnosticInfo;
}

