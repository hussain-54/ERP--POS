import {
  POS_SENSITIVE_PERMISSIONS,
  POS_UNAVAILABLE_SENSITIVE_ACTIONS,
  canActOnOwnedOrForeignHold,
  canPosDiscount,
  canPosPriceOverride,
  posDiscountRoleFromPermissions,
} from "@electronic-erp/domain";

export {
  POS_SENSITIVE_PERMISSIONS,
  POS_UNAVAILABLE_SENSITIVE_ACTIONS,
  canActOnOwnedOrForeignHold,
  canPosDiscount,
  canPosPriceOverride,
  posDiscountRoleFromPermissions,
};

type HasPermission = (key: string) => boolean;

function grantedFrom(hasPermission: HasPermission, keys: readonly string[]): string[] {
  return keys.filter((key) => hasPermission(key));
}

const POS_GRANT_PROBE = [
  POS_SENSITIVE_PERMISSIONS.sell,
  POS_SENSITIVE_PERMISSIONS.hold,
  POS_SENSITIVE_PERMISSIONS.resumeAny,
  POS_SENSITIVE_PERMISSIONS.return,
  POS_SENSITIVE_PERMISSIONS.shift,
  POS_SENSITIVE_PERMISSIONS.discountCashier,
  POS_SENSITIVE_PERMISSIONS.discountSupervisor,
  POS_SENSITIVE_PERMISSIONS.discountManager,
  POS_SENSITIVE_PERMISSIONS.discountOwner,
  POS_SENSITIVE_PERMISSIONS.discountSpecial,
  POS_SENSITIVE_PERMISSIONS.creditApprove,
  POS_SENSITIVE_PERMISSIONS.installmentsManage,
  POS_SENSITIVE_PERMISSIONS.paymentsReceive,
  POS_SENSITIVE_PERMISSIONS.cashDrawerOpen,
] as const;

export function posGrantedKeys(hasPermission: HasPermission): string[] {
  return grantedFrom(hasPermission, POS_GRANT_PROBE);
}

export function posActionFlags(hasPermission: HasPermission) {
  const granted = posGrantedKeys(hasPermission);
  return {
    canSell: hasPermission(POS_SENSITIVE_PERMISSIONS.sell),
    canHold: hasPermission(POS_SENSITIVE_PERMISSIONS.hold),
    canResumeAny: hasPermission(POS_SENSITIVE_PERMISSIONS.resumeAny),
    canReturn: hasPermission(POS_SENSITIVE_PERMISSIONS.return),
    canShift: hasPermission(POS_SENSITIVE_PERMISSIONS.shift),
    canDiscount: canPosDiscount(granted),
    canPriceOverride: canPosPriceOverride(granted),
    discountRole: posDiscountRoleFromPermissions(granted),
    canCreditApprove: hasPermission(POS_SENSITIVE_PERMISSIONS.creditApprove),
    canInstallment: hasPermission(POS_SENSITIVE_PERMISSIONS.installmentsManage),
    canReceivePayments: hasPermission(POS_SENSITIVE_PERMISSIONS.paymentsReceive),
    canOpenDrawer: hasPermission(POS_SENSITIVE_PERMISSIONS.cashDrawerOpen),
  };
}
