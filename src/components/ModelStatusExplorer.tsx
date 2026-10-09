import React, { useState, useMemo, useRef } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Bot,
  Zap,
  Search,
  Copy,
  Check,
  Filter,
  Layers,
  Download,
  RefreshCw,
  Play,
  Eye,
  EyeOff,
  ArrowUpDown,
  ShieldAlert,
  Square,
  ChevronDown,
  X,
  RotateCcw,
} from 'lucide-react';
import { ModelItem, ApiProviderId } from '../types';

interface ModelStatusExplorerProps {
  models: string[];
  modelDetails?: ModelItem[];
  provider: ApiProviderId;
  apiKey?: string;
  onOpenChat?: (provider: ApiProviderId, apiKey: string, modelId: string) => void;
}

interface ProbeProgressState {
  active: boolean;
  current: number;
  total: number;
  currentModelName?: string;
  healthyCount: number;
  rateLimitedCount: number;
  errorCount: number;
  completed: boolean;
  cancelled: boolean;
}

export const ModelStatusExplorer: React.FC<ModelStatusExplorerProps> = ({
  models,
  modelDetails,
  provider,
  apiKey,
  onOpenChat,
}) => {
  // Merge simple model string list with rich details
  const initialItems: ModelItem[] = useMemo(() => {
    if (modelDetails && modelDetails.length > 0) {
      return modelDetails;
    }
    return models.map(id => {
      const lower = id.toLowerCase();
      let category: ModelItem['category'] = 'chat';
      if (lower.includes('embed')) category = 'embedding';
      else if (lower.includes('thinking') || lower.includes('reason') || lower.startsWith('o1') || lower.startsWith('o3')) category = 'reasoning';
      else if (lower.includes('vision') || lower.includes('flash') || lower.includes('4o')) category = 'multimodal';
      else if (lower.includes('whisper') || lower.includes('tts') || lower.includes('audio')) category = 'audio';

      let status: ModelItem['status'] = 'active';
      if (lower.includes('preview') || lower.includes('exp')) status = 'preview';
      else if (lower.includes('001') || lower.includes('1.0') || lower.includes('legacy') || lower.includes('davinci')) status = 'legacy';

      return {
        id,
        name: id,
        category,
        status,
        probeStatus: 'idle',
      };
    });
  }, [models, modelDetails]);

  const [items, setItems] = useState<ModelItem[]>(initialItems);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'context' | 'probe'>('name');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [hideErrorModels, setHideErrorModels] = useState(false);

  // Cancellation and Progress management for Test All
  const cancelProbeRef = useRef(false);
  const [probeProgress, setProbeProgress] = useState<ProbeProgressState>({
    active: false,
    current: 0,
    total: 0,
    healthyCount: 0,
    rateLimitedCount: 0,
    errorCount: 0,
    completed: false,
    cancelled: false,
  });

  // Sync if props change
  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Live probe a single model
  const probeModel = async (modelId: string) => {
    setItems(prev =>
      prev.map(m =>
        m.id === modelId
          ? { ...m, probeStatus: 'checking', probeMessage: 'Đang kiểm tra...' }
          : m
      )
    );

    try {
      const res = await fetch('/api/probe-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || (provider === 'gemini' ? '__USE_ENV_GEMINI__' : ''),
          modelId,
        }),
      });
      const data = await res.json();
      const probeStatus: ModelItem['probeStatus'] =
        data.probeStatus || (data.success ? 'healthy' : 'unhealthy');

      setItems(prev =>
        prev.map(m => {
          if (m.id === modelId) {
            return {
              ...m,
              probeStatus,
              probeLatencyMs: data.latencyMs,
              probeMessage: data.message,
            };
          }
          return m;
        })
      );

      return {
        success: !!data.success,
        probeStatus,
        latencyMs: data.latencyMs,
      };
    } catch (err: any) {
      setItems(prev =>
        prev.map(m =>
          m.id === modelId
            ? {
                ...m,
                probeStatus: 'unhealthy',
                probeMessage: 'Lỗi kết nối máy chủ probe',
              }
            : m
        )
      );
      return {
        success: false,
        probeStatus: 'unhealthy' as const,
      };
    }
  };

  // Batch Test All / Selected Models
  const startBatchProbe = async (targetType: 'filtered' | 'all' | 'untested' | 'top5' = 'filtered') => {
    if (probeProgress.active) return;
    setShowOptionsDropdown(false);
    cancelProbeRef.current = false;

    let targetModels: ModelItem[] = [];
    if (targetType === 'top5') {
      targetModels = filteredItems.slice(0, 5);
    } else if (targetType === 'untested') {
      targetModels = items.filter(m => !m.probeStatus || m.probeStatus === 'idle');
    } else if (targetType === 'all') {
      targetModels = [...items];
    } else {
      // 'filtered'
      targetModels = [...filteredItems];
    }

    if (targetModels.length === 0) return;

    setProbeProgress({
      active: true,
      current: 0,
      total: targetModels.length,
      currentModelName: targetModels[0].id,
      healthyCount: 0,
      rateLimitedCount: 0,
      errorCount: 0,
      completed: false,
      cancelled: false,
    });

    let healthy = 0;
    let rateLimited = 0;
    let errors = 0;

    // Test 2 models concurrently for fast response while preventing burst 429
    const CONCURRENCY = 2;
    for (let i = 0; i < targetModels.length; i += CONCURRENCY) {
      if (cancelProbeRef.current) break;

      const chunk = targetModels.slice(i, i + CONCURRENCY);
      setProbeProgress(prev => ({
        ...prev,
        currentModelName: chunk.map(c => c.id).join(', '),
      }));

      const results = await Promise.all(chunk.map(m => probeModel(m.id)));

      for (const r of results) {
        if (r.probeStatus === 'healthy') healthy++;
        else if (r.probeStatus === 'rate_limited') rateLimited++;
        else errors++;
      }

      const processed = Math.min(i + chunk.length, targetModels.length);
      setProbeProgress(prev => ({
        ...prev,
        current: processed,
        healthyCount: healthy,
        rateLimitedCount: rateLimited,
        errorCount: errors,
      }));

      // Small pause between batches
      if (i + CONCURRENCY < targetModels.length && !cancelProbeRef.current) {
        await new Promise(r => setTimeout(r, 70));
      }
    }

    const wasCancelled = cancelProbeRef.current;
    setProbeProgress(prev => ({
      ...prev,
      active: false,
      completed: !wasCancelled,
      cancelled: wasCancelled,
    }));
  };

  const stopBatchProbe = () => {
    cancelProbeRef.current = true;
    setProbeProgress(prev => ({
      ...prev,
      active: false,
      cancelled: true,
    }));
  };

  // Export models to JSON
  const handleExport = () => {
    const dataStr = JSON.stringify(items, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${provider}-models-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        const matchesSearch =
          item.id.toLowerCase().includes(search.toLowerCase()) ||
          (item.name && item.name.toLowerCase().includes(search.toLowerCase())) ||
          (item.description && item.description.toLowerCase().includes(search.toLowerCase()));

        const matchesCategory =
          selectedCategory === 'all' || item.category === selectedCategory;

        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'healthy' && item.probeStatus === 'healthy') ||
          (selectedStatus === 'rate_limited' && item.probeStatus === 'rate_limited') ||
          (selectedStatus === 'unhealthy' && item.probeStatus === 'unhealthy') ||
          (selectedStatus === 'untested' && (!item.probeStatus || item.probeStatus === 'idle')) ||
          item.status === selectedStatus;

        // Filter out error models if hideErrorModels is enabled
        const matchesHideErrors =
          !hideErrorModels ||
          selectedStatus === 'unhealthy' ||
          item.probeStatus !== 'unhealthy';

        return matchesSearch && matchesCategory && matchesStatus && matchesHideErrors;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.id.localeCompare(b.id);
        if (sortBy === 'context') {
          const aCtx = a.inputTokenLimit || a.contextWindow || 0;
          const bCtx = b.inputTokenLimit || b.contextWindow || 0;
          return bCtx - aCtx;
        }
        if (sortBy === 'probe') {
          const aLat = a.probeLatencyMs ?? 999999;
          const bLat = b.probeLatencyMs ?? 999999;
          return aLat - bLat;
        }
        return 0;
      });
  }, [items, search, selectedCategory, selectedStatus, sortBy, hideErrorModels]);

  // Statistics
  const stats = useMemo(() => {
    const total = items.length;
    const chat = items.filter(i => i.category === 'chat' || !i.category).length;
    const multimodal = items.filter(i => i.category === 'multimodal').length;
    const reasoning = items.filter(i => i.category === 'reasoning').length;
    const embeddings = items.filter(i => i.category === 'embedding').length;
    const healthy = items.filter(i => i.probeStatus === 'healthy').length;
    const rateLimited = items.filter(i => i.probeStatus === 'rate_limited').length;
    const unhealthy = items.filter(i => i.probeStatus === 'unhealthy').length;
    const untested = items.filter(i => !i.probeStatus || i.probeStatus === 'idle').length;

    return { total, chat, multimodal, reasoning, embeddings, healthy, rateLimited, unhealthy, untested };
  }, [items]);

  const formatContext = (tokens?: number) => {
    if (!tokens) return null;
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M`;
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
    return `${tokens}`;
  };

  const progressPercent = Math.round(
    (probeProgress.current / Math.max(probeProgress.total, 1)) * 100
  );

  return (
    <div className="space-y-4">
      {/* Top Overview & Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-neutral-50/80 border border-neutral-200/90 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Tổng Models</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900 mt-1 font-mono">{stats.total}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Khám phá từ API Key</div>
        </div>

        <div className="bg-neutral-50/80 border border-neutral-200/90 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Multimodal & Vision</span>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-700 mt-1 font-mono">{stats.multimodal}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Hỗ trợ hình ảnh / video</div>
        </div>

        <div className="bg-neutral-50/80 border border-neutral-200/90 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Reasoning / Thinking</span>
            <Cpu className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1 font-mono">{stats.reasoning}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">Suy luận logic & Code sâu</div>
        </div>

        <div className="bg-neutral-50/80 border border-neutral-200/90 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Đã Test Hoạt Động</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">
            {stats.healthy} <span className="text-xs font-normal text-neutral-400">/ {stats.total}</span>
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5">
            {stats.unhealthy > 0 ? `${stats.unhealthy} lỗi / ngưng hỗ trợ` : 'Kiểm tra độ trễ thực tế'}
          </div>
        </div>
      </div>

      {/* Action and Filter Toolbar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Tìm kiếm tên model, ID, mô tả (trong ${items.length} models)...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50/60 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-xs text-neutral-400 hover:text-neutral-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {probeProgress.active ? (
              <button
                type="button"
                onClick={stopBatchProbe}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all animate-pulse"
                title="Dừng quá trình kiểm tra ngay lập tức"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Dừng test ({probeProgress.current}/{probeProgress.total})</span>
              </button>
            ) : (
              <>
                {/* Primary Button: Test Tất Cả */}
                <button
                  type="button"
                  onClick={() => startBatchProbe('filtered')}
                  disabled={filteredItems.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm"
                  title={`Gửi request test phản hồi thực tế đến toàn bộ ${filteredItems.length} models trong danh sách hiện tại`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Test tất cả ({filteredItems.length})</span>
                </button>

                {/* Dropdown Options for Test */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowOptionsDropdown(prev => !prev)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-colors"
                    title="Tùy chọn kiểm tra khác"
                  >
                    <span>Tùy chọn</span>
                    <ChevronDown className="w-3 h-3 text-neutral-500" />
                  </button>

                  {showOptionsDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-neutral-200 py-1.5 z-30 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => startBatchProbe('top5')}
                        className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5">
                          <Play className="w-3 h-3 text-neutral-500" /> Test nhanh 5 model đầu
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">5</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startBatchProbe('untested')}
                        disabled={stats.untested === 0}
                        className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-neutral-500" /> Chỉ test model chưa thử
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">{stats.untested}</span>
                      </button>

                      {filteredItems.length !== items.length && (
                        <button
                          type="button"
                          onClick={() => startBatchProbe('all')}
                          className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between border-t border-neutral-100"
                        >
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-3 h-3 text-emerald-600" /> Test toàn bộ models (bỏ lọc)
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">{items.length}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Nút Ẩn/Hiện Model Bị Lỗi */}
            <button
              type="button"
              onClick={() => setHideErrorModels(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                hideErrorModels
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 font-semibold shadow-2xs hover:bg-rose-200'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
              }`}
              title={
                hideErrorModels
                  ? `Đang ẩn ${stats.unhealthy} model bị lỗi. Bấm để hiển thị lại.`
                  : `Ẩn các model bị lỗi hoặc không khả dụng (${stats.unhealthy} model lỗi)`
              }
            >
              {hideErrorModels ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Đang ẩn model lỗi ({stats.unhealthy})</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Ẩn model lỗi {stats.unhealthy > 0 ? `(${stats.unhealthy})` : ''}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors"
              title="Tải về danh sách models dạng JSON"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              <span>Xuất JSON</span>
            </button>
          </div>
        </div>

        {/* Category & Status Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold text-neutral-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Danh mục:
            </span>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'chat', label: 'Chat / LLM' },
              { id: 'multimodal', label: 'Multimodal / Vision' },
              { id: 'reasoning', label: 'Reasoning' },
              { id: 'embedding', label: 'Embeddings' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-all ${
                  selectedCategory === tab.id
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-neutral-400">Trạng thái:</span>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-2 py-0.5 text-[11px] bg-neutral-50 border border-neutral-200 rounded-md focus:outline-hidden"
              >
                <option value="all">Tất cả ({items.length})</option>
                <option value="healthy">🟢 Đã Test Hoạt Động ({stats.healthy})</option>
                {stats.rateLimited > 0 && (
                  <option value="rate_limited">🟡 Đã Test Bị Giới Hạn 429 ({stats.rateLimited})</option>
                )}
                {stats.unhealthy > 0 && (
                  <option value="unhealthy">🔴 Đã Test Bị Lỗi ({stats.unhealthy})</option>
                )}
                <option value="untested">⚪ Chưa kiểm tra ({stats.untested})</option>
                <option value="active">Chính thức (Active)</option>
                <option value="preview">Thử nghiệm (Preview)</option>
                <option value="legacy">Cũ / Deprecated</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-neutral-400">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="px-2 py-0.5 text-[11px] bg-neutral-50 border border-neutral-200 rounded-md focus:outline-hidden"
              >
                <option value="name">Tên A-Z</option>
                <option value="context">Context Window lớn nhất</option>
                <option value="probe">Độ trễ phản hồi thấp nhất</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Live Probe Progress Banner */}
      {probeProgress.active && (
        <div className="bg-neutral-900 text-white rounded-xl p-3 border border-neutral-800 shadow-md space-y-2 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span className="font-semibold text-white">
                Đang test tất cả: <span className="font-mono text-emerald-400">{probeProgress.current}</span> / <span className="font-mono">{probeProgress.total}</span> models ({progressPercent}%)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {probeProgress.healthyCount} Sẵn sàng
                </span>
                {probeProgress.rateLimitedCount > 0 && (
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {probeProgress.rateLimitedCount} 429
                  </span>
                )}
                {probeProgress.errorCount > 0 && (
                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> {probeProgress.errorCount} Lỗi
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={stopBatchProbe}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
              >
                <Square className="w-2.5 h-2.5 fill-current" /> Dừng
              </button>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {probeProgress.currentModelName && (
            <div className="text-[10px] text-neutral-400 font-mono truncate">
              Mô hình đang kiểm tra: <span className="text-neutral-200">{probeProgress.currentModelName}</span>
            </div>
          )}
        </div>
      )}

      {/* Completed Banner */}
      {probeProgress.completed && !probeProgress.active && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 px-3.5 flex items-center justify-between text-xs text-emerald-950 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Hoàn tất test tất cả {probeProgress.total} models!</strong> Kết quả: <span className="font-semibold text-emerald-700">{probeProgress.healthyCount} hoạt động tốt</span>
              {probeProgress.rateLimitedCount > 0 && (
                <span className="text-amber-700">, {probeProgress.rateLimitedCount} bị giới hạn tốc độ (429)</span>
              )}
              {probeProgress.errorCount > 0 && (
                <span className="text-rose-700">, {probeProgress.errorCount} không khả dụng / lỗi</span>
              )}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setProbeProgress(prev => ({ ...prev, completed: false }))}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-0.5 rounded hover:bg-emerald-100"
          >
            ✕ Đóng
          </button>
        </div>
      )}

      {/* Cancelled Banner */}
      {probeProgress.cancelled && !probeProgress.active && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 px-3.5 flex items-center justify-between text-xs text-amber-950 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Đã dừng quá trình test theo yêu cầu. Đã kiểm tra <span className="font-mono font-bold">{probeProgress.current}</span> / <span className="font-mono">{probeProgress.total}</span> models ({probeProgress.healthyCount} hoạt động, {probeProgress.errorCount} lỗi).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setProbeProgress(prev => ({ ...prev, cancelled: false }))}
            className="text-amber-700 hover:text-amber-900 text-xs font-semibold px-2 py-0.5 rounded hover:bg-amber-100"
          >
            ✕ Đóng
          </button>
        </div>
      )}

      {/* Hidden Error Models Notice Banner */}
      {hideErrorModels && stats.unhealthy > 0 && (
        <div className="bg-rose-50/90 border border-rose-200/90 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-rose-900 animate-fadeIn">
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              Đang ẩn <strong>{stats.unhealthy}</strong> model bị lỗi khỏi danh sách hiển thị.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHideErrorModels(false)}
            className="text-rose-700 hover:text-rose-950 font-semibold underline text-xs cursor-pointer ml-3 shrink-0"
          >
            Hiện lại tất cả ({stats.total} models)
          </button>
        </div>
      )}

      {/* Models List Grid */}
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 bg-white border border-neutral-200 rounded-xl space-y-2">
            <AlertCircle className="w-8 h-8 text-neutral-300 mx-auto" />
            <p className="text-xs font-semibold text-neutral-700">
              Không tìm thấy model nào phù hợp với bộ lọc hiện tại
            </p>
            {hideErrorModels && stats.unhealthy > 0 && (
              <p className="text-[11px] text-rose-600 font-medium">
                (Có {stats.unhealthy} model bị lỗi đang được ẩn)
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setHideErrorModels(false);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Đặt lại tất cả bộ lọc & hiện lại model lỗi
            </button>
          </div>
        ) : (
          filteredItems.map(item => {
            const hasTested = item.probeStatus && item.probeStatus !== 'idle';
            const contextLimit = item.inputTokenLimit || item.contextWindow;
            const outputLimit = item.outputTokenLimit;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all bg-white hover:border-neutral-300 shadow-2xs ${
                  item.probeStatus === 'healthy'
                    ? 'border-emerald-200/90 bg-emerald-50/10'
                    : item.probeStatus === 'unhealthy'
                    ? 'border-rose-200/90 bg-rose-50/10'
                    : item.probeStatus === 'rate_limited'
                    ? 'border-amber-200/90 bg-amber-50/10'
                    : 'border-neutral-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Model Identification & Badges */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-900 break-all select-all">
                        {item.id}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.id)}
                        className="text-neutral-400 hover:text-neutral-700 p-0.5 rounded transition-colors"
                        title="Sao chép ID model"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Category Badge */}
                      {item.category === 'reasoning' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Cpu className="w-2.5 h-2.5" /> Reasoning
                        </span>
                      )}

                      {item.category === 'multimodal' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Multimodal
                        </span>
                      )}

                      {item.category === 'embedding' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                          Embedding
                        </span>
                      )}

                      {/* Lifecycle Status Badge */}
                      {item.status === 'preview' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Preview
                        </span>
                      )}

                      {item.status === 'legacy' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                          Legacy
                        </span>
                      )}

                      {item.status === 'active' && !item.probeStatus && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sẵn sàng
                        </span>
                      )}
                    </div>

                    {/* Display name or description */}
                    {item.name && item.name !== item.id && (
                      <div className="text-xs font-semibold text-neutral-700">
                        {item.name}
                      </div>
                    )}

                    {item.description && (
                      <p className="text-[11px] text-neutral-500 line-clamp-1 leading-snug">
                        {item.description}
                      </p>
                    )}

                    {/* Specifications (Context, Output, Owner) */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 pt-0.5 font-mono">
                      {contextLimit && (
                        <span>
                          Context: <strong className="text-neutral-700">{formatContext(contextLimit)} tokens</strong>
                        </span>
                      )}
                      {outputLimit && (
                        <span>
                          Max Output: <strong className="text-neutral-700">{formatContext(outputLimit)}</strong>
                        </span>
                      )}
                      {item.ownedBy && (
                        <span>
                          Đơn vị: <span className="text-neutral-600">{item.ownedBy}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Health Status Indicator */}
                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    {/* Live probe button / result */}
                    {item.probeStatus === 'checking' ? (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 text-[11px] font-medium border border-neutral-200">
                        <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                        <span>Đang ping...</span>
                      </div>
                    ) : item.probeStatus === 'healthy' ? (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200"
                        title={item.probeMessage}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hoạt động ({item.probeLatencyMs}ms)</span>
                      </div>
                    ) : item.probeStatus === 'rate_limited' ? (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200"
                        title={item.probeMessage}
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Rate Limit 429</span>
                      </div>
                    ) : item.probeStatus === 'unhealthy' ? (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 text-[11px] font-bold border border-rose-200"
                        title={item.probeMessage}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Lỗi model</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => probeModel(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-700 text-[11px] font-semibold border border-neutral-200 transition-all hover:border-neutral-300"
                        title="Kiểm tra độ trễ và khả năng phản hồi trực tiếp của model"
                      >
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>Test tình trạng</span>
                      </button>
                    )}

                    {/* Chatbot Launch Button (if chat supported) */}
                    {item.category !== 'embedding' && onOpenChat && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(provider, apiKey || '', item.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-semibold border border-blue-200 transition-colors"
                        title={`Mở chatbot trò chuyện với ${item.id}`}
                      >
                        <Bot className="w-3 h-3 text-blue-600" />
                        <span>Trò chuyện</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded probe message details if present */}
                {item.probeMessage && item.probeStatus !== 'checking' && (
                  <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                    <span
                      className={`font-medium ${
                        item.probeStatus === 'healthy'
                          ? 'text-emerald-700'
                          : item.probeStatus === 'rate_limited'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {item.probeMessage}
                    </span>

                    {item.probeLatencyMs !== undefined && (
                      <span className="text-neutral-400 font-mono">
                        Latency: {item.probeLatencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
