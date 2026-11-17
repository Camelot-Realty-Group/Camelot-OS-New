import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { isAIConfigured, chatCompletion, chatCompletionStream, localQueryEngine, type AIChatMessage } from '@/lib/ai-client';
import { useBuildingsStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  Send, Bot, User, Sparkles, BarChart3, Mail,
  Target, AlertCircle, Loader2, Zap, RefreshCw,
} from 'lucide-react';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

const QUICK_ACTIONS = [
  { label: 'Pipeline Summary', icon: BarChart3, prompt: 'Give me a summary of our current pipeline status. How many buildings are in each stage?' },
  { label: 'Top Leads', icon: Target, prompt: 'What are our top 5 leads right now? Consider score, violations, and pipeline stage.' },
  { label: 'Draft Email', icon: Mail, prompt: 'Draft a cold outreach email for our highest-scored building that hasn\'t been contacted yet.' },
  { label: 'Untouched Leads', icon: AlertCircle, prompt: 'Which leads have been in the "discovered" stage for more than 7 days without any contact?' },
  { label: 'Competitive Analysis', icon: Zap, prompt: 'What can you tell me about the current competitive landscape for property management in NYC? What are common pain points buildings have with their current management?' },
  { label: 'Compliance Brief', icon: AlertCircle, prompt: 'Give me a Guardian compliance risk brief. Which buildings need source checks for violations, liens, LL97, court filings, or management-score reconciliation?' },
  { label: 'Market Brief', icon: BarChart3, prompt: 'Create a Sentinel market and comp brief from the current Scout database. What charts, sources, and neighborhood proof should go into the next report?' },
  { label: 'Proposal Angle', icon: Sparkles, prompt: 'Create an Excalibur board proposal angle for our strongest current lead, including fee positioning, service scope, and what financial documents we need before a final proposal.' },
  { label: 'Savings Plan', icon: RefreshCw, prompt: 'Build a value creation and vendor savings plan that shows how Camelot can save time, money, risk, and board effort.' },
  { label: 'HOA Recovery', icon: Target, prompt: 'Create an HOA recovery and field operations brief that separates executive back office, local facilities support, and claims/project oversight.' },
  { label: 'Agent Skill Sets', icon: Bot, prompt: 'Summarize the upgraded Scout agent skill sets across Merlin, Scout, Guardian, Sentinel, Outreach, and Excalibur.' },
];

