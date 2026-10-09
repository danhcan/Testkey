import React, { useState, useMemo } from 'react';
import {
  Terminal,
  Monitor,
  Copy,
  Check,
  Download,
  ExternalLink,
  FolderOpen,
  ShieldCheck,
  Code,
  Zap,
  Settings,
  Layers,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronRight,
  Info,
  Server,
  FileCode,
  Sparkles,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { ApiProviderId } from '../types';

interface ClaudeConfigViewerProps {
  initialApiKey?: string;
  initialProvider?: ApiProviderId;
  onTestKey?: (provider: ApiProviderId, key: string) => void;
}

export const ClaudeConfigViewer: React.FC<ClaudeConfigViewerProps> = ({
  initialApiKey = '',
  initialProvider = 'anthropic',
}) => {
  // Key & Provider State
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [showKey, setShowKey] = useState(false);
  const [providerType, setProviderType] = useState<'official' | 'openrouter' | 'custom'>('official');
  const [customBaseUrl, setCustomBaseUrl] = useState('https://openrouter.ai/api');
  const [selectedModel, setSelectedModel] = useState('claude-3-7-sonnet-latest');

  // Active Main Mode: 'desktop' (Claude Desktop) or 'cli' (Claude Code CLI) or 'proxy' (Proxy & LiteLLM)
  const [mainMode, setMainMode] = useState<'desktop' | 'cli' | 'proxy'>('desktop');

  // OS selection: 'mac' | 'windows' | 'linux'
  const [selectedOs, setSelectedOs] = useState<'mac' | 'windows' | 'linux'>('mac');

  // CLI Shell tab: 'zsh' | 'bash' | 'powershell' | 'cmd' | 'dotenv' | 'json'
  const [cliShell, setCliShell] = useState<'zsh' | 'bash' | 'powershell' | 'cmd' | 'dotenv' | 'json'>('zsh');

  // MCP Servers toggles for Claude Desktop
  const [mcpServers, setMcpServers] = useState({
    filesystem: true,
    memory: true,
    fetch: true,
    github: false,
    braveSearch: false,
    sqlite: false,
    puppeteer: false,
  });

  // Custom paths & tokens for MCP
  const [allowedDirectory, setAllowedDirectory] = useState(
    selectedOs === 'windows' ? 'C:\\Users\\Username\\Projects' : '~/Projects'
  );
  const [githubToken, setGithubToken] = useState('');
  const [braveApiKey, setBraveApiKey] = useState('');

  // Quick Test connection state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Determine effective key to display in templates
  const effectiveKey = apiKey.trim() || 'sk-ant-api03-YOUR_ANTHROPIC_KEY_HERE';
  const effectiveBaseUrl =
    providerType === 'openrouter'
      ? 'https://openrouter.ai/api'
      : providerType === 'custom'
      ? customBaseUrl.trim() || 'https://api.yourproxy.com/v1'
      : '';

  // Quick test connection
  const handleRunQuickTest = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập API Key trước khi kiểm tra kết nối.',
      });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);

    try {
      const provider = providerType === 'openrouter' ? 'openrouter' : 'anthropic';
      const response = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          testType: 'prompt',
          prompt: 'Hi in 2 words',
          customModel: selectedModel,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setTestResult({
          success: true,
          message: `Kết nối thành công! Model phản hồi: "${data.promptResult?.slice(0, 40) || 'OK'}"`,
          latencyMs: data.latencyMs,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || `Lỗi xác thực (Mã ${data.statusCode || response.status})`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Không thể gửi yêu cầu kiểm tra.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Paths by OS for Claude Desktop
  const desktopPaths = {
    mac: {
      dir: '~/Library/Application Support/Claude',
      file: '~/Library/Application Support/Claude/claude_desktop_config.json',
      openCmd: 'open "~/Library/Application Support/Claude"',
      createCmd: `mkdir -p "$HOME/Library/Application Support/Claude"`,
    },
    windows: {
      dir: '%APPDATA%\\Claude',
      file: '%APPDATA%\\Claude\\claude_desktop_config.json',
      openCmd: 'explorer.exe $env:APPDATA\\Claude',
      createCmd: `New-Item -ItemType Directory -Force -Path "$env:APPDATA\\Claude"`,
    },
    linux: {
      dir: '~/.config/Claude',
      file: '~/.config/Claude/claude_desktop_config.json',
      openCmd: 'xdg-open ~/.config/Claude',
      createCmd: `mkdir -p "$HOME/.config/Claude"`,
    },
  };

  // Generate Claude Desktop Config JSON
  const desktopConfigJson = useMemo(() => {
    const servers: Record<string, any> = {};

    if (mcpServers.filesystem) {
      servers['filesystem'] = {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          allowedDirectory || (selectedOs === 'windows' ? 'C:\\Users\\Username\\Projects' : '/Users/username/Projects'),
        ],
      };
    }

    if (mcpServers.memory) {
      servers['memory'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      };
    }

    if (mcpServers.fetch) {
      servers['fetch'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
      };
    }

    if (mcpServers.github) {
      servers['github'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: githubToken.trim() || 'ghp_your_github_token_here',
        },
      };
    }

    if (mcpServers.braveSearch) {
      servers['brave-search'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
          BRAVE_API_KEY: braveApiKey.trim() || 'BSA_your_brave_api_key_here',
        },
      };
    }

    if (mcpServers.sqlite) {
      servers['sqlite'] = {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-sqlite',
          '--db-path',
          selectedOs === 'windows' ? 'C:\\Users\\Username\\database.db' : '~/database.db',
        ],
      };
    }

    if (mcpServers.puppeteer) {
      servers['puppeteer'] = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      };
    }

    const config: Record<string, any> = {
      mcpServers: servers,
    };

    // If using custom proxy or custom endpoint for Claude Desktop
    if (providerType !== 'official' && effectiveBaseUrl) {
      config.globalShortcut = 'CommandOrControl+Shift+Space';
      config.anthropicBaseUrl = effectiveBaseUrl;
    }

    return JSON.stringify(config, null, 2);
  }, [
    mcpServers,
    allowedDirectory,
    selectedOs,
    githubToken,
    braveApiKey,
    providerType,
    effectiveBaseUrl,
  ]);

  // Terminal bash/zsh export commands
  const zshCommand = useMemo(() => {
    let lines = [`export ANTHROPIC_API_KEY="${effectiveKey}"`];
    if (effectiveBaseUrl) {
      lines.push(`export ANTHROPIC_BASE_URL="${effectiveBaseUrl}"`);
    }
    if (selectedModel) {
      lines.push(`export CLAUDE_DEFAULT_MODEL="${selectedModel}"`);
    }
    return lines.join('\n');
  }, [effectiveKey, effectiveBaseUrl, selectedModel]);

  const zshAppendCmd = useMemo(() => {
    let script = `echo 'export ANTHROPIC_API_KEY="${effectiveKey}"' >> ~/.zshrc`;
    if (effectiveBaseUrl) {
      script += ` && echo 'export ANTHROPIC_BASE_URL="${effectiveBaseUrl}"' >> ~/.zshrc`;
    }
    if (selectedModel) {
      script += ` && echo 'export CLAUDE_DEFAULT_MODEL="${selectedModel}"' >> ~/.zshrc`;
    }
    script += ' && source ~/.zshrc';
    return script;
  }, [effectiveKey, effectiveBaseUrl, selectedModel]);

  const bashAppendCmd = useMemo(() => {
    let script = `echo 'export ANTHROPIC_API_KEY="${effectiveKey}"' >> ~/.bashrc`;
    if (effectiveBaseUrl) {
      script += ` && echo 'export ANTHROPIC_BASE_URL="${effectiveBaseUrl}"' >> ~/.bashrc`;
    }
    if (selectedModel) {
      script += ` && echo 'export CLAUDE_DEFAULT_MODEL="${selectedModel}"' >> ~/.bashrc`;
    }
    script += ' && source ~/.bashrc';
    return script;
  }, [effectiveKey, effectiveBaseUrl, selectedModel]);

  const powerShellCommand = useMemo(() => {
    let lines = [
      `# Thiết lập cho phiên PowerShell hiện tại:`,
      `$env:ANTHROPIC_API_KEY = "${effectiveKey}"`,
    ];
    if (effectiveBaseUrl) {
      lines.push(`$env:ANTHROPIC_BASE_URL = "${effectiveBaseUrl}"`);
    }
    if (selectedModel) {
      lines.push(`$env:CLAUDE_DEFAULT_MODEL = "${selectedModel}"`);
    }
    lines.push('');
    lines.push(`# Thiết lập VĨNH VIỄN cho User (không mất khi đóng terminal):`);
    lines.push(`[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', '${effectiveKey}', 'User')`);
    if (effectiveBaseUrl) {
      lines.push(`[System.Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', '${effectiveBaseUrl}', 'User')`);
    }
    if (selectedModel) {
      lines.push(`[System.Environment]::SetEnvironmentVariable('CLAUDE_DEFAULT_MODEL', '${selectedModel}', 'User')`);
    }
    return lines.join('\n');
  }, [effectiveKey, effectiveBaseUrl, selectedModel]);

  const cmdCommand = useMemo(() => {
    let lines = [
      `:: Thiết lập vĩnh viễn trong Windows CMD:`,
      `setx ANTHROPIC_API_KEY "${effectiveKey}"`,
    ];
    if (effectiveBaseUrl) {
      lines.push(`setx ANTHROPIC_BASE_URL "${effectiveBaseUrl}"`);
    }
    if (selectedModel) {
      lines.push(`setx CLAUDE_DEFAULT_MODEL "${selectedModel}"`);
    }
    lines.push('');
    lines.push(`:: Thiết lập tạm thời cho cửa sổ hiện tại:`);
    lines.push(`set ANTHROPIC_API_KEY=${effectiveKey}`);
    return lines.join('\n');
  }, [effectiveKey, effectiveBaseUrl, selectedModel]);

  const dotenvContent = useMemo(() => {
    let lines = [
      `# Cấu hình Claude CLI / Claude Code cho dự án cục bộ`,
      `ANTHROPIC_API_KEY=${effectiveKey}`,
    ];
    if (effectiveBaseUrl) {
      lines.push(`ANTHROPIC_BASE_URL=${effectiveBaseUrl}`);
    }
    lines.push(`CLAUDE_DEFAULT_MODEL=${selectedModel}`);
    lines.push(`CLAUDE_AUTO_UPDATER=enabled`);
    return lines.join('\n');
  }, [effectiveKey, effectiveBaseUrl, selectedModel]);

  const claudeCliJsonConfig = useMemo(() => {
    const config: Record<string, any> = {
      apiKey: effectiveKey,
      model: selectedModel,
      autoUpdaterStatus: 'enabled',
      preferredNotifChannel: 'terminal_bell',
      hasCompletedOnboarding: true,
    };
    if (effectiveBaseUrl) {
      config.baseUrl = effectiveBaseUrl;
    }
    return JSON.stringify(config, null, 2);
  }, [effectiveKey, selectedModel, effectiveBaseUrl]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Title & Overview Banner */}
      <div className="bg-gradient-to-r from-amber-900/90 via-neutral-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cấu Hình Tự Động 1-Click</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Cấu Hình Cho Claude CLI & Claude Desktop</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Trình tạo cấu hình hoàn chỉnh cho <strong>Claude Desktop</strong> (hỗ trợ Model Context Protocol - MCP) và{' '}
              <strong>Claude Code CLI</strong> (trợ lý lập trình terminal chính thức). Tự động tạo biến môi trường, file JSON và lệnh thực thi cho macOS, Windows và Linux.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-neutral-800/80 px-3 py-1.5 rounded-xl border border-neutral-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-neutral-200 font-mono">Claude 3.7 / 3.5 Sonnet Ready</span>
            </div>
            <a
              href="https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition-colors font-medium"
            >
              <span>Tài liệu Claude Code CLI</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Card 1: Khóa API & Nhà Cung Cấp */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>1. Nhập Khóa API & Chọn Nhà Cung Cấp</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Khóa API này sẽ được tự động điền vào tất cả các file cấu hình và lệnh terminal bên dưới.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500">Mô hình mặc định:</span>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="text-xs py-1 px-2.5 rounded-lg border border-neutral-300 bg-neutral-50 font-mono text-neutral-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-amber-500"
            >
              <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet (Hybrid Reasoning)</option>
              <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Chuẩn coding)</option>
              <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Siêu nhanh)</option>
              <option value="claude-3-opus-latest">Claude 3 Opus (Phân tích sâu)</option>
            </select>
          </div>
        </div>

        {/* Provider Source Choice */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setProviderType('official')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              providerType === 'official'
                ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/30'
                : 'border-neutral-200 bg-white hover:bg-neutral-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-neutral-900">Anthropic Trực Tiếp</span>
                {providerType === 'official' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Tài khoản chính thức console.anthropic.com (Key tiền tố <code>sk-ant-...</code>).
              </p>
            </div>
            <span className="inline-block mt-2 text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded w-fit">
              Khuyên dùng
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProviderType('openrouter')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              providerType === 'openrouter'
                ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/30'
                : 'border-neutral-200 bg-white hover:bg-neutral-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-neutral-900">OpenRouter (Proxy Claude)</span>
                {providerType === 'openrouter' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Dùng key OpenRouter (<code>sk-or-v1-...</code>) để gọi Claude qua base URL <code>openrouter.ai/api</code>.
              </p>
            </div>
            <span className="inline-block mt-2 text-[10px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded w-fit">
              Dễ nạp tiền tại VN
            </span>
          </button>

          <button
            type="button"
            onClick={() => setProviderType('custom')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
              providerType === 'custom'
                ? 'border-neutral-800 bg-neutral-50 ring-1 ring-neutral-800/30'
                : 'border-neutral-200 bg-white hover:bg-neutral-50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-neutral-900">LiteLLM / Custom Proxy</span>
                {providerType === 'custom' && <CheckCircle2 className="w-4 h-4 text-neutral-800" />}
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Endpoint proxy nội bộ, OneAPI, hoặc LiteLLM chuyển tiếp các model khác sang Claude format.
              </p>
            </div>
            <span className="inline-block mt-2 text-[10px] font-semibold text-neutral-700 bg-neutral-200 px-2 py-0.5 rounded w-fit">
              Tùy biến URL
            </span>
          </button>
        </div>

        {/* Custom Base URL if selected */}
        {providerType === 'custom' && (
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1 animate-fadeIn">
            <label className="block text-xs font-semibold text-neutral-700">
              ANTHROPIC_BASE_URL (URL Máy chủ Proxy):
            </label>
            <input
              type="text"
              value={customBaseUrl}
              onChange={e => setCustomBaseUrl(e.target.value)}
              placeholder="http://localhost:4000 hoặc https://my-proxy.com/v1"
              className="w-full text-xs font-mono py-1.5 px-3 rounded-lg border border-neutral-300 bg-white focus:ring-1 focus:ring-amber-500"
            />
          </div>
        )}

        {/* API Key Input Field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-neutral-700">
            Khóa API ({providerType === 'official' ? 'Anthropic' : providerType === 'openrouter' ? 'OpenRouter' : 'Proxy'}):
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={
                  providerType === 'official'
                    ? 'sk-ant-api03-...'
                    : providerType === 'openrouter'
                    ? 'sk-or-v1-...'
                    : 'sk-...'
                }
                className="w-full text-xs font-mono py-2.5 pl-3.5 pr-10 rounded-xl border border-neutral-300 bg-neutral-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                title={showKey ? 'Ẩn key' : 'Hiện key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleRunQuickTest}
              disabled={testingConnection || !apiKey.trim()}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Gửi 1 ping kiểm tra nhanh đến Anthropic API"
            >
              {testingConnection ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
              )}
              <span>{testingConnection ? 'Đang test...' : 'Test kết nối key'}</span>
            </button>
          </div>

          {/* Test connection alert result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fadeIn ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
                {testResult.latencyMs !== undefined && (
                  <span className="font-mono font-semibold text-emerald-700">({testResult.latencyMs}ms)</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Switcher: Claude Desktop vs Claude Code CLI vs Proxy Guide */}
      <div className="flex items-center p-1 bg-neutral-200/80 rounded-xl max-w-xl mx-auto border border-neutral-200">
        <button
          type="button"
          onClick={() => setMainMode('desktop')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            mainMode === 'desktop'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Monitor className="w-4 h-4 text-amber-600" />
          <span>Claude Desktop (MCP)</span>
        </button>

        <button
          type="button"
          onClick={() => setMainMode('cli')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            mainMode === 'cli'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-600" />
          <span>Claude Code CLI</span>
        </button>

        <button
          type="button"
          onClick={() => setMainMode('proxy')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            mainMode === 'proxy'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Server className="w-4 h-4 text-indigo-600" />
          <span>Proxy / OpenRouter</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CLAUDE DESKTOP CONFIGURATION (claude_desktop_config.json)      */}
      {/* ========================================================================= */}
      {mainMode === 'desktop' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full mb-1 border border-amber-200">
                <Monitor className="w-3.5 h-3.5" />
                <span>claude_desktop_config.json</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">
                Cấu hình Claude Desktop & Model Context Protocol (MCP)
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Claude Desktop sử dụng file này để kích hoạt các công cụ (tools) mở rộng như truy cập file ổ cứng, duyệt web và ghi nhớ.
              </p>
            </div>

            {/* OS Selection Tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedOs('mac');
                  setAllowedDirectory('~/Projects');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedOs === 'mac'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                🍏 macOS
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOs('windows');
                  setAllowedDirectory('C:\\Users\\Username\\Projects');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedOs === 'windows'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                🪟 Windows
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOs('linux');
                  setAllowedDirectory('~/Projects');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedOs === 'linux'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                🐧 Linux
              </button>
            </div>
          </div>

          {/* Path & Fast Open Helper */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-amber-600" />
                Vị trí file cấu hình trên {selectedOs === 'mac' ? 'macOS' : selectedOs === 'windows' ? 'Windows' : 'Linux'}:
              </span>
              <button
                type="button"
                onClick={() => handleCopy('path', desktopPaths[selectedOs].file)}
                className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedId === 'path' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Sao chép đường dẫn</span>
              </button>
            </div>

            <div className="bg-neutral-900 text-neutral-200 px-3.5 py-2.5 rounded-lg text-xs font-mono break-all flex items-center justify-between">
              <span>{desktopPaths[selectedOs].file}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-neutral-600">
              <span className="font-semibold text-neutral-700">Lệnh mở nhanh thư mục qua Terminal:</span>
              <button
                type="button"
                onClick={() => handleCopy('openCmd', desktopPaths[selectedOs].openCmd)}
                className="bg-white hover:bg-neutral-100 border border-neutral-300 px-2.5 py-1 rounded font-mono text-neutral-800 flex items-center gap-1.5 shadow-2xs"
                title="Bấm để sao chép lệnh mở thư mục"
              >
                {copiedId === 'openCmd' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{desktopPaths[selectedOs].openCmd}</span>
              </button>
            </div>
          </div>

          {/* MCP Server Selector Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>Chọn các tính năng / MCP Servers muốn cài đặt:</span>
              </label>
              <span className="text-[11px] text-neutral-500">Tự động cấu hình file JSON bên dưới</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Filesystem MCP */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  mcpServers.filesystem
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-neutral-200 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    📂 Filesystem (Đọc/Sửa file)
                  </span>
                  <input
                    type="checkbox"
                    checked={mcpServers.filesystem}
                    onChange={e => setMcpServers(prev => ({ ...prev, filesystem: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-neutral-600 mb-2">
                  Cho phép Claude đọc, tạo và chỉnh sửa code trong thư mục máy tính của bạn.
                </p>
                {mcpServers.filesystem && (
                  <input
                    type="text"
                    value={allowedDirectory}
                    onChange={e => setAllowedDirectory(e.target.value)}
                    placeholder="Đường dẫn thư mục cho phép truy cập"
                    className="w-full text-[11px] font-mono py-1 px-2 rounded border border-neutral-300 bg-white"
                  />
                )}
              </div>

              {/* Memory MCP */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  mcpServers.memory
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-neutral-200 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    🧠 Memory (Ghi nhớ)
                  </span>
                  <input
                    type="checkbox"
                    checked={mcpServers.memory}
                    onChange={e => setMcpServers(prev => ({ ...prev, memory: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-neutral-600">
                  Lưu đồ thị tri thức (Knowledge Graph) giúp Claude nhớ sở thích và quy ước code của bạn.
                </p>
              </div>

              {/* Fetch MCP */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  mcpServers.fetch
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-neutral-200 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    🌐 Web Fetch (Duyệt web)
                  </span>
                  <input
                    type="checkbox"
                    checked={mcpServers.fetch}
                    onChange={e => setMcpServers(prev => ({ ...prev, fetch: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-neutral-600">
                  Cho phép Claude truy cập và đọc trực tiếp nội dung các liên kết trang web hoặc tài liệu online.
                </p>
              </div>

              {/* GitHub MCP */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  mcpServers.github
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-neutral-200 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    🐙 GitHub MCP
                  </span>
                  <input
                    type="checkbox"
                    checked={mcpServers.github}
                    onChange={e => setMcpServers(prev => ({ ...prev, github: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-neutral-600 mb-2">
                  Tìm kiếm repository, tạo issues, đọc pull request trên GitHub.
                </p>
                {mcpServers.github && (
                  <input
                    type="password"
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    placeholder="GitHub Personal Access Token (ghp_...)"
                    className="w-full text-[11px] font-mono py-1 px-2 rounded border border-neutral-300 bg-white"
                  />
                )}
              </div>

              {/* Brave Search MCP */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  mcpServers.braveSearch
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-neutral-200 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    🔍 Brave Search (Tìm kiếm)
                  </span>
                  <input
                    type="checkbox"
                    checked={mcpServers.braveSearch}
                    onChange={e => setMcpServers(prev => ({ ...prev, braveSearch: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-neutral-600 mb-2">
                  Tìm kiếm thông tin internet mới nhất theo thời gian thực.
                </p>
                {mcpServers.braveSearch && (
                  <input
                    type="password"
                    value={braveApiKey}
                    onChange={e => setBraveApiKey(e.target.value)}
                    placeholder="Brave Search API Key (BSA_...)"
                    className="w-full text-[11px] font-mono py-1 px-2 rounded border border-neutral-300 bg-white"
                  />
                )}
              </div>

              {/* SQLite MCP */}
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  mcpServers.sqlite
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-neutral-200 bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    🗄️ SQLite Database
                  </span>
                  <input
                    type="checkbox"
                    checked={mcpServers.sqlite}
                    onChange={e => setMcpServers(prev => ({ ...prev, sqlite: e.target.checked }))}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-neutral-600">
                  Cho phép Claude chạy truy vấn SQL và phân tích cơ sở dữ liệu cục bộ.
                </p>
              </div>
            </div>
          </div>

          {/* Generated JSON Output Block */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <Code className="w-4 h-4 text-neutral-500" />
                Nội dung file <code>claude_desktop_config.json</code>:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('desktopJson', desktopConfigJson)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-2xs transition-colors"
                >
                  {copiedId === 'desktopJson' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'desktopJson' ? 'Đã sao chép!' : 'Sao chép JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload('claude_desktop_config.json', desktopConfigJson)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition-colors"
                  title="Tải về file claude_desktop_config.json"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file .json</span>
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950">
              <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[340px] leading-relaxed">
                {desktopConfigJson}
              </pre>
            </div>
          </div>

          {/* Next Steps for Claude Desktop */}
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2 text-xs text-amber-950">
            <h4 className="font-bold flex items-center gap-1.5 text-amber-900">
              <CheckCircle2 className="w-4 h-4 text-amber-700" />
              Cách áp dụng vào Claude Desktop:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-neutral-700">
              <li>
                Bấm <strong>Tải file .json</strong> hoặc <strong>Sao chép JSON</strong> ở trên.
              </li>
              <li>
                Dán file vào đúng thư mục:{' '}
                <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-amber-900">
                  {desktopPaths[selectedOs].file}
                </code>
              </li>
              <li>
                Tắt và khởi động lại <strong>Claude Desktop</strong> (hoặc nhấn <kbd className="bg-white px-1 border rounded">Ctrl+R</kbd> / <kbd className="bg-white px-1 border rounded">Cmd+R</kbd>).
              </li>
              <li>
                Khi mở cuộc trò chuyện mới, bạn sẽ thấy biểu tượng 🔨 <strong>Tools / MCP</strong> xuất hiện ở góc dưới bên phải khung nhập liệu!
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: CLAUDE CODE CLI (@anthropic-ai/claude-code)                     */}
      {/* ========================================================================= */}
      {mainMode === 'cli' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full mb-1 border border-emerald-200">
                <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                <span>@anthropic-ai/claude-code</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">
                Cấu hình Claude Code CLI (Terminal Agent)
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Trợ lý lập trình terminal chính thức của Anthropic — tự động duyệt code, tạo git branch, sửa bug và chạy test.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://www.npmjs.com/package/@anthropic-ai/claude-code"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 font-semibold"
              >
                <span>npm package</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Step 1: Install Command */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2">
            <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>Bước 1: Cài đặt Claude CLI toàn cục (Global)</span>
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-neutral-950 text-neutral-100 p-3 rounded-lg font-mono text-xs flex items-center justify-between">
                <span>npm install -g @anthropic-ai/claude-code</span>
                <button
                  type="button"
                  onClick={() => handleCopy('npmInstall', 'npm install -g @anthropic-ai/claude-code')}
                  className="text-neutral-400 hover:text-white ml-2 p-1"
                  title="Sao chép lệnh cài đặt npm"
                >
                  {copiedId === 'npmInstall' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-neutral-950 text-neutral-100 p-3 rounded-lg font-mono text-xs flex items-center justify-between">
                <span>curl -fsSL https://claude.ai/install.sh | bash</span>
                <button
                  type="button"
                  onClick={() => handleCopy('curlInstall', 'curl -fsSL https://claude.ai/install.sh | bash')}
                  className="text-neutral-400 hover:text-white ml-2 p-1"
                  title="Sao chép lệnh cài đặt bash script"
                >
                  {copiedId === 'curlInstall' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Shell / OS Configuration Tabs */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Bước 2: Chọn Shell / Hệ điều hành để cấu hình biến môi trường:</span>
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <button
                type="button"
                onClick={() => setCliShell('zsh')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  cliShell === 'zsh'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                macOS / Linux (~/.zshrc)
              </button>

              <button
                type="button"
                onClick={() => setCliShell('bash')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  cliShell === 'bash'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Linux / Git Bash (~/.bashrc)
              </button>

              <button
                type="button"
                onClick={() => setCliShell('powershell')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  cliShell === 'powershell'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Windows (PowerShell)
              </button>

              <button
                type="button"
                onClick={() => setCliShell('cmd')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  cliShell === 'cmd'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Windows (CMD setx)
              </button>

              <button
                type="button"
                onClick={() => setCliShell('dotenv')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  cliShell === 'dotenv'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                File .env (Dự án)
              </button>

              <button
                type="button"
                onClick={() => setCliShell('json')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  cliShell === 'json'
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                ~/.claude.json
              </button>
            </div>

            {/* Displaying chosen Shell commands */}
            {cliShell === 'zsh' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Lệnh 1-click tự động ghi vào <code>~/.zshrc</code> và kích hoạt ngay:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('zshAppend', zshAppendCmd)}
                    className="flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    {copiedId === 'zshAppend' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'zshAppend' ? 'Đã sao chép!' : 'Sao chép lệnh 1-click'}</span>
                  </button>
                </div>
                <div className="bg-neutral-950 text-emerald-400 p-3.5 rounded-xl font-mono text-xs overflow-x-auto border border-neutral-800">
                  {zshAppendCmd}
                </div>

                <div className="pt-2">
                  <span className="text-[11px] text-neutral-500 font-semibold">Hoặc copy các biến export thủ công:</span>
                  <div className="bg-neutral-900 text-neutral-200 p-3 rounded-lg font-mono text-xs mt-1 relative">
                    <pre>{zshCommand}</pre>
                    <button
                      type="button"
                      onClick={() => handleCopy('zshExport', zshCommand)}
                      className="absolute right-2 top-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 p-1.5 rounded text-xs"
                      title="Sao chép"
                    >
                      {copiedId === 'zshExport' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {cliShell === 'bash' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Lệnh 1-click tự động ghi vào <code>~/.bashrc</code> và kích hoạt ngay:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('bashAppend', bashAppendCmd)}
                    className="flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    {copiedId === 'bashAppend' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'bashAppend' ? 'Đã sao chép!' : 'Sao chép lệnh 1-click'}</span>
                  </button>
                </div>
                <div className="bg-neutral-950 text-emerald-400 p-3.5 rounded-xl font-mono text-xs overflow-x-auto border border-neutral-800">
                  {bashAppendCmd}
                </div>
              </div>
            )}

            {cliShell === 'powershell' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Lệnh PowerShell (bao gồm thiết lập vĩnh viễn):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('psCmd', powerShellCommand)}
                    className="flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    {copiedId === 'psCmd' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'psCmd' ? 'Đã sao chép!' : 'Sao chép PowerShell'}</span>
                  </button>
                </div>
                <div className="bg-neutral-950 text-cyan-300 p-3.5 rounded-xl font-mono text-xs overflow-x-auto border border-neutral-800 whitespace-pre-wrap">
                  {powerShellCommand}
                </div>
              </div>
            )}

            {cliShell === 'cmd' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Lệnh Command Prompt (setx lưu vĩnh viễn):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('cmdText', cmdCommand)}
                    className="flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    {copiedId === 'cmdText' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'cmdText' ? 'Đã sao chép!' : 'Sao chép CMD'}</span>
                  </button>
                </div>
                <div className="bg-neutral-950 text-amber-300 p-3.5 rounded-xl font-mono text-xs overflow-x-auto border border-neutral-800 whitespace-pre-wrap">
                  {cmdCommand}
                </div>
              </div>
            )}

            {cliShell === 'dotenv' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Nội dung file <code>.env</code> cho thư mục dự án:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('dotenvText', dotenvContent)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 text-white font-semibold cursor-pointer"
                    >
                      {copiedId === 'dotenvText' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Sao chép</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload('.env', dotenvContent)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Tải file .env</span>
                    </button>
                  </div>
                </div>
                <div className="bg-neutral-950 text-emerald-300 p-3.5 rounded-xl font-mono text-xs overflow-x-auto border border-neutral-800 whitespace-pre-wrap">
                  {dotenvContent}
                </div>
              </div>
            )}

            {cliShell === 'json' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">File cấu hình <code>~/.claude.json</code>:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy('jsonCli', claudeCliJsonConfig)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 text-white font-semibold cursor-pointer"
                    >
                      {copiedId === 'jsonCli' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Sao chép</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload('claude.json', claudeCliJsonConfig)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Tải .claude.json</span>
                    </button>
                  </div>
                </div>
                <div className="bg-neutral-950 text-emerald-400 p-3.5 rounded-xl font-mono text-xs overflow-x-auto border border-neutral-800 whitespace-pre-wrap">
                  {claudeCliJsonConfig}
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Run & Verify Commands */}
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/90 space-y-3">
            <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>Bước 3: Khởi động và kiểm tra trên Terminal</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-white p-3 rounded-lg border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-500 block mb-1">1. Khởi động Claude Code</span>
                <div className="flex items-center justify-between bg-neutral-900 text-white px-2.5 py-1.5 rounded font-mono text-xs">
                  <span>claude</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('runCmd', 'claude')}
                    className="text-neutral-400 hover:text-white"
                  >
                    {copiedId === 'runCmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-500 block mb-1">2. Chẩn đoán kết nối (Doctor)</span>
                <div className="flex items-center justify-between bg-neutral-900 text-white px-2.5 py-1.5 rounded font-mono text-xs">
                  <span>claude doctor</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('docCmd', 'claude doctor')}
                    className="text-neutral-400 hover:text-white"
                  >
                    {copiedId === 'docCmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-neutral-200">
                <span className="text-[11px] font-semibold text-neutral-500 block mb-1">3. Chạy 1 lệnh prompt nhanh</span>
                <div className="flex items-center justify-between bg-neutral-900 text-white px-2.5 py-1.5 rounded font-mono text-xs">
                  <span className="truncate">claude -p "Explain files"</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('promptCmd', 'claude -p "Explain this project structure"')}
                    className="text-neutral-400 hover:text-white shrink-0 ml-1"
                  >
                    {copiedId === 'promptCmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: PROXY / OPENROUTER / LITELLM GUIDE                              */}
      {/* ========================================================================= */}
      {mainMode === 'proxy' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-neutral-200/80 shadow-xs space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full mb-1 border border-indigo-200">
              <Server className="w-3.5 h-3.5 text-indigo-600" />
              <span>Chuyển đổi Proxy & Gateway</span>
            </div>
            <h2 className="text-base font-bold text-neutral-900">
              Sử dụng Claude CLI / Desktop qua OpenRouter hoặc LiteLLM Proxy
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Giải pháp tối ưu khi bạn không có thẻ tín dụng quốc tế để đăng ký Anthropic trực tiếp, hoặc muốn dùng 1 tài khoản duy nhất để gọi cả Claude, OpenAI và Gemini.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OpenRouter Setup */}
            <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <span>1. Cấu hình qua OpenRouter.ai</span>
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">
                  Khuyên dùng tại VN
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                OpenRouter hỗ trợ thanh toán thẻ nội địa, crypto và cung cấp tất cả các model Claude 3.7 & 3.5 với giá gốc.
              </p>

              <div className="bg-neutral-950 text-indigo-300 p-3 rounded-lg font-mono text-xs space-y-1 relative">
                <div>export ANTHROPIC_BASE_URL="https://openrouter.ai/api"</div>
                <div>export ANTHROPIC_API_KEY="{apiKey.startsWith('sk-or') ? apiKey : 'sk-or-v1-YOUR_KEY'}"</div>
                <div>claude</div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'orProxyCmd',
                      `export ANTHROPIC_BASE_URL="https://openrouter.ai/api"\nexport ANTHROPIC_API_KEY="${apiKey.startsWith('sk-or') ? apiKey : 'sk-or-v1-YOUR_KEY'}"\nclaude`
                    )
                  }
                  className="absolute right-2 top-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 p-1.5 rounded"
                  title="Sao chép"
                >
                  {copiedId === 'orProxyCmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* LiteLLM Proxy Setup */}
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-neutral-900 flex items-center gap-1.5">
                  <span>2. Cấu hình qua LiteLLM Proxy (Tự host)</span>
                </span>
                <span className="text-[10px] bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded font-semibold">
                  Local / On-Prem
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 leading-relaxed">
                Nếu bạn chạy <code>litellm --port 4000</code> trên máy cục bộ hoặc server riêng để quản lý chi phí & bảo mật:
              </p>

              <div className="bg-neutral-950 text-neutral-200 p-3 rounded-lg font-mono text-xs space-y-1 relative">
                <div>export ANTHROPIC_BASE_URL="http://localhost:4000"</div>
                <div>export ANTHROPIC_API_KEY="sk-litellm-proxy-key"</div>
                <div>claude</div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'liteProxyCmd',
                      `export ANTHROPIC_BASE_URL="http://localhost:4000"\nexport ANTHROPIC_API_KEY="sk-litellm-proxy-key"\nclaude`
                    )
                  }
                  className="absolute right-2 top-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 p-1.5 rounded"
                  title="Sao chép"
                >
                  {copiedId === 'liteProxyCmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
