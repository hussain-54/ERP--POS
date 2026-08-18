import { useRef, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { canShowNavItem } from "@/app/modules";
import { isPosShellNavActive, POS_SHELL_NAV } from "../pos-ownership";
import { POSNavIcon } from "./POSNavIcon";
import { posCn } from "./posCn";

function navClass(active: boolean) {
  if (active) return "pos-nav-active font-medium";
  return "text-[var(--pos-nav-ink)] hover:bg-white/10";
}

export function POSNav({
  onNavigate,
  grantedCount = 0,
  hasPermission = () => true,
}: {
  onNavigate: () => void;
  grantedCount?: number;
  hasPermission?: (key: string) => boolean;
}) {
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    const items = [...(navRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-pos-nav]") ?? [])];
    if (!items.length) return;
    const current = items.indexOf(event.target as HTMLAnchorElement);
    const index = current < 0 ? 0 : current;
    event.preventDefault();
    if (event.key === "Home") {
      items[0]?.focus();
      return;
    }
    if (event.key === "End") {
      items[items.length - 1]?.focus();
      return;
    }
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next = (index + delta + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <nav
      ref={navRef}
      id="pos-environment-nav"
      aria-label="POS navigation"
      className="flex flex-col gap-1 p-2"
      onKeyDown={onKeyDown}
    >
      {POS_SHELL_NAV.map((item) => {
        if (!canShowNavItem(item.permission, grantedCount, hasPermission)) return null;
        const active = isPosShellNavActive(item, location.pathname);
        return (
          <Link
            key={item.title}
            to={item.path}
            data-pos-nav={item.icon}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={posCn("pos-nav-link", navClass(active))}
          >
            <POSNavIcon name={item.icon} />
            <span className="min-w-0 whitespace-normal break-words">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
