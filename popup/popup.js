// popup.js

// 初始化国际化
function initI18n() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message && element) {
      element.textContent = message;
    }
  });
  
  // 更新页面标题
  const title = chrome.i18n.getMessage('popupTitle');
  if (title) {
    document.title = title;
  }
  
  // 动态更新底部版本信息
  updateVersionInfo();
}

// 更新版本信息
function updateVersionInfo() {
  // 获取manifest中的版本信息
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version;
  const extensionName = chrome.i18n.getMessage('extensionName');
  
  // 更新底部版本信息
  const versionElements = document.querySelectorAll('[data-i18n="version"]');
  versionElements.forEach(element => {
    element.textContent = `${extensionName} v${version}`;
  });
}

// 全局变量
let config = {
  enabled: true
};

// 初始化
function init() {
  initI18n();
  loadConfig();
  setupEventListeners();
}

// 加载配置
function loadConfig() {
  chrome.storage.local.get('linkMarkerConfig', (result) => {
    if (result.linkMarkerConfig) {
      config = { ...config, ...result.linkMarkerConfig };
      updateUI();
    }
  });
}

// 更新UI
function updateUI() {
  // 更新启用开关
  const enabledToggleElement = document.getElementById('enabled-toggle');
  if (enabledToggleElement) {
    enabledToggleElement.checked = config.enabled;
  }
  
  // 更新状态文本
  const statusText = document.getElementById('status-text');
  if (statusText) {
    statusText.textContent = config.enabled ? chrome.i18n.getMessage('enabled') : chrome.i18n.getMessage('disabled');
    statusText.style.color = config.enabled ? '#4CAF50' : '#f44336';
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 启用开关
  const enabledToggleElement = document.getElementById('enabled-toggle');
  if (enabledToggleElement) {
    enabledToggleElement.addEventListener('change', (e) => {
      config.enabled = e.target.checked;
      saveConfig();
      updateUI();
    });
  }
  
  // 一键清除按钮
  const clearAllBtnElement = document.getElementById('clear-all-btn');
  if (clearAllBtnElement) {
    clearAllBtnElement.addEventListener('click', () => {
      if (confirm(chrome.i18n.getMessage('clearConfirm'))) {
        clearAllMarks();
      }
    });
  }
  
  // 选项设置按钮
  const optionsBtnElement = document.getElementById('options-btn');
  if (optionsBtnElement) {
    optionsBtnElement.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  
  // 历史记录按钮
  const historyBtnElement = document.getElementById('history-btn');
  if (historyBtnElement) {
    historyBtnElement.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('history/history.html') });
    });
  }
}

// 保存配置
function saveConfig() {
  chrome.storage.local.get('linkMarkerConfig', (result) => {
    const currentConfig = result.linkMarkerConfig || {};
    const newConfig = { ...currentConfig, ...config };
    
    chrome.storage.local.set({ linkMarkerConfig: newConfig }, () => {
      // 通知所有标签页更新
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          // 检查标签页URL是否有效，避免向扩展页面、文件系统页面等发送消息
          if (tab.url && tab.url.startsWith('http')) {
            chrome.tabs.sendMessage(tab.id, { action: 'updateMarks' }, () => {
              // 忽略错误，使用箭头函数避免错误显示
              if (chrome.runtime.lastError) {
                // 静默处理错误，避免错误消息显示
              }
            });
          }
        });
      });
    });
  });
}

// 清除所有标记
function clearAllMarks() {
  chrome.storage.local.remove(['linkDatabase', 'linkMarkerData'], () => {
    // 通知所有标签页更新
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        // 检查标签页URL是否有效，避免向扩展页面、文件系统页面等发送消息
        if (tab.url && tab.url.startsWith('http')) {
          chrome.tabs.sendMessage(tab.id, { action: 'updateMarks' }, () => {
            // 忽略错误，使用箭头函数避免错误显示
            if (chrome.runtime.lastError) {
              // 静默处理错误，避免错误消息显示
            }
          });
        }
      });
    });

    // 显示成功消息
    alert(chrome.i18n.getMessage('exportSuccess'));
  });
}

// 初始化
init();