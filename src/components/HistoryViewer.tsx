import React, { useState } from 'react';
import { Trash2, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronRight, Eye, Filter } from 'lucide-react';
import { TestResult } from '../types';
import { DiagnosticCard } from './DiagnosticCard';
import { ResponseInspector } from './ResponseInspector';
import { LatencyChart } from './LatencyChart';

interface HistoryViewerProps {
  history: TestResult[];
  onClearHistory: () => void;
}

export const HistoryViewer: React.FC<HistoryViewerProps> = ({ history, onClearHistory }) => {
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(history[0] || null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  if (history.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center shadow-xs">
        <Clock className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-neutral-800">Chưa có lịch sử kiểm tra</h3>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
          Mỗi lần bạn thực hiện kiểm tra API Key, kết quả sẽ được lưu tạm thời tại đây để vẽ biểu đồ đo độ trễ và đối soát chi tiết.
        </p>
      </div>
    );
  }

  const filteredHistory = history.filter(item => {
    if (statusFilter === 'success') return item.success;
    if (statusFilter === 'failed') return !item.success;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Latency Comparison Chart using Recharts */}
      <LatencyChart
        history={history}
        selectedId={selectedResult?.id}
        onSelectResult={res => setSelectedResult(res)}
      />

      {/* History List and Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* History List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Danh sách kiểm tra ({history.length})
            </h3>
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-neutral-400 hover:text-rose-600 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa lịch sử
            </button>
          </div>

          {/* Filter pills */}
          <div className="flex items-center space-x-1.5 pb-1">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Tất cả ({history.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('success')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                statusFilter === 'success'
                  ? 'bg-emerald-700 text-white'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Thành công ({history.filter(h => h.success).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                statusFilter === 'failed'
                  ? 'bg-rose-700 text-white'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Lỗi ({history.filter(h => !h.success).length})
            </button>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {filteredHistory.map(item => {
              const isSelected = selectedResult?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedResult(item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : item.statusCode === 429 ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900 uppercase">
                          {item.provider}
                        </span>
                        <span className="text-[11px] font-mono text-neutral-500 truncate">
                          {item.maskedKey}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 flex items-center gap-2 mt-0.5">
                        <span>{item.timestamp}</span>
                        <span>•</span>
                        <span className={item.success ? 'text-emerald-700 font-mono font-medium' : ''}>
                          {item.latencyMs}ms
                        </span>
                        <span>•</span>
                        <span className="capitalize">{item.testType}</span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0 ml-2" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Detail */}
        <div className="lg:col-span-7 space-y-4">
          {selectedResult ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-neutral-500" />
                  Chi tiết kết quả [{selectedResult.provider.toUpperCase()}]
                </h3>
                <span className="text-xs text-neutral-400 font-mono">
                  {selectedResult.timestamp}
                </span>
              </div>

              <DiagnosticCard
                statusCode={selectedResult.statusCode}
                statusText={selectedResult.statusText}
                latencyMs={selectedResult.latencyMs}
                diagnostic={selectedResult.diagnostic}
                success={selectedResult.success}
              />

              <ResponseInspector
                models={selectedResult.models}
                modelDetails={selectedResult.modelDetails}
                provider={selectedResult.provider}
                promptResult={selectedResult.promptResult}
                headers={selectedResult.headers}
                rawResponse={selectedResult.rawResponse}
              />
            </>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-xs text-neutral-500">
              Chọn một mục từ danh sách bên trái hoặc nhấp vào cột biểu đồ để xem chi tiết.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
