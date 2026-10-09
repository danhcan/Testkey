import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
  ServerCrash,
  WifiOff,
  Lightbulb,
} from 'lucide-react';
import { DiagnosticInfo } from '../types';

interface DiagnosticCardProps {
  statusCode: number;
  statusText: string;
  latencyMs: number;
  diagnostic: DiagnosticInfo;
  success: boolean;
}

export const DiagnosticCard: React.FC<DiagnosticCardProps> = ({
  statusCode,
  statusText,
  latencyMs,
  diagnostic,
  success,
}) => {
  const getIcon = () => {
    if (success) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
    switch (diagnostic.type) {
      case 'auth_error':
        return <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />;
      case 'quota_error':
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'permission_error':
        return <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />;
      case 'server_error':
        return <ServerCrash className="w-5 h-5 text-purple-600 shrink-0" />;
      case 'network_error':
        return <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />;
      default:
        return <XCircle className="w-5 h-5 text-rose-600 shrink-0" />;
    }
  };

  const getLatencyColor = (ms: number) => {
    if (ms <= 300) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (ms <= 800) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (ms <= 2000) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getLatencyLabel = (ms: number) => {
    if (ms <= 300) return 'Rất nhanh';
    if (ms <= 800) return 'Tốt';
    if (ms <= 2000) return 'Trung bình';
    return 'Chậm';
  };

  return (
    <div
      className={`rounded-xl border p-4.5 transition-all ${
        success
          ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
          : 'bg-rose-50/40 border-rose-200 text-neutral-900'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          {getIcon()}
          <div>
            <h3 className="text-sm font-bold tracking-tight">
              {diagnostic.title || (success ? 'Khóa API hợp lệ' : `Lỗi ${statusCode}: ${statusText}`)}
            </h3>
            <span className="text-xs text-neutral-500">
              Mã phản hồi HTTP:{' '}
              <span className={`font-mono font-bold ${success ? 'text-emerald-700' : 'text-rose-700'}`}>
                {statusCode > 0 ? statusCode : 'Lỗi mạng'} {statusText ? `(${statusText})` : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Latency badge */}
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getLatencyColor(
              latencyMs
            )}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{latencyMs} ms</span>
            <span className="text-[10px] opacity-75 font-normal">({getLatencyLabel(latencyMs)})</span>
          </div>
        </div>
      </div>

      {/* Suggestion / Troubleshooting */}
      <div className="mt-3 flex items-start gap-2.5 text-xs text-neutral-700">
        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-semibold text-neutral-800">Khuyến nghị & Chẩn đoán: </span>
          <span>{diagnostic.suggestion}</span>
          {diagnostic.helpUrl && (
            <div className="mt-1.5">
              <a
                href={diagnostic.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                <span>Mở bảng điều khiển nhà cung cấp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
