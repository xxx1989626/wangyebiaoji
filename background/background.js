// background.js - 工业级架构版本

// 内存数据库 - 使用 Set 实现 O(1) 查询
let linkDatabase = new Map(); // Map<domain, Map<url, markData>>
let isDirty = false;
let saveTimer = null;
const SAVE_DEBOUNCE = 2000; // 2秒后批量写入
const EXPIRATION_CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟检查一次

function init() {
  loadDatabase();
  setupEventListeners();
  setupContextMenu();
  scheduleExpirationCheck();
}

// 从存储加载数据库
function loadDatabase() {
  chrome.storage.local.get(['linkDatabase', 'linkMarkerData'], (result) => {
    let hasData = false;

    // 优先加载新格式数据
    if (result.linkDatabase) {
      try {
        const data = JSON.parse(result.linkDatabase);
        linkDatabase = new Map();
        Object.keys(data).forEach(domain => {
          const domainLinks = new Map();
          Object.keys(data[domain]).forEach(url => {
            domainLinks.set(url, data[domain][url]);
          });
          linkDatabase.set(domain, domainLinks);
        });
        console.log(`[Link Marker] 加载完成，总记录数: ${getTotalCount()}`);
        hasData = true;
      } catch (e) {
        console.error('[Link Marker] 数据解析失败:', e);
        linkDatabase = new Map();
      }
    }

    // 如果没有新格式数据，检查旧格式并迁移
    if (!hasData && result.linkMarkerData) {
      console.log('[Link Marker] 发现旧格式数据，开始迁移...');
      Object.keys(result.linkMarkerData).forEach(domain => {
        const domainLinks = new Map();
        Object.keys(result.linkMarkerData[domain]).forEach(url => {
          domainLinks.set(url, result.linkMarkerData[domain][url]);
        });
        linkDatabase.set(domain, domainLinks);
      });

      // 保存为新格式
      isDirty = true;
      saveDatabase();
      console.log(`[Link Marker] 数据迁移完成，总记录数: ${getTotalCount()}`);

      // 保留旧格式数据一段时间以便回滚
      // chrome.storage.local.remove(['linkMarkerData']);
    }

    if (linkDatabase.size === 0) {
      console.log('[Link Marker] 首次初始化');
    }
  });
}

// 保存数据库到存储
function saveDatabase() {
  if (!isDirty) return;

  const data = {};
  linkDatabase.forEach((domainLinks, domain) => {
    data[domain] = {};
    domainLinks.forEach((markData, url) => {
      data[domain][url] = markData;
    });
  });

  const jsonString = JSON.stringify(data);
  chrome.storage.local.set({ linkDatabase: jsonString }, () => {
    isDirty = false;
    console.log(`[Link Marker] 数据已保存，总记录数: ${getTotalCount()}`);
  });
}

// 标记链接 - 立即应用 + 延迟保存
function markLink(url, tabId, customDomain) {
  const domain = customDomain || getDomain(url);
  const timestamp = Date.now();

  if (!linkDatabase.has(domain)) {
    linkDatabase.set(domain, new Map());
  }

  const domainLinks = linkDatabase.get(domain);
  const markData = {
    timestamp,
    duration: 'permanent' // 默认永久
  };

  domainLinks.set(url, markData);
  isDirty = true;

  // 延迟保存，避免频繁写入
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDatabase, SAVE_DEBOUNCE);

  // 立即通知标签页更新
  if (tabId) {
    notifyTab(tabId, { action: 'markAdded', url, markData });
  }

  return markData;
}

// 取消标记
function unmarkLink(url, tabId, customDomain) {
  const domain = customDomain || getDomain(url);

  if (linkDatabase.has(domain)) {
    const domainLinks = linkDatabase.get(domain);
    if (domainLinks.has(url)) {
      domainLinks.delete(url);
      isDirty = true;

      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(saveDatabase, SAVE_DEBOUNCE);

      if (tabId) {
        notifyTab(tabId, { action: 'markRemoved', url });
      }
      return true;
    }
  }
  return false;
}

