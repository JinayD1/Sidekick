import { useEffect, useState } from "react";
import {
  Send,
  RefreshCw,
  X,
} from "lucide-react";
import { AuditReportCard } from "./AuditReportCard";
import { AgentActionFeed, AssistantBubble, DriveLoading, MarkdownText, SourceFiles, StorefrontLoading, ThinkingLoading } from "./ChatParts";
import { ProductDraftCard } from "./ProductDraftCard";
import { SalesReportCard, VisualSummary } from "./Visuals";

export function SidekickPanel({ isOpen, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [connections, setConnections] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/status")
      .then((response) => response.json())
      .then(setConnections)
      .catch(() => {
        setConnections({
          ok: false,
          anthropic: false,
          google: false,
          microsoft: false,
        });
      });
  }, [isOpen]);

  const createAssistantMessage = (text) => {
    const normalized = text.toLowerCase();
    if (
      normalized.includes("sales") ||
      normalized.includes("dropoff") ||
      normalized.includes("analyze")
    ) {
      return {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        chart: true,
        text: "The dip in sales is probably due to minimal snow. These are summer months in many regions, so it's natural for sales to decrease.",
      };
    }

    if (normalized.includes("discount")) {
      return {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: "I can draft a discount for you. Choose the percentage, customer eligibility, and dates, then I will ask for confirmation before creating it.",
      };
    }

    return {
      id: `assistant-${Date.now()}`,
      sender: "assistant",
      text: "I can help with store tasks, analytics, products, orders, theme edits, and discounts. Tell me what you want to change or understand.",
    };
  };

  const sendPrompt = async (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmed,
    };
    const assistantId = `assistant-${Date.now()}`;
    const placeholder = {
      id: assistantId,
      sender: "assistant",
      pending: "thinking",
      text: "",
    };
    setMessages((current) => [...current, userMessage, placeholder]);
    setPrompt("");

    const updateAssistant = (patchOrFn) =>
      setMessages((current) =>
        current.map((m) => {
          if (m.id !== assistantId) return m;
          const patch = typeof patchOrFn === "function" ? patchOrFn(m) : patchOrFn;
          return { ...m, ...patch };
        }),
      );

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-6),
        }),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "plan") {
            const isStorefront = event.plan?.intent === "storefront_agent";
            const needsDrive =
              !isStorefront &&
              (event.plan?.needsFiles || event.plan?.intent === "product_create");
            updateAssistant({
              pending: isStorefront ? "storefront" : needsDrive ? "drive" : "thinking",
            });
          } else if (event.type === "tool_call") {
            updateAssistant((m) => ({
              actions: [
                ...(m.actions || []),
                { name: event.name, input: event.input, done: false },
              ],
            }));
          } else if (event.type === "tool_result") {
            updateAssistant((m) => {
              const actions = [...(m.actions || [])];
              const idx = actions.map((a) => a.name).lastIndexOf(event.name);
              if (idx !== -1) actions[idx] = { ...actions[idx], done: true };
              return { actions };
            });
          } else if (event.type === "audit_report") {
            updateAssistant((m) => ({
              reports: [
                ...(m.reports || []),
                { auditType: event.auditType, report: event.report },
              ],
            }));
          } else if (event.type === "agent_text") {
            // intermediate agent narration — ignore, final answer covers it
          } else if (event.type === "final") {
            updateAssistant({
              pending: null,
              text: event.display?.answer || "",
              files: event.display?.files || [],
              visual: event.display?.visual || null,
              product: event.display?.product || null,
              raw: event.raw || null,
            });
          }
        }
      }
    } catch {
      updateAssistant({
        pending: null,
        text: createAssistantMessage(trimmed).text,
      });
    }
  };

  return (
    <aside
      className={`sidekick-panel ${isOpen ? "is-open" : ""}`}
      aria-label="Shopify Sidekick"
    >
      <div className="sidekick-header">
        <strong>Sidekick</strong>
        <div className="sidekick-controls">
          <button
            className="icon-button"
            type="button"
            aria-label="Close Sidekick"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="chat-stream">
        {messages.length === 0 ? (
          <div className="sidekick-start">
            <AssistantBubble>
              <p>
                I&apos;m Sidekick, your Shopify assistant. Ask questions and get
                help with your to-do list. I&apos;m still learning and can
                sometimes make mistakes, so trust your expertise. What would you
                like help with?
              </p>
            </AssistantBubble>
            {!connections?.google ? (
              <div className="connection-row">
                <a href="/api/oauth/google/start">Connect Google Drive</a>
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message) =>
            message.sender === "assistant" ? (
              <AssistantBubble key={message.id}>
                {message.pending === "drive" ? (
                  <DriveLoading />
                ) : message.pending === "storefront" ? (
                  <StorefrontLoading actions={message.actions} />
                ) : message.pending === "thinking" ? (
                  <ThinkingLoading />
                ) : (
                  <>
                    {message.actions?.length > 0 && (
                      <AgentActionFeed actions={message.actions} />
                    )}
                    {message.reports?.map((r, i) => (
                      <AuditReportCard
                        key={`${r.auditType}-${i}`}
                        auditType={r.auditType}
                        report={r.report}
                      />
                    ))}
                    <MarkdownText text={message.text} />
                    {message.product ? (
                      <ProductDraftCard
                        draft={message.product}
                        files={message.files}
                      />
                    ) : (
                      <>
                        {message.files?.length ? (
                          <SourceFiles files={message.files} />
                        ) : null}
                        {message.visual ? (
                          <VisualSummary visual={message.visual} />
                        ) : null}
                        {message.chart ? <SalesReportCard /> : null}
                      </>
                    )}
                  </>
                )}
              </AssistantBubble>
            ) : (
              <div className="message-row user-row" key={message.id}>
                <span className="user-avatar">JD</span>
                <div className="message user">{message.text}</div>
              </div>
            ),
          )
        )}
      </div>

      <form
        className="sidekick-composer"
        onSubmit={(event) => {
          event.preventDefault();
          sendPrompt();
        }}
      >
        <label>
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask anything..."
          />
          <button
            className="composer-icon"
            type="button"
            aria-label="Regenerate"
          >
            <RefreshCw size={19} />
          </button>
          <button
            className="composer-send"
            type="submit"
            aria-label="Send prompt"
          >
            <Send size={21} />
          </button>
        </label>
      </form>
    </aside>
  );
}
