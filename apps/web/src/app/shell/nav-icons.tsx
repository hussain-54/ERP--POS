import type { ReactNode } from "react";
import type { NavIconName } from "@/app/modules";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS: Record<NavIconName, ReactNode> = {
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Icon>
  ),
  products: (
    <Icon>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </Icon>
  ),
  barcode: (
    <Icon>
      <path d="M4 6v12M7 6v12M9 6v12M13 6v12M16 6v12M20 6v12" />
    </Icon>
  ),
  camera: (
    <Icon>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </Icon>
  ),
  pos: (
    <Icon>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h8M8 14h4" />
    </Icon>
  ),
  quote: (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </Icon>
  ),
  orders: (
    <Icon>
      <path d="M6 2h12v4H6zM6 6v14l6-3 6 3V6" />
    </Icon>
  ),
  delivery: (
    <Icon>
      <rect x="1" y="7" width="15" height="10" rx="1" />
      <path d="M16 10h4l3 4v3h-7" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </Icon>
  ),
  purchases: (
    <Icon>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </Icon>
  ),
  inventory: (
    <Icon>
      <path d="M3 7h18M5 7v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 7V5a3 3 0 0 1 6 0v2" />
    </Icon>
  ),
  warehouse: (
    <Icon>
      <path d="M3 21V9l9-6 9 6v12M3 21h18M9 21v-6h6v6" />
    </Icon>
  ),
  customers: (
    <Icon>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  suppliers: (
    <Icon>
      <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
    </Icon>
  ),
  service: (
    <Icon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Icon>
  ),
  warranty: (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  ),
  accounts: (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Icon>
  ),
  banking: (
    <Icon>
      <path d="M3 21h18M3 10h18M5 6l7-4 7 4M6 10v11M10 10v11M14 10v11M18 10v11" />
    </Icon>
  ),
  crm: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Icon>
  ),
  reports: (
    <Icon>
      <path d="M4 19V5M4 19h16M8 17v-6M12 17V8M16 17v-3" />
    </Icon>
  ),
  salesman: (
    <Icon>
      <circle cx="12" cy="7" r="4" />
      <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
    </Icon>
  ),
  expenses: (
    <Icon>
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Icon>
  ),
  installments: (
    <Icon>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Icon>
  ),
  loyalty: (
    <Icon>
      <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5" />
    </Icon>
  ),
  documents: (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </Icon>
  ),
  approvals: (
    <Icon>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Icon>
  ),
  users: (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </Icon>
  ),
  permissions: (
    <Icon>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  ),
  audit: (
    <Icon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  ),
  notifications: (
    <Icon>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  ),
  branches: (
    <Icon>
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="12" cy="18" r="3" />
      <path d="M8.5 8.5 11 15M15.5 8.5 13 15" />
    </Icon>
  ),
  tax: (
    <Icon>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7H14" />
    </Icon>
  ),
  import: (
    <Icon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </Icon>
  ),
  printing: (
    <Icon>
      <path d="M6 9V2h12v7" />
      <rect x="6" y="14" width="12" height="8" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    </Icon>
  ),
  backup: (
    <Icon>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5" />
      <path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
    </Icon>
  ),
  devices: (
    <Icon>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </Icon>
  ),
  industry: (
    <Icon>
      <path d="M2 20h20M4 20V10l6 4V10l6 4V4h4v16" />
    </Icon>
  ),
  customize: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  ),
  rules: (
    <Icon>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Icon>
  ),
  admin: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M4.5 12.5 3 11l2-3.5 2 .5M19.5 12.5 21 11l-2-3.5-2 .5M12 4.5V3M12 21v-1.5" />
    </Icon>
  ),
};

export function NavIcon({ name }: { name: NavIconName }) {
  return <>{ICONS[name]}</>;
}
