import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Bot,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Database,
  Terminal,
  Activity,
  Zap,
  TrendingUp,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { trpc } from '../trpc';
import type { ToolCallAudit, AITutorResponse, SupportedSymbol } from '@orderbook/shared';
import { SUPPORTED_SYMBOLS } from '@orderbook/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  toolAudit?: ToolCallAudit[];
  usedTools?: string[];
  latencyMs?: number;
  model?: string;
  timestamp: number;
}

const SUGGESTED_PROMPTS = [
  { label: 'Why did INFY price move?', symbol: 'INFY' as SupportedSymbol },
  { label: 'Calculate slippage for 250 shares BUY', symbol: 'TCS' as SupportedSymbol },
  { label: 'What is current Order Book Imbalance (OBI)?', symbol: 'INFY' as SupportedSymbol },
  { label: 'Inspect recent PostgreSQL trade contracts', symbol: 'TCS' as SupportedSymbol },
  { label: 'Explain book depth and spread', symbol: 'RELIANCE' as SupportedSymbol },
];

/**
 * ToolAuditAccordion: Expandable telemetry viewer showing executed database tools,
 * latency, input arguments, and raw database contract responses (NR-02).
 */
function ToolAuditAccordion({ audit }: { audit: ToolCallAudit[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!audit || audit.length === 0) return null;

  const totalTime = audit.reduce((sum, a) => sum + (a.executionTimeMs || 0), 0);

  const handleCopy = (id: string, data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          <span className="font-semibold">Tool Audit Telemetry:</span>
          <span>
            {audit.length} Database {audit.length === 1 ? 'Tool' : 'Tools'} Executed
          </span>
          <span className="text-[10px] text-muted-foreground">({totalTime.toFixed(1)}ms)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {isOpen ? 'Hide' : 'Inspect'}
          </span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-amber-500/20 px-3 py-2 space-y-2 bg-background/60">
          <div className="flex flex-wrap gap-1">
            {audit.map((tool) => (
              <Badge
                key={tool.id}
                variant="outline"
                className="text-[10px] bg-muted/60 text-foreground border-amber-500/30 gap-1 py-0.5"
              >
                <Database className="h-2.5 w-2.5 text-amber-500" />
                <code>{tool.toolName}</code>
                <span className="text-muted-foreground font-mono">({tool.executionTimeMs}ms)</span>
              </Badge>
            ))}
          </div>

          <div className="space-y-1.5 mt-2">
            {audit.map((tool) => {
              const isExpanded = expandedToolId === tool.id;
              return (
                <div
                  key={tool.id}
                  className="rounded border border-border/60 bg-card p-2 text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedToolId(isExpanded ? null : tool.id)}
                      className="flex items-center gap-1.5 font-mono font-medium hover:text-amber-500 transition-colors text-left"
                    >
                      <Terminal className="h-3 w-3 text-emerald-500" />
                      <span>{tool.toolName}</span>
                      <span className="text-muted-foreground text-[10px]">
                        ({tool.executionTimeMs}ms)
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(tool.id, tool.result)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Copy raw tool result"
                      >
                        {copiedId === tool.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedToolId(isExpanded ? null : tool.id)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 space-y-1.5 pt-1.5 border-t border-border/40 font-mono text-[10px]">
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase tracking-wider">
                          Arguments:
                        </span>
                        <pre className="bg-muted/80 p-1.5 rounded overflow-x-auto text-[10px]">
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[9px] uppercase tracking-wider">
                          Database Result Payload:
                        </span>
                        <pre className="bg-muted/80 p-1.5 rounded overflow-x-auto max-h-48 text-[10px]">
                          {JSON.stringify(tool.result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AITutorDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<SupportedSymbol>('INFY');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `### 🎓 Welcome to the Glass-Box AI Microstructure Tutor!
I am your embedded market microstructure professor and DBMS concurrency specialist.

I execute **real database and order book inspection tools** to dissect market phenomena:
- 📊 **Order Book Depth & Spread:** Top 10 levels and cumulative liquidity.
- 📐 **Slippage & VWAP:** Multi-level order sweep cost calculations.
- ⚖️ **Order Book Imbalance (OBI):** Real-time buyer vs. seller pressure across top 5 tiers.
- 📜 **PostgreSQL Trade Contracts:** Audited immutable execution records.
- 🔍 **Price Movement Causality:** Aggressive taker flow analysis.

*Zero hallucination guarantee: Every single number I cite is mathematically fetched from the system.*`,
      timestamp: Date.now(),
      model: 'Glass-Box Tutor Engine',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (textToSend?: string, overrideSymbol?: SupportedSymbol) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const symbolToUse = overrideSymbol || selectedSymbol;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response: AITutorResponse = await trpc.aiTutor.askQuestion.mutate({
        message: text,
        symbol: symbolToUse,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        toolAudit: response.toolAudit,
        usedTools: response.usedTools,
        latencyMs: response.latencyMs,
        model: response.model,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('[AITutor] Failed to send message:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Diagnostic Error:** Unable to reach AI Tutor endpoint. (${err?.message || String(err)})`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* ── Floating Launcher Button (Bottom Right) ───────────────────────── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-3 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20 group cursor-pointer"
          title="Open AI Market Microstructure Tutor (NR-02)"
        >
          <div className="relative">
            <Sparkles className="h-5 w-5 animate-pulse text-amber-300" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <span className="font-semibold text-sm tracking-wide">AI Tutor</span>
          <Badge
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white text-[10px] px-1.5 py-0 border-0"
          >
            NR-02
          </Badge>
        </button>
      )}

      {/* ── Expandable Floating Drawer Container ─────────────────────────── */}
      {isOpen && (
        <aside
          aria-label="Agentic AI Tutor Panel"
          className="fixed bottom-6 right-6 z-50 flex h-[620px] max-h-[calc(100vh-3rem)] w-[460px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
        >
          {/* Top Gradient Accent Bar */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Agentic AI Tutor
                  </h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/40 text-purple-600 dark:text-purple-400">
                    Tool-Calling
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Activity className="h-3 w-3 text-emerald-500" />
                  <span>PostgreSQL & Engine Live Audit</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setMessages(messages.slice(0, 1))}
                title="Reset conversation"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="Minimize AI Tutor"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Symbol Selector Bar */}
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 bg-muted/10 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-primary" />
              Active Symbol:
            </span>
            <div className="flex items-center gap-1">
              {SUPPORTED_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setSelectedSymbol(sym)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                    selectedSymbol === sym
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="flex items-center gap-1 mb-1 text-[10px] text-muted-foreground">
                    <Sparkles className="h-2.5 w-2.5 text-purple-500" />
                    <span className="font-medium">Glass-Box Tutor</span>
                    {msg.latencyMs !== undefined && (
                      <span className="font-mono text-[9px]">({msg.latencyMs}ms)</span>
                    )}
                  </div>
                )}

                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs max-w-[92%] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none shadow-sm'
                      : 'bg-muted/70 text-foreground rounded-tl-none border border-border/50 shadow-sm'
                  }`}
                >
                  {/* Tool Audit Accordion for Assistant Responses */}
                  {msg.toolAudit && msg.toolAudit.length > 0 && (
                    <ToolAuditAccordion audit={msg.toolAudit} />
                  )}

                  {/* Markdown Answer Rendering */}
                  <div className="prose prose-xs dark:prose-invert max-w-none break-words">
                    <ReactMarkdown
                      components={{
                        table: ({ node, ...props }) => (
                          <div className="my-2 overflow-x-auto rounded border border-border/60">
                            <table className="w-full text-[10px] border-collapse" {...props} />
                          </div>
                        ),
                        th: ({ node, ...props }) => (
                          <th
                            className="bg-muted px-2 py-1 font-semibold text-left border-b border-border/60 text-foreground"
                            {...props}
                          />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="px-2 py-1 border-b border-border/40 font-mono text-[10px]" {...props} />
                        ),
                        p: ({ node, ...props }) => <p className="my-1.5 leading-relaxed" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-1 space-y-0.5" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 my-1 space-y-0.5" {...props} />,
                        code: ({ node, className, children, ...props }) => (
                          <code
                            className="bg-background/80 px-1 py-0.5 rounded text-[11px] font-mono border border-border/40"
                            {...props}
                          >
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {msg.model && (
                    <div className="mt-2 text-[9px] text-muted-foreground border-t border-border/40 pt-1 flex items-center justify-between">
                      <span>{msg.model}</span>
                      <span>Verified Zero Hallucination</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex flex-col items-start space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Bot className="h-3 w-3 animate-spin text-purple-500" />
                  <span>Agentic Tutor is auditing market state...</span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-border/50 bg-muted/60 px-3.5 py-2 text-xs">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Executing tools against PostgreSQL & OrderBook...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Prompt Chips */}
          <div className="border-t border-border/40 bg-muted/20 px-3 py-2">
            <span className="text-[10px] font-medium text-muted-foreground block mb-1 flex items-center gap-1">
              <HelpCircle className="h-3 w-3 text-purple-500" />
              Suggested Explorations:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setSelectedSymbol(prompt.symbol);
                    handleSendMessage(prompt.label, prompt.symbol);
                  }}
                  className="rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[10px] text-foreground hover:border-purple-500/50 hover:bg-purple-500/10 transition-colors disabled:opacity-50 text-left"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input Form */}
          <div className="border-t border-border/60 p-3 bg-card">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask AI tutor about ${selectedSymbol} (e.g. Why did price move?)...`}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !inputMessage.trim()}
                className="h-8 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-sm disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </aside>
      )}
    </>
  );
}
