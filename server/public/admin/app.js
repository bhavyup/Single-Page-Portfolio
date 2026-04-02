"use strict";

const STORAGE_KEY = "portfolio_admin_saved_draft_v1";
const PREV_PUBLISHED_KEY = "portfolio_admin_previous_published_v1";
const DOCK_POSITION_KEY = "portfolio_admin_dock_pos_v1";
const HISTORY_LIMIT = 120;

const state = {
  csrfToken: "",
  content: null,
  previousPublished: null,
  draftContent: null,
  loadedDataset: "currentPublished",
  activeSection: "dashboard",
  dirtySections: new Set(),
  history: [],
  historyIndex: -1,
  historyTimer: null,
  visibleTooltipTarget: null,
  draggingDock: false,
  dockOffsetX: 0,
  dockOffsetY: 0,
  confirmResolver: null,
  assets: [],
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const authCard = $("#authCard");
const adminPanel = $("#adminPanel");
const loginForm = $("#loginForm");
const loginMessage = $("#loginMessage");
const sectionNav = $("#sectionNav");
const editorPanes = $("#editorPanes");
const dashboardPane = $("#dashboardPane");
const activeTitle = $("#activeTitle");
const workspaceHelp = $(".workspace-help");
const globalStatus = $("#globalStatus");
const auditList = $("#auditList");
const assetList = $("#assetList");
const assetUploadForm = $("#assetUploadForm");
const assetFileInput = $("#assetFileInput");
const assetUploadHint = $("#assetUploadHint");
const assetUrlOptions = $("#assetUrlOptions");
const toastStack = $("#toastStack");
const floatingTooltip = $("#floatingTooltip");
const actionDock = $("#actionDock");
const actionDockHandle = $("#actionDockHandle");
const snapshotPill = $("#snapshotPill");

const confirmModal = $("#confirmModal");
const confirmTitle = $("#confirmTitle");
const confirmMessage = $("#confirmMessage");
const confirmCancelBtn = $("#confirmCancelBtn");
const confirmOkBtn = $("#confirmOkBtn");

const lastPublishedBtn = $("#lastPublishedBtn");
const currentPublishedBtn = $("#currentPublishedBtn");
const undoBtn = $("#undoBtn");
const redoBtn = $("#redoBtn");
const refreshBtn = $("#refreshBtn");
const saveDraftBtn = $("#saveDraftBtn");
const discardDraftBtn = $("#discardDraftBtn");
const publishBtn = $("#publishBtn");
const logoutBtn = $("#logoutBtn");

const sectionDescriptions = {
  seo: "This controls the browser tab title and social preview metadata.",
  nav: "This controls your top navigation and mobile menu links.",
  hero: "This controls your hero headline, actions, social badges and intro stats.",
  sections: "This controls section numbers and titles shown in the page flow.",
  origin: "This controls the cinematic origin sequence copy and cards.",
  about: "This controls your about quote, summary, columns and CTA actions.",
  skills: "This controls marquee skills and grouped expertise cards.",
  work: "This controls project cards, links, placeholders and work CTA.",
  journey: "This controls education, certifications and currently exploring blocks.",
  contact: "This controls contact details, social links and form settings.",
  footer: "This controls footer branding, copy and back-to-top link.",
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  return JSON.stringify(value ?? null);
}

function showToast(message, type = "success") {
  if (!toastStack) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastStack.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => toast.remove(), 170);
  }, 2600);
}

function setGlobalStatus(text, isError = false) {
  if (!globalStatus) return;
  globalStatus.textContent = text;
  globalStatus.style.color = isError ? "#ff91ab" : "#a5b5da";
}

function canUseStorage() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readStorageJson(key) {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStorageJson(key, value) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorage(key) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(key);
}

function readSavedDraft() {
  const parsed = readStorageJson(STORAGE_KEY);
  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.data || typeof parsed.data !== "object") return null;
  return parsed;
}

function persistSavedDraftSnapshot() {
  if (!state.draftContent) return;
  writeStorageJson(STORAGE_KEY, {
    savedAt: new Date().toISOString(),
    activeSection: state.activeSection,
    data: state.draftContent,
  });
}

function clearSavedDraftSnapshot() {
  removeStorage(STORAGE_KEY);
}

function readPreviousPublishedSnapshot() {
  const parsed = readStorageJson(PREV_PUBLISHED_KEY);
  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.data || typeof parsed.data !== "object") return null;
  return parsed;
}

function persistPreviousPublishedSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;
  writeStorageJson(PREV_PUBLISHED_KEY, {
    savedAt: new Date().toISOString(),
    data: snapshot,
  });
}

