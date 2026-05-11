import {
  BadgePercent,
  BarChart3,
  CircleDollarSign,
  Globe,
  Home,
  Mail,
  Megaphone,
  Package,
  SearchCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
} from "lucide-react";

export const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "products", label: "Products", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "finances", label: "Finances", icon: CircleDollarSign },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "discounts", label: "Discounts", icon: BadgePercent },
];

export const salesChannels = [
  { label: "Online Store", icon: Globe },
  { label: "Point of Sale", icon: Store },
];

export const appItems = [
  { label: "Shopify Email", icon: Mail },
  { label: "Shopify Search & Discovery", icon: SearchCheck },
  { label: "Shopify Flow", icon: Sparkles },
];

export const orders = [
  {
    id: "#1049",
    customer: "Mina Chen",
    channel: "Online Store",
    amount: "$184.00",
    payment: "Paid",
    fulfillment: "Unfulfilled",
  },
  {
    id: "#1048",
    customer: "Rafael Alvarez",
    channel: "Shop",
    amount: "$76.50",
    payment: "Paid",
    fulfillment: "Fulfilled",
  },
  {
    id: "#1047",
    customer: "Priya Nair",
    channel: "POS",
    amount: "$249.99",
    payment: "Pending",
    fulfillment: "On hold",
  },
  {
    id: "#1046",
    customer: "Jordan Smith",
    channel: "Online Store",
    amount: "$42.00",
    payment: "Paid",
    fulfillment: "Archived",
  },
];

export const initialProducts = [
  {
    id: "seed-1",
    title: "Voyager Canvas Tote",
    status: "Active",
    inventory: "126 in stock",
    type: "Bags",
  },
  {
    id: "seed-2",
    title: "Trail Merino Hoodie",
    status: "Active",
    inventory: "18 low stock",
    type: "Apparel",
  },
  {
    id: "seed-3",
    title: "Recharge Bottle",
    status: "Draft",
    inventory: "88 in stock",
    type: "Accessories",
  },
];

export const customers = [
  { name: "Mina Chen", orders: 9, spend: "$1,248", segment: "VIP" },
  { name: "Rafael Alvarez", orders: 3, spend: "$342", segment: "Returning" },
  { name: "Priya Nair", orders: 1, spend: "$249", segment: "New" },
];

export const sectionDetails = {
  content: {
    title: "Content",
    eyebrow: "Metaobjects, files, and store media",
    cards: [
      [
        "Metaobjects",
        "Manage structured entries for size guides, product highlights, and reusable content.",
      ],
      [
        "Files",
        "Upload images, videos, CSVs, and documents for products, themes, and Sidekick analysis.",
      ],
      [
        "Blog content",
        "Create posts and pages that support search, discovery, and customer education.",
      ],
    ],
  },
  analytics: {
    title: "Analytics",
    eyebrow: "Performance overview and reports",
    cards: [
      ["Total sales", "$48,920 across all channels this week."],
      ["Top product", "Voyager Canvas Tote generated $8,420 in revenue."],
      [
        "Live view",
        "42 active visitors, 6 active carts, and 2 checkouts started.",
      ],
      [
        "Reports",
        "Sales, acquisition, customer behavior, sessions, and device performance.",
      ],
    ],
  },
  marketing: {
    title: "Marketing",
    eyebrow: "Campaigns, channels, and automations",
    cards: [
      [
        "Campaigns",
        "Email, ads, and promotion calendars with attributed sales.",
      ],
      [
        "Automations",
        "Abandoned cart, back-in-stock, post-purchase, and win-back templates.",
      ],
      [
        "Recommendations",
        "Suggested apps and channels based on store activity.",
      ],
    ],
  },
  discounts: {
    title: "Discounts",
    eyebrow: "Codes and automatic promotions",
    cards: [
      ["WELCOME15", "15% off for first-time customers. Ends May 8."],
      ["Free shipping", "Automatic discount for orders over $75."],
      ["BOGO Socks", "Buy one, get one 50% off selected accessories."],
    ],
  },
  sales: {
    title: "Sales channels",
    eyebrow: "Online, offline, and marketplace selling",
    cards: [
      [
        "Online Store",
        "Themes, blog posts, pages, navigation, and preferences.",
      ],
      [
        "Shop App",
        "Mobile discovery, customer profiles, and Shop Pay performance.",
      ],
      [
        "Point of Sale",
        "Retail inventory, registers, locations, and staff permissions.",
      ],
      ["Inbox", "Customer conversations and chat availability."],
    ],
  },
  apps: {
    title: "Apps",
    eyebrow: "Installed apps and recommendations",
    cards: [
      [
        "Pinned apps",
        "Flow, Inbox, Email, Reviews, and Loyalty appear in the sidebar.",
      ],
      [
        "App Store",
        "Browse marketing, shipping, analytics, subscriptions, and merchandising apps.",
      ],
      [
        "Settings",
        "Manage permissions, support links, and app removals from settings.",
      ],
    ],
  },
  finances: {
    title: "Finances",
    eyebrow: "Payouts, balances, billing, and tax",
    cards: [
      ["Summary", "$12,840 pending payout with next transfer on Friday."],
      ["Balance", "Shopify Balance card ending 4921 has $8,604 available."],
      [
        "Billing",
        "Review subscription, transaction fees, app charges, and invoices.",
      ],
      ["Taxes", "Configure regions, registrations, and auto-calculated rates."],
    ],
  },
};