// 获取域名的所有标记
function getDomainMarks(domain) {
  return linkDatabase.get(domain) || new Map();
}

// 获取所有数据（用于content script）
function getAllData() {
  const data = {};
  linkDatabase.forEach((domainLinks, domain) => {
    data[domain] = {};
    domainLinks.forEach((markData, url) => {
      data[domain][url] = markData;
    });
  });
  return data;
}

// 获取总记录数
function getTotalCount() {
  let count = 0;
  linkDatabase.forEach(domainLinks => {
    count += domainLinks.size;
  });
  return count;
}

// 获取域名
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// 获取主域名函数（与content.js保持一致）
function getPrimaryDomain(domain, config) {
  if (!domain || !config?.domainAliases) return domain;
  
  for (const group of config.domainAliases) {
    if (group.primary === domain || group.aliases.includes(domain)) {
      return group.primary;
    }
  }
  return domain;
}

// 检查是否过期
function isExpired(mark) {
  if (!mark || mark.duration === 'permanent') return false;

  const now = Date.now();
  const duration = mark.duration;
  let expireTime;

  switch (duration) {
    case '1h': expireTime = 60 * 60 * 1000; break;
    case '1d': expireTime = 24 * 60 * 60 * 1000; break;
    case '7d': expireTime = 7 * 24 * 60 * 60 * 1000; break;
    case '30d': expireTime = 30 * 24 * 60 * 60 * 1000; break;
    default: expireTime = 7 * 24 * 60 * 60 * 1000;
  }

  return now - mark.timestamp > expireTime;
}

// 设置事件监听器
function setupEventListeners() {
  // 监听来自content script和popup的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    console.log('[Link Marker] 收到消息:', message.action, '来自标签页:', tabId);

    if (message.action === 'getAllData') {
      const data = getAllData();
      console.log('[Link Marker] 发送数据，域名数:', Object.keys(data).length);
      sendResponse({ success: true, data });
    } else if (message.action === 'markLink') {
      console.log('[Link Marker] 标记链接:', message.url, '域名:', message.domain);
      const markData = markLink(message.url, tabId, message.domain);
      sendResponse({ success: true, markData });
    } else if (message.action === 'unmarkLink') {
      const success = unmarkLink(message.url, tabId, message.domain);
      sendResponse({ success });
    } else if (message.action === 'checkExpiration') {
      checkExpiration();
      sendResponse({ success: true });
    } else if (message.action === 'updateMarks') {
      notifyAllTabs();
      sendResponse({ success: true });
    } else if (message.action === 'getDomainMarks') {
      const marks = getDomainMarks(message.domain);
      const marksObj = {};
      marks.forEach((data, url) => {
        marksObj[url] = data;
      });
      sendResponse({ success: true, marks: marksObj });
    }
    return true;
  });

  // 扩展安装或更新
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      initializeDefaultConfig();
    } else if (details.reason === 'update') {
      migrateData();
    }
  });

  // 标签页更新完成
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      notifyTab(tabId);
    }
  });
}

// 设置右键菜单
function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'markLink',
      title: chrome.i18n.getMessage('markLink') || '标记链接',
      contexts: ['link']
    });

    chrome.contextMenus.create({
      id: 'unmarkLink',
      title: chrome.i18n.getMessage('unmarkLink') || '取消标记',
      contexts: ['link']
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'markLink') {
      handleMarkLink(info.linkUrl, tab);
    } else if (info.menuItemId === 'unmarkLink') {
      handleUnmarkLink(info.linkUrl, tab);
    }
  });
}

// 处理标记链接
function handleMarkLink(linkUrl, tab) {
  if (!linkUrl || !tab?.id) return;
  
  // 关键修复：获取配置并转换为主域名
  chrome.storage.local.get('linkMarkerConfig', (result) => {
    const config = result.linkMarkerConfig || {};
    const domain = getDomain(linkUrl);
    const primaryDomain = getPrimaryDomain(domain, config);
    
    // 将URL转换为主域名版本
    try {
      const urlObj = new URL(linkUrl);
      urlObj.hostname = primaryDomain;
      const storageUrl = urlObj.href;
      
      markLink(storageUrl, tab.id, primaryDomain);
    } catch (e) {
      markLink(linkUrl, tab.id);
    }
  });
}

