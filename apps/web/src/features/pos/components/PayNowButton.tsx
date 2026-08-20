import { POSButton, type POSButtonProps } from "../design-system";
import { posCn } from "../design-system/posCn";

export function PayNowButton({
  className,
  children = "PAY NOW →",
  ...props
}: POSButtonProps) {
  return (
    <POSButton
      variant="primary"
      size="lg"
      className={posCn("pos-pay-now", className)}
      {...props}
    >
      {children}
    </POSButton>
  );
}
