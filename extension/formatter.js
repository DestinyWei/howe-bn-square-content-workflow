const editor = document.querySelector("#editor");
const titleInput = document.querySelector("#title");
const coverInput = document.querySelector("#cover");
const sourceUrlInput = document.querySelector("#source-url");
const assetsList = document.querySelector("#assets");
const issuesList = document.querySelector("#issues");
const scoreBox = document.querySelector("#score");
const toast = document.querySelector("#toast");
const wordCount = document.querySelector("#word-count");
const saveButton = document.querySelector("#save-extension");
const saveState = document.querySelector("#save-state");

let assets = [];
let sourceDiagnostics = null;

const demo = globalThis.checkoutDemo;

function setToast(message) {
  toast.textContent = message;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function blocksToHtml(blocks = []) {
  return blocks.map((block) => {
    if (block.html) return block.html;
    if (block.type === "heading") return `<h2>${escapeHtml(block.text)}</h2>`;
    if (block.type === "blockquote") return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
    if (block.type === "divider") return "<hr>";
    if (block.type === "image" && sanitizeUrl(block.url)) {
      return `<img src="${escapeHtml(sanitizeUrl(block.url))}" alt="${escapeHtml(block.alt || "")}">`;
    }
    if (block.type === "bulletList" || block.type === "orderedList") {
      const tag = block.type === "orderedList" ? "ol" : "ul";
      return `<${tag}>${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
    }
    return `<p>${escapeHtml(block.text || "")}</p>`;
  }).join("");
}

function loadArticle(article) {
  titleInput.value = article.title || "";
  coverInput.value = article.cover || "";
  sourceUrlInput.value = article.sourceUrl || "";
  sourceDiagnostics = article.diagnostics || null;
  assets = (article.assets || []).map((asset) => typeof asset === "string" ? { url: asset } : asset);
  editor.innerHTML = article.html || blocksToHtml(article.blocks);
  normalizeContent(false);
  refresh();
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url, location.href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function isXLink(url) {
  try {
    const hostname = new URL(url, location.href).hostname.toLowerCase();
    return hostname === "x.com" ||
      hostname.endsWith(".x.com") ||
      hostname === "twitter.com" ||
      hostname.endsWith(".twitter.com");
  } catch {
    return false;
  }
}

function unwrapLink(link) {
  link.replaceWith(...link.childNodes);
}

function isHandleOnly(text) {
  return /^@[A-Za-z0-9_]{1,15}$/.test(text.trim());
}

function stripBareHandles(root) {
  root.normalize();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    node.nodeValue = node.nodeValue
      .replace(/(?<![A-Za-z0-9._%+-])@[A-Za-z0-9_]{1,15}\b/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([，。！？：；、])/g, "$1");
  });

  [...root.querySelectorAll("a")].forEach((link) => {
    if (!link.textContent.trim()) link.remove();
  });
}

function stripXReferences(root) {
  [...root.querySelectorAll("a")].forEach((link) => {
    if (!isXLink(link.href)) return;
    if (isHandleOnly(link.textContent)) link.remove();
    else unwrapLink(link);
  });
  stripBareHandles(root);
}

function sanitizeContent() {
  const allowed = new Set(["P", "H2", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "BLOCKQUOTE", "HR", "A", "BR", "IMG"]);
  const clone = editor.cloneNode(true);
  [...clone.querySelectorAll("*")].forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    if (element.tagName === "A") {
      const href = sanitizeUrl(element.getAttribute("href") || element.href);
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
      if (document.querySelector("#strip-x-links").checked && isXLink(href)) {
        if (isHandleOnly(element.textContent)) element.remove();
        else unwrapLink(element);
      }
      else if (href) element.setAttribute("href", href);
      else unwrapLink(element);
    } else if (element.tagName === "IMG") {
      const src = sanitizeUrl(element.getAttribute("src") || element.src);
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
      if (src) element.setAttribute("src", src);
      else element.remove();
    } else {
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    }
  });
  if (document.querySelector("#strip-x-links").checked) stripBareHandles(clone);
  return clone.innerHTML;
}

function collectImages() {
  const existing = new Set(assets.map((asset) => asset.url));
  [...editor.querySelectorAll("img")].forEach((image) => {
    const url = sanitizeUrl(image.currentSrc || image.src);
    if (url && !existing.has(url)) {
      assets.push({ url, alt: image.alt || "" });
      existing.add(url);
    }
  });
}

function normalizeContent(showMessage = true) {
  collectImages();
  if (document.querySelector("#normalize-headings").checked) {
    [...editor.querySelectorAll("h1,h3,h4,h5,h6")].forEach((heading) => {
      const h2 = document.createElement("h2");
      h2.innerHTML = heading.innerHTML;
      heading.replaceWith(h2);
    });
  }
  if (document.querySelector("#strip-x-links").checked) {
    stripXReferences(editor);
  }
  if (document.querySelector("#image-placeholders").checked) {
    [...editor.querySelectorAll("img")].forEach((image) => {
      const url = sanitizeUrl(image.currentSrc || image.src);
      let index = assets.findIndex((asset) => asset.url === url);
      if (index < 0) {
        assets.push({ url });
        index = assets.length - 1;
      }
      const placeholder = document.createElement("p");
      placeholder.className = "image-slot";
      placeholder.dataset.assetIndex = String(index + 1);
      placeholder.textContent = `正文图片 ${index + 1}：请在币安编辑器中上传`;
      image.replaceWith(placeholder);
    });
  }
  if (showMessage) setToast("已应用币安兼容转换。");
  refresh();
}

function runChecks() {
  const issues = [];
  const html = editor.innerHTML;
  const text = editor.innerText.trim();
  if (!titleInput.value.trim()) issues.push({ type: "error", text: "缺少标题。" });
  if (!coverInput.value.trim()) issues.push({ type: "warn", text: "缺少 5:2 封面。" });
  if (!text) issues.push({ type: "error", text: "正文为空。" });
  if (sourceDiagnostics?.coverage != null) {
    const coveragePercent = (sourceDiagnostics.coverage * 100).toFixed(1);
    if (sourceDiagnostics.coverage < 0.98) {
      issues.push({ type: "error", text: `来源正文提取覆盖率仅 ${coveragePercent}%，存在漏文风险。` });
    } else {
      issues.push({ type: "ok", text: `来源正文提取覆盖率 ${coveragePercent}%，共 ${sourceDiagnostics.blockCount || "未知"} 个正文块。` });
    }
  }
  if (editor.querySelector("h1,h3,h4,h5,h6")) issues.push({ type: "warn", text: "存在非 H2 小标题，建议统一转换。" });
  if (editor.querySelector("img")) issues.push({ type: "warn", text: "正文仍含远程图片；币安通常不会随粘贴上传图片。" });
  if (editor.querySelector("table,pre,code")) issues.push({ type: "warn", text: "存在表格或代码块，币安编辑器可能无法保留。" });
  if (/\n\s*[-*]\s+\S/.test(text)) issues.push({ type: "warn", text: "发现 Markdown 列表语法，建议转换为富文本列表。" });
  if (/^>\s+/m.test(text)) issues.push({ type: "warn", text: "发现 Markdown 引用语法，建议转换为引用块。" });
  const remainingXLinks = [...editor.querySelectorAll("a")].filter((link) => isXLink(link.href));
  if (remainingXLinks.length) {
    const optionHint = document.querySelector("#strip-x-links").checked ? "请重新应用币安兼容转换。" : "当前已关闭移除选项。";
    issues.push({ type: "warn", text: `仍包含 ${remainingXLinks.length} 个 X / Twitter 链接。${optionHint}` });
  }
  const remainingHandles = text.match(/(?<![A-Za-z0-9._%+-])@[A-Za-z0-9_]{1,15}\b/g) || [];
  if (remainingHandles.length) {
    const optionHint = document.querySelector("#strip-x-links").checked ? "请重新应用币安兼容转换。" : "当前已关闭移除选项。";
    issues.push({ type: "warn", text: `仍包含 ${remainingHandles.length} 个 @handle。${optionHint}` });
  }
  if (html.length > 100000) issues.push({ type: "error", text: "正文可能超过币安 100,000 字符上限。" });
  if (!issues.length) issues.push({ type: "ok", text: "未发现明显的格式兼容问题。" });

  issuesList.innerHTML = issues.map((issue) => `<li class="${issue.type}">${escapeHtml(issue.text)}</li>`).join("");
  const penalty = issues.reduce((sum, issue) => sum + (issue.type === "error" ? 25 : issue.type === "warn" ? 8 : 0), 0);
  scoreBox.textContent = `兼容度 ${Math.max(0, 100 - penalty)} / 100`;
}

function renderAssets() {
  const cover = sanitizeUrl(coverInput.value.trim());
  const lines = [];
  if (cover) {
    lines.push(`<li><strong>00-cover</strong><br>${escapeHtml(cover)}</li>`);
  }
  if (assets.length) {
    lines.push(...assets.map((asset, index) => `<li><strong>${String(index + 1).padStart(2, "0")}-image</strong><br>${escapeHtml(asset.url || "缺少 URL")}</li>`));
  } else {
    lines.push(`<li>${cover ? "已识别封面，暂无正文图片。" : "尚未记录封面或正文图片。"}</li>`);
  }
  assetsList.innerHTML = lines.join("");
}

function refresh() {
  wordCount.textContent = `${editor.innerText.length.toLocaleString()} 字符`;
  renderAssets();
  runChecks();
}

function currentDraft() {
  return {
    workflow: "x-article-to-binance-square",
    version: 4,
    source: "binance-square-formatter",
    sourceUrl: sourceUrlInput.value.trim(),
    title: titleInput.value.trim(),
    cover: coverInput.value.trim(),
    html: sanitizeContent(),
    assets,
    diagnostics: sourceDiagnostics,
    updatedAt: new Date().toISOString()
  };
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("浏览器未允许写入剪贴板。");
}

async function copyDraftBridge(draft) {
  const text = JSON.stringify(draft);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    fallbackCopyText(text);
  }
}

function download(name, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function copyRichText() {
  const draft = currentDraft();
  const plain = editor.innerText;
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([draft.html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" })
    })
  ]);
  setToast("已复制币安兼容富文本。粘贴后请上传图片并预览。");
}

async function readClipboard() {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    if (item.types.includes("text/html")) {
      editor.innerHTML = await (await item.getType("text/html")).text();
      normalizeContent();
      return;
    }
    if (item.types.includes("text/plain")) {
      const text = await (await item.getType("text/plain")).text();
      editor.innerHTML = text.split(/\n{2,}/).map((part) => `<p>${escapeHtml(part)}</p>`).join("");
      normalizeContent();
      return;
    }
  }
  throw new Error("剪贴板中没有可读取的文字内容。");
}

document.querySelector("#load-demo").addEventListener("click", () => loadArticle(demo));
document.querySelector("#normalize").addEventListener("click", () => normalizeContent());
document.querySelector("#run-check").addEventListener("click", runChecks);
document.querySelector("#copy-rich").addEventListener("click", () => copyRichText().catch((error) => setToast(error.message)));
document.querySelector("#copy-title").addEventListener("click", () => navigator.clipboard.writeText(titleInput.value).then(() => setToast("已复制标题。")).catch((error) => setToast(error.message)));
document.querySelector("#read-clipboard").addEventListener("click", () => readClipboard().catch((error) => setToast(`无法读取剪贴板：${error.message}\n也可以直接粘贴到正文编辑区。`)));
document.querySelector("#export-json").addEventListener("click", () => download("binance-square-draft.json", JSON.stringify(currentDraft(), null, 2), "application/json"));
document.querySelector("#export-assets").addEventListener("click", () => {
  const lines = [`00-cover\t${coverInput.value.trim()}`, ...assets.map((asset, index) => `${String(index + 1).padStart(2, "0")}-image\t${asset.url || ""}`)];
  download("binance-square-assets.txt", lines.join("\n"), "text/plain");
});
document.querySelector("#import-json").addEventListener("click", () => document.querySelector("#json-file").click());
document.querySelector("#json-file").addEventListener("change", async (event) => {
  try {
    const file = event.target.files[0];
    if (file) loadArticle(JSON.parse(await file.text()));
  } catch (error) {
    setToast(`导入失败：${error.message}`);
  }
});
document.querySelector("#save-extension").addEventListener("click", async () => {
  try {
    const draft = currentDraft();
    let storedDirectly = false;
    if (globalThis.chrome?.storage?.local) {
      await chrome.storage.local.set({ binanceDraft: draft });
      storedDirectly = true;
    }
    await copyDraftBridge(draft);
    localStorage.setItem("binanceSquareDraft", JSON.stringify(draft));
    saveButton.textContent = "已保存 ✓";
    saveState.textContent = storedDirectly ? "已写入扩展并复制草稿桥" : "网页模式：已复制草稿桥，扩展填入时会自动读取";
    setTimeout(() => { saveButton.textContent = "保存给扩展"; }, 2400);
    setToast("草稿已保存。现在打开币安文章编辑器，再点击扩展中的“把已保存版本填入当前币安草稿”。");
  } catch (error) {
    saveState.textContent = "保存失败";
    setToast(error.message);
  }
});

editor.addEventListener("input", refresh);
editor.addEventListener("paste", () => setTimeout(() => normalizeContent(false), 20));
[titleInput, coverInput, sourceUrlInput].forEach((input) => input.addEventListener("input", refresh));
["normalize-headings", "strip-x-links", "image-placeholders"].forEach((id) => {
  document.querySelector(`#${id}`).addEventListener("change", () => normalizeContent(false));
});

(async () => {
  if (globalThis.chrome?.storage?.local) {
    const { sourceArticle, binanceDraft } = await chrome.storage.local.get(["sourceArticle", "binanceDraft"]);
    if (sourceArticle) loadArticle(sourceArticle);
    else if (binanceDraft) loadArticle(binanceDraft);
    else loadArticle(demo);
  } else {
    loadArticle(demo);
  }
})();