// 处理取消标记
function handleUnmarkLink(linkUrl, tab) {
  if (!linkUrl || !tab?.id) return;
  
  // 关键修复：获取配置并转换为主域名
  chrome.storage.local.get('linkMarkerConfig', (result) => {
    const config = result.linkMarkerConfig || {};
    const domain = getDomain(linkUrl);
    const primaryDomain = getPrimaryDomain(domain, config);
    
    // 将URL转换为主域名版本
    try {
      const urlObj = new URL(linkUrl);
      urlObj.hostname = primaryDomain;
      const storageUrl = urlObj.href;
      
      unmarkLink(storageUrl, tab.id, primaryDomain);
    } catch (e) {
      unmarkLink(linkUrl, tab.id);
    }
  });
}

// 初始化默认配置
function initializeDefaultConfig() {
  const defaultConfig = {
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
    customTimeFormat: '',
    showTime: false,
    autoRulesEnabled: false,
    blacklist: [],
    whitelist: [],
    maxLinksPerPage: 1000,
    domainAliases: [],
    cleanModeEnabled: false,
    cleanModeRules: []
  };

  chrome.storage.local.set({ linkMarkerConfig: defaultConfig }, () => {
    console.log('[Link Marker] 默认配置已初始化');
  });
}

// 迁移数据（处理旧版本数据格式）
function migrateData() {
  chrome.storage.local.get(['linkMarkerData', 'linkDatabase'], (result) => {
    // 如果已经有新格式，跳过
    if (result.linkDatabase) {
      console.log('[Link Marker] 数据格式已是最新');
      return;
    }

    // 迁移旧格式数据
    if (result.linkMarkerData) {
      try {
        linkDatabase = new Map();
        Object.keys(result.linkMarkerData).forEach(domain => {
          const domainLinks = new Map();
          Object.keys(result.linkMarkerData[domain]).forEach(url => {
            domainLinks.set(url, result.linkMarkerData[domain][url]);
          });
          linkDatabase.set(domain, domainLinks);
        });

        // 保存为新格式
        saveDatabase();
        console.log('[Link Marker] 数据迁移完成');

        // 删除旧格式
        chrome.storage.local.remove(['linkMarkerData']);
      } catch (e) {
        console.error('[Link Marker] 数据迁移失败:', e);
      }
    }
  });
}

// 安排过期检查
function scheduleExpirationCheck() {
  checkExpiration();
  setInterval(checkExpiration, EXPIRATION_CHECK_INTERVAL);
}

// 检查过期记录
function checkExpiration() {
  let expiredCount = 0;
  let hasChanges = false;

  linkDatabase.forEach((domainLinks, domain) => {
    const toDelete = [];
    domainLinks.forEach((markData, url) => {
      if (isExpired(markData)) {
        toDelete.push(url);
      }
    });

    toDelete.forEach(url => {
      domainLinks.delete(url);
      expiredCount++;
      hasChanges = true;
    });

    if (domainLinks.size === 0) {
      linkDatabase.delete(domain);
    }
  });

  if (hasChanges && expiredCount > 0) {
    saveDatabase();
    console.log(`[Link Marker] 已清除 ${expiredCount} 条过期记录`);
    notifyAllTabs();
  }
}

// 通知所有标签页
async function notifyAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const validTabs = tabs.filter(tab =>
      tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))
    );

    const promises = validTabs.map(tab =>
      notifyTab(tab.id).catch(() => {})
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('[Link Marker] 通知标签页失败:', error);
  }
}

// 通知单个标签页
async function notifyTab(tabId, message = { action: 'updateMarks' }) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // 忽略错误
  }
}

// 启动
init();