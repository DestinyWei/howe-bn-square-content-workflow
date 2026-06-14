function isVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function box(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, area: rect.width * rect.height };
}

function attributesText(element) {
  return [...element.attributes].map((attribute) => `${attribute.name}=${attribute.value}`).join(" ");
}

function editableElements() {
  const candidates = [...document.querySelectorAll("input, textarea, [contenteditable='true'], [role='textbox']")]
    .filter(isVisible)
    .filter((element) => {
      const hint = `${element.getAttribute("placeholder") || ""} ${element.getAttribute("aria-label") || ""} ${attributesText(element)}`;
      return !/搜索|search|邮箱|email|手机|phone/i.test(hint);
    });
  return [...new Set(candidates)].filter((element) =>
    !candidates.some((other) => other !== element && element.contains(other))
  );
}

function nearestTextMarker(text) {
  return [...document.querySelectorAll("body *")]
    .filter(isVisible)
    .filter((element) => element.children.length === 0 && element.textContent.trim() === text)
    .sort((a, b) => box(a).area - box(b).area)[0] || null;
}

function findBodyEditor(editables) {
  const contentEditables = editables.filter((element) =>
    element.isContentEditable || element.getAttribute("role") === "textbox"
  );
  return (contentEditables.length ? contentEditables : editables)
    .map((element) => ({ element, ...box(element) }))
    .sort((a, b) => b.area - a.area)[0]?.element || null;
}

function findTitleInput(editables, bodyEditor) {
  const explicit = editables.find((element) =>
    /添加标题|add title|article.title/i.test(`${element.textContent || ""} ${attributesText(element)}`)
  );
  if (explicit && explicit !== bodyEditor) return explicit;

  const marker = nearestTextMarker("添加标题");
  if (marker) {
    const containing = editables.find((element) => element !== bodyEditor && element.contains(marker));
    if (containing) return containing;
  }

  const bodyBox = bodyEditor ? box(bodyEditor) : null;
  const candidates = editables
    .filter((element) => element !== bodyEditor)
    .map((element) => ({ element, ...box(element) }))
    .filter((candidate) => {
      if (!bodyBox) return true;
      return candidate.y < bodyBox.y &&
        candidate.y > bodyBox.y - 420 &&
        candidate.width >= bodyBox.width * 0.35 &&
        candidate.height <= 180;
    })
    .map((candidate) => {
      const markerBox = marker ? box(marker) : null;
      const markerDistance = markerBox ? Math.abs(candidate.y - markerBox.y) + Math.abs(candidate.x - markerBox.x) : 0;
      const bodyDistance = bodyBox ? Math.abs(bodyBox.y - (candidate.y + candidate.height)) : 0;
      return { ...candidate, score: markerDistance + bodyDistance };
    })
    .sort((a, b) => a.score - b.score);
  return candidates[0]?.element || null;
}

function dispatchInput(element, inputType) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: null }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

function setTextControl(element, value) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  dispatchInput(element, "insertText");
}

function replaceEditable(element, value, rich) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setTextControl(element, value);
    return;
  }

  element.focus();
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  const commandWorked = document.execCommand(rich ? "insertHTML" : "insertText", false, value);
  if (!commandWorked) {
    if (rich) element.innerHTML = value;
    else element.textContent = value;
  }
  dispatchInput(element, rich ? "insertFromPaste" : "insertText");
}

