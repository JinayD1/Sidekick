

function scoreColor(score) {
  if (score >= 8) return "green";
  if (score >= 5) return "amber";
  return "red";
}

function ScoreBar({ score }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  return (
    <div className="audit-score-bar-track">
      <div
        className={`audit-score-bar-fill audit-score-bar-fill--${scoreColor(score)}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function AuditReportCard({ auditType, report }) {
  if (!report || report.error) {
    return (
      <div className="audit-report-card audit-report-card--error">
        <span>Audit error: {report?.error || "Unknown error"}</span>
      </div>
    );
  }

  if (auditType === "ux") {
    const { overallScore, dimensions = [], topFrictions = [], topWins = [] } = report;
    return (
      <div className="audit-report-card">
        <div className="audit-report-header">
          <span className="audit-report-label">UX Audit</span>
          <span className={`audit-score-badge audit-score-badge--${scoreColor(overallScore)}`}>
            {overallScore}/10
          </span>
        </div>

        <div className="audit-dimensions">
          {dimensions.map((d, i) => (
            <div key={i} className="audit-dimension-row">
              <div className="audit-dimension-name">{d.name}</div>
              <div className="audit-dimension-bar-row">
                <ScoreBar score={d.score} />
                <span className={`audit-dimension-score audit-dimension-score--${scoreColor(d.score)}`}>
                  {d.score}/10
                </span>
              </div>
              <p className="audit-dimension-why">{d.why}</p>
              {d.recommendation && d.recommendation !== "None needed" && (
                <p className="audit-dimension-rec">→ {d.recommendation}</p>
              )}
            </div>
          ))}
        </div>

        {topFrictions.length > 0 && (
          <div className="audit-section">
            <span className="audit-section-label audit-section-label--friction">Top Frictions</span>
            <ul className="audit-frictions-list">
              {topFrictions.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}

        {topWins.length > 0 && (
          <div className="audit-section">
            <span className="audit-section-label audit-section-label--win">Top Wins</span>
            <ul className="audit-wins-list">
              {topWins.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (auditType === "product_clarity") {
    const { overallClarityScore, products = [], topImprovements = [] } = report;
    return (
      <div className="audit-report-card">
        <div className="audit-report-header">
          <span className="audit-report-label">Product Clarity Audit</span>
          {overallClarityScore !== null && (
            <span className={`audit-score-badge audit-score-badge--${scoreColor(overallClarityScore)}`}>
              {overallClarityScore}/10
            </span>
          )}
        </div>

        <div className="audit-product-grid">
          {products.map((p, i) => {
            const scores = p.scores || {};
            const scoreValues = Object.values(scores).filter((v) => typeof v === "number");
            const avg = scoreValues.length
              ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1)
              : null;
            return (
              <div key={i} className="audit-product-card">
                <div className="audit-product-card-header">
                  <strong className="audit-product-title">{p.productTitle}</strong>
                  {avg && (
                    <span className={`audit-score-badge audit-score-badge--sm audit-score-badge--${scoreColor(parseFloat(avg))}`}>
                      {avg}
                    </span>
                  )}
                </div>
                {p.inferredAudience && (
                  <p className="audit-product-audience">
                    <span className="audit-product-meta-label">Audience:</span> {p.inferredAudience}
                  </p>
                )}
                {p.inferredBusinessType && (
                  <p className="audit-product-business">
                    <span className="audit-product-meta-label">Business:</span> {p.inferredBusinessType}
                  </p>
                )}
                <div className="audit-product-score-rows">
                  {Object.entries(scores).map(([key, val]) => (
                    <div key={key} className="audit-product-score-row">
                      <span className="audit-product-score-key">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <ScoreBar score={val} />
                      <span className={`audit-dimension-score audit-dimension-score--${scoreColor(val)}`}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
                {p.missingFields?.length > 0 && (
                  <p className="audit-product-missing">
                    Missing: {p.missingFields.join(", ")}
                  </p>
                )}
                {p.topSuggestions?.length > 0 && (
                  <ul className="audit-product-suggestions">
                    {p.topSuggestions.slice(0, 2).map((s, j) => <li key={j}>{s}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {topImprovements.length > 0 && (
          <div className="audit-section">
            <span className="audit-section-label audit-section-label--friction">Top Improvements</span>
            <ul className="audit-frictions-list">
              {topImprovements.map((imp, i) => <li key={i}>{imp}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (auditType === "discoverability") {
    const {
      overallDiscoverabilityScore,
      queriesTested,
      queriesWithRecommendation,
      neverRecommended = [],
      queryResults = [],
      topImprovements = [],
    } = report;
    const badgeColor = overallDiscoverabilityScore >= 70 ? "green" : overallDiscoverabilityScore >= 40 ? "amber" : "red";
    return (
      <div className="audit-report-card">
        <div className="audit-report-header">
          <span className="audit-report-label">Agentic Discoverability Audit</span>
          <span className={`audit-score-badge audit-score-badge--${badgeColor}`}>
            {overallDiscoverabilityScore}%
          </span>
          <span className="audit-report-sub">
            {queriesWithRecommendation}/{queriesTested} queries matched
          </span>
        </div>

        <div className="audit-query-list">
          {queryResults.map((q, i) => (
            <div key={i} className={`audit-query-row ${q.wouldRecommend ? "audit-query-row--match" : "audit-query-row--miss"}`}>
              <span className="audit-query-icon">{q.wouldRecommend ? "✓" : "✕"}</span>
              <div className="audit-query-content">
                <span className="audit-query-text">"{q.query}"</span>
                {q.wouldRecommend && q.recommendations?.length > 0 && (
                  <span className="audit-query-match">
                    → {q.recommendations.filter((r) => r.relevance >= 2).map((r) => r.productTitle).join(", ")}
                  </span>
                )}
                {!q.wouldRecommend && q.gaps && (
                  <span className="audit-query-gap">{q.gaps}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {neverRecommended.length > 0 && (
          <div className="audit-section">
            <span className="audit-section-label audit-section-label--friction">Never Recommended</span>
            <ul className="audit-frictions-list">
              {neverRecommended.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

        {topImprovements.length > 0 && (
          <div className="audit-section">
            <span className="audit-section-label audit-section-label--friction">Improvements</span>
            <ul className="audit-frictions-list">
              {topImprovements.map((imp, i) => <li key={i}>{imp}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return null;
}