function updatePublishedButtons() {
  if (lastPublishedBtn) lastPublishedBtn.disabled = !state.previousPublished;
}

function updateSnapshotPill() {
  if (!snapshotPill) return;
  const map = {
    draft: "Draft",
    previousPublished: "Previous Published",
    currentPublished: "Current Published",
  };
  snapshotPill.textContent = map[state.loadedDataset] || "Draft";
}

function resolveConfirm(result) {
  if (!state.confirmResolver) return;
  const resolver = state.confirmResolver;
  state.confirmResolver = null;
  confirmModal?.classList.remove("is-open");
  confirmModal?.setAttribute("aria-hidden", "true");
  resolver(result);
}

function openConfirmModal({ title, message, confirmLabel = "Confirm", danger = false }) {
  if (!confirmModal || !confirmTitle || !confirmMessage || !confirmOkBtn) {
    return Promise.resolve(true);
  }

  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOkBtn.textContent = confirmLabel;
  confirmOkBtn.classList.toggle("danger", !!danger);
  confirmOkBtn.classList.toggle("primary", !danger);
  confirmModal.classList.add("is-open");
  confirmModal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    state.confirmResolver = resolve;
    confirmCancelBtn?.focus();
  });
}

function createRequestHeaders(options = {}) {
  const hasFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const hasExplicitContentType = Object.keys(options.headers || {}).some(
    (key) => key.toLowerCase() === "content-type",
  );

  return {
    ...(hasExplicitContentType || hasFormDataBody ? {} : { "content-type": "application/json" }),
    ...(state.csrfToken ? { "x-csrf-token": state.csrfToken } : {}),
    ...(options.headers || {}),
  };
}

async function ensureCsrf() {
  const res = await fetch("/admin/auth/csrf", {
    method: "GET",
    credentials: "include",
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.csrfToken) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  state.csrfToken = body.csrfToken;
}

async function request(url, options = {}, allowCsrfRetry = true) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: createRequestHeaders(options),
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    return body;
  }

  const errorMessage = body.error || `HTTP ${res.status}`;
  const isCsrfError =
    res.status === 403 &&
    /(csrf token mismatch|missing csrf token)/i.test(String(errorMessage));

  if (allowCsrfRetry && isCsrfError) {
    await ensureCsrf();
    return request(url, options, false);
  }

  throw new Error(errorMessage);
}

async function checkSession() {
  try {
    await request("/admin/auth/session", { method: "GET" });
    return true;
  } catch {
    return false;
  }
}

function formatTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function formatStorageMode(storage) {
  if (!storage || typeof storage !== "object") return "Unknown";

  const useDatabase = Boolean(storage.useDatabase);
  const driver = String(storage.driver || "").toLowerCase();

  if (useDatabase || driver === "database") {
    const dbName = storage.mongoDbName ? ` (${storage.mongoDbName})` : "";
    return `Database${dbName}`;
  }

  return "File";
}

