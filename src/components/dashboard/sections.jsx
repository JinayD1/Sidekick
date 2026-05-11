import {
  LayoutDashboard,
  MoreHorizontal,
} from "lucide-react";
import { customers, orders } from "../../data/mockData";

export function OrdersSection() {
  return (
    <section className="table-panel">
      <SectionToolbar
        title="Orders"
        label="Open, unfulfilled, paid, and archived orders"
        filters={["All", "Open", "Unfulfilled", "Paid", "Archived"]}
      />
      <DataTable
        columns={[
          "Order",
          "Customer",
          "Channel",
          "Amount",
          "Payment",
          "Fulfillment",
        ]}
        rows={orders.map((order) => [
          order.id,
          order.customer,
          order.channel,
          order.amount,
          order.payment,
          order.fulfillment,
        ])}
      />
      <div className="detail-preview">
        <div>
          <span className="eyebrow">Order details preview</span>
          <h2>#1049 · Mina Chen</h2>
          <p>
            Purchased 2 items. Shipping to Brooklyn, NY. Timeline includes
            payment capture, risk check, and staff notes.
          </p>
        </div>
        <div className="preview-actions">
          <button className="primary-button" type="button">
            Fulfill items
          </button>
          <button className="secondary-button" type="button">
            Refund
          </button>
          <button className="secondary-button" type="button">
            Duplicate
          </button>
        </div>
      </div>
    </section>
  );
}

export function ProductsSection({ products }) {
  return (
    <section className="table-panel">
      <SectionToolbar
        title="Products"
        label="Product listings, inventory, collections, and gift cards"
        filters={["All", "Active", "Draft", "Low stock", "Collections"]}
      />
      <DataTable
        columns={["Product", "Status", "Inventory", "Type"]}
        rows={products.map((product) => [
          product.title,
          product.status,
          product.inventory,
          product.type,
        ])}
      />
      <div className="product-form-preview">
        <article>
          <span className="eyebrow">Product detail fields</span>
          <h2>Trail Merino Hoodie</h2>
          <p>
            Title, description, media, pricing, inventory, shipping weight,
            variants, metafields, and SEO preview.
          </p>
        </article>
        <article>
          <span className="eyebrow">Inventory</span>
          <h2>4 locations tracked</h2>
          <p>
            Continue selling rules, low-stock alerts, and transfer history are
            visible from the inventory subsection.
          </p>
        </article>
      </div>
    </section>
  );
}

export function CustomersSection() {
  return (
    <section className="table-panel">
      <SectionToolbar
        title="Customers"
        label="Profiles, order history, segments, and B2B companies"
        filters={["All", "VIP", "Returning", "New", "Companies"]}
      />
      <DataTable
        columns={["Customer", "Orders", "Total spend", "Segment"]}
        rows={customers.map((customer) => [
          customer.name,
          customer.orders,
          customer.spend,
          customer.segment,
        ])}
      />
      <div className="cards-row">
        <article className="insight-card">
          <span className="eyebrow">Segments</span>
          <strong>Build targeted audiences</strong>
          <p>
            Create segments from purchase history, tags, behavior, location, and
            lifetime value.
          </p>
        </article>
        <article className="insight-card">
          <span className="eyebrow">Companies</span>
          <strong>Manage B2B buyers</strong>
          <p>
            Company profiles include contacts, locations, terms, tax IDs, and
            wholesale-specific notes.
          </p>
        </article>
      </div>
    </section>
  );
}

export function DetailSection({ section }) {
  return (
    <section className="detail-section">
      <div className="section-intro">
        <span className="eyebrow">{section.eyebrow}</span>
        <h2>{section.title} workspace</h2>
      </div>
      <div className="detail-card-grid">
        {section.cards.map(([title, detail]) => (
          <article className="detail-card" key={title}>
            <LayoutDashboard size={20} />
            <strong>{title}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SectionToolbar({ title, label, filters }) {
  return (
    <div className="section-toolbar">
      <div>
        <span className="eyebrow">{label}</span>
        <h2>{title}</h2>
      </div>
      <div className="filter-row">
        {filters.map((filter, index) => (
          <button
            className={index === 0 ? "filter active" : "filter"}
            key={filter}
            type="button"
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("-")}>
              {row.map((cell) => (
                <td key={cell}>
                  {String(cell).includes("Paid") ||
                  String(cell).includes("Active") ||
                  String(cell).includes("VIP") ? (
                    <span className="status-pill positive">{cell}</span>
                  ) : String(cell).includes("Unfulfilled") ||
                    String(cell).includes("Pending") ||
                    String(cell).includes("low") ? (
                    <span className="status-pill warning">{cell}</span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
              <td>
                <button
                  className="row-action"
                  type="button"
                  aria-label="Row actions"
                >
                  <MoreHorizontal size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
