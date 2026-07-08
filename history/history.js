// history.js

// 初始化国际化
function initI18n() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      element.textContent = message;
    }
  });

  const title = chrome.i18n.getMessage('historyTitle');
  if (title) {
    document.title = title;
  }

  updateVersionInfo();
}

// 更新版本信息
function updateVersionInfo() {
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version;
  const extensionName = chrome.i18n.getMessage('extensionName');

  const footerVersionElements = document.querySelectorAll('[data-i18n="footerVersion"]');
  footerVersionElements.forEach(element => {
    element.textContent = `${extensionName} v${version}`;
  });
}

// 全局变量
let allHistoryData = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 100;
let searchKeyword = '';
let searchType = 'url';
let statusFilter = 'all';

// 初始化
function init() {
  initI18n();
  loadHistoryData();
  setupEventListeners();
}

// 加载历史数据
function loadHistoryData() {
  chrome.storage.local.get(['linkDatabase', 'linkMarkerData'], (result) => {
    let data = null;

    if (result.linkDatabase) {
      try {
        data = JSON.parse(result.linkDatabase);
      } catch (e) {
        console.error('[Link Marker] 数据解析失败:', e);
      }
    }

    if (!data && result.linkMarkerData) {
      data = result.linkMarkerData;
    }

    if (data) {
      allHistoryData = [];

      Object.keys(data).forEach(domain => {
        const domainData = data[domain];

        Object.keys(domainData).forEach(link => {
          const mark = domainData[link];
          allHistoryData.push({
            link,
            timestamp: mark.timestamp,
            domain,
            duration: mark.duration || 'permanent',
            isExpired: isExpired(mark)
          });
        });
      });

      allHistoryData.sort((a, b) => b.timestamp - a.timestamp);
    }

    applyFilters();
    updateStats();
  });
}

// 应用筛选条件
function applyFilters() {
  filteredData = allHistoryData.filter(item => {
    if (statusFilter === 'active' && item.isExpired) return false;
    if (statusFilter === 'expired' && !item.isExpired) return false;

    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      if (searchType === 'url') {
        return item.link.toLowerCase().includes(keyword);
      } else {
        return item.domain.toLowerCase().includes(keyword);
      }
    }
    return true;
  });

  currentPage = 1;
  renderPage();
}

// 渲染当前页
function renderPage() {
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredData.length);
  const pageData = filteredData.slice(startIndex, endIndex);

  updateHistoryTable(pageData);
  updatePaginationControls(totalPages);
  updatePaginationInfo(startIndex, endIndex);
}

