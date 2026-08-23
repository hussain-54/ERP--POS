import type { FormHTMLAttributes, ReactNode } from "react";

export function Form({
  children,
  className,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode }) {
  return (
    <form className={["flex flex-col gap-3", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </form>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">{children}</div>;
}
