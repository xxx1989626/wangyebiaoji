// content.js - 工业级架构版本

let config = {
  enabled: true,
  bold: false,
  italic: false,
  strikethrough: false,
  highlight: true,
  highlightColor: '#FFFF00',
  highlightOpacity: 50,
  mainColor: '#4CAF50',
  duration: '1h',
  timeFormat: 'YYYY-MM-DD HH:MM:SS',
  showTime: false,
  autoRulesEnabled: false,
  blacklist: [],
  whitelist: [],
  maxLinksPerPage: 1000
};

let markedLinks = new Set();
let linkElementCache = new Map();
let isProcessing = false;
let currentDomain = '';

// 初始化
async function init() {
  currentDomain = getDomain(window.location.href);
  await loadConfig();
  await loadMarks();
  setupEventListeners();
  scanAndMarkLinks();
}

// 加载配置
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['linkMarkerConfig'], (result) => {
      if (result.linkMarkerConfig) {
        config = { ...config, ...result.linkMarkerConfig };
      }
      resolve();
    });
  });
}

// 从background加载标记数据
async function loadMarks() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getAllData' }, (response) => {
      if (response?.success && response.data) {
        const domainMarks = response.data[currentDomain] || {};
        markedLinks.clear();

        Object.keys(domainMarks).forEach(url => {
          const mark = domainMarks[url];
          if (!isExpired(mark)) {
            markedLinks.add(url);
          }
        });

        console.log(`[Link Marker] 已加载 ${markedLinks.size} 条标记`);
      }
      resolve();
    });
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 点击事件 - 使用事件委托
  document.addEventListener('click', (e) => {
    console.log('[Link Marker] 点击事件触发', e.target.tagName);

    if (!config.enabled) {
      console.log('[Link Marker] 扩展未启用');
      return;
    }

    const link = e.target.closest('a');
    if (!link) {
      console.log('[Link Marker] 未找到链接元素');
      return;
    }

    if (!link.href) {
      console.log('[Link Marker] 链接没有href');
      return;
    }

    const linkUrl = normalizeUrl(link.href);
    console.log('[Link Marker] 点击的URL:', linkUrl);

    if (isDomainInList(linkUrl, config.blacklist)) {
      console.log('[Link Marker] URL在黑名单中');
      return;
    }

    if (config.autoRulesEnabled && !isDomainInList(linkUrl, config.whitelist)) {
      console.log('[Link Marker] URL不在白名单中');
      return;
    }

    if (markedLinks.has(linkUrl)) {
      console.log('[Link Marker] URL已被标记');
      return;
    }

    if (markedLinks.size >= config.maxLinksPerPage) {
      showLimitWarning();
      return;
    }

    console.log('[Link Marker] 开始标记链接');
    markLink(linkUrl);
  }, false);

  // 来自background的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'markAdded') {
      markedLinks.add(message.url);
      markLinkOnPage(message.url, message.markData);
      sendResponse({ success: true });
    } else if (message.action === 'markRemoved') {
      markedLinks.delete(message.url);
      unmarkLinkOnPage(message.url);
      sendResponse({ success: true });
    } else if (message.action === 'updateMarks') {
      loadMarks().then(() => {
        scanAndMarkLinks();
        sendResponse({ success: true });
      });
      return true;
    }
    return true;
  });

  // MutationObserver - 增量扫描新链接
  const observer = new MutationObserver((mutations) => {
    let hasNewLinks = false;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'A') {
              hasNewLinks = true;
              break;
            }
            if (node.querySelectorAll && node.querySelectorAll('a').length > 0) {
              hasNewLinks = true;
              break;
            }
          }
        }
      }
      if (hasNewLinks) break;
    }

    if (hasNewLinks && !isProcessing) {
      requestAnimationFrame(() => scanAndMarkLinks());
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// 扫描并标记所有链接
function scanAndMarkLinks() {
  if (!config.enabled || isProcessing) return;

  isProcessing = true;

  const allLinks = document.querySelectorAll('a[href]');
  let marked = 0;

  allLinks.forEach(link => {
    if (!isValidLink(link.href)) return;

    const linkUrl = normalizeUrl(link.href);

    if (markedLinks.has(linkUrl) && !link.hasAttribute('data-link-marker')) {
      link.setAttribute('data-link-marker', 'true');
      applyStyles(link);
      marked++;
    }
  });

  console.log(`[Link Marker] 本次标记 ${marked} 个链接`);
  isProcessing = false;
}

// 标记链接
function markLink(linkUrl) {
  if (markedLinks.has(linkUrl)) return;

  markedLinks.add(linkUrl);

  const linkElements = getLinkElements(linkUrl);
  linkElements.forEach(link => {
    if (!link.hasAttribute('data-link-marker')) {
      link.setAttribute('data-link-marker', 'true');
      applyStyles(link);
    }
  });

  chrome.runtime.sendMessage({
    action: 'markLink',
    url: linkUrl
  });
}

// 取消标记链接
function unmarkLink(linkUrl) {
  if (!markedLinks.has(linkUrl)) return;

  markedLinks.delete(linkUrl);
  unmarkLinkOnPage(linkUrl);

  chrome.runtime.sendMessage({
    action: 'unmarkLink',
    url: linkUrl
  });
}

// 在页面上标记链接
function markLinkOnPage(linkUrl, markData) {
  const linkElements = getLinkElements(linkUrl);

  linkElements.forEach(link => {
    if (!link.hasAttribute('data-link-marker')) {
      link.setAttribute('data-link-marker', 'true');
      applyStyles(link);
    }
  });
}

// 在页面上取消标记
function unmarkLinkOnPage(linkUrl) {
  const linkElements = getLinkElements(linkUrl);

  linkElements.forEach(link => {
    if (link.hasAttribute('data-link-marker')) {
      link.removeAttribute('data-link-marker');
      removeStyles(link);
    }
  });
}

// 获取链接元素（带缓存）
function getLinkElements(linkUrl) {
  if (linkElementCache.has(linkUrl)) {
    return linkElementCache.get(linkUrl);
  }

  const results = [];
  const allLinks = document.querySelectorAll('a[href]');

  allLinks.forEach(link => {
    if (normalizeUrl(link.href) === linkUrl) {
      results.push(link);
    }
  });

  linkElementCache.set(linkUrl, results);
  return results;
}

// 应用样式
function applyStyles(element) {
  if (config.highlight) {
    element.style.backgroundColor = config.highlightColor;
    element.style.opacity = (100 - config.highlightOpacity) / 100;
    element.style.padding = '0 2px';
    element.style.borderRadius = '2px';
  }

  element.style.color = config.mainColor;
  element.style.fontWeight = config.bold ? 'bold' : '';
  element.style.fontStyle = config.italic ? 'italic' : '';
  element.style.textDecoration = config.strikethrough ? 'line-through' : '';
}

// 移除样式
function removeStyles(element) {
  element.style.backgroundColor = '';
  element.style.opacity = '';
  element.style.padding = '';
  element.style.borderRadius = '';
  element.style.color = '';
  element.style.fontWeight = '';
  element.style.fontStyle = '';
  element.style.textDecoration = '';
}

// 显示标记数量上限警告
function showLimitWarning() {
  const warningDiv = document.createElement('div');
  warningDiv.className = 'link-marker-warning';
  warningDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    background-color: #ff9800;
    color: white;
    border-radius: 4px;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    max-width: 300px;
  `;

  const title = chrome.i18n.getMessage('markLimitReached');
  const warningText = chrome.i18n.getMessage('markLimitWarning', [markedLinks.size, config.maxLinksPerPage]);

  warningDiv.innerHTML = `
    <strong>${title}</strong>
    <p style="margin: 4px 0 0 0;">${warningText}</p>
  `;

  document.body.appendChild(warningDiv);

  setTimeout(() => {
    warningDiv.style.transition = 'opacity 0.3s ease';
    warningDiv.style.opacity = '0';
    setTimeout(() => {
      if (warningDiv.parentNode) {
        document.body.removeChild(warningDiv);
      }
    }, 300);
  }, 5000);
}

// 工具函数
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function normalizeUrl(url) {
  try {
    if (url.startsWith('//')) {
      url = window.location.protocol + url;
    } else if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    const urlObj = new URL(url);
    return urlObj.href;
  } catch {
    return url;
  }
}

function isValidLink(href) {
  if (!href) return false;
  return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//') || href.startsWith('/');
}

function isExpired(mark) {
  if (!mark || mark.duration === 'permanent') return false;

  const now = Date.now();
  let expireTime;

  switch (mark.duration) {
    case '1h': expireTime = 60 * 60 * 1000; break;
    case '1d': expireTime = 24 * 60 * 60 * 1000; break;
    case '7d': expireTime = 7 * 24 * 60 * 60 * 1000; break;
    case '30d': expireTime = 30 * 24 * 60 * 60 * 1000; break;
    default: expireTime = 7 * 24 * 60 * 60 * 1000;
  }

  return now - mark.timestamp > expireTime;
}

function isDomainInList(url, list) {
  if (!url || !list || list.length === 0) return false;

  try {
    const urlObj = new URL(url);
    const fullPath = urlObj.hostname + urlObj.pathname;

    return list.some(pattern => {
      // 将通配符模式转换为正则表达式
      // 支持: *.domain.com, domain.com/path/*, domain.com
      const regexPattern = pattern
        .replace(/\./g, '\\.')  // 转义点
        .replace(/\*/g, '.*')    // * 匹配任意字符
        .replace(/\?/g, '.');    // ? 匹配单个字符

      const regex = new RegExp('^' + regexPattern, 'i');
      return regex.test(fullPath) || regex.test(urlObj.hostname);
    });
  } catch (e) {
    return false;
  }
}

function formatTime(timestamp, format = 'YYYY-MM-DD HH:MM:SS') {
  const date = new Date(timestamp);
  const pad = (n) => n.toString().padStart(2, '0');

  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const M = pad(date.getMinutes());
  const s = pad(date.getSeconds());

  if (format === 'YYYY-MM-DD HH:MM:SS') {
    return `${y}-${m}-${d} ${h}:${M}:${s}`;
  } else if (format === 'YYYY-MM-DD') {
    return `${y}-${m}-${d}`;
  } else if (format === 'MM-DD HH:MM') {
    return `${m}-${d} ${h}:${M}`;
  } else if (format === 'YYYY-MM-DD_HH-MM-SS') {
    return `${y}-${m}-${d}_${h}-${M}-${s}`;
  } else {
    return date.toLocaleString();
  }
}

// 启动
init();