// 更新历史表格
function updateHistoryTable(pageData) {
  const tbody = document.getElementById('history-body');
  const emptyState = document.getElementById('empty-state');

  if (filteredData.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tbody.innerHTML = '';

  pageData.forEach((item, index) => {
    const globalIndex = (currentPage - 1) * pageSize + index;
    const tr = document.createElement('tr');
    tr.setAttribute('data-index', globalIndex);

    const expiredText = chrome.i18n.getMessage('expired');
    const activeText = chrome.i18n.getMessage('active');
    const deleteText = chrome.i18n.getMessage('delete');

    tr.innerHTML = `
      <td class="link-cell">
        <a href="${item.link}" target="_blank" title="${item.link}">${truncateUrl(item.link)}</a>
      </td>
      <td class="mark-time-cell">${formatTime(item.timestamp)}</td>
      <td>${item.domain}</td>
      <td>${formatDuration(item.duration)}</td>
      <td class="${item.isExpired ? 'status-expired' : 'status-active'}">
        ${item.isExpired ? expiredText : activeText}
      </td>
      <td class="action-cell">
        <button class="btn btn-danger delete-btn" data-index="${globalIndex}">${deleteText}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 截断URL显示
function truncateUrl(url, maxLength = 60) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

// 更新分页控制
function updatePaginationControls(totalPages) {
  document.getElementById('page-info').textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;

  document.getElementById('first-page-btn').disabled = currentPage <= 1;
  document.getElementById('prev-page-btn').disabled = currentPage <= 1;
  document.getElementById('next-page-btn').disabled = currentPage >= totalPages;
  document.getElementById('last-page-btn').disabled = currentPage >= totalPages;
}

// 更新分页信息
function updatePaginationInfo(startIndex, endIndex) {
  document.getElementById('pagination-info').textContent =
    `显示 ${startIndex + 1}-${endIndex} 条，共 ${filteredData.length} 条`;
}

// 更新统计信息
function updateStats() {
  const totalCount = allHistoryData.length;
  const activeCount = allHistoryData.filter(item => !item.isExpired).length;
  const expiredCount = allHistoryData.filter(item => item.isExpired).length;

  const domains = new Set();
  allHistoryData.forEach(item => domains.add(item.domain));
  const domainCount = domains.size;

  document.getElementById('total-count').textContent = totalCount;
  document.getElementById('active-count').textContent = activeCount;
  document.getElementById('expired-count').textContent = expiredCount;
  document.getElementById('domain-count').textContent = domainCount;
}

// 设置事件监听器
function setupEventListeners() {
  document.getElementById('export-btn').addEventListener('click', exportData);

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-options').classList.remove('hidden');
    document.getElementById('domain-migration-options').classList.add('hidden');
  });

  document.getElementById('cancel-import-btn').addEventListener('click', () => {
    document.getElementById('import-options').classList.add('hidden');
    document.getElementById('import-file').value = '';
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
  });

  document.getElementById('confirm-import-btn').addEventListener('click', importData);

  // 域名迁移
  document.getElementById('migrate-domain-btn').addEventListener('click', () => {
    document.getElementById('domain-migration-options').classList.remove('hidden');
    document.getElementById('import-options').classList.add('hidden');
  });

  document.getElementById('cancel-migration-btn').addEventListener('click', () => {
    document.getElementById('domain-migration-options').classList.add('hidden');
    document.getElementById('old-domain').value = '';
    document.getElementById('new-domain').value = '';
  });

  document.getElementById('confirm-migration-btn').addEventListener('click', migrateDomain);

  document.getElementById('clear-expired-btn').addEventListener('click', clearExpired);

  document.getElementById('clear-all-btn').addEventListener('click', clearAllRecords);

  document.getElementById('refresh-btn').addEventListener('click', loadHistoryData);

  document.getElementById('history-body').addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const index = parseInt(e.target.getAttribute('data-index'));
      if (!isNaN(index)) {
        deleteRecord(index);
      }
    }
  });

  // 搜索功能
  const searchInput = document.getElementById('search-input');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchKeyword = e.target.value;
      applyFilters();
    }, 300);
  });

  document.getElementById('search-type').addEventListener('change', (e) => {
    searchType = e.target.value;
    applyFilters();
  });

  document.getElementById('status-filter').addEventListener('change', (e) => {
    statusFilter = e.target.value;
    applyFilters();
  });

  // 分页功能
  document.getElementById('first-page-btn').addEventListener('click', () => {
    currentPage = 1;
    renderPage();
  });

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPage();
    }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    if (currentPage < totalPages) {
      currentPage++;
      renderPage();
    }
  });

  document.getElementById('last-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    currentPage = totalPages;
    renderPage();
  });

  document.getElementById('page-size').addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    renderPage();
  });
}

// 导出数据
function exportData() {
  chrome.storage.local.get(['linkDatabase', 'linkMarkerData', 'linkMarkerConfig'], (result) => {
    let data = null;

    if (result.linkDatabase) {
      try {
        data = JSON.parse(result.linkDatabase);
      } catch (e) {
        console.error('[Link Marker] 数据解析失败:', e);
      }
    }

    if (!data && result.linkMarkerData) {
      data = result.linkMarkerData;
    }

    const exportData = {
      config: result.linkMarkerConfig,
      data: data,
      exportTime: Date.now(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = formatTime(Date.now(), 'YYYY-MM-DD_HH-MM-SS');
    const fileName = `link-marker-data-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(chrome.i18n.getMessage('exportSuccess'), chrome.i18n.getMessage('exportSuccessMessage', [fileName]), 'success');
  });
}

// 导入数据
function importData() {
  const importFileInput = document.getElementById('import-file');
  const importFile = importFileInput.files[0];

  if (!importFile) {
    showNotification(chrome.i18n.getMessage('error'), chrome.i18n.getMessage('selectFile'), 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const jsonData = e.target.result;
      const importMode = document.querySelector('input[name="import-mode"]:checked').value;
      const importData = JSON.parse(jsonData);

      if (importMode === 'replace') {
        const savePromises = [];

        if (importData.config) {
          savePromises.push(new Promise((resolve) => {
            chrome.storage.local.set({ linkMarkerConfig: importData.config }, resolve);
          }));
        }

        if (importData.data) {
          const jsonString = JSON.stringify(importData.data);
          savePromises.push(new Promise((resolve) => {
            chrome.storage.local.set({ linkDatabase: jsonString }, resolve);
          }));
        }

        Promise.all(savePromises).then(() => {
          showNotification(chrome.i18n.getMessage('importSuccess'), chrome.i18n.getMessage('importSuccessMessage'), 'success');
          document.getElementById('import-options').classList.add('hidden');
          importFileInput.value = '';
          loadHistoryData();
        });
      } else if (importMode === 'append') {
        chrome.storage.local.get(['linkDatabase', 'linkMarkerData', 'linkMarkerConfig'], (result) => {
          const currentConfig = result.linkMarkerConfig || {};
          const mergedConfig = { ...currentConfig, ...(importData.config || {}) };

          let currentData = null;

          if (result.linkDatabase) {
            try {
              currentData = JSON.parse(result.linkDatabase);
            } catch (e) {
              currentData = {};
            }
          }

          if (!currentData && result.linkMarkerData) {
            currentData = result.linkMarkerData;
          }

          if (!currentData) {
            currentData = {};
          }

          const mergedData = { ...currentData };

          if (importData.data) {
            Object.keys(importData.data).forEach(domain => {
              if (!mergedData[domain]) {
                mergedData[domain] = {};
              }
              mergedData[domain] = { ...mergedData[domain], ...importData.data[domain] };
            });
          }

          const jsonString = JSON.stringify(mergedData);
          chrome.storage.local.set({ linkMarkerConfig: mergedConfig, linkDatabase: jsonString }, () => {
            showNotification(chrome.i18n.getMessage('importSuccess'), chrome.i18n.getMessage('importSuccessMessage'), 'success');
            document.getElementById('import-options').classList.add('hidden');
            importFileInput.value = '';
            loadHistoryData();
          });
        });
      }
    } catch (error) {
      showNotification(chrome.i18n.getMessage('importFailed'), chrome.i18n.getMessage('jsonFormatError'), 'error');
    }
  };

  reader.readAsText(importFile);
}

// 清除过期记录
function clearExpired() {
  chrome.storage.local.get(['linkDatabase', 'linkMarkerData'], (result) => {
    let data = null;

    if (result.linkDatabase) {
      try {
        data = JSON.parse(result.linkDatabase);
      } catch (e) {
        data = null;
      }
    }

    if (!data && result.linkMarkerData) {
      data = result.linkMarkerData;
    }

    if (data) {
      let expiredCount = 0;

      Object.keys(data).forEach(domain => {
        const domainData = data[domain];
        const updatedDomainData = {};

        Object.keys(domainData).forEach(link => {
          const mark = domainData[link];
          if (!isExpired(mark)) {
            updatedDomainData[link] = mark;
          } else {
            expiredCount++;
          }
        });

        if (Object.keys(updatedDomainData).length === 0) {
          delete data[domain];
        } else {
          data[domain] = updatedDomainData;
        }
      });

      const jsonString = JSON.stringify(data);
      chrome.storage.local.set({ linkDatabase: jsonString }, () => {
        showNotification(chrome.i18n.getMessage('clearSuccess'), chrome.i18n.getMessage('clearExpiredMessage', [expiredCount]), 'success');
        loadHistoryData();
      });
    } else {
      showNotification(chrome.i18n.getMessage('info'), chrome.i18n.getMessage('noExpiredRecords'), 'info');
    }
  });
}

// 清除所有记录
function clearAllRecords() {
  if (confirm(chrome.i18n.getMessage('clearAllConfirm'))) {
    chrome.storage.local.remove(['linkDatabase', 'linkMarkerData'], () => {
      showNotification(chrome.i18n.getMessage('clearSuccess'), chrome.i18n.getMessage('clearAllMessage'), 'success');
      loadHistoryData();
    });
  }
}

// 删除记录
function deleteRecord(index) {
  if (confirm(chrome.i18n.getMessage('deleteConfirm'))) {
    const record = filteredData[index];

    if (!record) {
      showNotification(chrome.i18n.getMessage('error'), chrome.i18n.getMessage('recordNotFound'), 'error');
      return;
    }

    chrome.storage.local.get(['linkDatabase', 'linkMarkerData'], (result) => {
      let data = null;

      if (result.linkDatabase) {
        try {
          data = JSON.parse(result.linkDatabase);
        } catch (e) {
          data = null;
        }
      }

      if (!data && result.linkMarkerData) {
        data = result.linkMarkerData;
      }

      if (data && data[record.domain] && data[record.domain][record.link]) {
        delete data[record.domain][record.link];

        if (Object.keys(data[record.domain]).length === 0) {
          delete data[record.domain];
        }

        const jsonString = JSON.stringify(data);
        chrome.storage.local.set({ linkDatabase: jsonString }, () => {
          showNotification(chrome.i18n.getMessage('deleteSuccess'), chrome.i18n.getMessage('deleteSuccessMessage'), 'success');
          loadHistoryData();
        });
      } else {
        showNotification(chrome.i18n.getMessage('error'), chrome.i18n.getMessage('recordNotFound'), 'error');
      }
    });
  }
}

// 检查是否过期
function isExpired(mark) {
  if (mark.duration === 'permanent') {
    return false;
  }

  const now = Date.now();
  const timestamp = mark.timestamp;
  const duration = mark.duration;

  let expireTime;
  switch (duration) {
    case '1h':
      expireTime = timestamp + 60 * 60 * 1000;
      break;
    case '1d':
      expireTime = timestamp + 24 * 60 * 60 * 1000;
      break;
    case '7d':
      expireTime = timestamp + 7 * 24 * 60 * 60 * 1000;
      break;
    case '30d':
      expireTime = timestamp + 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      expireTime = timestamp + 7 * 24 * 60 * 60 * 1000;
  }

  return now > expireTime;
}

// 格式化时间
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

// 格式化时长
function formatDuration(duration) {
  switch (duration) {
    case '1h':
      return chrome.i18n.getMessage('oneHour');
    case '1d':
      return chrome.i18n.getMessage('oneDay');
    case '7d':
      return chrome.i18n.getMessage('sevenDays');
    case '30d':
      return chrome.i18n.getMessage('thirtyDays');
    case 'permanent':
      return chrome.i18n.getMessage('permanent');
    default:
      return duration;
  }
}

// 显示通知
function showNotification(title, message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 4px;
    color: white;
    font-size: 14px;
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  `;

  if (type === 'success') {
    notification.style.backgroundColor = '#4CAF50';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#f44336';
  } else if (type === 'warning') {
    notification.style.backgroundColor = '#ff9800';
  } else {
    notification.style.backgroundColor = '#2196f3';
  }

  notification.innerHTML = `
    <strong>${title}</strong>
    <p style="margin: 4px 0 0 0;">${message}</p>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      document.body.removeChild(notification);
      document.head.removeChild(style);
    }, 300);
  }, 3000);
}