function describeEditables(editables) {
  return editables.map((element) => {
    const rect = box(element);
    return {
      tag: element.tagName,
      role: element.getAttribute("role"),
      contenteditable: element.getAttribute("contenteditable"),
      placeholder: element.getAttribute("placeholder"),
      text: (element.textContent || element.value || "").trim().slice(0, 30),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  });
}

function fillDraft(draft) {
  const editables = editableElements();
  const bodyEditor = findBodyEditor(editables);
  const titleInput = findTitleInput(editables, bodyEditor);
  if (!titleInput) {
    throw new Error(`未找到标题编辑区。检测到 ${editables.length} 个可编辑控件：${JSON.stringify(describeEditables(editables))}`);
  }
  if (!bodyEditor) throw new Error("未找到正文富文本区域。请确认已打开币安广场文章编辑器。");

  replaceEditable(titleInput, draft.title || "", false);
  replaceEditable(bodyEditor, draft.html, true);
  return {
    titleTag: titleInput.tagName,
    bodyTag: bodyEditor.tagName,
    editableCount: editables.length
  };
}

let imageAssistantState = null;

function ensureAssistantStyles() {
  if (document.querySelector("#bs-image-assistant-styles")) return;
  const style = document.createElement("style");
  style.id = "bs-image-assistant-styles";
  style.textContent = `
    .bs-image-target {
      outline: 4px solid #f0b90b !important;
      outline-offset: 4px !important;
      background: rgba(240,185,11,.22) !important;
    }
    .bs-image-target.bs-image-verified {
      outline-color: #0ecb81 !important;
      background: rgba(14,203,129,.18) !important;
    }
    .bs-image-toolbar-target {
      outline: 3px solid #0ecb81 !important;
      outline-offset: 3px !important;
    }
    #bs-image-target-marker {
      position: fixed; z-index: 2147483646; pointer-events: none;
      border: 4px solid #f0b90b; border-radius: 7px;
      background: rgba(240,185,11,.13);
      box-shadow: 0 0 0 5px rgba(240,185,11,.2), 0 0 26px rgba(240,185,11,.68);
      animation: bs-image-target-pulse 1.05s ease-in-out infinite alternate;
    }
    #bs-image-target-marker .bs-image-marker-label {
      position: absolute; left: -4px; bottom: calc(100% + 9px);
      padding: 6px 10px; border-radius: 6px;
      color: #111; background: #f0b90b; box-shadow: 0 6px 22px rgba(0,0,0,.42);
      font: 750 13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      white-space: nowrap;
    }
    @keyframes bs-image-target-pulse {
      from { border-color: #f0b90b; box-shadow: 0 0 0 4px rgba(240,185,11,.18), 0 0 18px rgba(240,185,11,.5); }
      to { border-color: #fff1a6; box-shadow: 0 0 0 9px rgba(240,185,11,.3), 0 0 34px rgba(240,185,11,.9); }
    }
    #bs-image-assistant {
      position: fixed; top: 18px; right: 18px; z-index: 2147483647;
      width: 330px; max-height: calc(100vh - 36px); padding: 15px;
      overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable;
      box-sizing: border-box;
      border: 1px solid #3a424d; border-radius: 12px;
      color: #eaecef; background: #11151b; box-shadow: 0 16px 50px rgba(0,0,0,.5);
      font: 13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    #bs-image-assistant::-webkit-scrollbar { width: 8px; }
    #bs-image-assistant::-webkit-scrollbar-thumb { border-radius: 8px; background: #48515d; }
    #bs-image-assistant::-webkit-scrollbar-track { background: transparent; }
    #bs-image-assistant * { box-sizing: border-box; }
    #bs-image-assistant h3 { margin: 0 0 8px; color: #f0b90b; font-size: 16px; }
    #bs-image-assistant p { margin: 7px 0; color: #c9ced5; }
    #bs-image-assistant img { display: block; width: 100%; max-height: 150px; margin: 10px 0; border-radius: 7px; object-fit: contain; background: #080b0e; }
    #bs-image-assistant .bs-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 10px; }
    #bs-image-assistant button { padding: 8px; border: 1px solid #3a424d; border-radius: 7px; color: #eaecef; background: #20262e; cursor: pointer; }
    #bs-image-assistant button.bs-primary { border-color: #f0b90b; color: #111; background: #f0b90b; font-weight: 750; }
    #bs-image-assistant button.bs-wide { grid-column: 1 / -1; }
    #bs-image-assistant .bs-status { padding: 8px; border-radius: 6px; color: #b7bdc6; background: #080b0e; white-space: pre-wrap; }
    #bs-image-assistant .bs-option { display: flex; align-items: center; gap: 7px; margin: 8px 0 3px; color: #c9ced5; }
    #bs-image-assistant .bs-option input { width: auto; margin: 0; accent-color: #f0b90b; }
    #bs-image-assistant .bs-folder-option { display: block; margin: 8px 0 3px; color: #c9ced5; }
    #bs-image-assistant .bs-folder-option input { width: 100%; margin-top: 4px; padding: 7px; border: 1px solid #3a424d; border-radius: 6px; color: #eaecef; background: #080b0e; }
    #bs-image-assistant .bs-download-hint { margin: 4px 0 8px; color: #7f8791; font-size: 11px; }
    #bs-image-assistant .bs-danger { grid-column: 1 / -1; border-color: #7a4b00; color: #f0b90b; background: #1e1708; font-weight: 750; }
  `;
  document.head.append(style);
}

function assetUrl(asset) {
  return typeof asset === "string" ? asset : asset?.url || "";
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

function assistantOverlay() {
  return document.querySelector("#bs-image-assistant");
}

function clearAssistantHighlights() {
  document.querySelectorAll(".bs-image-target").forEach((element) => element.classList.remove("bs-image-target"));
  document.querySelectorAll(".bs-image-toolbar-target").forEach((element) => element.classList.remove("bs-image-toolbar-target"));
  document.querySelector("#bs-image-target-marker")?.remove();
}

function findPlaceholder(editor, index) {
  const pattern = new RegExp(`正文图片\\s*${index}\\s*[：:]`);
  return [...editor.querySelectorAll("p,div,li,blockquote")]
    .filter((element) => pattern.test((element.textContent || "").trim()))
    .sort((a, b) => box(a).area - box(b).area)[0] || null;
}

function findPlaceholders(editor, index) {
  const pattern = new RegExp(`正文图片\\s*${index}\\s*[：:]`);
  return [...editor.querySelectorAll("p,div,li,blockquote")]
    .filter((element) => pattern.test((element.textContent || "").trim()))
    .filter((element) => ![...element.children].some((child) => pattern.test((child.textContent || "").trim())))
    .sort((a, b) => topLevelIndex(editor, a) - topLevelIndex(editor, b));
}

function allPlaceholders(editor) {
  return [...editor.querySelectorAll("p,div,li,blockquote")]
    .filter((element) => /正文图片\s*\d+\s*[：:]/.test((element.textContent || "").trim()))
    .filter((element) => ![...element.children].some((child) =>
      /正文图片\s*\d+\s*[：:]/.test((child.textContent || "").trim())
    ));
}

function removeDuplicatePlaceholders(editor, index) {
  if (!editor) return null;
  const placeholders = findPlaceholders(editor, index);
  placeholders.slice(1).forEach((placeholder) => placeholder.remove());
  if (placeholders.length > 1) dispatchInput(editor, "deleteContentBackward");
  return placeholders[0] || null;
}

function setCaretBefore(element) {
  const editableParent = element.closest("[contenteditable='true'],[role='textbox']");
  editableParent?.focus();
  const range = document.createRange();
  range.setStartBefore(element);
  range.collapse(true);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function currentAssistantEditor() {
  if (!imageAssistantState) return null;
  if (imageAssistantState.editor?.isConnected && isVisible(imageAssistantState.editor)) return imageAssistantState.editor;
  const editor = findBodyEditor(editableElements());
  if (editor) imageAssistantState.editor = editor;
  return editor;
}

function positionTargetMarker(placeholder, index) {
  let marker = document.querySelector("#bs-image-target-marker");
  if (!marker) {
    marker = document.createElement("div");
    marker.id = "bs-image-target-marker";
    marker.innerHTML = `<span class="bs-image-marker-label"></span>`;
    document.body.append(marker);
  }
  marker.querySelector(".bs-image-marker-label").textContent = `第 ${index + 1} 张图片插在这里`;
  const rect = placeholder.getBoundingClientRect();
  marker.style.left = `${Math.max(4, rect.left - 8)}px`;
  marker.style.top = `${rect.top - 8}px`;
  marker.style.width = `${Math.max(24, rect.width + 16)}px`;
  marker.style.height = `${Math.max(24, rect.height + 16)}px`;
}

function scrollPlaceholderIntoView(placeholder) {
  if (!placeholder?.isConnected) return;
  placeholder.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
  positionTargetMarker(placeholder, imageAssistantState?.index || 0);
}

function schedulePlaceholderScroll(index) {
  if (!imageAssistantState) return;
  imageAssistantState.scrollTimers?.forEach(clearTimeout);
  imageAssistantState.scrollTimers = [0, 120, 420].map((delay) =>
    setTimeout(() => {
      if (!imageAssistantState || imageAssistantState.index !== index) return;
      const editor = currentAssistantEditor();
      const placeholder = editor ? findPlaceholder(editor, index + 1) : null;
      if (placeholder) scrollPlaceholderIntoView(placeholder);
    }, delay)
  );
}

function refreshAssistantTarget(scroll = false) {
  if (!imageAssistantState) return null;
  const editor = currentAssistantEditor();
  if (!editor) return null;
  const placeholder = findPlaceholder(editor, imageAssistantState.index + 1);
  document.querySelectorAll(".bs-image-target").forEach((element) => element.classList.remove("bs-image-target"));
  if (!placeholder) {
    document.querySelector("#bs-image-target-marker")?.remove();
    return null;
  }
  placeholder.classList.add("bs-image-target");
  if (scroll) scrollPlaceholderIntoView(placeholder);
  positionTargetMarker(placeholder, imageAssistantState.index);
  return placeholder;
}

function scheduleAssistantTargetRefresh() {
  if (!imageAssistantState) return;
  imageAssistantState.refreshTimers?.forEach(clearTimeout);
  imageAssistantState.refreshTimers = [0, 180, 600, 1400].map((delay) =>
    setTimeout(() => refreshAssistantTarget(false), delay)
  );
}

function startAssistantTargetWatcher() {
  if (!imageAssistantState) return;
  imageAssistantState.observer?.disconnect();
  imageAssistantState.observer = new MutationObserver(() => {
    clearTimeout(imageAssistantState?.mutationTimer);
    if (imageAssistantState) {
      imageAssistantState.mutationTimer = setTimeout(() => refreshAssistantTarget(false), 70);
    }
  });
  imageAssistantState.observer.observe(document.body, { childList: true, subtree: true });
  imageAssistantState.viewportHandler = () => refreshAssistantTarget(false);
  window.addEventListener("scroll", imageAssistantState.viewportHandler, true);
  window.addEventListener("resize", imageAssistantState.viewportHandler);
}

function stopAssistantTargetWatcher() {
  if (!imageAssistantState) return;
  imageAssistantState.observer?.disconnect();
  clearTimeout(imageAssistantState.mutationTimer);
  imageAssistantState.refreshTimers?.forEach(clearTimeout);
  imageAssistantState.scrollTimers?.forEach(clearTimeout);
  if (imageAssistantState.viewportHandler) {
    window.removeEventListener("scroll", imageAssistantState.viewportHandler, true);
    window.removeEventListener("resize", imageAssistantState.viewportHandler);
  }
}

function mediaNodes(editor) {
  const candidates = [...editor.querySelectorAll(
    "img, figure, [data-type='image'], [data-node-type='image'], [data-image], [class*='image-wrapper'], [class*='image-container']"
  )];
  return candidates.filter((element) =>
    !candidates.some((other) => other !== element && other.contains(element))
  );
}

function separateMediaFromPlaceholder(placeholder, media) {
  if (!placeholder || !media || !placeholder.contains(media)) return;
  let movable = media;
  while (movable.parentElement && movable.parentElement !== placeholder) movable = movable.parentElement;
  if (movable.parentElement === placeholder) placeholder.before(movable);
}

function moveMediaBeforePlaceholder(editor, placeholder, media) {
  if (!editor || !placeholder?.isConnected || !media?.isConnected) return false;
  const containingPlaceholder = allPlaceholders(editor).find((candidate) => candidate.contains(media));
  if (containingPlaceholder) separateMediaFromPlaceholder(containingPlaceholder, media);
  let movable = media;
  while (movable.parentElement && movable.parentElement !== editor) movable = movable.parentElement;
  if (movable.parentElement !== editor) return false;
  placeholder.before(movable);
  dispatchInput(editor, "insertFromPaste");
  return true;
}

function mediaKey(element) {
  const image = element.matches("img") ? element : element.querySelector("img");
  const source = image?.currentSrc || image?.src || element.getAttribute("data-src") || element.getAttribute("data-image") || "";
  return `${element.tagName}|${source}`;
}

function captureMediaSnapshot(editor) {
  const nodes = mediaNodes(editor);
  const counts = new Map();
  nodes.forEach((node) => counts.set(mediaKey(node), (counts.get(mediaKey(node)) || 0) + 1));
  return { count: nodes.length, nodes: new Set(nodes), counts };
}

function newMediaSince(editor, snapshot) {
  const seen = new Map();
  return mediaNodes(editor).filter((node) => {
    const key = mediaKey(node);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    return !snapshot.nodes.has(node) && occurrence > (snapshot.counts.get(key) || 0);
  });
}

function newMediaNearPlaceholder(editor, snapshot, placeholder) {
  let addedMedia = newMediaSince(editor, snapshot);
  const currentMedia = mediaNodes(editor);
  if (!addedMedia.length && currentMedia.length > snapshot.count) addedMedia = currentMedia.slice(snapshot.count);
  const placeholderIndex = topLevelIndex(editor, placeholder);
  const nearby = addedMedia.filter((media) => {
    const mediaIndex = topLevelIndex(editor, media);
    return placeholderIndex >= 0 && mediaIndex >= 0 && Math.abs(mediaIndex - placeholderIndex) <= 2;
  });
  return { addedMedia, nearby };
}

function mediaIsLoaded(media) {
  if (!media?.isConnected) return false;
  const images = media.matches("img") ? [media] : [...media.querySelectorAll("img")];
  if (images.length) {
    return images.some((image) => {
      const source = image.currentSrc || image.src || "";
      return image.complete &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0 &&
        !/^(data|blob):/i.test(source);
    });
  }
  const source = media.getAttribute("data-src") || media.getAttribute("data-image") || "";
  return Boolean(source) && !/^(data|blob):/i.test(source);
}

function mediaForAssetIndex(editor, index) {
  if (!editor) return null;
  return mediaNodes(editor).find((media) =>
    media.dataset.bsAssetIndex === String(index + 1) && mediaIsLoaded(media)
  ) || null;
}

function markInsertedMedia(media, index) {
  if (media) media.dataset.bsAssetIndex = String(index + 1);
}

async function waitForNewMedia(editor, snapshot, placeholder, timeout = 6500) {
  const startedAt = Date.now();
  let latest = { addedMedia: [], nearby: [] };
  while (Date.now() - startedAt < timeout) {
    latest = newMediaNearPlaceholder(editor, snapshot, placeholder);
    const loadedNearby = latest.nearby.filter(mediaIsLoaded);
    if (loadedNearby.length) return { ...latest, nearby: loadedNearby };
    await sleep(250);
  }
  return { ...latest, nearby: latest.nearby.filter(mediaIsLoaded) };
}

function removeMediaAddedSince(editor, snapshot) {
  const added = newMediaSince(editor, snapshot);
  const removable = new Set();
  added.forEach((media) => {
    const containingPlaceholder = allPlaceholders(editor).find((placeholder) => placeholder.contains(media));
    if (containingPlaceholder) {
      let nested = media;
      while (nested.parentElement && nested.parentElement !== containingPlaceholder) nested = nested.parentElement;
      removable.add(nested);
      return;
    }
    let current = media;
    while (current.parentElement && current.parentElement !== editor) current = current.parentElement;
    if (current.parentElement === editor) removable.add(current);
    else removable.add(media);
  });
  removable.forEach((media) => media.remove());
  if (removable.size) dispatchInput(editor, "deleteContentBackward");
  return removable.size;
}

function topLevelIndex(editor, node) {
  let current = node;
  while (current && current.parentElement !== editor) current = current.parentElement;
  return current?.parentElement === editor ? [...editor.children].indexOf(current) : -1;
}

function verifyCurrentImage() {
  if (!imageAssistantState?.mediaSnapshot) return { ok: false, message: "缺少上传前图片快照，请点击“重新定位”后再上传。" };
  const { index, mediaSnapshot } = imageAssistantState;
  const editor = currentAssistantEditor();
  if (!editor) return { ok: false, message: "正文编辑器已重新渲染且暂时无法重新定位，请点击“重新定位”后再试。" };
  const placeholder = findPlaceholder(editor, index + 1);
  if (!placeholder) return { ok: false, message: "当前占位符已经不存在，无法验证图片位置。请重新填入草稿后再试。" };

  const currentMedia = mediaNodes(editor);
  if (currentMedia.length <= mediaSnapshot.count) {
    return { ok: false, message: "未检测到币安正文新增图片。占位符已保留。\n请先点击“复制当前图片”，在黄色框位置粘贴；或打开自动下载后手动上传文件，然后再验证。" };
  }

  const { addedMedia, nearby } = newMediaNearPlaceholder(editor, mediaSnapshot, placeholder);
  if (!nearby.length) {
    return { ok: false, message: "检测到新增图片，但它不在当前占位符附近。占位符已保留。\n请撤销错误图片，并在黄色占位符位置重新上传。" };
  }
  return { ok: true, placeholder, media: nearby[0] };
}

function findImageToolbarButton(bodyEditor) {
  if (!bodyEditor) return null;
  const bodyBox = box(bodyEditor);
  const pattern = /插入图片|添加图片|上传图片|正文图片|image|photo|picture/i;
  return [...document.querySelectorAll("button,[role='button'],[title],[aria-label]")]
    .filter(isVisible)
    .filter((element) => {
      const text = `${element.textContent || ""} ${element.getAttribute("title") || ""} ${element.getAttribute("aria-label") || ""}`;
      return pattern.test(text) && !/封面|cover/i.test(text);
    })
    .map((element) => ({ element, ...box(element) }))
    .filter((candidate) => candidate.y <= bodyBox.y + 120)
    .sort((a, b) => Math.abs(a.y - bodyBox.y) - Math.abs(b.y - bodyBox.y))[0]?.element || null;
}

async function downloadAssistantAsset(url, index, kind = "image") {
  if (!url) throw new Error("当前图片没有可用 URL。");
  const response = await chrome.runtime.sendMessage({
    type: "DOWNLOAD_ARTICLE_ASSET",
    url,
    index,
    kind,
    folder: imageAssistantState?.downloadFolder || "binance-square-assets",
    saveAs: Boolean(imageAssistantState?.downloadSaveAs)
  });
  if (!response?.ok) throw new Error(response?.error || "图片下载失败。");
  return response.filename;
}

function mimeTypeForAsset(url) {
  try {
    const parsed = new URL(url);
    const format = parsed.searchParams.get("format") || "";
    if (/png/i.test(format)) return "image/png";
    if (/webp/i.test(format)) return "image/webp";
    if (/jpe?g/i.test(format)) return "image/jpeg";
    if (/\.png$/i.test(parsed.pathname)) return "image/png";
    if (/\.webp$/i.test(parsed.pathname)) return "image/webp";
  } catch {}
  return "image/jpeg";
}

function dataUrlToBlob(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error("图片数据格式异常。");
  const mimeType = match[1] || "image/png";
  const raw = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("图片读取失败。"));
    reader.readAsDataURL(blob);
  });
}

