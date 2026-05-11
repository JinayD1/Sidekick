import {
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CreditCard,
  MoreHorizontal,
  ShoppingBag,
} from "lucide-react";

export function HomeDashboard() {
  return (
    <div className="home-dashboard">
      <div className="home-controls">
        <button type="button">
          Today
          <ChevronDown size={14} />
        </button>
        <button type="button">
          All channels
          <ChevronDown size={14} />
        </button>
        <span className="live-pill">
          <i />
          123 live visitors
        </span>
        <span className="payout-pill">Next payout: $123.45</span>
      </div>

      <section className="analytics-card">
        <div className="analytics-metrics">
          {[
            ["Sessions", "264", "2%"],
            ["Total sales", "$226.11", "1.25%"],
            ["Total orders", "5", "1.25%"],
            ["Conversion rate", "15.79%", "1.50%"],
          ].map(([label, value, delta]) => (
            <div className="analytics-metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <em>↗ {delta}</em>
            </div>
          ))}
          <ChevronDown className="collapse-icon" size={18} />
        </div>
        <div className="chart-area" aria-label="Sales chart">
          <div className="chart-y-axis">
            <span>12K</span>
            <span>6K</span>
            <span>0K</span>
          </div>
          <svg viewBox="0 0 820 230" role="presentation" aria-hidden="true">
            <path className="chart-grid" d="M24 48H796M24 115H796M24 182H796" />
            <path
              className="chart-line"
              d="M26 164C82 160 118 130 164 118C210 106 230 94 282 96C336 98 354 96 398 88C444 80 459 35 512 38C562 40 580 66 625 74C682 84 692 142 744 153C770 158 788 162 800 162"
            />
          </svg>
          <div className="chart-x-axis">
            <span>12:00 AM</span>
            <span>6:00 AM</span>
            <span>12:00 PM</span>
            <span>6:00 PM</span>
            <span>12:00 AM</span>
          </div>
        </div>
      </section>

      <section className="todo-card">
        <h2>Things to do next</h2>
        {[
          ["5 orders to fulfill", ShoppingBag],
          ["1 payment to capture", CreditCard],
        ].map(([label, Icon]) => (
          <button className="todo-row" type="button" key={label}>
            <Icon size={19} />
            <span>{label}</span>
            <ChevronRight size={18} />
          </button>
        ))}
      </section>

      <section className="audience-card">
        <div className="audience-header">
          <div>
            <h2>Grow your audience</h2>
            <p>Reach more shoppers and increase traffic to your store</p>
          </div>
          <div className="card-tools">
            <MoreHorizontal size={18} />
            <ChevronDown size={18} />
          </div>
        </div>
        <div className="progress-row">
          <span>0 of 5 tasks complete</span>
          <div>
            <i />
          </div>
        </div>
        <div className="featured-task">
          <Circle size={24} />
          <div>
            <h3>Offer a first purchase upsell</h3>
            <p>
              Up to 95% of sales can come from upsells if they&apos;re offered
              and they cost less than acquiring a new customer. Turn your
              customers into repeat buyers by automating your first purchase
              upsell offers.
            </p>
            <button className="dark-action" type="button">
              Enable upsell automation workflow
            </button>
          </div>
          <div className="mini-preview" aria-hidden="true">
            <div className="mini-top" />
            <div className="mini-body">
              <span />
              <span />
              <strong />
            </div>
            <div className="mini-cart">+</div>
          </div>
        </div>
        {[
          "Increase store visibility with SEO",
          "Reward customers for referrals",
          "Promote your products on TikTok",
          "Collaborate with influencers",
        ].map((task) => (
          <button className="audience-task" type="button" key={task}>
            <CircleCheck size={23} />
            <span>{task}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
