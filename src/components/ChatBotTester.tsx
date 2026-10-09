import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Trash2,
  SlidersHorizontal,
  Zap,
  Clock,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { ApiProviderId, ChatMessage, TestResult } from '../types';
import { PROVIDERS } from '../data/providers';

interface ChatBotTesterProps {
  systemGeminiConfigured?: boolean;
  onAddHistory?: (result: TestResult) => void;
  initialProvider?: ApiProviderId;
  initialApiKey?: string;
}

export const ChatBotTester: React.FC<ChatBotTesterProps> = ({
  systemGeminiConfigured,
  onAddHistory,
  initialProvider,
  initialApiKey,
}) => {
  const [provider, setProvider] = useState<ApiProviderId>(initialProvider || 'gemini');
  const [apiKey, setApiKey] = useState(initialApiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('Bạn là trợ lý AI thông minh và hữu ích. Hãy trả lời ngắn gọn, súc tích.');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [showConfig, setShowConfig] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];
  const isUsingSystemKey = provider === 'gemini' && apiKey === '__USE_ENV_GEMINI__';

  // Set default model when provider changes
  useEffect(() => {
    if (currentProvider && currentProvider.availableModels.length > 0) {
      setSelectedModel(currentProvider.defaultModel);
      setCustomModel('');
    }
  }, [provider]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Elapsed timer when loading
  useEffect(() => {
    if (isLoading) {
      setElapsedTime(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.round((Date.now() - start) / 100) / 10);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputPrompt).trim();
    if (!textToSend || isLoading) return;

    if (!apiKey && !(provider === 'gemini' && systemGeminiConfigured)) {
      alert('Vui lòng nhập API Key hoặc chọn "Dùng System Key" để bắt đầu trò chuyện.');
      return;
    }

    const effectiveKey = apiKey || (provider === 'gemini' && systemGeminiConfigured ? '__USE_ENV_GEMINI__' : '');

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt('');
    setIsLoading(true);

    const modelToUse = customModel.trim() || selectedModel;

    try {
      const response = await fetch('/api/chat-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: effectiveKey,
          model: modelToUse,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          systemInstruction: systemInstruction.trim() || undefined,
          temperature,
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.reply || (data.error ? `Lỗi: ${data.error}` : 'Không nhận được phản hồi'),
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        latencyMs: data.latencyMs,
        tokens: data.tokens,
        error: !data.success,
        diagnostic: data.diagnostic,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Add to global test history for latency charts
      if (onAddHistory) {
        const masked = effectiveKey === '__USE_ENV_GEMINI__'
          ? 'System [GEMINI_API_KEY]'
          : effectiveKey.length > 8
          ? `${effectiveKey.slice(0, 4)}...${effectiveKey.slice(-4)}`
          : '***';

        onAddHistory({
          id: `chat-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          provider,
          maskedKey: masked,
          testType: 'prompt',
          success: data.success,
          statusCode: data.statusCode || (data.success ? 200 : 500),
          statusText: data.statusText || (data.success ? 'OK' : 'Error'),
          latencyMs: data.latencyMs || 0,
          message: data.success ? `Chatbot Test thành công (${modelToUse})` : (data.error || 'Chatbot Test thất bại'),
          promptResult: data.reply?.slice(0, 150),
          diagnostic: data.diagnostic || {
            type: data.success ? 'ok' : 'network_error',
            title: data.success ? 'Thành công' : 'Lỗi phản hồi',
            suggestion: '',
          },
        });
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `Lỗi kết nối: ${err.message || 'Không thể gửi tin nhắn đến máy chủ API'}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        error: true,
        diagnostic: {
          type: 'network_error',
          title: 'Lỗi mạng hoặc Server nội bộ',
          suggestion: 'Kiểm tra đường truyền internet hoặc kết nối máy chủ.',
        },
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = [
    'Chào bạn! Hãy giới thiệu bạn là model nào và đơn vị phát triển?',
    'Viết 1 đoạn code Python kiểm tra HTTP API key bằng requests',
    'Giải thích sự khác biệt giữa Token và Word trong xử lý ngôn ngữ tự nhiên',
    'Thử thách tốc độ: Trả lời "OK API Key hoạt động hoàn hảo" trong 10 chữ',
  ];

  return (
    <div className="space-y-4">
      {/* Top Configuration Bar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Chatbot Sandbox Test Key
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Interactive Live
                </span>
              </h2>
              <p className="text-xs text-neutral-500">
                Trò chuyện trực tiếp với LLM qua API Key để kiểm tra tốc độ phản hồi, streaming và chất lượng câu trả lời.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showConfig
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Cấu hình Model & Prompt</span>
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 hover:text-rose-600 border border-neutral-200 hover:border-rose-200 bg-white transition-all"
                title="Xóa cuộc trò chuyện"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Provider, Model, and Key Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Provider Select */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Nhà cung cấp
            </label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as ApiProviderId)}
              className="w-full px-3 py-2 text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            >
              {PROVIDERS.filter(p => p.id !== 'custom').map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Select */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Mô hình (Model)
            </label>
            <select
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                setCustomModel('');
              }}
              className="w-full px-3 py-2 text-xs font-medium bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            >
              {currentProvider.availableModels.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div className="sm:col-span-6">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider">
                API Key {currentProvider.keyPrefix && `(${currentProvider.keyPrefix}...)`}
              </label>

              {provider === 'gemini' && systemGeminiConfigured && (
                <button
                  type="button"
                  onClick={() => {
                    if (isUsingSystemKey) {
                      setApiKey('');
                    } else {
                      setApiKey('__USE_ENV_GEMINI__');
                    }
                  }}
                  className={`text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                    isUsingSystemKey ? 'text-emerald-700 underline' : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  {isUsingSystemKey ? 'Đang dùng System Key (Hủy)' : 'Dùng System Key'}
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={isUsingSystemKey ? '•••••••••••• (System GEMINI_API_KEY)' : apiKey}
                disabled={isUsingSystemKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={isUsingSystemKey ? 'Đang sử dụng key hệ thống server' : currentProvider.placeholder}
                className={`w-full pl-3 pr-16 py-2 text-xs font-mono rounded-xl border transition-all ${
                  isUsingSystemKey
                    ? 'bg-emerald-50/50 border-emerald-300 text-emerald-900 font-semibold'
                    : 'bg-neutral-50 border-neutral-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />

              {!isUsingSystemKey && (
                <div className="absolute right-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="p-1 text-neutral-400 hover:text-neutral-600 rounded"
                    title={showKey ? 'Ẩn key' : 'Hiện key'}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {apiKey && (
                    <button
                      type="button"
                      onClick={() => setApiKey('')}
                      className="p-1 text-neutral-400 hover:text-rose-600 rounded text-xs"
                      title="Xóa"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Configuration */}
        {showConfig && (
          <div className="p-4 rounded-xl bg-neutral-50/80 border border-neutral-200/90 space-y-3 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Chỉ dẫn hệ thống (System Instruction / Prompt)
                </label>
                <input
                  type="text"
                  value={systemInstruction}
                  onChange={e => setSystemInstruction(e.target.value)}
                  placeholder="Ví dụ: Bạn là chuyên gia lập trình hỗ trợ giải thích code ngắn gọn..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700">
                    Nhiệt độ (Temperature)
                  </label>
                  <span className="text-xs font-mono text-neutral-500">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Tùy chỉnh tên Model (Ghi đè nếu model mới ra mắt)
              </label>
              <input
                type="text"
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
                placeholder={`Mặc định dùng ${selectedModel}, hoặc nhập tên model khác (ví dụ gpt-4o, claude-3-7-sonnet...)`}
                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Interface */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-xs flex flex-col h-[580px] overflow-hidden">
        {/* Chat History Messages Scroll Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
                <Bot className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h3 className="text-sm font-bold text-neutral-800">
                  Bắt đầu cuộc trò chuyện với {currentProvider.name}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Nhập câu hỏi bất kỳ hoặc bấm vào các câu mẫu dưới đây để gửi request thực tế và kiểm tra độ trễ của API key.
                </p>
              </div>

              {/* Quick suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-2">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="p-2.5 text-left rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-blue-50/70 hover:border-blue-200 text-xs text-neutral-700 transition-all leading-snug"
                  >
                    💬 {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div
                      className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-xs mt-1"
                      style={{ backgroundColor: currentProvider.color }}
                    >
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[75%] space-y-1.5`}>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-neutral-900 text-white rounded-tr-xs'
                          : msg.error
                          ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-xs'
                          : 'bg-neutral-100/90 border border-neutral-200/80 text-neutral-800 rounded-tl-xs'
                      }`}
                    >
                      {msg.content}

                      {/* Error diagnostic box inside message if failed */}
                      {msg.error && msg.diagnostic && (
                        <div className="mt-2.5 pt-2.5 border-t border-rose-200 text-[11px] text-rose-800 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            {msg.diagnostic.title}
                          </div>
                          <p className="text-rose-700">{msg.diagnostic.suggestion}</p>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-2 text-[10px] text-neutral-400 px-1">
                      <span>{msg.timestamp}</span>

                      {!isUser && msg.latencyMs !== undefined && (
                        <>
                          <span>•</span>
                          <span
                            className={`font-mono font-semibold flex items-center gap-0.5 ${
                              msg.latencyMs <= 300
                                ? 'text-emerald-700'
                                : msg.latencyMs <= 800
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }`}
                          >
                            <Zap className="w-2.5 h-2.5" />
                            {msg.latencyMs}ms
                          </span>
                        </>
                      )}

                      {!isUser && msg.tokens?.total && (
                        <>
                          <span>•</span>
                          <span>{msg.tokens.total} tokens</span>
                        </>
                      )}

                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="ml-auto text-neutral-400 hover:text-neutral-700 p-0.5 rounded transition-colors"
                          title="Sao chép câu trả lời"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-neutral-900 shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-xs mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div
                className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-xs animate-pulse"
                style={{ backgroundColor: currentProvider.color }}
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-neutral-100 border border-neutral-200/80 p-3 rounded-2xl text-xs text-neutral-600 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                <span>
                  {currentProvider.name} đang suy luận và phản hồi... ({elapsedTime}s)
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-neutral-50/80 border-t border-neutral-200">
          <div className="relative flex items-end gap-2">
            <textarea
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Nhắn tin với ${currentProvider.name} để test key (Nhấn Enter để gửi, Shift+Enter xuống dòng)...`}
              rows={2}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-neutral-200 rounded-xl resize-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-neutral-400"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() || isLoading}
              className={`h-10 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                !inputPrompt.trim() || isLoading
                  ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20'
              }`}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Gửi</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2 px-1">
            <span>
              Đang test: <strong className="text-neutral-700">{customModel.trim() || selectedModel}</strong> • {currentProvider.name}
            </span>
            <span>Kết quả test thành công sẽ được ghi nhận vào biểu đồ Latency</span>
          </div>
        </div>
      </div>
    </div>
  );
};