async function fetchAssistantAssetBlob(url) {
  if (!url) throw new Error("当前图片没有可用 URL。");
  if (/^data:/i.test(url)) return dataUrlToBlob(url);

  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (/^image\//i.test(blob.type)) return blob;
    return new Blob([blob], { type: mimeTypeForAsset(url) });
  } catch {
    const response = await chrome.runtime.sendMessage({ type: "FETCH_ARTICLE_ASSET", url });
    if (!response?.ok) throw new Error(response?.error || "图片读取失败。");
    return dataUrlToBlob(response.dataUrl);
  }
}

async function attemptPasteImage(editor, placeholder, blob, dataUrl, index, sourceUrl) {
  setCaretBefore(placeholder);
  try {
    const mimeType = blob.type || "image/png";
    const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const file = new File([blob], `bn-square-image-${String(index + 1).padStart(2, "0")}.${extension}`, { type: mimeType });
    const clipboardData = new DataTransfer();
    clipboardData.items.add(file);
    clipboardData.setData("text/html", `<img src="${dataUrl}" alt="正文图片 ${index + 1}">`);
    clipboardData.setData("text/plain", sourceUrl || "");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData
    });
    const target = window.getSelection()?.anchorNode?.parentElement?.closest("[contenteditable='true'],[role='textbox']") || editor;
    target.dispatchEvent(event);
    return true;
  } catch {
    return false;
  }
}

