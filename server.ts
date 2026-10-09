import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '5mb' }));

// Helper to mask API keys safely
function maskKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****' + trimmed.slice(-2);
  return trimmed.slice(0, 4) + '...' + trimmed.slice(-4);
}

// Helper to sanitize headers for response
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  const relevantHeaders = [
    'content-type',
    'x-ratelimit-limit-requests',
    'x-ratelimit-remaining-requests',
    'x-ratelimit-reset-requests',
    'x-ratelimit-limit-tokens',
    'x-ratelimit-remaining-tokens',
    'x-ratelimit-reset-tokens',
    'retry-after',
    'server',
    'openai-organization',
    'openai-processing-ms',
    'anthropic-ratelimit-requests-remaining',
    'anthropic-ratelimit-tokens-remaining',
    'date',
  ];

  headers.forEach((val, name) => {
    const lower = name.toLowerCase();
    if (relevantHeaders.some(rh => lower.includes(rh) || lower.startsWith('x-ratelimit'))) {
      result[lower] = val;
    }
  });

  return result;
}

// Diagnostic helper
function analyzeStatus(status: number, data: any, provider: string) {
  let type: 'ok' | 'auth_error' | 'quota_error' | 'permission_error' | 'network_error' | 'not_found' | 'server_error' = 'ok';
  let title = 'Xác thực thành công (200 OK)';
  let suggestion = 'Khóa API hợp lệ và sẵn sàng sử dụng.';
  let helpUrl = '';

  const errStr = JSON.stringify(data || {}).toLowerCase();

  if (status >= 200 && status < 300) {
    return { type, title, suggestion, helpUrl };
  }

  if (status === 401 || (status === 400 && (errStr.includes('api_key_invalid') || errStr.includes('api key not valid') || errStr.includes('invalid_api_key')))) {
    type = 'auth_error';
    title = 'Khóa API không hợp lệ (API Key Invalid)';
    suggestion = 'Khóa API không hợp lệ hoặc đã bị thu hồi. Vui lòng kiểm tra lại chuỗi API key, đảm bảo không thừa khoảng trắng hoặc ký tự đặc biệt.';
    if (provider === 'gemini') helpUrl = 'https://aistudio.google.com/app/apikey';
    if (provider === 'openai') helpUrl = 'https://platform.openai.com/api-keys';
    if (provider === 'anthropic') helpUrl = 'https://console.anthropic.com/settings/keys';
  } else if (status === 403) {
    type = 'permission_error';
    title = 'Truy cập bị từ chối (403 Forbidden)';
    suggestion = 'Key không có quyền truy cập dịch vụ này, hoặc dự án chưa kích hoạt Billing/API, hoặc IP bị hạn chế bởi chính sách bảo mật.';
    if (provider === 'gemini') helpUrl = 'https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com';
  } else if (status === 429) {
    type = 'quota_error';
    title = 'Hết hạn ngạch hoặc bị giới hạn tốc độ (429 Too Many Requests)';
    suggestion = 'Tài khoản đã đạt giới hạn RPM (requests per minute) hoặc hết số dư/hạn ngạch tín dụng (Quota exceeded).';
    if (provider === 'openai') helpUrl = 'https://platform.openai.com/usage';
    if (provider === 'deepseek') helpUrl = 'https://platform.deepseek.com/top_up';
  } else if (status === 404) {
    type = 'not_found';
    title = 'Không tìm thấy tài nguyên hoặc Model (404 Not Found)';
    suggestion = 'Endpoint hoặc model chỉ định không tồn tại hoặc đã ngưng hỗ trợ.';
  } else if (status >= 500) {
    type = 'server_error';
    title = `Lỗi máy chủ dịch vụ (${status} Server Error)`;
    suggestion = 'Nhà cung cấp API đang gặp sự cố hoặc bảo trì tạm thời. Vui lòng thử lại sau.';
  } else {
    type = 'network_error';
    title = `Yêu cầu không thành công (Mã ${status})`;
    suggestion = errStr.length > 20 ? errStr.slice(0, 150) : 'Kiểm tra lại cấu hình yêu cầu và endpoint.';
  }

  return { type, title, suggestion, helpUrl };
}

