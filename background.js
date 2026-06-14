function extensionFor(url) {
  try {
    const parsed = new URL(url);
    const format = parsed.searchParams.get("format");
    if (/^(jpg|jpeg|png|webp)$/i.test(format || "")) return format.toLowerCase().replace("jpeg", "jpg");
    const match = parsed.pathname.match(/\.(jpg|jpeg|png|webp)$/i);
    if (match) return match[1].toLowerCase().replace("jpeg", "jpg");
  } catch {}
  return "jpg";
}

function mimeTypeFor(url) {
  const extension = extensionFor(url);
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function sanitizeDownloadFolder(value) {
  const normalized = String(value || "binance-square-assets")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[<>:"|?*\u0000-\u001f]/g, "-").trim())
    .filter(Boolean)
    .join("/");
  return normalized || "binance-square-assets";
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FETCH_ARTICLE_ASSET") {
    fetch(message.url, { credentials: "omit", cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`图片读取失败：HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || mimeTypeFor(message.url);
        if (!/^image\//i.test(contentType)) throw new Error(`图片类型异常：${contentType}`);
        const buffer = await response.arrayBuffer();
        sendResponse({
          ok: true,
          dataUrl: `data:${contentType};base64,${arrayBufferToBase64(buffer)}`
        });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }

  if (message?.type !== "DOWNLOAD_ARTICLE_ASSET") return;
  const index = Number(message.index) || 1;
  const kind = message.kind === "cover" ? "cover" : "image";
  const extension = extensionFor(message.url);
  const folder = sanitizeDownloadFolder(message.folder);
  const filename = kind === "cover"
    ? `${folder}/00-cover.${extension}`
    : `${folder}/${String(index).padStart(2, "0")}-image.${extension}`;

  chrome.downloads.download({
    url: message.url,
    filename,
    conflictAction: "overwrite",
    saveAs: Boolean(message.saveAs)
  }).then((downloadId) => sendResponse({ ok: true, downloadId, filename }))
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});
