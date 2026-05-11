import { useState } from "react";

export function ProductDraftCard({ draft, files }) {
  const [title, setTitle] = useState(draft.title || "");
  const [price, setPrice] = useState(draft.price || "");
  const [vendor, setVendor] = useState(draft.vendor || "");
  const [mediaItems, setMediaItems] = useState(draft.media || []);

  // Shopify dev store state
  const [shopifyCreating, setShopifyCreating] = useState(false);
  const [shopifyResult, setShopifyResult] = useState(null);
  const [shopifyError, setShopifyError] = useState(null);
  const [shopifyMediaErrors, setShopifyMediaErrors] = useState([]);

  const editedDraft = {
    ...draft,
    title,
    price: price || null,
    vendor,
    media: mediaItems,
  };
  const sourceFile = files?.[0];

  const handleShopifyCreate = async () => {
    setShopifyCreating(true);
    setShopifyError(null);
    setShopifyMediaErrors([]);
    try {
      const response = await fetch("/api/shopify/products/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft: editedDraft }),
      });
      const data = await response.json();
      if (data.success) {
        setShopifyResult(data.product);
        if (data.mediaErrors?.length) {
          setShopifyMediaErrors(data.mediaErrors);
        }
      } else {
        const msg =
          data.errors?.map((e) => e.message).join("; ") ||
          "Failed to create product in Shopify.";
        setShopifyError(msg);
      }
    } catch {
      setShopifyError("Network error — could not reach Shopify.");
    } finally {
      setShopifyCreating(false);
    }
  };

  const variantPreview = draft.variants
    ?.slice(0, 4)
    .map((v) => v.title)
    .join(", ");
  const hasMoreVariants = (draft.variants?.length || 0) > 4;
  const tagPreview = draft.tags?.slice(0, 5).join(", ");

  return (
    <div className="product-draft-card">
      <div className="draft-card-badges">
        <span className="draft-badge active-badge">ACTIVE</span>
        {sourceFile && (
          <a
            className="gdrive-badge"
            href={sourceFile.url}
            target="_blank"
            rel="noreferrer"
          >
            {sourceFile.provider === "google" ? "Google Drive" : "OneDrive"} ·{" "}
            {sourceFile.title}
          </a>
        )}
      </div>

      <div className="draft-field-row">
        <label className="draft-field-label">Title</label>
        <input
          className="draft-field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Product title"
        />
      </div>

      <div className="draft-fields-inline">
        <div className="draft-field-row">
          <label className="draft-field-label">Price ($)</label>
          <input
            className="draft-field-input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="draft-field-row">
          <label className="draft-field-label">Vendor</label>
          <input
            className="draft-field-input"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Vendor name"
          />
        </div>
        {draft.productType && (
          <div className="draft-field-row">
            <label className="draft-field-label">Type</label>
            <span className="draft-field-value">{draft.productType}</span>
          </div>
        )}
      </div>

      {variantPreview && (
        <div className="draft-meta-row">
          <span className="draft-meta-label">Variants</span>
          <span className="draft-meta-value">
            {variantPreview}
            {hasMoreVariants ? ` + ${draft.variants.length - 4} more` : ""}
          </span>
        </div>
      )}

      {tagPreview && (
        <div className="draft-meta-row">
          <span className="draft-meta-label">Tags</span>
          <span className="draft-meta-value">{tagPreview}</span>
        </div>
      )}

      {draft.seo?.title && (
        <div className="draft-meta-row">
          <span className="draft-meta-label">SEO title</span>
          <span className="draft-meta-value">{draft.seo.title}</span>
        </div>
      )}

      {/* Media section */}
      <div className="draft-media-section">
        <span className="draft-field-label">
          Images{" "}
          {mediaItems.length > 0 ? `(${mediaItems.length} from Drive)` : ""}
        </span>

        {mediaItems.length > 0 ? (
          <>
            <div className="draft-media-grid">
              {mediaItems.map((item, index) => (
                <div
                  className="draft-media-item"
                  key={item.driveFileId || index}
                >
                  <div className="draft-media-thumb">
                    {item.driveFileId ? (
                      <img
                        src={`/api/drive/thumbnail/${item.driveFileId}`}
                        alt={item.alt || item.sourceFileName}
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className="draft-media-placeholder"
                      style={item.driveFileId ? { display: "none" } : {}}
                    >
                      🖼
                    </div>
                  </div>
                  <span
                    className="draft-media-filename"
                    title={item.sourceFileName}
                  >
                    {item.sourceFileName?.replace(/\.[^.]+$/, "")}
                  </span>
                  <button
                    type="button"
                    className="draft-media-remove"
                    onClick={() =>
                      setMediaItems((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={`Remove ${item.sourceFileName}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="draft-no-images-hint">
            No product images found in Drive. Add images to your product folder
            to include them.
          </p>
        )}
      </div>

      {/* Mock store row */}
      {/* Shopify dev store row */}
      {shopifyResult ? (
        <div className="shopify-success-card">
          <div className="shopify-success-header">
            <span className="shopify-success-badge">Shopify Dev Store</span>
            <span className="shopify-status-pill">{shopifyResult.status}</span>
          </div>
          <strong className="shopify-product-title">
            {shopifyResult.title}
          </strong>
          <div className="shopify-product-meta">
            <span>
              ID:{" "}
              <code>
                {shopifyResult.id.replace("gid://shopify/Product/", "")}
              </code>
            </span>
            <span>
              Handle: <code>{shopifyResult.handle}</code>
            </span>
            {shopifyResult.media?.length > 0 && (
              <span>
                Media: {shopifyResult.media.length} image
                {shopifyResult.media.length > 1 ? "s" : ""} attached
              </span>
            )}
          </div>
          <div className="shopify-action-links">
            {shopifyResult.adminUrl && (
              <a
                className="shopify-admin-link"
                href={shopifyResult.adminUrl}
                target="_blank"
                rel="noreferrer"
              >
                View in Shopify Admin →
              </a>
            )}
            {shopifyResult.previewUrl && (
              <a
                className="shopify-preview-link"
                href={shopifyResult.previewUrl}
                target="_blank"
                rel="noreferrer"
              >
                Preview storefront →
              </a>
            )}
          </div>
          {shopifyMediaErrors.length > 0 && (
            <p className="draft-media-upload-error">
              Product created, but images could not be attached — make your
              Drive images public ("Anyone with the link") and try again.
            </p>
          )}
          <p className="shopify-post-create-note">
            Product is now active and visible in your Online Store.
          </p>
        </div>
      ) : (
        <>{shopifyError && <p className="draft-error">{shopifyError}</p>}</>
      )}

      {/* Action button */}
      {!shopifyResult && (
        <div className="draft-buttons-row">
          <button
            type="button"
            className="shopify-create-button"
            onClick={handleShopifyCreate}
            disabled={shopifyCreating || !title}
          >
            {shopifyCreating ? "Creating…" : "Create Product"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Audit Report Card ────────────────────────────────────────────────────────