function formatBytes(size) {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetSourceLabel(source) {
  const map = {
    blob: "Blob Upload",
    "local-upload": "Local Upload",
    "local-static": "Bundled Asset",
  };
  return map[source] || "Asset";
}

function isLinkLikePath(path) {
  const key = String(path[path.length - 1] || "").toLowerCase();
  return ["href", "src", "url", "file", "image", "video", "pdf", "document"].some((token) =>
    key.includes(token),
  );
}

function renderAssetOptions() {
  if (!assetUrlOptions) return;
  assetUrlOptions.innerHTML = state.assets
    .map((asset) => `<option value="${escapeHtml(asset.url)}">${escapeHtml(asset.name)}</option>`)
    .join("");
}

function renderAssetList() {
  if (!assetList) return;

  if (!state.assets.length) {
    assetList.innerHTML = "<li>No uploaded assets yet.</li>";
    renderAssetOptions();
    return;
  }

  assetList.innerHTML = state.assets
    .map((asset) => {
      const deleteButton = asset.deletable
        ? `<button type="button" class="ghost danger" data-delete-asset-id="${escapeHtml(asset.id || "")}" data-delete-asset-source="${escapeHtml(asset.source || "")}" data-delete-asset-name="${escapeHtml(asset.name || "")}" data-delete-asset-url="${escapeHtml(asset.url || "")}" data-delete-asset-raw-url="${escapeHtml(asset.rawUrl || "")}">Delete</button>`
        : "";

      return `<li><strong>${escapeHtml(asset.name)}</strong><span class="asset-list__meta">${escapeHtml(assetSourceLabel(asset.source))} • ${escapeHtml(asset.url)} • ${escapeHtml(formatBytes(asset.size))} • ${escapeHtml(formatTime(asset.uploadedAt))}</span><div class="asset-list__actions"><button type="button" class="ghost" data-copy-asset-url="${escapeHtml(asset.url)}">Copy URL</button>${deleteButton}</div></li>`;
    })
    .join("");

  renderAssetOptions();
}

async function loadAssets(showErrors = false) {
  if (!assetList) return;

  try {
    const res = await request("/admin/api/assets", { method: "GET" });
    state.assets = Array.isArray(res.data)
      ? res.data.map((asset) => ({
          ...asset,
          deletable: Boolean(asset.deletable),
          source: asset.source || "blob",
        }))
      : [];
    renderAssetList();

    if (assetUploadHint) {
      assetUploadHint.textContent = "Allowed: images, videos, pdf/docs, txt, zip (max 25MB)";
    }
  } catch (error) {
    state.assets = [];
    renderAssetList();
    if (assetUploadHint) {
      assetUploadHint.textContent = error.message;
    }
    if (showErrors) {
      showToast(error.message, "error");
    }
  }
}

async function copyAssetUrl(url) {
  try {
    const clipboard = window?.navigator?.clipboard;
    if (!clipboard) {
      throw new Error("Clipboard unavailable");
    }
    await clipboard.writeText(url);
    showToast("Asset URL copied.", "success");
  } catch {
    showToast("Copy failed. Copy manually from the list.", "warn");
  }
}

async function deleteAsset(asset) {
  if (!asset || !asset.deletable) {
    showToast("This asset is read-only.", "warn");
    return;
  }

  const ok = await openConfirmModal({
    title: "Delete Asset",
    message: `Delete ${asset.name}? This cannot be undone.`,
    confirmLabel: "Delete",
    danger: true,
  });
  if (!ok) return;

  try {
    await request("/admin/api/assets", {
      method: "DELETE",
      body: JSON.stringify({
        id: asset.id,
        source: asset.source,
        name: asset.name,
        url: asset.url,
        rawUrl: asset.rawUrl,
      }),
    });
    await loadAssets(true);
    await loadAudit();
    showToast("Asset deleted.", "warn");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadHealthSummary() {
  const healthValue = $("#healthValue");
  const storageModeValue = $("#storageModeValue");

  try {
    const health = await request("/api/health", { method: "GET" });
    if (healthValue) {
      healthValue.textContent =
        String(health?.status || "").toLowerCase() === "ok" ? "Healthy" : "Degraded";
    }
    if (storageModeValue) {
      storageModeValue.textContent = formatStorageMode(health?.storage);
    }
  } catch {
    if (healthValue) healthValue.textContent = "Unknown";
    if (storageModeValue) storageModeValue.textContent = "Unknown";
  }
}

function sectionKeys() {
  return state.draftContent ? Object.keys(state.draftContent) : [];
}

function pathLabel(segment) {
  return String(segment)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}

function pathToText(path) {
  if (!path.length) return "root";
  return path.map(pathLabel).join(" > ");
}

function describeField(section, path) {
  const pathKey = path.join(".");
  const sectionCopy = sectionDescriptions[section] || "This updates your public portfolio content.";

  const hints = [
    { key: "href", text: "This is the link destination users can open." },
    { key: "title", text: "This appears as a visible title in the portfolio UI." },
    { key: "label", text: "This text appears as a label users read in the UI." },
    { key: "description", text: "This appears as descriptive copy in the public page." },
    { key: "iconClass", text: "This controls the icon class used in the public UI." },
    { key: "placeholder", text: "This controls placeholder visual text or image references." },
  ];

  for (const hint of hints) {
    if (pathKey.toLowerCase().includes(hint.key.toLowerCase())) {
      return `${sectionCopy} ${hint.text} Location: ${pathToText(path)}.`;
    }
  }

  return `${sectionCopy} Location: ${pathToText(path)}.`;
}

function makeInfoIcon(section, path) {
  const tip = escapeHtml(describeField(section, path));
  return `<span class="info-wrap"><span class="info-dot" tabindex="0" role="button" aria-label="Field help" data-tooltip="${tip}">i</span></span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function computeDirtySections() {
  const dirty = new Set();
  if (!state.content || !state.draftContent) return dirty;

  for (const key of Object.keys(state.draftContent)) {
    if (stableStringify(state.draftContent[key]) !== stableStringify(state.content[key])) {
      dirty.add(key);
    }
  }

  return dirty;
}

function syncDirtySections() {
  state.dirtySections = computeDirtySections();
}

function updateHistoryButtons() {
  if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = state.historyIndex >= state.history.length - 1;
}

function resetHistory(snapshot) {
  state.history = [deepClone(snapshot)];
  state.historyIndex = 0;
  updateHistoryButtons();
}

function pushHistorySnapshot(snapshot) {
  const current = state.history[state.historyIndex];
  if (current && stableStringify(current) === stableStringify(snapshot)) return;

  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }

  state.history.push(deepClone(snapshot));
  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  }

  state.historyIndex = state.history.length - 1;
  updateHistoryButtons();
}

function captureHistoryNow() {
  if (!state.draftContent) return;
  pushHistorySnapshot(state.draftContent);
}

function queueHistoryCapture() {
  clearTimeout(state.historyTimer);
  state.historyTimer = setTimeout(captureHistoryNow, 240);
}

function applyHistorySnapshot(index) {
  if (index < 0 || index >= state.history.length) return;

  state.historyIndex = index;
  state.draftContent = deepClone(state.history[index]);
  state.loadedDataset = "draft";
  syncDirtySections();
  renderNav();
  renderEditors();
  setActiveSection(state.activeSection);
  updateSnapshotPill();
  updateHistoryButtons();
}

function renderNav() {
  const keys = sectionKeys();
  sectionNav.innerHTML = ["dashboard", ...keys]
    .map((key) => {
      const active = key === state.activeSection ? "active" : "";
      const draftTag = state.dirtySections.has(key) ? " (draft)" : "";
      const label = key === "dashboard" ? "Dashboard" : pathLabel(key);
      return `<button class="${active}" data-section="${key}">${escapeHtml(label + draftTag)}</button>`;
    })
    .join("");
}

function encodePath(path) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(path))));
}

function decodePath(encoded) {
  return JSON.parse(decodeURIComponent(escape(atob(encoded))));
}

function getValueAtPath(root, path) {
  return path.reduce((acc, key) => acc?.[key], root);
}

function setValueAtPath(root, path, value) {
  if (!path.length) return;
  let node = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    node = node[path[i]];
  }
  node[path[path.length - 1]] = value;
}

function removeArrayItem(root, path) {
  const arr = getValueAtPath(root, path.slice(0, -1));
  const index = path[path.length - 1];
  if (Array.isArray(arr)) arr.splice(index, 1);
}

function addArrayItem(root, path) {
  const arr = getValueAtPath(root, path);
  if (!Array.isArray(arr)) return;

  const sample = arr[0];
  if (typeof sample === "string") return arr.push("");
  if (typeof sample === "number") return arr.push(0);
  if (typeof sample === "boolean") return arr.push(false);
  if (sample && typeof sample === "object") return arr.push(deepClone(sample));
  arr.push("");
}

function inferFieldType(value, path) {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  const key = String(path[path.length - 1] || "").toLowerCase();
  if (key.includes("email")) return "email";
  if (key.includes("url") || key.includes("href")) return "url";
  return "text";
}

function renderPrimitiveField(section, path, value) {
  const fieldId = `f_${Math.random().toString(36).slice(2, 10)}`;
  const pathToken = encodePath(path);
  const label = pathLabel(path[path.length - 1]);
  const fieldType = inferFieldType(value, path);
  const shouldSuggestAssets = typeof value === "string" && isLinkLikePath(path);
  const fieldHints = shouldSuggestAssets
    ? ' list="assetUrlOptions" placeholder="Use /assets/... or https://..."'
    : "";

  if (typeof value === "boolean") {
    return `<div class="field-row"><label class="field-label" for="${fieldId}">${escapeHtml(label)} ${makeInfoIcon(section, path)}</label><select id="${fieldId}" class="field-select" data-path="${pathToken}" data-section="${section}"><option value="true" ${value ? "selected" : ""}>True</option><option value="false" ${!value ? "selected" : ""}>False</option></select></div>`;
  }

  if (typeof value === "string" && value.length > 80) {
    return `<div class="field-row"><label class="field-label" for="${fieldId}">${escapeHtml(label)} ${makeInfoIcon(section, path)}</label><textarea id="${fieldId}" class="field-textarea" data-path="${pathToken}" data-section="${section}">${escapeHtml(value)}</textarea></div>`;
  }

  return `<div class="field-row"><label class="field-label" for="${fieldId}">${escapeHtml(label)} ${makeInfoIcon(section, path)}</label><input id="${fieldId}" class="field-input" type="${fieldType}"${fieldHints} data-path="${pathToken}" data-section="${section}" value="${escapeHtml(value)}"></div>`;
}

function renderNode(section, path, node) {
  if (Array.isArray(node)) {
    const pathToken = encodePath(path);
    const itemsHtml = node
      .map((item, index) => {
        const itemPath = [...path, index];
        const itemToken = encodePath(itemPath);
        return `<div class="array-item"><div class="inline-tools"><button type="button" class="ghost" data-remove-item="${itemToken}" data-section="${section}">Remove Item</button></div>${renderNode(section, itemPath, item)}</div>`;
      })
      .join("");

    return `<section class="field-group"><div class="array-header"><div class="field-legend">${escapeHtml(pathLabel(path[path.length - 1] || "Items"))} ${makeInfoIcon(section, path)}</div><button type="button" class="ghost" data-add-item="${pathToken}" data-section="${section}">Add Item</button></div><div class="array-items">${itemsHtml}</div></section>`;
  }

  if (node && typeof node === "object") {
    const entries = Object.entries(node)
      .map(([key, value]) => renderNode(section, [...path, key], value))
      .join("");

    if (!path.length) return `<div>${entries}</div>`;
    return `<section class="field-group"><div class="field-legend">${escapeHtml(pathLabel(path[path.length - 1]))} ${makeInfoIcon(section, path)}</div>${entries}</section>`;
  }

  return renderPrimitiveField(section, path, node);
}

function renderEditors() {
  const keys = sectionKeys();
  editorPanes.style.display = keys.length ? "grid" : "none";

  editorPanes.innerHTML = keys
    .map((key) => {
      const active = key === state.activeSection ? "active" : "";
      const sectionNode = state.draftContent[key];
      const dirtyText = state.dirtySections.has(key) ? "Draft pending" : "No local edits";

      return `<article class="editor-pane ${active}" data-pane="${key}"><div class="form-scroll" data-form-scroll="${key}">${renderNode(key, [], sectionNode)}</div><div class="editor-footer"><span class="status" data-status="${key}">${escapeHtml(dirtyText)}</span></div></article>`;
    })
    .join("");
}

function setActiveSection(key) {
  state.activeSection = key;
  renderNav();

  if (key === "dashboard") {
    dashboardPane.style.display = "block";
    editorPanes.style.display = "none";
    activeTitle.textContent = "Dashboard";
    if (workspaceHelp) {
      workspaceHelp.textContent = "";
    }
    return;
  }

  dashboardPane.style.display = "none";
  editorPanes.style.display = "grid";
  activeTitle.innerHTML = `${escapeHtml(pathLabel(key))} ${makeInfoIcon(key, [key])}`;
  if (workspaceHelp) {
    workspaceHelp.textContent = sectionDescriptions[key] || "Edit this section with structured fields.";
  }

  $$(".editor-pane", editorPanes).forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.pane === key);
  });
}

function markSectionDirty(section) {
  state.loadedDataset = "draft";
  state.dirtySections.add(section);
  renderNav();
  updateSnapshotPill();
  const status = editorPanes.querySelector(`[data-status="${section}"]`);
  if (status) status.textContent = "Draft pending";
}

function parseInputValue(input, existingValue) {
  if (typeof existingValue === "number") {
    const parsed = Number(input.value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof existingValue === "boolean") return input.value === "true";
  return input.value;
}

function applyExternalSnapshot(snapshot, successMessage, source) {
  if (!snapshot || typeof snapshot !== "object") return;
  state.draftContent = deepClone(snapshot);
  state.loadedDataset = source || "draft";
  syncDirtySections();
  captureHistoryNow();
  renderNav();
  renderEditors();
  setActiveSection(state.activeSection);
  updateSnapshotPill();
  setGlobalStatus(successMessage);
  showToast(successMessage, "success");
}

async function loadAudit() {
  const res = await request("/admin/api/audit", { method: "GET" });
  auditList.innerHTML = (res.data || [])
    .slice(0, 25)
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.action)}</strong> by ${escapeHtml(item.actor || "system")} <br><small>${escapeHtml(formatTime(item.ts))} | ${escapeHtml(item.ip || "n/a")}</small></li>`,
    )
    .join("");
}

async function loadContent() {
  setGlobalStatus("Loading content...");
  const result = await request("/admin/api/content", { method: "GET" });
  state.content = result.data;

  const previousPublishedPayload = readPreviousPublishedSnapshot();
  state.previousPublished = previousPublishedPayload?.data || null;
  updatePublishedButtons();

  const savedDraft = readSavedDraft();
  if (savedDraft?.data) {
    state.draftContent = deepClone(savedDraft.data);
    state.loadedDataset = "draft";
    setGlobalStatus(`Loaded saved draft snapshot (${formatTime(savedDraft.savedAt)})`);
    showToast("Recovered saved draft snapshot.", "success");
  } else {
    state.draftContent = deepClone(result.data);
    state.loadedDataset = "currentPublished";
    setGlobalStatus("Synced with API");
  }

  syncDirtySections();
  resetHistory(state.draftContent);

  await loadHealthSummary();
  $("#sectionCount").textContent = String(Object.keys(state.content).length);
  $("#lastLoad").textContent = formatTime(result.fetchedAt || new Date().toISOString());

  renderNav();
  renderEditors();
  updateSnapshotPill();
  const nextSection = savedDraft?.activeSection || state.activeSection;
  setActiveSection(nextSection === "dashboard" ? "dashboard" : nextSection);
}

async function bootstrapPanel() {
  await ensureCsrf();
  await loadContent();
  await loadAudit();
  await loadAssets();

  authCard.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  initActionDock();
}

function saveDraftSnapshot() {
  if (!state.draftContent) {
    showToast("Nothing to save yet.", "warn");
    return;
  }
  persistSavedDraftSnapshot();
  showToast("Draft snapshot saved and will survive logout/reload.", "success");
  setGlobalStatus("Draft snapshot saved locally. Publish when ready.");
}

function discardLocalDraft() {
  clearSavedDraftSnapshot();
  if (!state.content) {
    showToast("No published content loaded.", "warn");
    return;
  }

  state.draftContent = deepClone(state.content);
  state.loadedDataset = "currentPublished";
  syncDirtySections();
  resetHistory(state.draftContent);
  renderNav();
  renderEditors();
  updateSnapshotPill();
  setActiveSection(state.activeSection);
  setGlobalStatus("Local draft discarded. Editor reset to current published content.");
  showToast("Local draft discarded.", "warn");
}

async function discardLocalDraftWithConfirm() {
  const ok = await openConfirmModal({
    title: "Discard Local Draft",
    message: "This removes your saved local snapshot and resets the editor to current published data.",
    confirmLabel: "Discard",
    danger: true,
  });
  if (!ok) return;
  discardLocalDraft();
}

function loadLastPublishedToEditor() {
  if (!state.previousPublished) {
    showToast("No previous published snapshot available yet.", "warn");
    return;
  }
  applyExternalSnapshot(state.previousPublished, "Loaded previous published snapshot into editor.", "previousPublished");
}

function loadCurrentPublishedToEditor() {
  if (!state.content) return;
  applyExternalSnapshot(state.content, "Loaded current published snapshot into editor.", "currentPublished");
}

function undoChange() {
  applyHistorySnapshot(state.historyIndex - 1);
}

function redoChange() {
  applyHistorySnapshot(state.historyIndex + 1);
}

function showFloatingTooltip(target) {
  if (!floatingTooltip) return;
  const text = target?.dataset?.tooltip;
  if (!text) return;

  state.visibleTooltipTarget = target;
  floatingTooltip.textContent = text;
  floatingTooltip.classList.add("is-visible");
  floatingTooltip.setAttribute("aria-hidden", "false");
  positionFloatingTooltip(target);
}

function hideFloatingTooltip() {
  if (!floatingTooltip) return;
  state.visibleTooltipTarget = null;
  floatingTooltip.classList.remove("is-visible");
  floatingTooltip.setAttribute("aria-hidden", "true");
}

function positionFloatingTooltip(target) {
  if (!floatingTooltip || !target) return;

  const rect = target.getBoundingClientRect();
  const margin = 10;

  floatingTooltip.style.left = "0px";
  floatingTooltip.style.top = "0px";

  const tipRect = floatingTooltip.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  let top = rect.top - tipRect.height - 10;

  if (top < margin) top = rect.bottom + 10;
  left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

  floatingTooltip.style.left = `${Math.round(left)}px`;
  floatingTooltip.style.top = `${Math.round(top)}px`;
}

function onTooltipEnter(event) {
  const dot = event.target.closest(".info-dot[data-tooltip]");
  if (!dot) return;
  showFloatingTooltip(dot);
}

function onTooltipLeave(event) {
  const dot = event.target.closest(".info-dot[data-tooltip]");
  if (!dot) return;
  hideFloatingTooltip();
}

function clampDockPosition(left, top) {
  const margin = 8;
  const dockRect = actionDock.getBoundingClientRect();
  const maxLeft = window.innerWidth - dockRect.width - margin;
  const maxTop = window.innerHeight - dockRect.height - margin;

  return {
    left: Math.max(margin, Math.min(left, maxLeft)),
    top: Math.max(margin, Math.min(top, maxTop)),
  };
}

function setDockPosition(left, top, persist = false) {
  if (!actionDock) return;
  const clamped = clampDockPosition(left, top);
  actionDock.style.left = `${clamped.left}px`;
  actionDock.style.top = `${clamped.top}px`;
  actionDock.style.right = "auto";
  actionDock.style.bottom = "auto";
  actionDock.style.transform = "none";

  if (persist) {
    writeStorageJson(DOCK_POSITION_KEY, clamped);
  }
}

function initActionDock() {
  if (!actionDock || !actionDockHandle) return;

  if (window.innerWidth <= 1080) {
    actionDock.style.left = "";
    actionDock.style.top = "";
    actionDock.style.right = "";
    actionDock.style.bottom = "";
    actionDock.style.transform = "";
    return;
  }

  const saved = readStorageJson(DOCK_POSITION_KEY);
  if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
    setDockPosition(saved.left, saved.top, false);
  }

  actionDockHandle.onpointerdown = (event) => {
    if (window.innerWidth <= 1080) return;
    if (event.target.closest("button")) return;
    event.preventDefault();

    const rect = actionDock.getBoundingClientRect();
    state.draggingDock = true;
    state.dockOffsetX = event.clientX - rect.left;
    state.dockOffsetY = event.clientY - rect.top;
    actionDock.classList.add("is-dragging");

    actionDockHandle.setPointerCapture(event.pointerId);
  };

  actionDockHandle.onpointermove = (event) => {
    if (!state.draggingDock || window.innerWidth <= 1080) return;
    const left = event.clientX - state.dockOffsetX;
    const top = event.clientY - state.dockOffsetY;
    setDockPosition(left, top, false);
  };

  actionDockHandle.onpointerup = (event) => {
    if (!state.draggingDock) return;
    state.draggingDock = false;
    actionDock.classList.remove("is-dragging");
    actionDockHandle.releasePointerCapture(event.pointerId);

    const rect = actionDock.getBoundingClientRect();
    setDockPosition(rect.left, rect.top, true);
  };
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  loginMessage.textContent = "Authenticating...";

  try {
    await ensureCsrf();
    await request("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
      }),
    });

    loginMessage.textContent = "Access granted.";
    showToast("Welcome to Mission Control.", "success");
    await bootstrapPanel();
  } catch (error) {
    loginMessage.textContent = error.message;
    showToast(error.message, "error");
  }
});

