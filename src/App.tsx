import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SingleTester } from './components/SingleTester';
import { BatchTester } from './components/BatchTester';
import { CustomTester } from './components/CustomTester';
import { HistoryViewer } from './components/HistoryViewer';
import { ChatBotTester } from './components/ChatBotTester';
import { ClaudeConfigViewer } from './components/ClaudeConfigViewer';
import { TestResult, ApiProviderId } from './types';
import { ShieldCheck, HelpCircle, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'custom' | 'chat' | 'history' | 'claude-config'>('single');
  const [systemGeminiConfigured, setSystemGeminiConfigured] = useState(false);
  const [chatInitialProvider, setChatInitialProvider] = useState<ApiProviderId>('gemini');
  const [chatInitialKey, setChatInitialKey] = useState<string>('');
  const [claudeInitialKey, setClaudeInitialKey] = useState<string>('');
  const [claudeInitialProvider, setClaudeInitialProvider] = useState<ApiProviderId>('anthropic');
  const [history, setHistory] = useState<TestResult[]>(() => {
    try {
      const saved = localStorage.getItem('api_key_test_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    // Check system status
    fetch('/api/system-status')
      .then(res => res.json())
      .then(data => {
        if (data.geminiConfigured) {
          setSystemGeminiConfigured(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleAddHistory = (item: TestResult) => {
    setHistory(prev => {
      const updated = [item, ...prev].slice(0, 30);
      try {
        localStorage.setItem('api_key_test_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('api_key_test_history');
    } catch {}
  };

  return (
    <div className="min-h-screen bg-neutral-100/70 text-neutral-900 font-sans flex flex-col">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        systemGeminiConfigured={systemGeminiConfigured}
        historyCount={history.length}
        onQuickTestSystemKey={() => {
          setActiveTab('single');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'single' && (
          <SingleTester
            onAddHistory={handleAddHistory}
            systemGeminiConfigured={systemGeminiConfigured}
            onOpenChat={(prov, key) => {
              setChatInitialProvider(prov);
              setChatInitialKey(key);
              setActiveTab('chat');
            }}
            onOpenClaudeConfig={(key, prov) => {
              setClaudeInitialKey(key);
              if (prov) setClaudeInitialProvider(prov);
              setActiveTab('claude-config');
            }}
          />
        )}

        {activeTab === 'chat' && (
          <ChatBotTester
            key={`${chatInitialProvider}-${chatInitialKey}`}
            systemGeminiConfigured={systemGeminiConfigured}
            onAddHistory={handleAddHistory}
            initialProvider={chatInitialProvider}
            initialApiKey={chatInitialKey}
          />
        )}

        {activeTab === 'claude-config' && (
          <ClaudeConfigViewer
            initialApiKey={claudeInitialKey}
            initialProvider={claudeInitialProvider}
          />
        )}

        {activeTab === 'batch' && <BatchTester />}

        {activeTab === 'custom' && <CustomTester onAddHistory={handleAddHistory} />}

        {activeTab === 'history' && (
          <HistoryViewer history={history} onClearHistory={handleClearHistory} />
        )}

        {/* Quick Knowledge & Status Codes Guide */}
        <section className="mt-12 pt-6 border-t border-neutral-200/80">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Bảo mật dữ liệu tuyệt đối</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Mọi khóa API bạn nhập chỉ được xử lý tạm thời trên bộ nhớ RAM để gửi yêu cầu kiểm tra trực tiếp đến máy chủ của nhà cung cấp. Tuyệt đối không lưu vào bất kỳ cơ sở dữ liệu nào.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>Ý nghĩa mã phản hồi HTTP</span>
              </div>
              <ul className="text-xs text-neutral-600 space-y-1">
                <li><strong className="text-emerald-700 font-mono">200 OK:</strong> Khóa hợp lệ, sẵn sàng sử dụng.</li>
                <li><strong className="text-rose-700 font-mono">401:</strong> Sai key hoặc key đã bị hủy.</li>
                <li><strong className="text-amber-700 font-mono">429:</strong> Hết quota hoặc bị giới hạn tốc độ.</li>
                <li><strong className="text-purple-700 font-mono">403:</strong> Thiếu quyền truy cập model/dự án.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Đa dạng dịch vụ AI</span>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Hỗ trợ đầy đủ Google Gemini (2.5/1.5), OpenAI (GPT-4o, o3-mini), Anthropic Claude 3.5, Groq LPU, DeepSeek V3/R1, OpenRouter và bất kỳ Custom REST API nào.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-4 text-center text-xs text-neutral-500">
        API Key Tester — Công cụ kiểm tra, phân tích độ trễ và chẩn đoán trạng thái API Key an toàn và tiện lợi.
      </footer>
    </div>
  );
}
