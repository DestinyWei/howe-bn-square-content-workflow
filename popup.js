const statusBox = document.querySelector("#status");
const downloadFolderInput = document.querySelector("#download-folder");
const downloadSaveAsInput = document.querySelector("#download-save-as");

function setStatus(message) {
  statusBox.textContent = message;
}

function sanitizeDownloadFolder(value) {
  return String(value || "binance-square-assets")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[<>:"|?*\u0000-\u001f]/g, "-").trim())
    .filter(Boolean)
    .join("/") || "binance-square-assets";
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function openFormatter() {
  await chrome.tabs.create({ url: chrome.runtime.getURL("formatter.html") });
}

function isWorkflowDraft(value) {
  return value?.workflow === "x-article-to-binance-square" && typeof value?.html === "string";
}

async function clipboardDraft() {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text);
    return isWorkflowDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function latestDraft() {
  const { binanceDraft } = await chrome.storage.local.get("binanceDraft");
  const fromClipboard = await clipboardDraft();
  if (!isWorkflowDraft(binanceDraft)) return fromClipboard;
  if (!fromClipboard) return binanceDraft;
  return new Date(fromClipboard.updatedAt || 0) > new Date(binanceDraft.updatedAt || 0) ? fromClipboard : binanceDraft;
}

async function loadDownloadSettings() {
  const settings = await chrome.storage.local.get(["downloadFolder", "downloadSaveAs"]);
  downloadFolderInput.value = settings.downloadFolder || "binance-square-assets";
  downloadSaveAsInput.checked = Boolean(settings.downloadSaveAs);
}

document.querySelector("#save-download-settings").addEventListener("click", async () => {
  const downloadFolder = sanitizeDownloadFolder(downloadFolderInput.value);
  const downloadSaveAs = downloadSaveAsInput.checked;
  downloadFolderInput.value = downloadFolder;
  await chrome.storage.local.set({ downloadFolder, downloadSaveAs });
  setStatus(downloadSaveAs
    ? `下载设置已保存。\n每次下载都会弹出“另存为”。`
    : `下载设置已保存。\n文件将保存到 Downloads/${downloadFolder}/`);
});

document.querySelector("#formatter").addEventListener("click", openFormatter);

document.querySelector("#extract").addEventListener("click", async () => {
  try {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
      throw new Error("请先打开一篇 X Article。");
    }
    setStatus("正在读取当前 X Article…");
    const response = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_X_ARTICLE" });
    if (!response?.ok) throw new Error(response?.error || "未能识别文章内容。");
    await chrome.storage.local.set({ sourceArticle: response.article });
    const coverage = response.article.diagnostics?.coverage;
    setStatus(`已采集：${response.article.title}\n正文块 ${response.article.diagnostics?.blockCount || "未知"} 个 · 图片 ${response.article.assets.length} 张${coverage ? ` · 覆盖率 ${(coverage * 100).toFixed(1)}%` : ""}`);
    await openFormatter();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

document.querySelector("#fill").addEventListener("click", async () => {
  try {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(www\.)?binance\.com\//.test(tab.url || "")) {
      throw new Error("请先打开币安广场文章编辑器。");
    }
    const binanceDraft = await latestDraft();
    if (!binanceDraft?.html) throw new Error("排版器中还没有保存可填入的版本。");
    await chrome.storage.local.set({ binanceDraft });
    setStatus("正在填入币安草稿…");
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "FILL_BINANCE_DRAFT",
      draft: binanceDraft
    });
    if (!response?.ok) throw new Error(response?.error || "填入失败。");
    setStatus(`已填入标题和正文。\n请手动上传 ${binanceDraft.assets?.length || 0} 张图片并预览；不会自动发布。`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

document.querySelector("#images").addEventListener("click", async () => {
  try {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(www\.)?binance\.com\//.test(tab.url || "")) {
      throw new Error("请先打开币安广场文章编辑器。");
    }
    const binanceDraft = await latestDraft();
    if (!binanceDraft?.assets?.length) throw new Error("当前草稿没有正文图片素材。");
    setStatus("正在启动批量插图助手…");
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "START_IMAGE_ASSISTANT",
      draft: binanceDraft
    });
    if (!response?.ok) throw new Error(response?.error || "无法启动插图助手。");
    setStatus(`插图助手已启动，共 ${binanceDraft.assets.length} 张正文图片。\n请按照页面右上角助手操作。`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

loadDownloadSettings();