sectionNav?.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-section]");
  if (!target) return;
  setActiveSection(target.dataset.section);
});

editorPanes?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-path][data-section]");
  if (!input) return;

  const section = input.dataset.section;
  const path = decodePath(input.dataset.path);
  const sectionRoot = state.draftContent[section];
  const existing = getValueAtPath(sectionRoot, path);
  const nextValue = parseInputValue(input, existing);
  setValueAtPath(sectionRoot, path, nextValue);
  markSectionDirty(section);
  queueHistoryCapture();
});

editorPanes?.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-item][data-section]");
  if (addButton) {
    const section = addButton.dataset.section;
    const path = decodePath(addButton.dataset.addItem);
    addArrayItem(state.draftContent[section], path);
    markSectionDirty(section);
    captureHistoryNow();
    renderEditors();
    setActiveSection(section);
    showToast("Array item added.", "success");
    return;
  }

  const removeButton = event.target.closest("[data-remove-item][data-section]");
  if (removeButton) {
    const section = removeButton.dataset.section;
    const path = decodePath(removeButton.dataset.removeItem);
    removeArrayItem(state.draftContent[section], path);
    markSectionDirty(section);
    captureHistoryNow();
    renderEditors();
    setActiveSection(section);
    showToast("Array item removed.", "warn");
  }
});

