/* global electronicErpDesktop from preload */
const api = window.electronicErpDesktop;

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  $(id).textContent = value == null || value === "" ? "—" : String(value);
}

async function refresh() {
  const [state, paths, status, updates] = await Promise.all([
    api.getFirstRunState(),
    api.getPaths(),
    api.getStatus(),
    api.checkForUpdates().catch(() => null),
  ]);

  setText("device-id", state.deviceId);
  setText("db-path", paths.databaseFile);
  setText("integrity", status.integrity?.ok ? `ok (${status.integrity.detail})` : status.integrity?.detail);
  setText("provisioned", state.provisioned ? "yes" : "no");
  setText("first-run-message", state.message);
  setText("version", `v${status.version ?? "0.1.0"}`);

  const pill = $("online-pill");
  pill.textContent = state.online ? "Online" : "Offline";
  pill.className = `pill ${state.online ? "online" : "offline"}`;

  $("provision-form").hidden = state.provisioned;
  if (updates) setText("update-status", updates.message);
}

$("provision-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const err = $("form-error");
  err.hidden = true;
  const data = Object.fromEntries(new FormData(event.target));
  try {
    await api.provisionDevice(data);
    await refresh();
  } catch (e) {
    err.hidden = false;
    err.textContent = e?.message || String(e);
  }
});

$("btn-toggle-online").addEventListener("click", async () => {
  const state = await api.getFirstRunState();
  await api.setConnectivity(!state.online);
  await refresh();
});

$("btn-smoke-sale").addEventListener("click", async () => {
  const state = await api.getFirstRunState();
  if (!state.provisioned || !state.device) {
    alert("Provision the device first.");
    return;
  }
  const sale = {
    organizationId: state.device.organizationId,
    branchId: state.device.branchId,
    warehouseId: state.device.branchId,
    idempotencyKey: crypto.randomUUID(),
    discountTotal: 0,
    items: [
      {
        productId: crypto.randomUUID(),
        unitId: crypto.randomUUID(),
        qty: 1,
        unitPrice: 100,
        discount: 0,
        tax: 0,
      },
    ],
  };
  try {
    const row = await api.postOfflineSale({ sale });
    alert(`Sale posted: ${row.invoiceNumber}`);
    await refreshPending();
  } catch (e) {
    alert(e?.message || String(e));
  }
});

async function refreshPending() {
  const rows = await api.listPendingSales();
  $("pending-sales").textContent = JSON.stringify(rows, null, 2);
}

$("btn-pending").addEventListener("click", () => refreshPending());

$("btn-hw").addEventListener("click", async () => {
  const status = await api.hardwareStatus();
  $("hw-status").textContent = JSON.stringify(status, null, 2);
});

$("btn-print").addEventListener("click", async () => {
  const result = await api.printReceipt({
    payload: "Electronic ERP\\nTest receipt\\n",
    copies: 1,
  });
  alert(JSON.stringify(result));
});

$("btn-drawer").addEventListener("click", async () => {
  const result = await api.openCashDrawer();
  alert(JSON.stringify(result));
});

$("btn-check-update").addEventListener("click", async () => {
  const status = await api.checkForUpdates();
  setText("update-status", status.message);
});

$("btn-download-update").addEventListener("click", async () => {
  const status = await api.downloadUpdate();
  setText("update-status", status.message);
});

$("btn-install-update").addEventListener("click", async () => {
  const status = await api.quitAndInstall();
  setText("update-status", status.message);
});

refresh().catch((e) => {
  $("first-run-message").textContent = e?.message || String(e);
});
