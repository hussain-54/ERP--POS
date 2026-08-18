import { POSButton, type POSButtonProps } from "../design-system";
import { posCn } from "../design-system/posCn";

export function QuotationButton({
  className,
  children = "QUOTATION",
  ...props
}: POSButtonProps) {
  return (
    <POSButton variant="ghost" className={posCn("pos-quotation", className)} {...props}>
      {children}
    </POSButton>
  );
}