lastPublishedBtn?.addEventListener("click", loadLastPublishedToEditor);
currentPublishedBtn?.addEventListener("click", loadCurrentPublishedToEditor);
undoBtn?.addEventListener("click", undoChange);
redoBtn?.addEventListener("click", redoChange);
saveDraftBtn?.addEventListener("click", saveDraftSnapshot);
discardDraftBtn?.addEventListener("click", discardLocalDraftWithConfirm);

refreshBtn?.addEventListener("click", async () => {
  try {
    await loadContent();
    await loadAudit();
    await loadAssets();
    showToast("Reloaded latest live content from API.", "success");
  } catch (error) {
    setGlobalStatus(error.message, true);
    showToast(error.message, "error");
  }
});

assetUploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = assetFileInput?.files?.[0];
  if (!file) {
    showToast("Select a file first.", "warn");
    return;
  }

  const formData = new FormData();
  formData.append("asset", file);

  try {
    await request("/admin/api/assets", {
      method: "POST",
      body: formData,
    });

    if (assetFileInput) assetFileInput.value = "";
    await loadAssets(true);
    await loadAudit();
    showToast("Asset uploaded.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
});

assetList?.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy-asset-url]");
  if (copyButton) {
    await copyAssetUrl(copyButton.dataset.copyAssetUrl || "");
    return;
  }

  const deleteButton = event.target.closest("[data-delete-asset-id]");
  if (deleteButton) {
    await deleteAsset({
      id: deleteButton.dataset.deleteAssetId || "",
      source: deleteButton.dataset.deleteAssetSource || "",
      name: deleteButton.dataset.deleteAssetName || "",
      url: deleteButton.dataset.deleteAssetUrl || "",
      rawUrl: deleteButton.dataset.deleteAssetRawUrl || "",
      deletable: true,
    });
  }
});

