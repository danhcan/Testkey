import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { TestResult } from '../types';
import { PROVIDERS } from '../data/providers';
import { BarChart3, LineChart as LineChartIcon, Activity, Zap, TrendingDown, Gauge } from 'lucide-react';

interface LatencyChartProps {
  history: TestResult[];
  onSelectResult?: (result: TestResult) => void;
  selectedId?: string;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({
  history,
  onSelectResult,
  selectedId,
}) => {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // Filter only successful tests with valid latency
  const successfulTests = history
    .filter(item => item.success && item.latencyMs > 0)
    .reverse(); // Chronological order (oldest to newest)

  if (successfulTests.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-xs">
        <Activity className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
          Chưa có dữ liệu độ trễ thành công
        </h4>
        <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
          Thực hiện một hoặc nhiều lần kiểm tra API Key thành công để biểu đồ Recharts tự động so sánh độ trễ (latency) của từng nhà cung cấp.
        </p>
      </div>
    );
  }

  // Calculate statistics
  const latencies = successfulTests.map(t => t.latencyMs);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  const fastestItem = successfulTests.find(t => t.latencyMs === minLatency);

  const getProviderColor = (providerId: string) => {
    const p = PROVIDERS.find(prov => prov.id === providerId);
    return p?.color || '#2563eb';
  };

  const chartData = successfulTests.map((t, index) => {
    const prov = PROVIDERS.find(p => p.id === t.provider);
    return {
      index: index + 1,
      id: t.id,
      name: `#${index + 1} ${prov?.name || t.provider.toUpperCase()}`,
      shortName: `${prov?.name?.split(' ')[0] || t.provider} (${t.latencyMs}ms)`,
      timestamp: t.timestamp,
      latency: t.latencyMs,
      provider: t.provider,
      providerName: prov?.name || t.provider,
      color: getProviderColor(t.provider),
      testType: t.testType === 'prompt' ? 'Prompt Test' : t.testType === 'models' ? 'Models List' : 'Ping Auth',
      rawItem: t,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-neutral-900 text-white p-3 rounded-xl shadow-lg border border-neutral-800 text-xs min-w-[200px]">
          <div className="flex items-center gap-2 pb-1.5 border-b border-neutral-800">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-bold text-neutral-100">{data.providerName}</span>
            <span className="text-[10px] text-neutral-400 font-mono ml-auto">
              {data.timestamp}
            </span>
          </div>

          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Độ trễ (Latency):</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {data.latency} ms
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Chế độ test:</span>
              <span className="text-neutral-300">{data.testType}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Đánh giá:</span>
              <span
                className={`font-semibold ${
                  data.latency <= 300
                    ? 'text-emerald-400'
                    : data.latency <= 800
                    ? 'text-blue-400'
                    : 'text-amber-400'
                }`}
              >
                {data.latency <= 300 ? 'Siêu tốc (Fast)' : data.latency <= 800 ? 'Tốt (Good)' : 'Trung bình (Moderate)'}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-1.5 border-t border-neutral-800 text-[10px] text-neutral-400 text-center">
            Nhấp chuột vào cột để xem chi tiết
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-neutral-900 tracking-tight">
              Biểu đồ So sánh Độ trễ (Latency Comparison)
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Recharts
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Dữ liệu thống kê thời gian phản hồi của {successfulTests.length} lần kiểm tra thành công
          </p>
        </div>

        {/* Toggle Bar vs Line */}
        <div className="flex items-center bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs">
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              chartType === 'bar'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Cột (Bar)</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
              chartType === 'line'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>Đường (Trend)</span>
          </button>
        </div>
      </div>

      {/* Latency Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80">
          <div className="text-[11px] font-semibold text-neutral-500 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-neutral-400" />
            Độ trễ trung bình
          </div>
          <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
            {avgLatency} <span className="text-xs font-normal text-neutral-500">ms</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
          <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-600" />
            Nhanh nhất (Min)
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {minLatency} <span className="text-xs font-normal text-emerald-600">ms</span>
          </div>
          {fastestItem && (
            <div className="text-[10px] text-emerald-700 font-semibold truncate mt-0.5">
              {fastestItem.provider.toUpperCase()} ({fastestItem.timestamp})
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
          <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-amber-600" />
            Chậm nhất (Max)
          </div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">
            {maxLatency} <span className="text-xs font-normal text-amber-600">ms</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
          <div className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
            <Activity className="w-3 h-3 text-blue-600" />
            Lần kiểm tra đạt
          </div>
          <div className="text-xl font-bold font-mono text-blue-700 mt-1">
            {successfulTests.length}{' '}
            <span className="text-xs font-normal text-blue-600">kết quả</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart
              data={chartData}
              margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload[0]) {
                  const clickedItem = state.activePayload[0].payload?.rawItem;
                  if (onSelectResult && clickedItem) onSelectResult(clickedItem);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="index"
                tickLine={false}
                stroke="#6b7280"
                fontSize={11}
                tickFormatter={val => `#${val}`}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                unit="ms"
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }} />
              <ReferenceLine
                y={avgLatency}
                stroke="#9ca3af"
                strokeDasharray="4 4"
                label={{
                  value: `TB: ${avgLatency}ms`,
                  position: 'insideTopRight',
                  fill: '#6b7280',
                  fontSize: 10,
                }}
              />
              <Bar dataKey="latency" radius={[6, 6, 0, 0]} maxBarSize={48} cursor="pointer">
                {chartData.map(entry => (
                  <Cell
                    key={entry.id}
                    fill={entry.color}
                    opacity={selectedId && selectedId === entry.id ? 1 : 0.85}
                    stroke={selectedId && selectedId === entry.id ? '#000' : 'none'}
                    strokeWidth={2}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart
              data={chartData}
              margin={{ top: 15, right: 15, left: -10, bottom: 20 }}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload[0]) {
                  const clickedItem = state.activePayload[0].payload?.rawItem;
                  if (onSelectResult && clickedItem) onSelectResult(clickedItem);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="index"
                tickLine={false}
                stroke="#6b7280"
                fontSize={11}
                tickFormatter={val => `#${val}`}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                unit="ms"
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={avgLatency}
                stroke="#9ca3af"
                strokeDasharray="4 4"
                label={{
                  value: `TB: ${avgLatency}ms`,
                  position: 'insideTopRight',
                  fill: '#6b7280',
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#2563eb', strokeWidth: 1, stroke: '#fff' }}
                activeDot={{ r: 7, fill: '#1d4ed8' }}
                cursor="pointer"
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Provider Legend */}
      <div className="flex items-center justify-center flex-wrap gap-3 pt-2 text-xs border-t border-neutral-100">
        {PROVIDERS.filter(p => p.id !== 'custom').map(p => (
          <div key={p.id} className="flex items-center gap-1.5 text-neutral-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
