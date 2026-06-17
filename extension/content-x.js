function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanMultilineText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizedForCompare(value) {
  return cleanText(value).replace(/\s+/g, "");
}

function normalizeTweetHandles(value) {
  const lines = String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());
  const merged = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const handle = line.match(/^@([A-Za-z][A-Za-z0-9_]{0,14})$/)?.[1] || "";
    const previous = merged[merged.length - 1] || "";
    const next = lines[index + 1] || "";
    const shouldJoin = handle &&
      previous &&
      next &&
      !/[。！？!?]$/.test(previous) &&
      !/^(?:[#•*~-]|\d+[.)、])/.test(next);
    if (shouldJoin) {
      merged[merged.length - 1] = `${previous} ${handle} ${next}`.replace(/[ \t]{2,}/g, " ");
      index += 1;
      continue;
    }
    merged.push(line.replace(/(?<![A-Za-z0-9._%+-])@([A-Za-z0-9_]{1,15})\b/g, "$1"));
  }
  return merged
    .join("\n")
    .replace(/(?<![A-Za-z0-9._%+-])@([A-Za-z0-9_]{1,15})\b/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([，。！？：；、])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function articleUiLine(line) {
  return /^(Article|Follow|Following|Show more|Show translation|Post your reply|Reply|Boost|Home|Explore|Notifications|Bookmarks|Articles|Profile|More|Relevant people|What.s happening|Terms of Service|Privacy Policy|Cookie Policy|Accessibility|Ads info)$/i.test(line) ||
    /^@\w{1,20}$/.test(line) ||
    /^\d+(\.\d+)?[KMB]?\s*(Views|次浏览|Likes|点赞|Retweets|转帖|Replies|回复)$/i.test(line) ||
    /^[·•]\s*/.test(line) ||
    /^\d{1,2}:\d{2}\s*(AM|PM)?/i.test(line);
}

function articleStopLine(line) {
  return /^(Show more|Post your reply|Relevant people|What.s happening|Terms of Service|Privacy Policy|Cookie Policy|Accessibility|Ads info)$/i.test(line);
}

function titleLikeLine(line) {
  return line.length >= 6 && line.length <= 120 && /[\u4e00-\u9fffA-Za-z]/.test(line);
}

function visibleFallbackBlocks(main, title) {
  const rawLines = String(main.innerText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());
  const lines = rawLines.filter(Boolean);
  if (!lines.length) return [];

  const titleKey = normalizedForCompare(title);
  let startIndex = titleKey
    ? lines.findIndex((line) => normalizedForCompare(line) === titleKey)
    : -1;
  if (startIndex < 0) {
    startIndex = lines.findIndex((line) => titleLikeLine(line) && !articleUiLine(line));
  }
  if (startIndex < 0) return [];

  const fallback = [];
  const seen = new Set();
  const pushBlock = (type, text) => {
    const cleaned = cleanText(text);
    const key = normalizedForCompare(cleaned);
    if (!cleaned || seen.has(key)) return;
    seen.add(key);
    fallback.push({
      type,
      text: cleaned,
      html: type === "heading" ? `<h2>${escapeHtml(cleaned)}</h2>` : `<p>${escapeHtml(cleaned)}</p>`
    });
  };

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (articleStopLine(line)) break;
    if (articleUiLine(line)) continue;
    if (line.length < 12 && !/[。！？.!?]$/.test(line)) continue;
    pushBlock("paragraph", line);
  }
  return fallback.length ? fallback : [];
}

function sourceTextForBlocks(blocks) {
  return cleanText(blocks.map((block) => block.text).join(" "));
}

function coverageFor(sourceText, blocks) {
  const extractedText = sourceTextForBlocks(blocks);
  return {
    extractedText,
    coverage: sourceText.length ? extractedText.length / sourceText.length : 0
  };
}

function extractArticle() {
  const main = document.querySelector("main");
  if (!main) throw new Error("页面中没有找到文章主体。");

  const bodyRoot = findBodyRoot(main);
  if (!bodyRoot) throw new Error("无法定位 X Article 正文块。");

  const title = extractTitle(main, bodyRoot);
  let blocks = extractBlocks(bodyRoot);
  const sourceText = cleanText(bodyRoot.innerText);
  let diagnosticSourceText = sourceText;
  let { extractedText, coverage } = coverageFor(sourceText, blocks);
  let extractionMode = "structured";
  if (coverage < 0.98) {
    const fallbackBlocks = visibleFallbackBlocks(main, title);
    const fallbackSourceText = sourceTextForBlocks(fallbackBlocks);
    const fallbackCoverage = fallbackSourceText.length && fallbackBlocks.length
      ? coverageFor(fallbackSourceText, fallbackBlocks).coverage
      : 0;
    if (fallbackBlocks.length && fallbackCoverage > coverage) {
      blocks = fallbackBlocks;
      diagnosticSourceText = fallbackSourceText;
      extractedText = fallbackSourceText;
      coverage = fallbackCoverage;
      extractionMode = "visible-text-fallback";
    }
  }
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
      sourceCharacters: diagnosticSourceText.length,
      extractedCharacters: extractedText.length,
      coverage: Number(coverage.toFixed(4)),
      blockCount: blocks.length,
      extractionMode
    }
  };
}

function currentStatusId() {
  return location.pathname.match(/\/status\/(\d+)/)?.[1] || "";
}

function directTweetText(article) {
  return [...article.querySelectorAll("[data-testid='tweetText']")]
    .find((element) => element.closest("article") === article) || null;
}

function findTweetArticle() {
  const tweetId = currentStatusId();
  const articles = [...document.querySelectorAll("article")]
    .filter((article) => directTweetText(article))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  if (!articles.length) return null;
  if (tweetId) {
    const matched = articles.find((article) =>
      [...article.querySelectorAll("a[href*='/status/']")]
        .some((link) => link.href.includes(`/status/${tweetId}`))
    );
    if (matched) return matched;
  }
  return articles[0];
}

function extractTweetImages(article) {
  const seen = new Set();
  return [...article.querySelectorAll("img[src*='pbs.twimg.com/media']")]
    .filter((image) => image.closest("article") === article)
    .map((image) => ({
      url: originalMediaUrl(image.currentSrc || image.src),
      alt: cleanText(image.alt)
    }))
    .filter((asset) => {
      if (!asset.url || seen.has(asset.url)) return false;
      seen.add(asset.url);
      return true;
    });
}

function extractTweet() {
  const article = findTweetArticle();
  if (!article) throw new Error("未找到当前 X 推文正文。请先打开单条推文详情页。");
  const textElement = directTweetText(article);
  const text = normalizeTweetHandles(cleanMultilineText(textElement?.innerText));
  if (!text) throw new Error("当前推文正文为空或无法读取。");
  const assets = extractTweetImages(article);

  return {
    version: 1,
    source: "x-tweet",
    sourceUrl: location.href,
    extractedAt: new Date().toISOString(),
    text,
    assets,
    diagnostics: {
      characters: text.length,
      imageCount: assets.length
    }
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING_X_CONTENT") {
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === "EXTRACT_X_TWEET") {
    try {
      sendResponse({ ok: true, tweet: extractTweet() });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
    return;
  }
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