async function publishAllWithConfirm() {
  const ok = await openConfirmModal({
    title: "Publish All Changes",
    message: "This pushes your current editor state live. Continue?",
    confirmLabel: "Publish",
  });
  if (!ok) return;

  try {
    if (!state.dirtySections.size) {
      showToast("No draft changes to publish.", "warn");
      return;
    }

    const beforePublish = deepClone(state.content);

    setGlobalStatus("Publishing all drafts to live site...");
    await request("/admin/api/content", {
      method: "PUT",
      body: JSON.stringify({ data: state.draftContent }),
    });

    state.previousPublished = beforePublish;
    persistPreviousPublishedSnapshot(beforePublish);
    state.content = deepClone(state.draftContent);
    state.loadedDataset = "currentPublished";

    clearSavedDraftSnapshot();
    syncDirtySections();
    resetHistory(state.draftContent);
    updatePublishedButtons();
    updateSnapshotPill();
    renderNav();
    renderEditors();
    setActiveSection(state.activeSection);

    setGlobalStatus("Published successfully");
    showToast("All drafts published live.", "success");
    await loadAudit();
  } catch (error) {
    setGlobalStatus(error.message, true);
    showToast(error.message, "error");
  }
}

publishBtn?.addEventListener("click", publishAllWithConfirm);

