import { forwardRef } from "react";
import { POSInput, type POSInputProps } from "./POSInput";
import { posCn } from "./posCn";

export type POSSearchProps = Omit<POSInputProps, "type"> & { compact?: boolean };

export const POSSearch = forwardRef<HTMLInputElement, POSSearchProps>(function POSSearch(
  { placeholder = "Search products, SKU, barcode…", className, compact, ...props },
  ref,
) {
  return (
    <POSInput
      ref={ref}
      type="search"
      placeholder={placeholder}
      leftAddon={<span aria-hidden="true">⌕</span>}
      className={posCn(!compact && "pos-search-input", className)}
      {...props}
    />
  );
});