async function insertAssistantImageAtPlaceholder(index) {
  const editor = currentAssistantEditor();
  if (!editor) return { ok: false, index, method: "none", message: "未找到正文编辑器。" };
  const placeholder = removeDuplicatePlaceholders(editor, index + 1) || findPlaceholder(editor, index + 1);
  if (!placeholder) return { ok: false, index, method: "none", message: `未找到正文图片 ${index + 1} 的占位符。` };
  const existing = mediaForAssetIndex(editor, index);
  if (existing) return { ok: true, index, method: "existing", media: existing };

  imageAssistantState.index = index;
  refreshAssistantTarget(true);
  const sourceUrl = assetUrl(imageAssistantState.draft.assets[index]);
  const blob = await imageBlobForClipboard(await fetchAssistantAssetBlob(sourceUrl));
  const dataUrl = await blobToDataUrl(blob);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const snapshot = captureMediaSnapshot(editor);
    let freshPlaceholder = removeDuplicatePlaceholders(editor, index + 1) || placeholder;
    await attemptPasteImage(editor, freshPlaceholder, blob, dataUrl, index, sourceUrl);
    let verified = await waitForNewMedia(editor, snapshot, freshPlaceholder);
    if (verified.nearby.length) {
      separateMediaFromPlaceholder(freshPlaceholder, verified.nearby[0]);
      markInsertedMedia(verified.nearby[0], index);
      freshPlaceholder.dataset.bsImageInserted = String(index + 1);
      return { ok: true, index, method: attempt === 1 ? "paste" : "paste-retry", media: verified.nearby[0] };
    }

    const loadedMisplaced = verified.addedMedia.filter(mediaIsLoaded);
    if (loadedMisplaced.length) {
      const misplaced = loadedMisplaced[loadedMisplaced.length - 1];
      if (moveMediaBeforePlaceholder(editor, freshPlaceholder, misplaced)) {
        await sleep(350);
        freshPlaceholder = findPlaceholder(editor, index + 1) || freshPlaceholder;
        verified = newMediaNearPlaceholder(editor, snapshot, freshPlaceholder);
        const loadedNearby = verified.nearby.find(mediaIsLoaded);
        if (loadedNearby) {
          separateMediaFromPlaceholder(freshPlaceholder, loadedNearby);
          markInsertedMedia(loadedNearby, index);
          freshPlaceholder.dataset.bsImageInserted = String(index + 1);
          return { ok: true, index, method: "paste-corrected", media: loadedNearby };
        }
      }
    }

    removeMediaAddedSince(editor, snapshot);
    removeDuplicatePlaceholders(editor, index + 1);
    await sleep(350);
  }

  return {
    ok: false,
    index,
    method: "paste",
    message: `正文图片 ${index + 1} 两次上传均未完成，已自动清理损坏图片框。请使用单张复制或手动上传。`
  };
}

