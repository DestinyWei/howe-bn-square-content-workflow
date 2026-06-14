const statusBox = document.querySelector("#status");
const downloadFolderInput = document.querySelector("#download-folder");
const downloadSaveAsInput = document.querySelector("#download-save-as");

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = type;
}

async function withBusy(buttonSelector, busyText, task) {
  const button = document.querySelector(buttonSelector);
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    return await task();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
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

function isMissingReceiverError(error) {
  return /Receiving end does not exist|Could not establish connection|No tab with id/i.test(error?.message || String(error));
}

async function sendMessageWithInjection(tab, message, scriptFile) {
  if (!tab?.id) throw new Error("找不到当前标签页。");
  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    if (response !== undefined) return response;
  } catch (error) {
    if (!isMissingReceiverError(error) || !chrome.scripting?.executeScript) throw error;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [scriptFile] });
  return chrome.tabs.sendMessage(tab.id, message);
}

async function openFormatter() {
  await chrome.tabs.create({ url: chrome.runtime.getURL("formatter.html") });
}

function isWorkflowDraft(value) {
  return value?.workflow === "x-article-to-binance-square" && typeof value?.html === "string";
}

function isPostDraft(value) {
  return value?.workflow === "x-tweet-to-binance-square-post" && typeof value?.text === "string";
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
    : `下载设置已保存。\n文件将保存到 Downloads/${downloadFolder}/`, "ok");
});

document.querySelector("#formatter").addEventListener("click", openFormatter);

document.querySelector("#extract").addEventListener("click", async () => {
  await withBusy("#extract", "正在采集…", async () => {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
      throw new Error("请先打开一篇 X Article。");
    }
    setStatus("正在读取当前 X Article…", "working");
    const response = await sendMessageWithInjection(tab, { type: "EXTRACT_X_ARTICLE" }, "content-x.js");
    if (!response?.ok) throw new Error(response?.error || "未能识别文章内容。");
    await chrome.storage.local.set({ sourceArticle: response.article });
    const coverage = response.article.diagnostics?.coverage;
    setStatus(`已采集：${response.article.title}\n正文块 ${response.article.diagnostics?.blockCount || "未知"} 个 · 图片 ${response.article.assets.length} 张${coverage ? ` · 覆盖率 ${(coverage * 100).toFixed(1)}%` : ""}`, "ok");
    await openFormatter();
  }).catch((error) => setStatus(error.message || String(error), "error"));
});

document.querySelector("#fill").addEventListener("click", async () => {
  await withBusy("#fill", "正在填入…", async () => {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(www\.)?binance\.com\//.test(tab.url || "")) {
      throw new Error("请先打开币安广场文章编辑器。");
    }
    const binanceDraft = await latestDraft();
    if (!binanceDraft?.html) throw new Error("排版器中还没有保存可填入的版本。");
    await chrome.storage.local.set({ binanceDraft });
    setStatus("正在填入币安草稿…", "working");
    const response = await sendMessageWithInjection(tab, {
      type: "FILL_BINANCE_DRAFT",
      draft: binanceDraft
    }, "content-binance.js");
    if (!response?.ok) throw new Error(response?.error || "填入失败。");
    setStatus(`已填入标题和正文。\n请手动上传 ${binanceDraft.assets?.length || 0} 张图片并预览；不会自动发布。`, "ok");
  }).catch((error) => setStatus(error.message || String(error), "error"));
});

document.querySelector("#images").addEventListener("click", async () => {
  await withBusy("#images", "正在启动…", async () => {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(www\.)?binance\.com\//.test(tab.url || "")) {
      throw new Error("请先打开币安广场文章编辑器。");
    }
    const binanceDraft = await latestDraft();
    if (!binanceDraft?.assets?.length) throw new Error("当前草稿没有正文图片素材。");
    setStatus("正在启动批量插图助手…", "working");
    const response = await sendMessageWithInjection(tab, {
      type: "START_IMAGE_ASSISTANT",
      draft: binanceDraft
    }, "content-binance.js");
    if (!response?.ok) throw new Error(response?.error || "无法启动插图助手。");
    setStatus(`插图助手已启动，共 ${binanceDraft.assets.length} 张正文图片。\n请按照页面右上角助手操作。`, "ok");
  }).catch((error) => setStatus(error.message || String(error), "error"));
});

document.querySelector("#extract-tweet").addEventListener("click", async () => {
  await withBusy("#extract-tweet", "正在采集…", async () => {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(tab.url || "")) {
      throw new Error("请先打开一条 X 推文详情页。");
    }
    setStatus("正在读取当前 X 推文…", "working");
    const response = await sendMessageWithInjection(tab, { type: "EXTRACT_X_TWEET" }, "content-x.js");
    if (!response?.ok) throw new Error(response?.error || "未能识别推文内容。");
    const draft = {
      workflow: "x-tweet-to-binance-square-post",
      version: 1,
      source: "popup",
      sourceUrl: response.tweet.sourceUrl,
      text: response.tweet.text,
      assets: response.tweet.assets || [],
      diagnostics: response.tweet.diagnostics || null,
      updatedAt: new Date().toISOString()
    };
    await chrome.storage.local.set({ binancePostDraft: draft });
    setStatus(`已采集 X 推文：${draft.text.length} 字符 · 图片 ${draft.assets.length} 张。\n打开币安广场短帖输入框后，点击“填入当前币安广场推文”。`, "ok");
  }).catch((error) => setStatus(error.message || String(error), "error"));
});

document.querySelector("#fill-post").addEventListener("click", async () => {
  await withBusy("#fill-post", "正在填入…", async () => {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(www\.)?binance\.com\//.test(tab.url || "")) {
      throw new Error("请先打开币安广场页面，并点开短帖输入框。");
    }
    const { binancePostDraft } = await chrome.storage.local.get("binancePostDraft");
    if (!isPostDraft(binancePostDraft)) throw new Error("还没有已采集的 X 推文。");
    setStatus("正在填入币安广场推文…", "working");
    const response = await sendMessageWithInjection(tab, {
      type: "FILL_BINANCE_POST",
      draft: binancePostDraft
    }, "content-binance.js");
    if (!response?.ok) throw new Error(response?.error || "填入失败。");
    setStatus(`已填入推文正文。\n如原推文包含 ${binancePostDraft.assets?.length || 0} 张图片，请手动上传并检查预览；不会自动发布。`, "ok");
  }).catch((error) => setStatus(error.message || String(error), "error"));
});

loadDownloadSettings();
