import React, { useState } from 'react';
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Download,
  Trash2,
  Check,
  Search,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import { ApiProviderId, BatchItemResult, BatchSummary } from '../types';
import { PROVIDERS } from '../data/providers';

export const BatchTester: React.FC = () => {
  const [provider, setProvider] = useState<ApiProviderId>('gemini');
  const [rawKeysInput, setRawKeysInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchItemResult[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid' | 'quota'>('all');
  const [search, setSearch] = useState('');
  const [copiedValid, setCopiedValid] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const activeProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

  // Parse lines
  const parsedKeys = rawKeysInput
    .split(/[\n,]+/)
    .map(k => k.trim())
    .filter(k => k.length > 0);

  const handleStartBatch = async () => {
    if (parsedKeys.length === 0) return;

    setLoading(true);
    setProgress(20);
    setResults([]);
    setSummary(null);

    try {
      const res = await fetch('/api/test-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          keys: parsedKeys,
          testType: 'ping',
        }),
      });

      setProgress(80);
      const data = await res.json();

      if (data.results && data.summary) {
        setResults(data.results);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProgress(100);
      setLoading(false);
    }
  };

  const handleCopyValidKeys = () => {
    const validKeys = results.filter(r => r.success).map(r => r.key);
    if (validKeys.length === 0) return;

    navigator.clipboard.writeText(validKeys.join('\n'));
    setCopiedValid(true);
    setTimeout(() => setCopiedValid(false), 2000);
  };

  const handleCopySingleKey = (key: string, idx: number) => {
    navigator.clipboard.writeText(key);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleDownloadCSV = () => {
    if (results.length === 0) return;

    const headers = ['Index', 'Key', 'Status', 'StatusCode', 'LatencyMs', 'Message'];
    const rows = results.map(r => [
      r.index,
      `"${r.key}"`,
      r.success ? 'VALID' : 'INVALID',
      r.statusCode,
      r.latencyMs,
      `"${r.message.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `api_keys_${provider}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResults = results.filter(r => {
    if (filter === 'valid' && !r.success) return false;
    if (filter === 'invalid' && (r.success || r.statusCode === 429)) return false;
    if (filter === 'quota' && r.statusCode !== 429) return false;
    if (search && !r.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Provider Selector */}
      <div>
        <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
          1. Chọn Dịch vụ API cần kiểm tra hàng loạt
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {PROVIDERS.filter(p => p.id !== 'custom').map(p => {
            const isSelected = provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                id={`batch-provider-${p.id}`}
                onClick={() => setProvider(p.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-500'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Textarea Container */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <label htmlFor="batch-keys-input" className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
            2. Dán danh sách API Keys (Mỗi dòng một key, tối đa 50 keys)
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-medium text-neutral-500">
              Đã nhận: <strong className="text-neutral-900">{parsedKeys.length}</strong> keys
            </span>
            {rawKeysInput && (
              <button
                type="button"
                onClick={() => setRawKeysInput('')}
                className="text-xs text-neutral-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa
              </button>
            )}
          </div>
        </div>

        <textarea
          id="batch-keys-input"
          rows={5}
          value={rawKeysInput}
          onChange={e => setRawKeysInput(e.target.value)}
          placeholder={`Dán danh sách API key tại đây, ví dụ:\n${activeProvider.keyPrefix || 'key'}123456...\n${activeProvider.keyPrefix || 'key'}abcdef...`}
          className="w-full p-3 rounded-xl border border-neutral-300 font-mono text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Kiểm tra song song đa luồng an toàn, phát hiện key lỗi, rate-limit và hết tiền.
          </div>

          <button
            type="button"
            id="btn-run-batch"
            onClick={handleStartBatch}
            disabled={loading || parsedKeys.length === 0}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang quét ({parsedKeys.length} keys)...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Kiểm tra {parsedKeys.length > 0 ? `(${parsedKeys.length} Keys)` : ''}</span>
              </>
            )}
          </button>
        </div>

        {loading && (
          <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 transition-all duration-300 rounded-full animate-pulse"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-white border border-neutral-200 text-neutral-800">
            <div className="text-xs font-semibold text-neutral-500">Tổng số kiểm tra</div>
            <div className="text-2xl font-bold font-mono mt-1">{summary.total}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
            <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Hợp lệ (Active)
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{summary.valid}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
            <div className="text-xs font-semibold text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Hết Quota (429)
            </div>
            <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{summary.rateLimited}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950">
            <div className="text-xs font-semibold text-rose-700 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Không hợp lệ (401)
            </div>
            <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{summary.invalid}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-800">
            <div className="text-xs font-semibold text-neutral-600">Lỗi khác / Timeout</div>
            <div className="text-2xl font-bold font-mono text-neutral-700 mt-1">{summary.error}</div>
          </div>
        </div>
      )}

      {/* Results Table Section */}
      {results.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            {/* Filter buttons */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  filter === 'all'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Tất cả ({results.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('valid')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  filter === 'valid'
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Hợp lệ ({summary?.valid || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilter('quota')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  filter === 'quota'
                    ? 'bg-amber-700 text-white'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Hết Quota ({summary?.rateLimited || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilter('invalid')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  filter === 'invalid'
                    ? 'bg-rose-700 text-white'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Sai key ({summary?.invalid || 0})
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyValidKeys}
                disabled={summary?.valid === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                {copiedValid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedValid ? 'Đã chép keys hợp lệ' : `Sao chép ${summary?.valid || 0} keys hợp lệ`}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-800 hover:bg-neutral-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Khóa API (Masked)</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Mã HTTP</th>
                  <th className="px-3 py-2">Độ trễ</th>
                  <th className="px-3 py-2">Chẩn đoán</th>
                  <th className="px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono">
                {filteredResults.map(r => (
                  <tr key={r.index} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="px-3 py-2 text-neutral-400 font-sans">{r.index}</td>
                    <td className="px-3 py-2 font-medium text-neutral-900">{r.maskedKey}</td>
                    <td className="px-3 py-2 font-sans">
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Hợp lệ
                        </span>
                      ) : r.statusCode === 429 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Hết Quota
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          {r.statusCode === 401 ? 'Key sai' : 'Lỗi'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-bold">
                      <span className={r.success ? 'text-emerald-700' : 'text-rose-700'}>
                        {r.statusCode > 0 ? r.statusCode : 'ERR'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{r.latencyMs}ms</td>
                    <td className="px-3 py-2 font-sans text-neutral-600 truncate max-w-xs" title={r.message}>
                      {r.message}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopySingleKey(r.key, r.index)}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                        title="Sao chép key này"
                      >
                        {copiedIndex === r.index ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