// URL规范化（与content.js、background.js保持一致）
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    urlObj.pathname = normalizePath(urlObj.pathname);
    return urlObj.href;
  } catch {
    return url;
  }
}

function normalizePath(pathname) {
  if (!pathname) return pathname;

  const forumPatterns = [
    /^\/threads\/[^.]*\.(\d+)\/?$/i,
    /^\/threads\/(\d+)\/?$/i
  ];

  for (const pattern of forumPatterns) {
    const match = pathname.match(pattern);
    if (match) {
      return `/threads/${match[1]}/`;
    }
  }

  return pathname;
}

// 域名迁移功能
function migrateDomain() {
  const oldDomain = document.getElementById('old-domain').value.trim();
  const newDomain = document.getElementById('new-domain').value.trim();
  const deleteOld = document.getElementById('migrate-delete-old').checked;

  if (!oldDomain) {
    showNotification('错误', '请输入旧域名', 'error');
    return;
  }

  if (!newDomain) {
    showNotification('错误', '请输入新域名', 'error');
    return;
  }

  if (oldDomain === newDomain) {
    showNotification('错误', '旧域名和新域名不能相同', 'error');
    return;
  }

  chrome.storage.local.get(['linkDatabase', 'linkMarkerData'], (result) => {
    let data = null;

    if (result.linkDatabase) {
      try {
        data = JSON.parse(result.linkDatabase);
      } catch (e) {
        data = null;
      }
    }

    if (!data && result.linkMarkerData) {
      data = result.linkMarkerData;
    }

    if (!data) {
      showNotification('错误', '没有找到数据', 'error');
      return;
    }

    if (!data[oldDomain]) {
      showNotification('错误', `未找到域名 "${oldDomain}" 的标记数据`, 'error');
      return;
    }

    const oldDomainData = data[oldDomain];
    const migratedCount = Object.keys(oldDomainData).length;

    // 创建新域名的数据（如果不存在）
    if (!data[newDomain]) {
      data[newDomain] = {};
    }

    // 迁移每个URL，替换域名部分并规范化
    Object.keys(oldDomainData).forEach(oldUrl => {
      const markData = oldDomainData[oldUrl];
      // 替换URL中的域名
      let newUrl = oldUrl.replace(new RegExp('//' + oldDomain.replace(/\./g, '\\.'), 'i'), '//' + newDomain);
      // URL规范化
      newUrl = normalizeUrl(newUrl);
      // 如果规范化后URL相同，保留时间较早的
      if (!data[newDomain][newUrl] || markData.timestamp < data[newDomain][newUrl].timestamp) {
        data[newDomain][newUrl] = markData;
      }
    });

    // 如果选择删除旧域名数据
    if (deleteOld) {
      delete data[oldDomain];
    }

    const jsonString = JSON.stringify(data);
    chrome.storage.local.set({ linkDatabase: jsonString }, () => {
      showNotification(
        '迁移成功',
        `已成功迁移 ${migratedCount} 条标记记录${deleteOld ? '，并删除了旧域名数据' : ''}`,
        'success'
      );
      document.getElementById('domain-migration-options').classList.add('hidden');
      document.getElementById('old-domain').value = '';
      document.getElementById('new-domain').value = '';
      loadHistoryData();
    });
  });
}

// 初始化
init();