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
  setText("config-path", paths.configDir || paths.userData || "—");
  setText("provisioned", state.provisioned ? "yes" : "no");
  setText("first-run-message", state.message);
  setText("version", `v${status.version ?? "0.1.0"}`);

  const pill = $("online-pill");
  pill.textContent = state.online ? "🟢 Connected" : "🔴 Connection Required";
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

$("btn-hw").addEventListener("click", async () => {
  const status = await api.hardwareStatus();
  $("hw-status").textContent = JSON.stringify(status, null, 2);
});

$("btn-print").addEventListener("click", async () => {
  const result = await api.printReceipt({
    payload: "ERP System\\nTest receipt\\n",
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
