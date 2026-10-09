import React from 'react';
import { KeyRound, ShieldCheck, Sparkles, RefreshCw, CheckCircle2, AlertCircle, Bot, Terminal } from 'lucide-react';

interface HeaderProps {
  activeTab: 'single' | 'batch' | 'custom' | 'chat' | 'history' | 'claude-config';
  onTabChange: (tab: 'single' | 'batch' | 'custom' | 'chat' | 'history' | 'claude-config') => void;
  systemGeminiConfigured: boolean;
  historyCount: number;
  onQuickTestSystemKey?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  systemGeminiConfigured,
  historyCount,
  onQuickTestSystemKey,
}) => {
  return (
    <header className="border-b border-neutral-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3">
          {/* Brand & title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-neutral-900 tracking-tight">
                  API Key Tester
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  v2.0 Realtime
                </span>
              </div>
              <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Kiểm tra trực tiếp, an toàn tuyệt đối — không lưu trữ key
              </p>
            </div>
          </div>

          {/* System Key badge & Quick Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            {systemGeminiConfigured ? (
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-medium">System GEMINI_API_KEY sẵn sàng</span>
                {onQuickTestSystemKey && (
                  <button
                    type="button"
                    onClick={onQuickTestSystemKey}
                    className="ml-1 px-2 py-0.5 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                  >
                    Test nhanh
                  </button>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 border border-neutral-200 text-xs text-neutral-600">
                <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
                <span>Nhập API Key để kiểm tra</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 border-t border-neutral-100 pt-2 pb-1 overflow-x-auto scrollbar-none">
          <button
            type="button"
            id="tab-single-test"
            onClick={() => onTabChange('single')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'single'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Kiểm tra Đơn
          </button>

          <button
            type="button"
            id="tab-chatbot-test"
            onClick={() => onTabChange('chat')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'chat'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Bot className="w-4 h-4 text-blue-500" />
            Chatbot Test Key
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
              Live
            </span>
          </button>

          <button
            type="button"
            id="tab-batch-test"
            onClick={() => onTabChange('batch')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'batch'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Kiểm tra Hàng loạt (Batch)
          </button>

          <button
            type="button"
            id="tab-custom-api"
            onClick={() => onTabChange('custom')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'custom'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <span>🛠️</span>
            Custom REST API
          </button>

          <button
            type="button"
            id="tab-claude-config"
            onClick={() => onTabChange('claude-config')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'claude-config'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Terminal className="w-4 h-4 text-amber-500" />
            <span>Cấu hình Claude</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
              CLI & Desktop
            </span>
          </button>

          <button
            type="button"
            id="tab-history"
            onClick={() => onTabChange('history')}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <span>📜</span>
            Lịch sử
            {historyCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-xs ${
                activeTab === 'history' ? 'bg-neutral-800 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}>
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