function merlinErrorText(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Merlin could not answer.';
  if (message === 'AI_NOT_CONFIGURED') {
    return 'Merlin has no model key on this server. Add OPENAI_API_KEY or AI_API_KEY in Render, then redeploy. Quick actions on this screen still work from the building list.';
  }
  if (message === 'AI_AUTH_FAILED') {
    return 'Merlin could not authenticate to the model. The server key was rejected. Check OPENAI_API_KEY or AI_API_KEY in Render.';
  }
  if (message === 'AI_RATE_LIMITED') {
    return 'The model rate limit was hit. Wait a moment and ask Merlin again.';
  }
  if (/no credits/i.test(message)) {
    return 'Merlin is wired up, but the OpenAI account behind this server has no credits left. Add credits in the OpenAI billing settings, then ask again.';
  }
  return message || 'Merlin could not answer.';
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buildings = useBuildingsStore((s) => s.buildings);
  const aiConfigured = isAIConfigured();
  const location = useLocation();
  const launchedPrompt = (location.state as { prompt?: string } | null)?.prompt || '';
  const launchedRef = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const buildContext = useCallback(() => {
    // Build context about current state for the AI
    const active = buildings.filter((b) => b.status === 'active');
    const byStage: Record<string, number> = {};
    active.forEach((b) => {
      byStage[b.pipeline_stage] = (byStage[b.pipeline_stage] || 0) + 1;
    });

    const top5 = [...active].sort((a, b) => b.score - a.score).slice(0, 5);

    return `Current Camelot OS Database Context:
- Total active buildings: ${active.length}
- Pipeline: ${Object.entries(byStage).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Top 5 by score: ${top5.map((b) => `${b.name || b.address} (score: ${b.score}, grade: ${b.grade}, stage: ${b.pipeline_stage})`).join('; ')}
- Average score: ${active.length ? Math.round(active.reduce((s, b) => s + b.score, 0) / active.length) : 0}
- Buildings with contacts: ${active.filter((b) => b.contacts?.length > 0).length}
- Self-managed buildings: ${active.filter((b) => b.current_management?.toLowerCase().includes('self') || b.current_management?.toLowerCase() === 'unknown').length}`;
  }, [buildings]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantMsgId = crypto.randomUUID();

    try {
      // Try local query engine first (works without AI backend)
      const localResult = localQueryEngine(content.trim(), buildings as any);

      if (localResult !== null) {
        // Local engine handled it — show result immediately
        setMessages((prev) => [
          ...prev,
          { id: assistantMsgId, role: 'assistant', content: localResult, timestamp: new Date() },
        ]);
        setIsLoading(false);
        return;
      }

      // No local match — try external AI if configured
      if (!aiConfigured) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: '🤖 AI backend not configured. Use the **quick actions** above for pipeline summaries, top leads, email drafts, and more — they work offline.\n\nTo turn on free-text chat, add `OPENAI_API_KEY` in **Render → Environment** — the Merlin agent activates automatically on the next deploy.',
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Build the messages array for the API
      const contextMsg: AIChatMessage = { role: 'user', content: buildContext() };
      const historyMsgs: AIChatMessage[] = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Try streaming first
      let fullText = '';
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true },
      ]);

      try {
        fullText = await chatCompletionStream(
          [contextMsg, ...historyMsgs, { role: 'user', content: content.trim() }],
          (chunk) => {
            fullText += ''; // Track is handled in the stream fn
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m
              )
            );
          }
        );
      } catch (streamErr: any) {
        // If streaming fails, try non-streaming
        if (streamErr.message !== 'AI_NOT_CONFIGURED') {
          fullText = await chatCompletion([
            contextMsg,
            ...historyMsgs,
            { role: 'user', content: content.trim() },
          ]);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: fullText, isStreaming: false } : m
            )
          );
        } else {
          throw streamErr;
        }
      }

      // Finalize
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, isStreaming: false, content: m.content || fullText } : m
        )
      );
    } catch (err: any) {
      // Remove the streaming placeholder
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: merlinErrorText(err), timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!launchedPrompt || launchedRef.current === launchedPrompt) return;
    launchedRef.current = launchedPrompt;
    void sendMessage(launchedPrompt);
  }, [launchedPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#02060c] text-slate-100">
      <div className="border-b border-[#7ef0ff]/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center border border-[#e8cc5a]/70 text-[#f4e4a8]">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="font-heading text-2xl text-white">Merlin</h2>
              {aiConfigured ? (
                <p className="text-xs uppercase tracking-[0.16em] text-[#7ef0ff]">Model link ready</p>
              ) : (
                <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Local answers only</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 border border-[#7ef0ff]/30 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-slate-300 hover:text-white"
          >
            <RefreshCw size={13} /> Clear
          </button>
        </div>
      </div>

      <div className="chat-messages min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-camelot-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-camelot-gold" />
            </div>
            <h3 className="font-heading text-3xl mb-2">Ask Merlin</h3>
            <p className="text-slate-400 text-sm mb-6">
              Pipeline, buildings, drafts, and the work on this desk. The command bar opens this same conversation.
            </p>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-w-2xl mx-auto">
              {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(prompt)}
                  className="flex items-center gap-2 border border-[#7ef0ff]/30 bg-black/30 p-3 text-left hover:border-[#e8cc5a]"
                >
                  <Icon size={16} className="text-camelot-gold flex-shrink-0" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3 max-w-3xl',
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              msg.role === 'user'
                ? 'bg-camelot-navy text-white'
                : 'bg-camelot-gold/20 text-camelot-gold'
            )}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={cn(
              'border px-4 py-3 max-w-[80%]',
              msg.role === 'user'
                ? 'border-[#e8cc5a]/50 bg-[#e8cc5a]/15 text-white'
                : 'border-[#7ef0ff]/30 bg-[#041018] text-slate-100'
            )}>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-camelot-gold ml-0.5 animate-pulse" />
                )}
              </div>
              <p className={cn(
                'text-[10px] mt-2',
                msg.role === 'user' ? 'text-gray-400' : 'text-gray-400'
              )}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-camelot-gold/20 flex items-center justify-center">
              <Bot size={14} className="text-camelot-gold" />
            </div>
            <div className="border border-[#7ef0ff]/30 bg-[#041018] px-4 py-3">
              <Loader2 size={16} className="animate-spin text-camelot-gold" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#7ef0ff]/30 bg-[#02070d] p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Merlin..."
                rows={1}
                className="w-full resize-none border border-[#7ef0ff]/40 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#e8cc5a]"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="bg-[#e8cc5a] p-3 text-[#1a1404] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Merlin answers from the model on this server and the buildings already loaded
          </p>
        </div>
      </div>
    </div>
  );
}
