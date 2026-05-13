

export function SalesReportCard() {
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

export function VisualSummary({ visual }) {
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
