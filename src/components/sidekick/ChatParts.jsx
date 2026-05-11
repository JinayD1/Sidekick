

export function MarkdownText({ text }) {
  if (!text) return null;
  // Split on double newlines for paragraphs, single newlines for line breaks
  const paragraphs = text.split(/\n\n+/);
  return (
    <>
      {paragraphs.map((para, i) => {
        // Render inline: **bold**, *italic*, [text](url), bare URLs
        const parts = [];
        let remaining = para;
        let key = 0;
        const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/\S+))/g;
        let lastIndex = 0;
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(remaining)) !== null) {
          if (match.index > lastIndex) {
            parts.push(remaining.slice(lastIndex, match.index));
          }
          if (match[2]) {
            parts.push(<strong key={key++}>{match[2]}</strong>);
          } else if (match[3]) {
            parts.push(<em key={key++}>{match[3]}</em>);
          } else if (match[4]) {
            parts.push(<a key={key++} href={match[5]} target="_blank" rel="noreferrer">{match[4]}</a>);
          } else if (match[6]) {
            parts.push(<a key={key++} href={match[6]} target="_blank" rel="noreferrer">{match[6]}</a>);
          }
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < remaining.length) parts.push(remaining.slice(lastIndex));
        return <p key={i}>{parts}</p>;
      })}
    </>
  );
}

export function AssistantBubble({ children }) {
  return (
    <div className="message-row assistant-row">
      <span className="sidekick-avatar">
        <img src="/sidekick-icon.svg" alt="" />
      </span>
      <div className="message assistant">{children}</div>
    </div>
  );
}

export function DriveLoading() {
  return (
    <div className="drive-loading" role="status" aria-live="polite">
      <img src="/8630399.png" alt="" />
      <span>Checking Google Drive…</span>
    </div>
  );
}

export function ThinkingLoading() {
  return (
    <div className="thinking-loading" role="status" aria-live="polite">
      <span>Thinking…</span>
    </div>
  );
}

const TOOL_LABELS = {
  get_storefront_audit: "Auditing store",
  scan_drive_for_product: "Scanning Drive",
  create_shopify_product: "Creating product",
  publish_product: "Publishing product",
  unpublish_product: "Unpublishing product",
  delete_product: "Deleting product",
  update_product: "Updating product",
  get_pages: "Reading pages",
  create_or_update_page: "Updating page",
  delete_page: "Deleting page",
  get_theme_settings: "Reading theme",
  update_theme_settings: "Updating theme",
  create_collection: "Creating collection",
  delete_collection: "Deleting collection",
  add_product_to_collection: "Adding to collection",
  get_menus: "Reading menus",
  run_ux_audit: "Running UX Auditor Agent",
  run_product_clarity_audit: "Running Product Clarity Agent",
  run_discoverability_audit: "Running Discoverability Scout",
  list_themes: "Listing installed themes",
  activate_theme: "Activating theme",
};

export function StorefrontLoading({ actions }) {
  const current = actions?.filter((a) => !a.done).at(-1);
  const label = current ? (TOOL_LABELS[current.name] ?? current.name) : "Working on your store…";
  return (
    <div className="thinking-loading" role="status" aria-live="polite">
      <span>{label}</span>
    </div>
  );
}

export function AgentActionFeed({ actions }) {
  return (
    <div className="agent-action-feed">
      {actions.map((a, i) => (
        <div key={i} className={`agent-action-item ${a.done ? "done" : "pending"}`}>
          <span className="agent-action-icon">{a.done ? "✓" : "○"}</span>
          <span>{TOOL_LABELS[a.name] ?? a.name}</span>
        </div>
      ))}
    </div>
  );
}

export function SourceFiles({ files }) {
  return (
    <div className="source-files">
      {files.slice(0, 4).map((file) => (
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          key={`${file.provider}-${file.title}`}
        >
          <strong>{file.title}</strong>
          <span>
            {file.provider} · {file.reason || "Relevant source"}
          </span>
        </a>
      ))}
    </div>
  );
}
