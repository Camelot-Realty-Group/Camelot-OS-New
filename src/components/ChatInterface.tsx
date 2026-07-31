import { useState, useRef, useEffect, useCallback } from 'react';
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

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buildings = useBuildingsStore((s) => s.buildings);
  const aiConfigured = isAIConfigured();

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

      let errorContent = 'Sorry, I encountered an error. Please try again.';
      if (err.message === 'AI_NOT_CONFIGURED') {
        errorContent = '🤖 AI backend not configured. Use the **quick actions** above for pipeline summaries, top leads, email drafts, and more — they work offline.\n\nTo turn on free-text chat, add `OPENAI_API_KEY` in **Render → Environment**.';
      } else if (err.message === 'AI_AUTH_FAILED') {
        errorContent = '⚠️ AI authentication failed. Please check your API key in **Settings**.';
      } else if (err.message === 'AI_RATE_LIMITED') {
        errorContent = '⚠️ AI rate limit reached. Please wait a moment and try again.';
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: errorContent, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-camelot-gold/20 rounded-xl flex items-center justify-center">
              <Bot size={20} className="text-camelot-gold" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Merlin AI</h2>
              {aiConfigured ? (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Connected
                </p>
              ) : (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Local Mode — Quick actions available
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw size={13} /> Clear Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 chat-messages">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-camelot-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={32} className="text-camelot-gold" />
            </div>
            <h3 className="text-lg font-bold mb-2">How can I help?</h3>
            <p className="text-gray-500 text-sm mb-6">
              Ask me about your pipeline, leads, buildings, or let me draft emails.
            </p>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-w-2xl mx-auto">
              {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(prompt)}
                  className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-camelot-gold/50 hover:shadow-sm transition-all text-left"
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
              'rounded-xl px-4 py-3 max-w-[80%]',
              msg.role === 'user'
                ? 'bg-camelot-navy text-white'
                : 'bg-white border border-gray-200'
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
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <Loader2 size={16} className="animate-spin text-camelot-gold" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Merlin AI anything..."
                rows={1}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-camelot-gold/50 focus:border-camelot-gold"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="bg-camelot-gold text-white p-3 rounded-xl hover:bg-camelot-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            Merlin AI has access to your building database for contextual answers
          </p>
        </div>
      </div>
    </div>
  );
}
