import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Clipboard,
  Trash2,
  Play,
  Loader2,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Zap,
  Bot,
  MessageSquare,
  ListTree,
  Server,
  Sliders,
  Terminal,
} from 'lucide-react';
import { ApiProviderId, TestType, TestResult } from '../types';
import { PROVIDERS } from '../data/providers';
import { DiagnosticCard } from './DiagnosticCard';
import { ResponseInspector } from './ResponseInspector';

interface SingleTesterProps {
  onAddHistory: (result: TestResult) => void;
  systemGeminiConfigured: boolean;
  onOpenChat?: (provider: ApiProviderId, apiKey: string) => void;
  onOpenClaudeConfig?: (apiKey: string, provider?: ApiProviderId) => void;
}

export const SingleTester: React.FC<SingleTesterProps> = ({
  onAddHistory,
  systemGeminiConfigured,
  onOpenChat,
  onOpenClaudeConfig,
}) => {
  const [provider, setProvider] = useState<ApiProviderId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testType, setTestType] = useState<TestType>('ping');
  const [customModel, setCustomModel] = useState('');
  const [promptText, setPromptText] = useState('Say hello in 5 words or less');
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const activeProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setApiKey(text.trim());
    } catch {
      // Fallback
    }
  };

  const handleUseSystemKey = () => {
    setProvider('gemini');
    setApiKey('__USE_ENV_GEMINI__');
  };

  const handleRunTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKey && provider !== 'custom') {
      setErrorMsg('Vui lòng nhập API Key để kiểm tra');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    setCurrentResult(null);

    const modelToUse = customModel.trim() || activeProvider.defaultModel;

    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          testType,
          model: modelToUse,
          promptText,
        }),
      });

      const data = await res.json();
      const testResult: TestResult = {
        id: 'test_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        provider,
        maskedKey:
          apiKey === '__USE_ENV_GEMINI__'
            ? 'ENV_GEMINI_KEY'
            : apiKey.length > 8
            ? apiKey.slice(0, 4) + '...' + apiKey.slice(-4)
            : '****',
        testType,
        success: data.success,
        statusCode: data.statusCode,
        statusText: data.statusText || '',
        latencyMs: data.latencyMs || 0,
        message: data.message || '',
        models: data.models,
        promptResult: data.promptResult,
        headers: data.headers,
        rawResponse: data.rawResponse,
        diagnostic: data.diagnostic || {
          type: data.success ? 'ok' : 'network_error',
          title: data.success ? 'Thành công' : 'Lỗi kiểm tra',
          suggestion: data.message || '',
        },
      };

      setCurrentResult(testResult);
      onAddHistory(testResult);
    } catch (err: any) {
      const failedResult: TestResult = {
        id: 'test_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        provider,
        maskedKey: apiKey ? '****' : 'none',
        testType,
        success: false,
        statusCode: 0,
        statusText: 'Network Error',
        latencyMs: 0,
        message: err.message || 'Lỗi gửi yêu cầu đến server kiểm tra',
        diagnostic: {
          type: 'network_error',
          title: 'Lỗi kết nối nội bộ',
          suggestion: 'Không thể kết nối với dịch vụ kiểm tra. Vui lòng thử lại.',
        },
      };
      setCurrentResult(failedResult);
      onAddHistory(failedResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider Selector Cards */}
      <div>
        <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2.5">
          1. Chọn Dịch vụ / Nhà cung cấp AI
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {PROVIDERS.filter(p => p.id !== 'custom').map(p => {
            const isSelected = provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                id={`provider-btn-${p.id}`}
                onClick={() => {
                  setProvider(p.id);
                  if (customModel && !p.availableModels.includes(customModel)) {
                    setCustomModel('');
                  }
                }}
                className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/80'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {isSelected && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded">
                      Đã chọn
                    </span>
                  )}
                </div>
                <div className="font-semibold text-neutral-900 text-xs sm:text-sm truncate w-full">
                  {p.name}
                </div>
                <div className="text-[11px] text-neutral-500 font-mono truncate w-full mt-0.5">
                  {p.keyPrefix ? `${p.keyPrefix}...` : 'API Key'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main input container */}
      <form onSubmit={handleRunTest} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-5">
        {/* API Key field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="api-key-input" className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-neutral-600" />
              2. Nhập API Key cho {activeProvider.name}
            </label>

            <div className="flex items-center gap-2">
              {provider === 'gemini' && systemGeminiConfigured && (
                <button
                  type="button"
                  onClick={handleUseSystemKey}
                  className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Dùng Key Hệ Thống (.env)
                </button>
              )}
              {activeProvider.docsUrl && (
                <a
                  href={activeProvider.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                >
                  <span>Lấy key tại đây</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              id="api-key-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder={`Dán khóa API ${activeProvider.name} vào đây (${activeProvider.placeholder})`}
              className={`w-full pl-3.5 pr-28 py-2.5 rounded-xl border text-sm font-mono transition-all ${
                errorMsg
                  ? 'border-rose-300 focus:ring-2 focus:ring-rose-200 bg-rose-50/20'
                  : 'border-neutral-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
              }`}
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Ẩn key' : 'Hiện key'}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handlePasteKey}
                title="Dán từ Clipboard"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
              >
                <Clipboard className="w-4 h-4" />
              </button>
              {apiKey && (
                <button
                  type="button"
                  onClick={() => setApiKey('')}
                  title="Xóa ô nhập"
                  className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {errorMsg ? (
            <p className="text-xs text-rose-600 mt-1.5 font-medium">{errorMsg}</p>
          ) : (
            <p className="text-xs text-neutral-500 mt-1.5 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
              {activeProvider.helpTip}
            </p>
          )}

          {provider === 'anthropic' && onOpenClaudeConfig && (
            <div className="mt-2.5 p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/70 flex items-center justify-between text-xs text-amber-950 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Muốn cấu hình key này cho <strong>Claude Desktop</strong> hoặc <strong>Claude Code CLI</strong>?
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpenClaudeConfig(apiKey, 'anthropic')}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer ml-2"
              >
                Mở Trình Cấu Hình Claude →
              </button>
            </div>
          )}
        </div>

        {/* Test Mode Selector */}
        <div>
          <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-2">
            3. Chế độ kiểm tra (Test Mode)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              id="test-mode-ping"
              onClick={() => setTestType('ping')}
              className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                testType === 'ping'
                  ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500'
                  : 'border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900">Ping & Xác thực</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Kiểm tra tính hợp lệ của key, quyền hạn & tốc độ phản hồi (ms)
                </div>
              </div>
            </button>

            <button
              type="button"
              id="test-mode-prompt"
              onClick={() => setTestType('prompt')}
              className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                testType === 'prompt'
                  ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500'
                  : 'border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <div className="p-2 rounded-lg bg-blue-100 text-blue-800 shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900">Thử nghiệm Prompt</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Gửi 1 câu prompt mẫu để kiểm tra khả năng sinh văn bản thực tế
                </div>
              </div>
            </button>

            <button
              type="button"
              id="test-mode-models"
              onClick={() => setTestType('models')}
              className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                testType === 'models'
                  ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500'
                  : 'border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <div className="p-2 rounded-lg bg-purple-100 text-purple-800 shrink-0">
                <ListTree className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-neutral-900">Kiểm tra Models</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Lấy danh sách tất cả AI models mà key này được quyền sử dụng
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Model & Prompt options if prompt test */}
        {testType === 'prompt' && (
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Mô hình (Model):
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={activeProvider.availableModels.includes(customModel) ? customModel : ''}
                    onChange={e => setCustomModel(e.target.value)}
                    className="text-xs py-1.5 px-3 rounded-lg border border-neutral-300 bg-white font-mono focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">{activeProvider.defaultModel} (Mặc định)</option>
                    {activeProvider.availableModels.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-neutral-400">hoặc gõ tùy biến:</span>
                  <input
                    type="text"
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    placeholder={activeProvider.defaultModel}
                    className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-neutral-300 bg-white font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Nội dung Prompt kiểm tra:
              </label>
              <input
                type="text"
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                placeholder="Ví dụ: Xin chào trong 5 từ hoặc ít hơn"
                className="w-full text-xs py-2 px-3 rounded-lg border border-neutral-300 bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-neutral-500">
            {apiKey === '__USE_ENV_GEMINI__' ? (
              <span className="text-emerald-700 font-medium">Sử dụng biến môi trường GEMINI_API_KEY</span>
            ) : apiKey ? (
              <span className="font-mono">Độ dài: {apiKey.length} ký tự</span>
            ) : (
              <span>Chưa nhập key</span>
            )}
          </div>

          <button
            type="submit"
            id="btn-run-single-test"
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang gửi yêu cầu kiểm tra...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Bắt đầu Kiểm tra Key</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Result Section */}
      {currentResult && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <span>Kết quả kiểm tra chi tiết</span>
              <span className="text-xs font-normal text-neutral-500">
                ({currentResult.timestamp} - {currentResult.provider.toUpperCase()})
              </span>
            </h2>

            <div className="flex items-center gap-2">
              {currentResult.success && onOpenClaudeConfig && (currentResult.provider === 'anthropic' || currentResult.provider === 'openrouter') && (
                <button
                  type="button"
                  onClick={() => onOpenClaudeConfig(apiKey, currentResult.provider)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cấu hình Claude CLI / Desktop</span>
                </button>
              )}

              {currentResult.success && onOpenChat && currentResult.provider !== 'custom' && (
                <button
                  type="button"
                  onClick={() => onOpenChat(currentResult.provider, apiKey)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                  <span>Trò chuyện thử trong Chatbot</span>
                </button>
              )}
            </div>
          </div>

          <DiagnosticCard
            statusCode={currentResult.statusCode}
            statusText={currentResult.statusText}
            latencyMs={currentResult.latencyMs}
            diagnostic={currentResult.diagnostic}
            success={currentResult.success}
          />

          <ResponseInspector
            models={currentResult.models}
            modelDetails={currentResult.modelDetails}
            provider={currentResult.provider}
            apiKey={apiKey}
            onOpenChat={onOpenChat}
            promptResult={currentResult.promptResult}
            headers={currentResult.headers}
            rawResponse={currentResult.rawResponse}
          />
        </div>
      )}
    </div>
  );
};
