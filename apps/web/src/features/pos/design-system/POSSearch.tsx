import { forwardRef } from "react";
import { POSInput, type POSInputProps } from "./POSInput";

export type POSSearchProps = Omit<POSInputProps, "type">;

export const POSSearch = forwardRef<HTMLInputElement, POSSearchProps>(function POSSearch(
  { placeholder = "Search products, SKU, barcode…", ...props },
  ref,
) {
  return (
    <POSInput
      ref={ref}
      type="search"
      placeholder={placeholder}
      leftAddon={<span aria-hidden="true">⌕</span>}
      {...props}
    />
  );
});