async function imageBlobForClipboard(blob) {
  if (blob.type === "image/png") return blob;
  if (typeof createImageBitmap !== "function") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob((pngBlob) => {
      if (pngBlob) resolve(pngBlob);
      else reject(new Error("图片转为剪贴板格式失败。"));
    }, "image/png");
  });
}

async function copyCurrentAssistantImage() {
  if (!imageAssistantState) return;
  const { draft, index } = imageAssistantState;
  const placeholder = refreshAssistantTarget(true);
  if (placeholder) {
    setCaretBefore(placeholder);
    scheduleAssistantTargetRefresh();
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("当前浏览器不支持写入图片剪贴板。请使用下载兜底。");
  }
  const source = assetUrl(draft.assets[index]);
  const cached = imageAssistantState.copyBlobIndex === index ? imageAssistantState.copyBlobPromise : null;
  const prepared = cached
    ? await cached
    : { ok: true, blob: await imageBlobForClipboard(await fetchAssistantAssetBlob(source)) };
  if (!prepared.ok) throw prepared.error;
  const blob = prepared.blob;
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
}

function preloadCurrentClipboardImage() {
  if (!imageAssistantState) return;
  const { draft, index } = imageAssistantState;
  const source = assetUrl(draft.assets[index]);
  imageAssistantState.copyBlobIndex = index;
  imageAssistantState.copyBlobPromise = fetchAssistantAssetBlob(source)
    .then((blob) => imageBlobForClipboard(blob))
    .then((blob) => ({ ok: true, blob }))
    .catch((error) => ({ ok: false, error }));
}

