/** Shared avatar initials / image for header and profile page. */
export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = "md",
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (name?.trim() || email?.trim() || "?").slice(0, 2).toUpperCase();
  const dims =
    size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${dims} shrink-0 rounded-full border border-[var(--erp-border)] object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--erp-brand-soft)] font-semibold text-[var(--erp-brand)]`}
    >
      {initials}
    </div>
  );
}
