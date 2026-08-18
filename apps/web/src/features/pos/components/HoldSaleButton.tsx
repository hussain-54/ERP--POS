import { POSButton, type POSButtonProps } from "../design-system";
import { posCn } from "../design-system/posCn";

export function HoldSaleButton({
  className,
  children = "HOLD SALE",
  ...props
}: POSButtonProps) {
  return (
    <POSButton variant="warning" className={posCn("pos-hold-sale", className)} {...props}>
      {children}
    </POSButton>
  );
}
