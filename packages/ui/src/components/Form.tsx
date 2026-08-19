import type { FormHTMLAttributes, ReactNode } from "react";

export function Form({
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode }) {
  return (
    <form className="flex flex-col gap-3" {...props}>
      {children}
    </form>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 pt-2">{children}</div>;
}