// Single key tester implementation
const ANTHROPIC_CURATED_MODELS = [
  {
    id: 'claude-3-7-sonnet-latest',
    name: 'Claude 3.7 Sonnet',
    description: 'Mô hình thông minh cao cấp nhất của Anthropic với tính năng Hybrid Reasoning',
    category: 'reasoning',
    status: 'active',
    contextWindow: 200000,
    outputTokenLimit: 64000,
  },
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    description: 'Cân bằng lý tưởng giữa tốc độ cao và năng lực suy luận xuất sắc',
    category: 'multimodal',
    status: 'active',
    contextWindow: 200000,
    outputTokenLimit: 8192,
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    description: 'Mô hình siêu nhanh, tiết kiệm chi phí cho tác vụ thường nhật',
    category: 'chat',
    status: 'active',
    contextWindow: 200000,
    outputTokenLimit: 8192,
  },
  {
    id: 'claude-3-opus-latest',
    name: 'Claude 3 Opus',
    description: 'Chuyên gia phân tích chuyên sâu cho các bài toán phức tạp',
    category: 'chat',
    status: 'active',
    contextWindow: 200000,
    outputTokenLimit: 4096,
  },
];

function parseModelDetails(provider: string, responseData: any): any[] {
  if (!responseData) return [];
  const results: any[] = [];

  if (provider === 'gemini') {
    const rawList = Array.isArray(responseData.models) ? responseData.models : [];
    for (const m of rawList) {
      if (!m) continue;
      const rawName = typeof m === 'string' ? m : m.name || m.id || '';
      const cleanId = rawName.replace(/^models\//, '');
      const lowerId = cleanId.toLowerCase();

      let category: 'chat' | 'multimodal' | 'embedding' | 'reasoning' | 'audio' | 'other' = 'chat';
      if (lowerId.includes('embed')) category = 'embedding';
      else if (lowerId.includes('thinking') || lowerId.includes('reasoning')) category = 'reasoning';
      else if (lowerId.includes('live') || lowerId.includes('audio') || lowerId.includes('tts')) category = 'audio';
      else if (lowerId.includes('flash') || lowerId.includes('pro') || lowerId.includes('vision')) category = 'multimodal';

      let status: 'active' | 'preview' | 'legacy' | 'restricted' = 'active';
      if (lowerId.includes('preview') || lowerId.includes('exp')) status = 'preview';
      else if (lowerId.includes('001') || lowerId.includes('1.0') || lowerId.includes('bison') || lowerId.includes('2.5-flash')) status = 'legacy';

      results.push({
        id: cleanId,
        name: m.displayName || cleanId,
        description: m.description || '',
        category,
        status,
        inputTokenLimit: m.inputTokenLimit || undefined,
        outputTokenLimit: m.outputTokenLimit || undefined,
        supportedMethods: m.supportedGenerationMethods || [],
      });
    }
  } else if (provider === 'openai') {
    const rawList = Array.isArray(responseData.data) ? responseData.data : [];
    for (const m of rawList) {
      if (!m) continue;
      const id = typeof m === 'string' ? m : m.id || '';
      const lowerId = id.toLowerCase();

      let category: 'chat' | 'multimodal' | 'embedding' | 'reasoning' | 'audio' | 'other' = 'chat';
      if (lowerId.includes('embed')) category = 'embedding';
      else if (lowerId.startsWith('o1') || lowerId.startsWith('o3')) category = 'reasoning';
      else if (lowerId.includes('gpt-4o') || lowerId.includes('vision') || lowerId.includes('dall-e')) category = 'multimodal';
      else if (lowerId.includes('whisper') || lowerId.includes('tts')) category = 'audio';

      let status: 'active' | 'preview' | 'legacy' | 'restricted' = 'active';
      if (lowerId.includes('preview')) status = 'preview';
      else if (lowerId.includes('turbo-instruct') || lowerId.includes('davinci') || lowerId.includes('curie') || lowerId.includes('babbage')) status = 'legacy';

      let contextWindow: number | undefined;
      if (lowerId.includes('gpt-4o') || lowerId.includes('o1') || lowerId.includes('o3')) contextWindow = 128000;
      else if (lowerId.includes('gpt-4-turbo')) contextWindow = 128000;
      else if (lowerId.includes('gpt-4')) contextWindow = 8192;
      else if (lowerId.includes('gpt-3.5-turbo')) contextWindow = 16385;

      results.push({
        id,
        name: id,
        ownedBy: m.owned_by || 'openai',
        category,
        status,
        contextWindow,
      });
    }
  } else if (provider === 'groq') {
    const rawList = Array.isArray(responseData.data) ? responseData.data : [];
    for (const m of rawList) {
      if (!m) continue;
      const id = typeof m === 'string' ? m : m.id || '';
      const lowerId = id.toLowerCase();
      let category: 'chat' | 'multimodal' | 'embedding' | 'reasoning' | 'audio' | 'other' = 'chat';
      if (lowerId.includes('whisper')) category = 'audio';
      else if (lowerId.includes('r1') || lowerId.includes('deepseek-r1')) category = 'reasoning';
      else if (lowerId.includes('vision')) category = 'multimodal';

      results.push({
        id,
        name: id,
        ownedBy: m.owned_by || 'Groq',
        contextWindow: m.context_window || undefined,
        status: m.active === false ? 'legacy' : 'active',
        category,
      });
    }
  } else if (provider === 'deepseek') {
    const rawList = Array.isArray(responseData.data) ? responseData.data : [];
    for (const m of rawList) {
      if (!m) continue;
      const id = typeof m === 'string' ? m : m.id || '';
      const isReasoner = id.includes('reasoner');
      results.push({
        id,
        name: isReasoner ? 'DeepSeek-R1 (Reasoner)' : 'DeepSeek-V3 (Chat)',
        description: isReasoner ? 'Mô hình lập luận logic sâu và toán học' : 'Mô hình hội thoại và lập trình tổng quát',
        ownedBy: 'DeepSeek',
        category: isReasoner ? 'reasoning' : 'chat',
        status: 'active',
        contextWindow: 64000,
      });
    }
  } else if (provider === 'openrouter') {
    const rawList = Array.isArray(responseData.data) ? responseData.data : [];
    for (const m of rawList) {
      if (!m) continue;
      const id = typeof m === 'string' ? m : m.id || '';
      const lowerId = id.toLowerCase();
      let category: 'chat' | 'multimodal' | 'embedding' | 'reasoning' | 'audio' | 'other' = 'chat';
      if (lowerId.includes('r1') || lowerId.includes('reasoning') || lowerId.includes('o1')) category = 'reasoning';
      else if (lowerId.includes('vision') || lowerId.includes('flash') || lowerId.includes('4o')) category = 'multimodal';

      results.push({
        id,
        name: m.name || id,
        description: m.description || '',
        category,
        status: 'active',
        contextWindow: m.context_length || undefined,
      });
    }
  }

  return results;
}

async function executeKeyTest(params: {
  provider: string;
  apiKey: string;
  testType?: 'ping' | 'models' | 'prompt';
  promptText?: string;
  model?: string;
  customConfig?: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
}) {
  const { provider, testType = 'ping', promptText = 'Say hello in 5 words', customConfig } = params;
  let apiKey = params.apiKey ? params.apiKey.trim() : '';

  // Allow testing server environment key for Gemini
  if (apiKey === '__USE_ENV_GEMINI__' || (provider === 'gemini' && !apiKey && process.env.GEMINI_API_KEY)) {
    apiKey = process.env.GEMINI_API_KEY || '';
  }

  if (!apiKey && provider !== 'custom') {
    return {
      success: false,
      statusCode: 400,
      statusText: 'Bad Request',
      latencyMs: 0,
      provider,
      testType,
      message: 'Chưa nhập API Key',
      diagnostic: {
        type: 'auth_error' as const,
        title: 'Thiếu API Key',
        suggestion: 'Vui lòng điền API Key vào ô nhập liệu.',
      },
    };
  }

  const startTime = performance.now();

  try {
    let url = '';
    let method = 'GET';
    const headers: Record<string, string> = {
      'User-Agent': 'API-Key-Tester/1.0',
    };
    let body: string | undefined = undefined;

    switch (provider) {
      case 'gemini': {
        if (testType === 'prompt') {
          const targetModel = params.model || 'gemini-3.1-flash-lite';
          url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
          method = 'POST';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { maxOutputTokens: 50 },
          });
        } else {
          // ping or models list
          url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
          method = 'GET';
        }
        break;
      }

      case 'openai': {
        headers['Authorization'] = `Bearer ${apiKey}`;
        if (testType === 'prompt') {
          url = 'https://api.openai.com/v1/chat/completions';
          method = 'POST';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            model: params.model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: promptText }],
            max_tokens: 40,
          });
        } else {
          url = 'https://api.openai.com/v1/models';
          method = 'GET';
        }
        break;
      }

      case 'anthropic': {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['Content-Type'] = 'application/json';
        url = 'https://api.anthropic.com/v1/messages';
        method = 'POST';
        body = JSON.stringify({
          model: params.model || 'claude-3-5-haiku-latest',
          max_tokens: 30,
          messages: [{ role: 'user', content: promptText }],
        });
        break;
      }

      case 'groq': {
        headers['Authorization'] = `Bearer ${apiKey}`;
        if (testType === 'prompt') {
          url = 'https://api.groq.com/openai/v1/chat/completions';
          method = 'POST';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            model: params.model || 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: promptText }],
            max_tokens: 40,
          });
        } else {
          url = 'https://api.groq.com/openai/v1/models';
          method = 'GET';
        }
        break;
      }

      case 'deepseek': {
        headers['Authorization'] = `Bearer ${apiKey}`;
        if (testType === 'prompt') {
          url = 'https://api.deepseek.com/chat/completions';
          method = 'POST';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            model: params.model || 'deepseek-chat',
            messages: [{ role: 'user', content: promptText }],
            max_tokens: 40,
          });
        } else {
          url = 'https://api.deepseek.com/models';
          method = 'GET';
        }
        break;
      }

      case 'openrouter': {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = 'https://ai.studio';
        headers['X-Title'] = 'API Key Tester';
        if (testType === 'prompt') {
          url = 'https://openrouter.ai/api/v1/chat/completions';
          method = 'POST';
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({
            model: params.model || 'google/gemini-2.0-flash-001',
            messages: [{ role: 'user', content: promptText }],
            max_tokens: 40,
          });
        } else {
          url = 'https://openrouter.ai/api/v1/auth/key';
          method = 'GET';
        }
        break;
      }

      case 'custom': {
        if (!customConfig?.url) {
          throw new Error('Thiếu URL cho custom endpoint');
        }
        url = customConfig.url;
        method = customConfig.method || 'GET';
        if (customConfig.headers) {
          Object.assign(headers, customConfig.headers);
        }
        if (apiKey && !headers['Authorization'] && !headers['authorization']) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        if (customConfig.body && method !== 'GET') {
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          body = customConfig.body;
        }
        break;
      }

      default:
        throw new Error(`Provider không được hỗ trợ: ${provider}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const latencyMs = Math.round(performance.now() - startTime);
    const contentType = response.headers.get('content-type') || '';
    let responseData: any = null;

    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    const isSuccess = response.ok;
    const sanitizedHeaderMap = sanitizeHeaders(response.headers);
    const diagnostic = analyzeStatus(response.status, responseData, provider);

    // Extract models list and rich model details if available
    let models: string[] = [];
    let modelDetails: any[] = [];
    if (responseData) {
      if (Array.isArray(responseData.models)) {
        models = responseData.models.map((m: any) => (typeof m === 'string' ? m : m.name ? m.name.replace(/^models\//, '') : m.id));
      } else if (Array.isArray(responseData.data)) {
        models = responseData.data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name));
      }
      modelDetails = parseModelDetails(provider, responseData);
    }

    if (provider === 'anthropic' && isSuccess) {
      modelDetails = ANTHROPIC_CURATED_MODELS;
      models = ANTHROPIC_CURATED_MODELS.map(m => m.id);
    }

    // Extract prompt result if prompt test
    let promptResult = '';
    if (responseData) {
      if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
        promptResult = responseData.candidates[0].content.parts[0].text;
      } else if (responseData.choices?.[0]?.message?.content) {
        promptResult = responseData.choices[0].message.content;
      } else if (responseData.content?.[0]?.text) {
        promptResult = responseData.content[0].text;
      }
    }

    return {
      success: isSuccess,
      statusCode: response.status,
      statusText: response.statusText,
      latencyMs,
      provider,
      testType,
      message: isSuccess ? 'Key hoạt động bình thường' : `Lỗi ${response.status}: ${response.statusText}`,
      models: models.length > 0 ? models.slice(0, 100) : undefined,
      modelDetails: modelDetails.length > 0 ? modelDetails.slice(0, 100) : undefined,
      promptResult: promptResult || undefined,
      headers: sanitizedHeaderMap,
      rawResponse: responseData,
      diagnostic,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    const isTimeout = err.name === 'AbortError';

    return {
      success: false,
      statusCode: isTimeout ? 408 : 0,
      statusText: isTimeout ? 'Request Timeout' : 'Network Error',
      latencyMs,
      provider,
      testType,
      message: isTimeout ? 'Yêu cầu hết thời gian chờ (Timeout 15s)' : (err.message || 'Lỗi kết nối mạng'),
      diagnostic: {
        type: 'network_error' as const,
        title: isTimeout ? 'Hết thời gian chờ (Timeout)' : 'Lỗi kết nối mạng',
        suggestion: isTimeout
          ? 'Máy chủ API phản hồi quá chậm (>15s). Kiểm tra lại kết nối mạng hoặc thử lại sau.'
          : 'Không thể gửi yêu cầu đến máy chủ API. Kiểm tra lại đường dẫn URL hoặc tường lửa mạng.',
      },
      rawResponse: { error: err.message || String(err) },
    };
  }
}

// System info endpoint
app.get('/api/system-status', (req, res) => {
  const envGemini = process.env.GEMINI_API_KEY;
  res.json({
    geminiConfigured: !!envGemini,
    maskedGeminiKey: envGemini ? maskKey(envGemini) : null,
    serverTime: new Date().toISOString(),
  });
});

// Single Key Test endpoint
app.post('/api/test-key', async (req, res) => {
  try {
    const result = await executeKeyTest(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      statusCode: 500,
      statusText: 'Internal Server Error',
      message: error.message || 'Lỗi xử lý kiểm tra key',
    });
  }
});

// Batch Key Test endpoint
app.post('/api/test-batch', async (req, res) => {
  try {
    const { provider, keys, testType = 'ping' } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'Danh sách keys không được để trống' });
    }

    // Limit to max 50 keys per batch to prevent server overload
    const cleanKeys = keys
      .map(k => (typeof k === 'string' ? k.trim() : ''))
      .filter(k => k.length > 0)
      .slice(0, 50);

    const results: any[] = [];
    // Concurrency pool of 4
    const concurrency = 4;
    for (let i = 0; i < cleanKeys.length; i += concurrency) {
      const chunk = cleanKeys.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async (key, chunkIdx) => {
        const testRes = await executeKeyTest({
          provider,
          apiKey: key,
          testType,
        });
        return {
          index: i + chunkIdx + 1,
          key,
          maskedKey: maskKey(key),
          success: testRes.success,
          statusCode: testRes.statusCode,
          latencyMs: testRes.latencyMs,
          message: testRes.message,
          diagnosticType: testRes.diagnostic?.type || (testRes.success ? 'ok' : 'network_error'),
          diagnosticTitle: testRes.diagnostic?.title || '',
        };
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const summary = {
      total: results.length,
      valid: results.filter(r => r.success).length,
      invalid: results.filter(r => !r.success && (r.statusCode === 401 || r.statusCode === 403)).length,
      rateLimited: results.filter(r => r.statusCode === 429).length,
      error: results.filter(r => !r.success && r.statusCode !== 401 && r.statusCode !== 403 && r.statusCode !== 429).length,
    };

    res.json({
      summary,
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Lỗi xử lý kiểm tra hàng loạt',
    });
  }
});

// Chatbot Key Testing Endpoint
app.post('/api/chat-test', async (req, res) => {
  try {
    const { provider, apiKey, model, messages, systemInstruction, temperature } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'Thiếu thông tin provider' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Danh sách tin nhắn không hợp lệ' });
    }

    let actualKey = (apiKey || '').trim();
    if (actualKey === '__USE_ENV_GEMINI__' || (provider === 'gemini' && !actualKey)) {
      actualKey = process.env.GEMINI_API_KEY || '';
      if (!actualKey) {
        return res.status(400).json({
          error: 'Chưa cấu hình GEMINI_API_KEY trong biến môi trường server',
        });
      }
    }

    if (!actualKey) {
      return res.status(400).json({ error: 'Vui lòng nhập API Key để trò chuyện' });
    }

    const startTime = performance.now();
    let url = '';
    let method = 'POST';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'aistudio-key-tester',
    };
    let body: any = null;
    const selectedModel = model || (
      provider === 'gemini' ? 'gemini-3.1-flash-lite' :
      provider === 'openai' ? 'gpt-4o-mini' :
      provider === 'anthropic' ? 'claude-3-5-haiku-latest' :
      provider === 'groq' ? 'llama-3.3-70b-versatile' :
      provider === 'deepseek' ? 'deepseek-chat' :
      provider === 'openrouter' ? 'google/gemini-2.0-flash-001' : 'default'
    );

    const tempVal = typeof temperature === 'number' ? temperature : 0.7;

    switch (provider) {
      case 'gemini': {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${actualKey}`;
        const contents = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

        body = {
          contents,
          generationConfig: {
            temperature: tempVal,
            maxOutputTokens: 1000,
          },
        };

        if (systemInstruction) {
          body.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }
        break;
      }

      case 'openai': {
        url = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${actualKey}`;
        const formattedMsgs: any[] = [];
        if (systemInstruction) {
          formattedMsgs.push({ role: 'system', content: systemInstruction });
        }
        formattedMsgs.push(...messages.map(m => ({ role: m.role, content: m.content })));
        body = {
          model: selectedModel,
          messages: formattedMsgs,
          temperature: tempVal,
          max_tokens: 1000,
        };
        break;
      }

      case 'anthropic': {
        url = 'https://api.anthropic.com/v1/messages';
        headers['x-api-key'] = actualKey;
        headers['anthropic-version'] = '2023-06-01';
        body = {
          model: selectedModel,
          system: systemInstruction || undefined,
          messages: messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content })),
          max_tokens: 1000,
          temperature: tempVal,
        };
        break;
      }

      case 'groq': {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${actualKey}`;
        const formattedMsgs: any[] = [];
        if (systemInstruction) {
          formattedMsgs.push({ role: 'system', content: systemInstruction });
        }
        formattedMsgs.push(...messages.map(m => ({ role: m.role, content: m.content })));
        body = {
          model: selectedModel,
          messages: formattedMsgs,
          temperature: tempVal,
          max_tokens: 1000,
        };
        break;
      }

      case 'deepseek': {
        url = 'https://api.deepseek.com/chat/completions';
        headers['Authorization'] = `Bearer ${actualKey}`;
        const formattedMsgs: any[] = [];
        if (systemInstruction) {
          formattedMsgs.push({ role: 'system', content: systemInstruction });
        }
        formattedMsgs.push(...messages.map(m => ({ role: m.role, content: m.content })));
        body = {
          model: selectedModel,
          messages: formattedMsgs,
          temperature: tempVal,
          max_tokens: 1000,
        };
        break;
      }

      case 'openrouter': {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${actualKey}`;
        headers['HTTP-Referer'] = 'https://ai.studio';
        headers['X-Title'] = 'API Key Chatbot Tester';
        const formattedMsgs: any[] = [];
        if (systemInstruction) {
          formattedMsgs.push({ role: 'system', content: systemInstruction });
        }
        formattedMsgs.push(...messages.map(m => ({ role: m.role, content: m.content })));
        body = {
          model: selectedModel,
          messages: formattedMsgs,
          temperature: tempVal,
          max_tokens: 1000,
        };
        break;
      }

      default:
        return res.status(400).json({ error: `Provider không hỗ trợ chatbot: ${provider}` });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const apiResponse = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);
    const contentType = apiResponse.headers.get('content-type') || '';
    let responseData: any = null;
    let replyText = '';
    let tokens: { prompt?: number; completion?: number; total?: number } | undefined;

    if (contentType.includes('application/json')) {
      responseData = await apiResponse.json();
    } else {
      const text = await apiResponse.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = { text };
      }
    }

    if (apiResponse.ok && responseData) {
      if (provider === 'gemini') {
        replyText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (responseData.usageMetadata) {
          tokens = {
            prompt: responseData.usageMetadata.promptTokenCount,
            completion: responseData.usageMetadata.candidatesTokenCount,
            total: responseData.usageMetadata.totalTokenCount,
          };
        }
      } else if (provider === 'anthropic') {
        replyText = responseData.content?.[0]?.text || '';
        if (responseData.usage) {
          tokens = {
            prompt: responseData.usage.input_tokens,
            completion: responseData.usage.output_tokens,
            total: (responseData.usage.input_tokens || 0) + (responseData.usage.output_tokens || 0),
          };
        }
      } else {
        // OpenAI, Groq, DeepSeek, OpenRouter
        replyText = responseData.choices?.[0]?.message?.content || '';
        if (responseData.usage) {
          tokens = {
            prompt: responseData.usage.prompt_tokens,
            completion: responseData.usage.completion_tokens,
            total: responseData.usage.total_tokens,
          };
        }
      }
    }

    const diagnostic = analyzeStatus(apiResponse.status, responseData, provider);

    res.json({
      success: apiResponse.ok,
      statusCode: apiResponse.status,
      statusText: apiResponse.statusText,
      latencyMs,
      provider,
      model: selectedModel,
      reply: replyText || (apiResponse.ok ? '(Không có nội dung phản hồi)' : ''),
      tokens,
      diagnostic,
      rawResponse: responseData,
    });
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    res.status(isTimeout ? 408 : 500).json({
      success: false,
      statusCode: isTimeout ? 408 : 500,
      statusText: isTimeout ? 'Request Timeout' : 'Internal Error',
      error: isTimeout ? 'Yêu cầu trò chuyện quá thời gian chờ (25s)' : (err.message || 'Lỗi server'),
      diagnostic: {
        type: 'network_error',
        title: isTimeout ? 'Hết thời gian chờ (Timeout)' : 'Lỗi kết nối',
        suggestion: isTimeout
          ? 'Mô hình AI mất quá 25s để phản hồi. Thử giảm độ dài prompt hoặc đổi model nhẹ hơn (ví dụ Flash/Haiku).'
          : 'Không thể kết nối đến máy chủ API của provider.',
      },
    });
  }
});

// Live Model Health Probe Endpoint
app.post('/api/probe-model', async (req, res) => {
  try {
    const { provider, apiKey, modelId } = req.body;
    if (!provider || !modelId) {
      return res.status(400).json({ error: 'Thiếu thông tin provider hoặc modelId' });
    }

    let actualKey = (apiKey || '').trim();
    if (actualKey === '__USE_ENV_GEMINI__' || (provider === 'gemini' && !actualKey)) {
      actualKey = process.env.GEMINI_API_KEY || '';
    }

    if (!actualKey && provider !== 'custom') {
      return res.status(400).json({ error: 'Thiếu API Key' });
    }

    const startTime = performance.now();
    let url = '';
    let method = 'POST';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'aistudio-model-probe',
    };
    let body: any = null;

    if (provider === 'gemini') {
      const cleanModel = modelId.replace(/^models\//, '');
      url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(actualKey)}`;
      body = {
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 2 },
      };
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = actualKey;
      headers['anthropic-version'] = '2023-06-01';
      body = {
        model: modelId,
        max_tokens: 2,
        messages: [{ role: 'user', content: 'ping' }],
      };
    } else {
      const baseUrls: Record<string, string> = {
        openai: 'https://api.openai.com/v1/chat/completions',
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/chat/completions',
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      };
      url = baseUrls[provider] || 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${actualKey}`;
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://ai.studio';
        headers['X-Title'] = 'Model Health Probe';
      }
      body = {
        model: modelId,
        max_tokens: 2,
        messages: [{ role: 'user', content: 'ping' }],
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const apiResponse = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);
    let respData: any = null;
    try {
      respData = await apiResponse.json();
    } catch {
      respData = null;
    }

    let probeStatus: 'healthy' | 'rate_limited' | 'unhealthy' = 'unhealthy';
    let message = '';

    if (apiResponse.ok) {
      probeStatus = 'healthy';
      message = `Sẵn sàng hoạt động (${latencyMs}ms)`;
    } else if (apiResponse.status === 429) {
      probeStatus = 'rate_limited';
      message = 'Bị giới hạn tốc độ (Rate Limit 429)';
    } else if (apiResponse.status === 404) {
      probeStatus = 'unhealthy';
      message = 'Không tồn tại hoặc đã ngừng hỗ trợ (404 Not Found)';
    } else if (apiResponse.status === 403) {
      probeStatus = 'unhealthy';
      message = 'Tài khoản không có quyền truy cập model này (403 Forbidden)';
    } else {
      const errDetail = respData?.error?.message || respData?.message || apiResponse.statusText;
      message = `Lỗi HTTP ${apiResponse.status}: ${errDetail || 'Không rõ nguyên nhân'}`;
    }

    res.json({
      modelId,
      provider,
      success: apiResponse.ok,
      statusCode: apiResponse.status,
      latencyMs,
      probeStatus,
      message,
    });
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    res.json({
      modelId: req.body.modelId,
      provider: req.body.provider,
      success: false,
      statusCode: isTimeout ? 408 : 500,
      latencyMs: 12000,
      probeStatus: 'unhealthy',
      message: isTimeout ? 'Hết thời gian chờ phản hồi (>12s)' : (err.message || 'Lỗi kết nối'),
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Vite or static serving
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
