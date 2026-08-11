const fs = require("node:fs");

const pc = fs.readFileSync("packages/domain/src/pos-cart.ts", "utf8");
const pv = fs.readFileSync("packages/domain/src/pos-validation.ts", "utf8");
const us = fs.readFileSync("apps/web/src/features/pos/session/usePosSession.ts", "utf8");
const page = fs.readFileSync("apps/web/src/features/pos/PosPage.tsx", "utf8");

const checks = [
  ["pos-cart must not import pos-validation", !/pos-validation/.test(pc)],
  ["pos-validation may import pos-cart", /pos-cart\.js/.test(pv)],
  ["usePosSession must not import PosPage", !/PosPage/.test(us)],
  ["PosPage must use usePosSession", /usePosSession/.test(page)],
  ["PosPage must not define local cart tax math", !/function lineTax|taxForLineNet\(/.test(page)],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "FAIL"}: ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("No circular POS session/domain cycles detected.");
