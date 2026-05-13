import { useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { HomeDashboard } from "./components/dashboard/HomeDashboard";
import { CustomersSection, DetailSection, OrdersSection, ProductsSection } from "./components/dashboard/sections";
import { SidekickPanel } from "./components/sidekick/SidekickPanel";
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

export default App;
