import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, Send, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CHAT_NODES, type ChatNode } from "@/lib/chatFlows";
import { trackOrder } from "@/lib/chatActions";

// ─── Types ───────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  options?: ChatNode["options"];
  input?: ChatNode["input"];
  isTyping?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

let msgCounter = 0;
const nextId = () => `msg-${++msgCounter}`;

// ─── Component ───────────────────────────────────────────────────────

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentNode, setCurrentNode] = useState<ChatNode | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  // Initialize chat with the start node
  const initChat = useCallback(() => {
    if (messages.length > 0) return; // Already initialized
    const startNode = CHAT_NODES["start"];
    setMessages([
      {
        id: nextId(),
        sender: "bot",
        text: startNode.botMessage,
        options: startNode.options,
      },
    ]);
    setCurrentNode(startNode);
  }, [messages.length]);

  // Open the chat
  const handleOpen = () => {
    setIsOpen(true);
    setHasInteracted(true);
    initChat();
  };

  // Process a node (add bot message, handle side effects)
  const processNode = useCallback(
    async (nodeId: string, userInput?: string) => {
      const node = CHAT_NODES[nodeId];
      if (!node) return;

      setCurrentNode(node);

      // Show typing indicator
      const typingId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: typingId, sender: "bot", text: "", isTyping: true },
      ]);
      scrollToBottom();

      // Simulate typing delay
      await new Promise((r) => setTimeout(r, 400));

      // If this is an order tracking action with user input
      if (node.action === "track_order" && userInput) {
        setIsLoading(true);
        const result = await trackOrder(userInput);
        setIsLoading(false);

        // Remove typing indicator
        setMessages((prev) => prev.filter((m) => m.id !== typingId));

        if (result.found) {
          // Show the order result
          const resultNode = {
            options: [
              { label: "📋 Go to my orders", nextNodeId: "go_orders" },
              { label: "📦 Track another", nextNodeId: "track_ask" },
              { label: "🏠 Main menu", nextNodeId: "start" },
            ],
          };
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              sender: "bot",
              text: result.message,
              options: resultNode.options,
            },
          ]);
        } else {
          // Show not found
          const notFoundNode = CHAT_NODES["track_not_found"];
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              sender: "bot",
              text: result.message || notFoundNode.botMessage,
              options: notFoundNode.options,
            },
          ]);
        }
        scrollToBottom();
        return;
      }

      // Remove typing indicator and add actual message
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== typingId);
        return [
          ...filtered,
          {
            id: nextId(),
            sender: "bot",
            text: node.botMessage,
            options: node.options,
            input: node.input,
          },
        ];
      });

      scrollToBottom();

      // Handle side effects
      if (node.link) {
        setTimeout(() => navigate(node.link!), 600);
      }
      if (node.externalLink) {
        setTimeout(() => window.open(node.externalLink!, "_blank"), 600);
      }
    },
    [navigate, scrollToBottom]
  );

  // Handle quick-reply button click
  const handleOption = (label: string, nextNodeId: string) => {
    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: nextId(), sender: "user", text: label },
    ]);
    scrollToBottom();
    processNode(nextNodeId);
  };

  // Handle text input submit (for order tracking)
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputValue.trim();
    if (!value || isLoading) return;

    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: nextId(), sender: "user", text: value },
    ]);
    setInputValue("");
    scrollToBottom();

    // Process the current node's action with the input
    if (currentNode?.action === "track_order") {
      processNode(currentNode.id, value);
    }
  };

  // Auto-focus input when it appears
  useEffect(() => {
    if (currentNode?.input && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 500);
    }
  }, [currentNode, isOpen]);

  // Show input field if the current (last) bot message needs it
  const showInput = currentNode?.input && !isLoading;

  return (
    <>
      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[min(500px,70vh)] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
            style={{ transformOrigin: "bottom right" }}
          >
            {/* Header */}
            <div className="bg-gray-900 px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-[#c2841d] flex items-center justify-center">
                <MessageCircle size={18} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight">
                  Solely Support
                </p>
                <p className="text-gray-400 text-[11px]">
                  We typically reply instantly
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Gold accent line */}
            <div className="h-0.5 bg-gradient-to-r from-[#c2841d] via-[#e6a93c] to-[#c2841d]" />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-white px-4 py-4 space-y-3 min-h-0">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.isTyping ? (
                    /* Typing indicator */
                    <div className="flex items-start gap-2">
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 inline-flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  ) : msg.sender === "bot" ? (
                    /* Bot message */
                    <div className="flex flex-col items-start gap-2">
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[90%]">
                        <p className="text-[13px] text-gray-800 leading-relaxed whitespace-pre-line">
                          {msg.text}
                        </p>
                      </div>
                      {/* Quick-reply options */}
                      {msg.options && msg.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-w-full">
                          {msg.options.map((opt) => (
                            <button
                              key={opt.nextNodeId + opt.label}
                              onClick={() =>
                                handleOption(opt.label, opt.nextNodeId)
                              }
                              className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-full hover:border-[#c2841d] hover:text-[#c2841d] hover:bg-[#c2841d]/5 transition-all duration-200 active:scale-95 whitespace-nowrap"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* User message */
                    <div className="flex justify-end">
                      <div className="bg-[#c2841d]/10 border border-[#c2841d]/20 rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[80%]">
                        <p className="text-[13px] text-[#8b5e14] font-medium">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar (only for order tracking) */}
            {showInput && (
              <form
                onSubmit={handleInputSubmit}
                className="shrink-0 border-t border-gray-100 bg-gray-50 px-3 py-2.5 flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Paste your order ID here..."
                  className="flex-1 px-3 py-2 text-[13px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c2841d]/30 focus:border-[#c2841d] transition-all"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  <Send size={15} />
                </button>
              </form>
            )}

            {/* Powered by footer */}
            <div className="shrink-0 bg-gray-50 border-t border-gray-100 px-4 py-1.5 text-center">
              <span className="text-[10px] text-gray-400">
                Powered by Solely 🛡️
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Bubble ── */}
      <motion.button
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className={`fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? "bg-gray-700 hover:bg-gray-600"
            : "bg-gray-900 hover:bg-gray-800 hover:shadow-xl hover:scale-110"
        }`}
        whileTap={{ scale: 0.9 }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={22} className="text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle size={22} className="text-white" strokeWidth={2} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse ring on first load (only if chat hasn't been opened yet) */}
        {!hasInteracted && (
          <span className="absolute inset-0 rounded-full border-2 border-[#c2841d] animate-ping opacity-40" />
        )}

        {/* Gold ring accent */}
        <span className="absolute inset-0 rounded-full ring-2 ring-[#c2841d]/30 pointer-events-none" />
      </motion.button>
    </>
  );
};

export default ChatBot;
