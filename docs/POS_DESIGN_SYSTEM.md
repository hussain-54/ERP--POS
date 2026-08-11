# POS Design System (Phase 3)

Scoped under `.pos-terminal` via `pos-tokens.css`. Own visual identity: navy sidebar, light workspace, indigo primary, purple secondary — not screenshot branding.

## Import

```ts
import {
  POSLayout,
  POSSidebar,
  POSTopbar,
  POSButton,
  // …
} from "@/features/pos/design-system";
```

## Tokens

CSS variables: `--pos-navy`, `--pos-primary`, `--pos-secondary`, `--pos-success`, `--pos-warning`, `--pos-danger`, `--pos-bg`, `--pos-workspace`, `--pos-border`, `--pos-radius*`, `--pos-shadow*`, `--pos-ring`.

## Primitives

Layout: `POSLayout`, `POSSidebar`, `POSTopbar`, `POSPageHeader`, `POSActionBar`  
Surfaces: `POSCard`, `POSStatCard`, `POSTable*`  
Controls: `POSButton`, `POSIconButton`, `POSInput`, `POSSearch`, `POSSelect`  
Feedback: `POSBadge`, `POSEmptyState`, `POSLoadingState`, `POSModal`, `POSDrawer`, `POSConfirmDialog`, `POSStepper`  
Toast: `usePOSToast` / `POSToastProvider` (reuses ERP Toast — no second stack)

Legacy `PosSidebar` / `PosHeader` re-export `POSSidebar` / `POSTopbar`.
