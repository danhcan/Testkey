import React, { useState } from 'react';
import { Play, Loader2, Plus, Trash2, Globe, Send, Terminal, KeyRound } from 'lucide-react';
import { TestResult } from '../types';
import { DiagnosticCard } from './DiagnosticCard';
import { ResponseInspector } from './ResponseInspector';

interface CustomTesterProps {
  onAddHistory: (result: TestResult) => void;
}

export const CustomTester: React.FC<CustomTesterProps> = ({ onAddHistory }) => {
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/todos/1');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT'>('GET');
  const [authType, setAuthType] = useState<'bearer' | 'apikey' | 'none'>('bearer');
  const [tokenKey, setTokenKey] = useState('');
  const [customHeaderName, setCustomHeaderName] = useState('x-api-key');
  const [headersList, setHeadersList] = useState<{ key: string; value: string }[]>([]);
  const [requestBody, setRequestBody] = useState('{\n  "query": "test"\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleAddHeader = () => {
    setHeadersList([...headersList, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (idx: number) => {
    setHeadersList(headersList.filter((_, i) => i !== idx));
  };

  const handleUpdateHeader = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...headersList];
    updated[idx][field] = val;
    setHeadersList(updated);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url) return;

    setLoading(true);
    setResult(null);

    const mergedHeaders: Record<string, string> = {};
    if (authType === 'bearer' && tokenKey) {
      mergedHeaders['Authorization'] = `Bearer ${tokenKey.trim()}`;
    } else if (authType === 'apikey' && tokenKey) {
      mergedHeaders[customHeaderName || 'x-api-key'] = tokenKey.trim();
    }

    headersList.forEach(h => {
      if (h.key.trim()) {
        mergedHeaders[h.key.trim()] = h.value;
      }
    });

    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'custom',
          apiKey: tokenKey,
          customConfig: {
            url,
            method,
            headers: mergedHeaders,
            body: method !== 'GET' ? requestBody : undefined,
          },
        }),
      });

      const data = await res.json();
      const testResult: TestResult = {
        id: 'test_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        provider: 'custom',
        maskedKey: tokenKey.length > 8 ? tokenKey.slice(0, 4) + '...' + tokenKey.slice(-4) : 'custom',
        testType: 'ping',
        success: data.success,
        statusCode: data.statusCode,
        statusText: data.statusText || '',
        latencyMs: data.latencyMs || 0,
        message: data.message || '',
        headers: data.headers,
        rawResponse: data.rawResponse,
        diagnostic: data.diagnostic || {
          type: data.success ? 'ok' : 'network_error',
          title: data.success ? 'Kết nối thành công' : 'Lỗi yêu cầu',
          suggestion: data.message || '',
        },
      };

      setResult(testResult);
      onAddHistory(testResult);
    } catch (err: any) {
      const failedResult: TestResult = {
        id: 'test_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        provider: 'custom',
        maskedKey: 'custom',
        testType: 'ping',
        success: false,
        statusCode: 0,
        statusText: 'Network Error',
        latencyMs: 0,
        message: err.message || 'Lỗi gửi yêu cầu',
        diagnostic: {
          type: 'network_error',
          title: 'Lỗi mạng',
          suggestion: 'Không thể kết nối đến URL cung cấp. Kiểm tra lại đường dẫn.',
        },
      };
      setResult(failedResult);
      onAddHistory(failedResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider mb-1">
            Kiểm tra Endpoint REST API Tùy Chỉnh
          </h2>
          <p className="text-xs text-neutral-500">
            Dành cho máy chủ riêng, proxy LLM cục bộ (Ollama, LocalAI, vLLM), hoặc bất kỳ dịch vụ Webhook/REST API nào.
          </p>
        </div>

        {/* URL & Method */}
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={method}
            onChange={e => setMethod(e.target.value as any)}
            className="text-xs font-bold py-2 px-3 rounded-xl border border-neutral-300 bg-neutral-50 text-neutral-900 focus:ring-1 focus:ring-blue-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </select>

          <div className="relative flex-1">
            <Globe className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://api.example.com/v1/endpoint"
              className="w-full pl-9 pr-4 py-2 text-xs font-mono rounded-xl border border-neutral-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* Authentication header configuration */}
        <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-neutral-600" />
              Cấu hình Xác thực (Authentication)
            </label>
            <div className="flex items-center space-x-2 text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="auth"
                  checked={authType === 'bearer'}
                  onChange={() => setAuthType('bearer')}
                  className="text-blue-600"
                />
                <span>Bearer Token</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="auth"
                  checked={authType === 'apikey'}
                  onChange={() => setAuthType('apikey')}
                  className="text-blue-600"
                />
                <span>Custom API Key Header</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="auth"
                  checked={authType === 'none'}
                  onChange={() => setAuthType('none')}
                  className="text-blue-600"
                />
                <span>Không dùng Auth</span>
              </label>
            </div>
          </div>

          {authType !== 'none' && (
            <div className="flex flex-col sm:flex-row gap-2">
              {authType === 'apikey' && (
                <input
                  type="text"
                  value={customHeaderName}
                  onChange={e => setCustomHeaderName(e.target.value)}
                  placeholder="Header Name (vd: x-api-key)"
                  className="text-xs py-2 px-3 rounded-lg border border-neutral-300 bg-white font-mono sm:w-48"
                />
              )}
              <input
                type="text"
                value={tokenKey}
                onChange={e => setTokenKey(e.target.value)}
                placeholder="Dán API Key hoặc Bearer Token vào đây..."
                className="flex-1 text-xs py-2 px-3 rounded-lg border border-neutral-300 bg-white font-mono"
              />
            </div>
          )}
        </div>

        {/* Custom headers editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Headers bổ sung ({headersList.length})
            </span>
            <button
              type="button"
              onClick={handleAddHeader}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm Header
            </button>
          </div>

          {headersList.map((h, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={h.key}
                onChange={e => handleUpdateHeader(idx, 'key', e.target.value)}
                placeholder="Header Name (vd: X-Custom-ID)"
                className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-neutral-300 font-mono"
              />
              <input
                type="text"
                value={h.value}
                onChange={e => handleUpdateHeader(idx, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 text-xs py-1.5 px-3 rounded-lg border border-neutral-300 font-mono"
              />
              <button
                type="button"
                onClick={() => handleRemoveHeader(idx)}
                className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-md"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Request Body if POST/PUT */}
        {method !== 'GET' && (
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
              Nội dung Request Body (JSON):
            </label>
            <textarea
              rows={4}
              value={requestBody}
              onChange={e => setRequestBody(e.target.value)}
              className="w-full p-3 rounded-xl border border-neutral-300 font-mono text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !url}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang gửi yêu cầu...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Gửi yêu cầu kiểm tra</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <DiagnosticCard
            statusCode={result.statusCode}
            statusText={result.statusText}
            latencyMs={result.latencyMs}
            diagnostic={result.diagnostic}
            success={result.success}
          />

          <ResponseInspector
            headers={result.headers}
            rawResponse={result.rawResponse}
          />
        </div>
      )}
    </div>
  );
};
