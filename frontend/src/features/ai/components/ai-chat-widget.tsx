import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { Spinner } from "@/components/ui/spinner";
import { useAIChat, type AIContext } from "@/features/ai/api/ai-api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AIChatWidget() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentRef = useRef(0);
  const SEND_COOLDOWN_MS = 2000;

  const chatMutation = useAIChat();

  const buildContext = useCallback((): AIContext => {
    return {
      page: location.pathname,
      language: i18n.language,
    };
  }, [location.pathname, i18n.language]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      // Rate-limit: enforce cooldown between sends
      const now = Date.now();
      if (now - lastSentRef.current < SEND_COOLDOWN_MS) return;
      lastSentRef.current = now;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      const context = buildContext();

      chatMutation.mutate(
        { message: text.trim(), context },
        {
          onSuccess: (data) => {
            const aiMsg: ChatMessage = {
              id: `ai-${Date.now()}`,
              role: "assistant",
              content: data.response,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMsg]);
            if (data.suggestions) {
              setSuggestedQuestions(data.suggestions);
            }
          },
          onError: () => {
            const errorMsg: ChatMessage = {
              id: `error-${Date.now()}`,
              role: "assistant",
              content: t("ai.error"),
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
          },
        },
      );
    },
    [buildContext, chatMutation, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (question: string) => {
    sendMessage(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label={isOpen ? t("ai.collapse") : t("ai.expand")}
      >
        {isOpen ? (
          <XMarkIcon className="h-6 w-6" />
        ) : (
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 flex h-[500px] w-[400px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-gray-200 bg-primary px-4 py-3">
            <SparklesIcon className="h-5 w-5 text-white" />
            <h3 className="text-sm font-semibold text-white">
              {t("ai.chatTitle")}
            </h3>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <SparklesIcon className="mb-3 h-10 w-10 text-primary/40" />
                <p className="text-sm text-gray-500">{t("ai.placeholder")}</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="mr-2 mt-1 flex-shrink-0">
                    <SparklesIcon className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="mb-3 flex justify-start">
                <div className="mr-2 mt-1 flex-shrink-0">
                  <SparklesIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
                  <Spinner size="sm" />
                  <span className="text-xs text-gray-500">
                    {t("ai.typing")}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions */}
          {suggestedQuestions.length > 0 && messages.length < 3 && (
            <div className="border-t border-gray-100 px-4 py-2">
              <p className="mb-1 text-xs font-medium text-gray-400">
                {t("ai.suggestedQuestions")}
              </p>
              <div className="flex flex-wrap gap-1">
                {suggestedQuestions.slice(0, 3).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSuggestionClick(q)}
                    className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-gray-200 px-4 py-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("ai.placeholder")}
              disabled={chatMutation.isPending}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
              aria-label={t("ai.send")}
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