function updateAssistantOverlay(message) {
  const overlay = assistantOverlay();
  if (!overlay || !imageAssistantState) return;
  const { draft, index } = imageAssistantState;
  const current = assetUrl(draft.assets[index]);
  overlay.querySelector(".bs-progress").textContent = `正文图片 ${index + 1} / ${draft.assets.length}`;
  overlay.querySelector("img").src = current;
  overlay.querySelector(".bs-url").textContent = current;
  overlay.querySelector(".bs-status").textContent = message;
  const toggle = overlay.querySelector("[data-action='auto-download']");
  if (toggle) toggle.checked = Boolean(imageAssistantState.autoDownload);
  const folder = overlay.querySelector("[data-action='download-folder']");
  if (folder && document.activeElement !== folder) folder.value = imageAssistantState.downloadFolder || "binance-square-assets";
  const saveAs = overlay.querySelector("[data-action='download-save-as']");
  if (saveAs) saveAs.checked = Boolean(imageAssistantState.downloadSaveAs);
}

function setAssistantBusy(isBusy) {
  if (!imageAssistantState) return;
  imageAssistantState.busy = isBusy;
  assistantOverlay()?.querySelectorAll("button,input").forEach((element) => {
    if (element.dataset.action === "close") return;
    element.disabled = isBusy;
  });
}

function setBatchResult(result) {
  if (!imageAssistantState) return;
  imageAssistantState.batchResults[result.index] = result;
  if (result.ok) imageAssistantState.verifiedIndices.add(result.index);
}

function markVerifiedPlaceholders() {
  if (!imageAssistantState) return;
  const editor = currentAssistantEditor();
  if (!editor) return;
  imageAssistantState.verifiedIndices.forEach((index) => {
    findPlaceholder(editor, index + 1)?.classList.add("bs-image-verified");
  });
}

function resultText(result) {
  if (!result) return "尚未自动插入或验证。";
  if (result.ok) {
    const method = result.method === "paste"
      ? "粘贴事件"
      : result.method === "paste-retry"
        ? "粘贴重试"
        : result.method === "paste-corrected"
          ? "粘贴后自动纠偏"
          : result.method === "existing"
            ? "已存在，跳过重复插入"
            : result.method === "manual-verify"
              ? "人工验证"
              : "自动插入";
    return `已插入，方式：${method}。`;
  }
  return result.message || "插入失败。";
}

function batchSummary() {
  if (!imageAssistantState) return "";
  const total = imageAssistantState.draft.assets.length;
  const done = imageAssistantState.batchResults.filter((result) => result?.ok).length;
  const failed = imageAssistantState.batchResults.filter((result) => result && !result.ok).length;
  return `批量插图完成：成功 ${done}/${total}${failed ? `，失败 ${failed}` : ""}。占位符已保留，请逐处审核。`;
}

async function focusReviewSlot(index, prefix = "") {
  if (!imageAssistantState) return;
  const total = imageAssistantState.draft.assets.length;
  imageAssistantState.index = Math.max(0, Math.min(total - 1, index));
  await prepareAssistantImage(false, true, { preserveStatus: true });
  const result = imageAssistantState.batchResults[imageAssistantState.index];
  const message = [
    prefix || `审核第 ${imageAssistantState.index + 1} / ${total} 处配图。`,
    resultText(result),
    "请检查图片是否在黄色框前方、顺序是否正确。确认全部没问题后，再点击“确认审核通过，删除所有占位符”。"
  ].join("\n");
  updateAssistantOverlay(message);
  markVerifiedPlaceholders();
  schedulePlaceholderScroll(imageAssistantState.index);
}

async function moveReviewSlot(direction) {
  if (!imageAssistantState) return;
  await focusReviewSlot(imageAssistantState.index + direction);
}

