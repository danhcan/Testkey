import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Search, ListFilter, Terminal, FileText, Cpu, Sparkles } from 'lucide-react';
import { ModelStatusExplorer } from './ModelStatusExplorer';
import { ModelItem, ApiProviderId } from '../types';

interface ResponseInspectorProps {
  models?: string[];
  modelDetails?: ModelItem[];
  provider?: ApiProviderId;
  apiKey?: string;
  onOpenChat?: (provider: ApiProviderId, apiKey: string, modelId: string) => void;
  promptResult?: string;
  headers?: Record<string, string>;
  rawResponse?: any;
}

export const ResponseInspector: React.FC<ResponseInspectorProps> = ({
  models,
  modelDetails,
  provider = 'gemini',
  apiKey,
  onOpenChat,
  promptResult,
  headers,
  rawResponse,
}) => {
  const [activeTab, setActiveTab] = useState<'prompt' | 'models' | 'json' | 'headers'>(
    models && models.length > 0 ? 'models' : promptResult ? 'prompt' : 'json'
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rawJsonString = rawResponse ? JSON.stringify(rawResponse, null, 2) : '';

  return (
    <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden shadow-xs">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-50/80 border-b border-neutral-200 text-xs">
        <div className="flex items-center space-x-1">
          {models && models.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('models')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'models'
                  ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>Tình trạng & Danh sách Models</span>
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px] font-bold">
                {models.length}
              </span>
            </button>
          )}

          {promptResult && (
            <button
              type="button"
              onClick={() => setActiveTab('prompt')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                activeTab === 'prompt'
                  ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Phản hồi Prompt (Kết quả AI)
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'json'
                ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            JSON Raw Payload
          </button>

          {headers && Object.keys(headers).length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('headers')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'headers'
                  ? 'bg-white text-neutral-900 shadow-xs border border-neutral-200'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>Headers / Rate Limits</span>
              <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-700 rounded-full text-[10px]">
                {Object.keys(headers).length}
              </span>
            </button>
          )}
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={() => {
            if (activeTab === 'prompt' && promptResult) handleCopy(promptResult);
            else if (activeTab === 'models' && models) handleCopy(models.join('\n'));
            else if (activeTab === 'headers' && headers) handleCopy(JSON.stringify(headers, null, 2));
            else handleCopy(rawJsonString);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-md transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {/* Models tab */}
        {activeTab === 'models' && models && (
          <ModelStatusExplorer
            models={models}
            modelDetails={modelDetails}
            provider={provider}
            apiKey={apiKey}
            onOpenChat={onOpenChat}
          />
        )}

        {/* Prompt tab */}
        {activeTab === 'prompt' && promptResult && (
          <div className="space-y-2">
            <div className="p-3.5 rounded-lg bg-neutral-900 text-neutral-100 font-sans text-sm leading-relaxed border border-neutral-800">
              <div className="text-[11px] text-neutral-400 uppercase tracking-wider mb-1 font-mono">
                Generated Text Output:
              </div>
              <p className="whitespace-pre-wrap">{promptResult}</p>
            </div>
          </div>
        )}

        {/* JSON Raw tab */}
        {activeTab === 'json' && (
          <div className="relative">
            <pre className="p-3.5 rounded-lg bg-neutral-900 text-emerald-400 font-mono text-xs overflow-x-auto max-h-80 leading-relaxed border border-neutral-800 selection:bg-emerald-900 selection:text-white">
              {rawJsonString || 'Không có dữ liệu JSON phản hồi'}
            </pre>
          </div>
        )}

        {/* Headers tab */}
        {activeTab === 'headers' && headers && (
          <div className="space-y-2">
            <div className="overflow-x-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                  <tr>
                    <th className="px-3 py-2">Header HTTP</th>
                    <th className="px-3 py-2">Giá trị (Value)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono">
                  {Object.entries(headers).map(([key, val]) => (
                    <tr key={key} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-3 py-1.5 font-medium text-neutral-800 break-all">{key}</td>
                      <td className="px-3 py-1.5 text-blue-700 break-all">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
