import {
  ERP_NAV_SECTIONS,
  type ErpNavChild,
} from "@/app/modules";

const SYSTEM_ADMIN_GROUPS: ReadonlyArray<{ title: string; childTitles: readonly string[] }> = [
  {
    title: "Organization",
    childTitles: ["Company", "Localization", "Currency", "Language", "Date & Numbering", "Templates"],
  },
  {
    title: "Operations",
    childTitles: ["Barcode", "POS", "Email", "SMS", "Storage", "Logs", "Maintenance", "Import", "Export", "Import Templates"],
  },
];

function systemChildren(): ErpNavChild[] {
  return (ERP_NAV_SECTIONS.find((section) => section.id === "39")?.children ?? []).filter(
    (child) => child.sidebar !== false,
  );
}

export function systemAdminNavGroups() {
  const children = systemChildren();
  return SYSTEM_ADMIN_GROUPS.map((group) => ({
    title: group.title,
    items: group.childTitles
      .map((title) => children.find((child) => child.title === title))
      .filter((child): child is ErpNavChild => Boolean(child)),
  })).filter((group) => group.items.length > 0);
}