async function batchInsertAllImages() {
  if (!imageAssistantState || imageAssistantState.busy) return;
  setAssistantBusy(true);
  const total = imageAssistantState.draft.assets.length;
  try {
    for (let index = 0; index < total; index += 1) {
      const previous = imageAssistantState.batchResults[index];
      const existing = mediaForAssetIndex(currentAssistantEditor(), index);
      if (previous?.ok || existing) {
        removeDuplicatePlaceholders(currentAssistantEditor(), index + 1);
        if (existing && !previous?.ok) setBatchResult({ ok: true, index, method: "existing", media: existing });
        continue;
      }
      imageAssistantState.index = index;
      updateAssistantOverlay(`正在自动插入第 ${index + 1} / ${total} 张配图...\n会等待图片真实加载；失败项自动清理并重试。`);
      let result;
      try {
        result = await insertAssistantImageAtPlaceholder(index);
      } catch (error) {
        result = {
          ok: false,
          index,
          method: "none",
          message: `正文图片 ${index + 1} 处理失败：${error.message || String(error)}`
        };
      }
      setBatchResult(result);
      markVerifiedPlaceholders();
      await sleep(250);
    }
    const firstProblem = imageAssistantState.batchResults.findIndex((result) => !result?.ok);
    await focusReviewSlot(firstProblem >= 0 ? firstProblem : 0, batchSummary());
  } catch (error) {
    updateAssistantOverlay(`批量插图中断：${error.message || String(error)}\n已插入的图片和占位符会保留，请人工检查。`);
  } finally {
    setAssistantBusy(false);
  }
}

function removeAllImagePlaceholders() {
  const editor = currentAssistantEditor();
  if (!editor) {
    updateAssistantOverlay("未找到正文编辑器，无法删除占位符。");
    return;
  }
  const confirmed = window.confirm("确认所有配图都已审核无误，并删除全部“正文图片 N”占位符吗？");
  if (!confirmed) return;
  const placeholders = allPlaceholders(editor);
  placeholders.forEach((placeholder) => placeholder.remove());
  dispatchInput(editor, "deleteContentBackward");
  clearAssistantHighlights();
  updateAssistantOverlay(`已删除 ${placeholders.length} 个图片占位符。请最后检查一遍正文图片数量、顺序和封面后再发布。`);
}

async function prepareAssistantImage(download = false, resetSnapshot = false, options = {}) {
  if (!imageAssistantState) return;
  clearAssistantHighlights();
  const { draft, index } = imageAssistantState;
  const editor = currentAssistantEditor();
  const placeholder = refreshAssistantTarget(true);
  const toolbar = findImageToolbarButton(editor);
  if (resetSnapshot || imageAssistantState.snapshotIndex !== index) {
    imageAssistantState.mediaSnapshot = captureMediaSnapshot(editor);
    imageAssistantState.snapshotIndex = index;
  }

  if (placeholder) {
    setCaretBefore(placeholder);
    scheduleAssistantTargetRefresh();
    schedulePlaceholderScroll(index);
  }
  if (toolbar) toolbar.classList.add("bs-image-toolbar-target");

  const messages = [];
  messages.push("建议点击“复制当前图片”，然后在高亮位置直接粘贴。");
  messages.push(placeholder ? `已滚动至第 ${index + 1} 张图片位置，并会持续闪烁高亮。` : "未找到对应占位符，请手动将光标放到目标位置。");
  messages.push(toolbar ? "若粘贴失败，也可以用绿色边框标出的图片按钮手动上传。" : "若粘贴失败，请点击币安工具栏中的图片图标手动上传。");
  if (download) {
    try {
      const filename = await downloadAssistantAsset(assetUrl(draft.assets[index]), index + 1);
      messages.push(`已下载兜底文件：Downloads/${filename}`);
    } catch (error) {
      messages.push(`自动下载失败：${error.message}`);
    }
  }
  if (!options.preserveStatus) updateAssistantOverlay(messages.join("\n"));
  preloadCurrentClipboardImage();
  markVerifiedPlaceholders();
}

function finishCurrentImage() {
  if (!imageAssistantState) return;
  const { index, draft } = imageAssistantState;
  const verification = verifyCurrentImage();
  if (!verification.ok) {
    updateAssistantOverlay(verification.message);
    return;
  }
  separateMediaFromPlaceholder(verification.placeholder, verification.media);
  markInsertedMedia(verification.media, index);
  setBatchResult({ ok: true, index, method: "manual-verify", media: verification.media });
  verification.placeholder.classList.add("bs-image-verified");
  if (index >= draft.assets.length - 1) {
    updateAssistantOverlay("已验证最后一张图片确实插入到对应位置。\n全部正文图片已处理。请用审核跳转再检查一遍，然后点击“确认审核通过，删除所有占位符”。");
    markVerifiedPlaceholders();
    return;
  }
  imageAssistantState.index += 1;
  prepareAssistantImage(imageAssistantState.autoDownload, true);
}

function previousAssistantImage() {
  if (!imageAssistantState || imageAssistantState.index === 0) return;
  imageAssistantState.index -= 1;
  prepareAssistantImage(imageAssistantState.autoDownload, true);
}

function closeImageAssistant() {
  stopAssistantTargetWatcher();
  clearAssistantHighlights();
  assistantOverlay()?.remove();
  imageAssistantState = null;
}

