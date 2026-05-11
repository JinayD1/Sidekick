import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  Moon,
  Plus,
  Search,
  Send,
  Settings,
  Sun,
  RefreshCw,
  X,
} from "lucide-react";
import { HomeDashboard } from "./components/dashboard/HomeDashboard";
import { CustomersSection, DetailSection, OrdersSection, ProductsSection } from "./components/dashboard/sections";
import { AuditReportCard } from "./components/sidekick/AuditReportCard";
import { AgentActionFeed, AssistantBubble, DriveLoading, MarkdownText, SourceFiles, StorefrontLoading, ThinkingLoading } from "./components/sidekick/ChatParts";
import { ProductDraftCard } from "./components/sidekick/ProductDraftCard";
import { appItems, customers, initialProducts, navItems, orders, salesChannels, sectionDetails } from "./data/mockData";
import "./App.css";

function App() {
  const [active, setActive] = useState("home");
  const [sidekickOpen, setSidekickOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [searchQuery, setSearchQuery] = useState("");
  const [products] = useState(initialProducts);
  const isDark = theme === "dark";

  const activeLabel = useMemo(
    () => navItems.find((item) => item.id === active)?.label ?? "Home",
    [active],
  );

  const selectSection = (section) => {
    setActive(section);
    setMobileNavOpen(false);
  };

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const entries = [
      ...navItems.map((item) => ({
        label: item.label,
        type: "Section",
        section: item.id,
      })),
      ...orders.map((order) => ({
        label: `${order.id} · ${order.customer}`,
        type: "Order",
        section: "orders",
      })),
      ...products.map((product) => ({
        label: product.title,
        type: "Product",
        section: "products",
      })),
      ...customers.map((customer) => ({
        label: customer.name,
        type: "Customer",
        section: "customers",
      })),
      ...salesChannels.map((channel) => ({
        label: channel.label,
        type: "Sales channel",
        section: "sales",
      })),
      ...appItems.map((app) => ({
        label: app.label,
        type: "App",
        section: "apps",
      })),
      {
        label: "Grow your audience",
        type: "Dashboard task",
        section: "home",
      },
      {
        label: "Sales over time",
        type: "Analytics",
        section: "home",
      },
    ];

    return entries
      .filter((entry) =>
        `${entry.label} ${entry.type}`.toLowerCase().includes(query),
      )
      .slice(0, 7);
  }, [searchQuery, products]);

  const openSearchResult = (result) => {
    setActive(result.section);
    setSearchQuery("");
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (searchResults[0]) openSearchResult(searchResults[0]);
  };

  return (
    <div className={`admin-shell ${isDark ? "theme-dark" : "theme-light"}`}>
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu size={20} />
        </button>
        <div className="shopify-logo" aria-label="Shopify">
          <img
            src="/png-clipart-shopify-logo-e-commerce-business-super-sale-angle-text.png"
            alt=""
          />
          <strong>shopify</strong>
        </div>
        <form className="command-bar" role="search" onSubmit={submitSearch}>
          <button type="submit" aria-label="Search">
            <Search size={18} />
          </button>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
          />
          <kbd>⌘K</kbd>
          {searchQuery ? (
            <div className="search-results">
              {searchResults.length ? (
                searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.label}`}
                    type="button"
                    onClick={() => openSearchResult(result)}
                  >
                    <span>{result.label}</span>
                    <em>{result.type}</em>
                  </button>
                ))
              ) : (
                <p>No results for "{searchQuery}"</p>
              )}
            </div>
          ) : null}
        </form>
        <div className="top-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="Create new item"
          >
            <Plus size={20} />
          </button>
          <button
            className="icon-button theme-toggle"
            type="button"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="sidekick-trigger"
            type="button"
            aria-label="Open Sidekick"
            onClick={() => setSidekickOpen(true)}
          >
            <img src="/sidekick-icon.svg" alt="" />
          </button>
          <button
            className="topbar-square"
            type="button"
            aria-label="Notifications"
          >
            <Bell size={20} />
            <span className="dot" />
          </button>
          <button className="account-pill" type="button">
            <span>Jinay Desai</span>
            <strong aria-hidden="true">JD</strong>
          </button>
        </div>
      </header>

      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="store-switcher">
          <div>
            <strong>Showcase Boards</strong>
          </div>
          <ChevronDown size={16} />
        </div>

        <nav className="nav-list" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${active === item.id ? "active" : ""}`}
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.count ? <em>{item.count}</em> : null}
              </button>
            );
          })}
        </nav>

        <div className="nav-group">
          <button className="nav-heading" type="button">
            <span>Sales channels</span>
            <ChevronRight size={15} />
          </button>
          {salesChannels.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className="nav-item subtle"
                key={item.label}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="nav-group apps-group">
          <button className="nav-heading" type="button">
            <span>Apps</span>
            <ChevronRight size={15} />
          </button>
          {appItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className="nav-item subtle"
                key={item.label}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <button className="nav-item settings-link" type="button">
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </aside>

      <div className="main-frame">
        <main className="workspace">
          <div
            className={`workspace-header ${active === "home" ? "home-title-hidden" : ""}`}
          >
            <div>
              <span className="breadcrumb">Admin / {activeLabel}</span>
              <h1>{active === "home" ? "Home" : activeLabel}</h1>
            </div>
            <div className="header-actions">
              <button className="secondary-button" type="button">
                Export
              </button>
              <button className="primary-button" type="button">
                <Plus size={16} />
                Create
              </button>
            </div>
          </div>

          {active === "home" ? <HomeDashboard /> : null}
          {active === "orders" ? <OrdersSection /> : null}
          {active === "products" ? (
            <ProductsSection products={products} />
          ) : null}
          {active === "customers" ? <CustomersSection /> : null}
          {sectionDetails[active] ? (
            <DetailSection section={sectionDetails[active]} />
          ) : null}
        </main>
      </div>

      {mobileNavOpen ? (
        <button
          className="scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <SidekickPanel
        isOpen={sidekickOpen}
        onClose={() => setSidekickOpen(false)}
      />
    </div>
  );
}

function SidekickPanel({ isOpen, onClose }) {
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

function SalesReportCard() {
  return (
    <div className="sidekick-report-card">
      <svg viewBox="0 0 360 190" aria-hidden="true" role="presentation">
        <path className="report-grid" d="M28 32H340M28 95H340M28 158H340" />
        <path
          className="report-dotted"
          d="M72 100C96 82 118 70 142 55C165 43 181 39 196 58C212 79 205 106 221 124C245 151 267 106 291 99C314 92 329 111 340 122"
        />
        <path
          className="report-line"
          d="M72 82C96 80 118 61 142 42C164 25 184 22 197 42C211 64 205 102 221 121C244 149 268 98 293 93C315 89 329 108 340 118"
        />
        <text x="12" y="28">
          $5k
        </text>
        <text x="12" y="99">
          $4k
        </text>
        <text x="12" y="164">
          $3k
        </text>
        <text x="72" y="184">
          Mar 1
        </text>
        <text x="185" y="184">
          Apr 1
        </text>
        <text x="302" y="184">
          Jul 1
        </text>
      </svg>
      <div>
        <div>
          <strong>Sales over time</strong>
          <span>Mar 1-Jul 30, 2023</span>
        </div>
        <button type="button">View report</button>
      </div>
    </div>
  );
}

function VisualSummary({ visual }) {
  if (!visual || visual.type === "null" || visual.type === null) return null;

  if (
    visual.type === "table" &&
    Array.isArray(visual.headers) &&
    Array.isArray(visual.rows)
  ) {
    return (
      <div className="visual-summary">
        {visual.title ? <strong>{visual.title}</strong> : null}
        <table className="visual-table">
          <thead>
            <tr>
              {visual.headers.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visual.rows.slice(0, 50).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {(Array.isArray(row) ? row : []).map((cell, cellIndex) => (
                  <td key={cellIndex}>{String(cell ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!Array.isArray(visual.points) || visual.points.length === 0) return null;

  const points = visual.points.slice(0, 8);
  const max = Math.max(...points.map((point) => Number(point.value) || 0), 1);

  if (visual.type === "line") {
    const width = 100;
    const height = 40;
    const stepX = points.length > 1 ? width / (points.length - 1) : 0;
    const path = points
      .map((point, index) => {
        const x = index * stepX;
        const y = height - ((Number(point.value) || 0) / max) * height;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return (
      <div className="visual-summary">
        <strong>{visual.title || "Visual summary"}</strong>
        <svg
          className="visual-line"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <div className="visual-line-labels">
          {points.map((point) => (
            <span key={point.label}>
              <em>{point.label}</em>
              <b>{point.value}</b>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="visual-summary">
      <strong>{visual.title || "Visual summary"}</strong>
      <div>
        {points.map((point) => (
          <span key={point.label}>
            <em>{point.label}</em>
            <i
              style={{
                width: `${Math.max(8, ((Number(point.value) || 0) / max) * 100)}%`,
              }}
            />
            <b>{point.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default App;
