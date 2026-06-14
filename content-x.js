function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function absoluteUrl(value) {
  try {
    return new URL(value, location.href).href;
  } catch {
    return value || "";
  }
}

function originalMediaUrl(value) {
  const url = absoluteUrl(value);
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "pbs.twimg.com") parsed.searchParams.set("name", "large");
    return parsed.href;
  } catch {
    return url;
  }
}

function commonAncestor(elements) {
  if (!elements.length) return null;
  const firstAncestors = [];
  let current = elements[0];
  while (current) {
    firstAncestors.push(current);
    current = current.parentElement;
  }
  return firstAncestors.find((ancestor) => elements.every((element) => ancestor.contains(element))) || null;
}

function findBodyRoot(main) {
  const headings = [...main.querySelectorAll("h1.longform-header-one, h2.longform-header-two, h3.longform-header-three")];
  if (headings.length) return commonAncestor(headings);

  const draftBlocks = [...main.querySelectorAll("[data-block='true']")];
  return commonAncestor(draftBlocks) || main;
}

function extractTitle(main, bodyRoot) {
  const titleFromDocument = document.title.match(/on X:\s*"([^"]+)"/)?.[1];
  if (titleFromDocument) return cleanText(titleFromDocument);

  const bodyText = cleanText(bodyRoot?.innerText);
  const candidates = [...main.querySelectorAll("[dir='auto'], [dir='ltr']")]
    .filter((element) => !bodyRoot?.contains(element))
    .map((element) => cleanText(element.innerText))
    .filter((text) => text.length >= 8 && text.length <= 180 && !bodyText.startsWith(text));
  return candidates[0] || "未命名 X Article";
}

function inlineHtml(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue);
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  if (node.tagName === "IMG" || node.tagName === "SVG") return "";
  const inner = [...node.childNodes].map(inlineHtml).join("");
  if (!inner) return "";

  if (node.tagName === "A") {
    const href = absoluteUrl(node.getAttribute("href"));
    return href ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
  }

  const style = node.style;
  let result = inner;
  if (node.tagName === "STRONG" || node.tagName === "B" || /bold|[6-9]00/.test(style.fontWeight || "")) {
    result = `<strong>${result}</strong>`;
  }
  if (node.tagName === "EM" || node.tagName === "I" || style.fontStyle === "italic") {
    result = `<em>${result}</em>`;
  }
  if (node.tagName === "U" || (style.textDecoration || "").includes("underline")) {
    result = `<u>${result}</u>`;
  }
  if (node.tagName === "S" || (style.textDecoration || "").includes("line-through")) {
    result = `<s>${result}</s>`;
  }
  return result;
}

function largeImageIn(element) {
  return [...element.querySelectorAll("img")].find((image) =>
    (image.naturalWidth || 0) >= 600 && (image.naturalHeight || 0) >= 300
  ) || null;
}

function blockFromElement(element) {
  const heading = element.matches("h1,h2,h3") ? element : element.querySelector("h1,h2,h3");
  if (heading) {
    return {
      type: "heading",
      text: cleanText(heading.innerText),
      html: `<h2>${inlineHtml(heading)}</h2>`
    };
  }

  if (element.matches("ul,ol")) {
    const tag = element.tagName.toLowerCase();
    const items = [...element.children].filter((child) => child.tagName === "LI");
    return {
      type: tag === "ol" ? "orderedList" : "bulletList",
      text: items.map((item) => cleanText(item.innerText)).join(" "),
      items: items.map((item) => cleanText(item.innerText)),
      html: `<${tag}>${items.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</${tag}>`
    };
  }

  if (element.matches("blockquote")) {
    return {
      type: "blockquote",
      text: cleanText(element.innerText),
      html: `<blockquote>${inlineHtml(element)}</blockquote>`
    };
  }

  const image = largeImageIn(element);
  if (image) {
    const url = originalMediaUrl(image.currentSrc || image.src);
    return {
      type: "image",
      text: "",
      url,
      alt: cleanText(image.alt),
      html: `<img src="${escapeHtml(url)}" alt="${escapeHtml(image.alt)}">`
    };
  }

  if (element.querySelector("[role='separator']") || element.matches("hr")) {
    return { type: "divider", text: "", html: "<hr>" };
  }

  const text = cleanText(element.innerText);
  if (!text) return null;
  return { type: "paragraph", text, html: `<p>${inlineHtml(element)}</p>` };
}

function extractBlocks(bodyRoot) {
  return [...bodyRoot.children].map(blockFromElement).filter(Boolean);
}

function extractArticle() {
  const main = document.querySelector("main");
  if (!main) throw new Error("页面中没有找到文章主体。");

  const bodyRoot = findBodyRoot(main);
  if (!bodyRoot) throw new Error("无法定位 X Article 正文块。");

  const title = extractTitle(main, bodyRoot);
  const blocks = extractBlocks(bodyRoot);
  const bodyImages = blocks.filter((block) => block.type === "image").map((block) => ({
    url: block.url,
    alt: block.alt
  }));
  const bodyImageUrls = new Set(bodyImages.map((asset) => asset.url));
  const coverImage = [...main.querySelectorAll("img")]
    .find((image) => {
      const url = originalMediaUrl(image.currentSrc || image.src);
      return (image.naturalWidth || 0) >= 600 && (image.naturalHeight || 0) >= 300 && !bodyImageUrls.has(url);
    });

  const sourceText = cleanText(bodyRoot.innerText);
  const extractedText = cleanText(blocks.map((block) => block.text).join(" "));
  const coverage = sourceText.length ? extractedText.length / sourceText.length : 0;

  return {
    version: 2,
    source: "x-article",
    sourceUrl: location.href,
    extractedAt: new Date().toISOString(),
    title,
    cover: coverImage ? originalMediaUrl(coverImage.currentSrc || coverImage.src) : "",
    assets: bodyImages,
    blocks,
    diagnostics: {
      sourceCharacters: sourceText.length,
      extractedCharacters: extractedText.length,
      coverage: Number(coverage.toFixed(4)),
      blockCount: blocks.length
    }
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_X_ARTICLE") return;
  try {
    const article = extractArticle();
    if (article.diagnostics.coverage < 0.98) {
      sendResponse({
        ok: false,
        error: `正文提取覆盖率仅 ${(article.diagnostics.coverage * 100).toFixed(1)}%，已停止导入以避免漏文。`
      });
      return;
    }
    sendResponse({ ok: true, article });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
});