function createImageAssistant(draft) {
  const editables = editableElements();
  const editor = findBodyEditor(editables);
  if (!editor) throw new Error("未找到正文富文本区域，无法启动插图助手。");
  if (!draft.assets?.length) throw new Error("草稿中没有正文图片素材。");

  ensureAssistantStyles();
  assistantOverlay()?.remove();
  const overlay = document.createElement("aside");
  overlay.id = "bs-image-assistant";
  overlay.innerHTML = `
    <h3>币安批量插图助手</h3>
    <p><strong>复制图片后，在黄色框位置粘贴，再点验证。</strong></p>
    <p class="bs-progress"></p>
    <img alt="当前待上传图片">
    <p class="bs-url"></p>
    <p class="bs-status"></p>
    <label class="bs-option"><input type="checkbox" data-action="auto-download"> 自动下载兜底文件</label>
    <label class="bs-folder-option">下载目录下的子文件夹
      <input type="text" data-action="download-folder" placeholder="binance-square-assets">
    </label>
    <label class="bs-option"><input type="checkbox" data-action="download-save-as"> 每次弹出“另存为”</label>
    <p class="bs-download-hint">静默下载只能保存到 Chrome 默认下载目录下的子文件夹。</p>
    <div class="bs-buttons">
      <button class="bs-primary bs-wide" data-action="batch">一键自动插入全部配图（保留占位符）</button>
      <button class="bs-primary bs-wide" data-action="copy">复制当前图片，然后粘贴</button>
      <button data-action="locate">重新定位</button>
      <button data-action="download">下载当前图片</button>
      <button data-action="cover">下载封面</button>
      <button data-action="previous">上一张素材</button>
      <button class="bs-primary bs-wide" data-action="next">验证当前图片（保留占位符）</button>
      <button data-action="review-prev">审核上一处</button>
      <button data-action="review-next">审核下一处</button>
      <button class="bs-danger" data-action="remove-placeholders">确认审核通过，删除所有占位符</button>
      <button data-action="close">关闭助手</button>
    </div>
  `;
  document.body.append(overlay);
  imageAssistantState = {
    draft,
    editor,
    index: 0,
    batchResults: [],
    verifiedIndices: new Set(),
    autoDownload: localStorage.getItem("bsAssistantAutoDownload") === "true",
    downloadFolder: "binance-square-assets",
    downloadSaveAs: false
  };
  startAssistantTargetWatcher();
  chrome.storage.local.get(["downloadFolder", "downloadSaveAs"]).then((settings) => {
    if (!imageAssistantState) return;
    imageAssistantState.downloadFolder = settings.downloadFolder || "binance-square-assets";
    imageAssistantState.downloadSaveAs = Boolean(settings.downloadSaveAs);
    updateAssistantOverlay(`下载设置已载入：${imageAssistantState.downloadSaveAs ? "每次弹出另存为" : `Downloads/${imageAssistantState.downloadFolder}/`}`);
  });

  overlay.addEventListener("click", async (event) => {
    const action = event.target.closest("button")?.dataset.action;
    if (action === "batch") batchInsertAllImages();
    if (action === "copy") {
      try {
        await copyCurrentAssistantImage();
        updateAssistantOverlay("已复制当前图片到剪贴板。\n现在在黄色框位置按 Cmd+V / Ctrl+V，图片出现后再点击验证。");
      } catch (error) {
        updateAssistantOverlay(`复制失败：${error.message}\n可以打开“自动下载兜底文件”，或点击“下载当前图片”后用币安图片按钮上传。`);
      }
    }
    if (action === "locate") prepareAssistantImage(false);
    if (action === "download") prepareAssistantImage(true);
    if (action === "cover") {
      try {
        const filename = await downloadAssistantAsset(draft.cover, 0, "cover");
        updateAssistantOverlay(`已准备封面：Downloads/${filename}`);
      } catch (error) {
        updateAssistantOverlay(`封面下载失败：${error.message}`);
      }
    }
    if (action === "previous") previousAssistantImage();
    if (action === "next") finishCurrentImage();
    if (action === "review-prev") moveReviewSlot(-1);
    if (action === "review-next") moveReviewSlot(1);
    if (action === "remove-placeholders") removeAllImagePlaceholders();
    if (action === "close") closeImageAssistant();
  });

  overlay.addEventListener("change", (event) => {
    if (!imageAssistantState) return;
    const action = event.target?.dataset?.action;
    if (action === "auto-download") {
      imageAssistantState.autoDownload = event.target.checked;
      localStorage.setItem("bsAssistantAutoDownload", String(imageAssistantState.autoDownload));
      if (imageAssistantState.autoDownload) {
        prepareAssistantImage(true);
      } else {
        updateAssistantOverlay("已关闭自动下载。现在默认使用“复制当前图片 → 粘贴 → 验证”的流程。");
      }
    }
    if (action === "download-save-as") {
      imageAssistantState.downloadSaveAs = event.target.checked;
      chrome.storage.local.set({ downloadSaveAs: imageAssistantState.downloadSaveAs });
      updateAssistantOverlay(imageAssistantState.downloadSaveAs
        ? "已开启每次弹出“另存为”，下载时可以选择任意位置。"
        : `已关闭“另存为”，文件将保存到 Downloads/${imageAssistantState.downloadFolder}/`);
    }
  });

  overlay.addEventListener("focusout", (event) => {
    if (event.target?.dataset?.action !== "download-folder" || !imageAssistantState) return;
    imageAssistantState.downloadFolder = sanitizeDownloadFolder(event.target.value);
    event.target.value = imageAssistantState.downloadFolder;
    chrome.storage.local.set({ downloadFolder: imageAssistantState.downloadFolder });
    updateAssistantOverlay(`下载子文件夹已保存：Downloads/${imageAssistantState.downloadFolder}/`);
  });

  prepareAssistantImage(imageAssistantState.autoDownload, true);
  return { imageCount: draft.assets.length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_IMAGE_ASSISTANT") {
    try {
      sendResponse({ ok: true, result: createImageAssistant(message.draft || {}) });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
    return;
  }
  if (message?.type !== "FILL_BINANCE_DRAFT") return;
  try {
    sendResponse({ ok: true, result: fillDraft(message.draft || {}) });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
});