logoutBtn?.addEventListener("click", async () => {
  try {
    await request("/admin/auth/logout", { method: "POST" });
    showToast("Logged out.", "warn");
  } finally {
    window.location.reload();
  }
});

confirmCancelBtn?.addEventListener("click", () => resolveConfirm(false));
confirmOkBtn?.addEventListener("click", () => resolveConfirm(true));
confirmModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-confirm-cancel]")) {
    resolveConfirm(false);
  }
});

document.addEventListener("keydown", async (event) => {
  if (event.key === "Escape" && state.confirmResolver) {
    event.preventDefault();
    resolveConfirm(false);
    return;
  }

  if (!(event.ctrlKey || event.metaKey)) return;

  const key = event.key.toLowerCase();
  const target = event.target;
  const isEditable =
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable);

  if (key === "s") {
    event.preventDefault();
    saveDraftSnapshot();
    return;
  }

  if (isEditable && key !== "enter") {
    return;
  }

  if (key === "z" && !event.shiftKey) {
    event.preventDefault();
    undoChange();
    return;
  }

  if (key === "y" || (key === "z" && event.shiftKey)) {
    event.preventDefault();
    redoChange();
    return;
  }

  if (key === "enter") {
    event.preventDefault();
    await publishAllWithConfirm();
  }
});

document.addEventListener("mouseenter", onTooltipEnter, true);
document.addEventListener("focusin", onTooltipEnter);
document.addEventListener("mouseleave", onTooltipLeave, true);
document.addEventListener("focusout", onTooltipLeave);
window.addEventListener("scroll", () => {
  if (state.visibleTooltipTarget) positionFloatingTooltip(state.visibleTooltipTarget);
});
window.addEventListener("resize", () => {
  if (state.visibleTooltipTarget) positionFloatingTooltip(state.visibleTooltipTarget);
});

(async function init() {
  try {
    await ensureCsrf();
    const hasSession = await checkSession();
    if (hasSession) {
      await bootstrapPanel();
    }
  } catch (error) {
    setGlobalStatus(error.message, true);
    showToast(error.message, "error");
  }
})();
