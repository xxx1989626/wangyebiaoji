// options.js

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
  
  // 更新占位符
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    const message = chrome.i18n.getMessage(key);
    if (message && element) {
      element.setAttribute('placeholder', message);
    }
  });
  
  // 更新页面标题
  const title = chrome.i18n.getMessage('optionsTitle');
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

// 默认配置
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

// 全局配置
let config = { ...defaultConfig };

// 初始化
function init() {
  initI18n();
  loadConfig();
  setupEventListeners();
  setupDomainAliasListeners();
}

// 加载配置
function loadConfig() {
  chrome.storage.local.get('linkMarkerConfig', (result) => {
    if (result.linkMarkerConfig) {
      config = { ...defaultConfig, ...result.linkMarkerConfig };
    }
    updateUI();
  });
}

// 更新UI
function updateUI() {
  const boldElement = document.getElementById('bold');
  const italicElement = document.getElementById('italic');
  const strikethroughElement = document.getElementById('strikethrough');
  const highlightElement = document.getElementById('highlight');
  const highlightColorElement = document.getElementById('highlight-color');
  const highlightOpacityElement = document.getElementById('highlight-opacity');
  const highlightOpacityValueElement = document.getElementById('highlight-opacity-value');
  const mainColorElement = document.getElementById('main-color');

  if (boldElement) boldElement.checked = config.bold;
  if (italicElement) italicElement.checked = config.italic;
  if (strikethroughElement) strikethroughElement.checked = config.strikethrough;
  if (highlightElement) highlightElement.checked = config.highlight;
  if (highlightColorElement) highlightColorElement.value = config.highlightColor;
  if (highlightOpacityElement) highlightOpacityElement.value = config.highlightOpacity;
  if (highlightOpacityValueElement) highlightOpacityValueElement.textContent = config.highlightOpacity;
  if (mainColorElement) mainColorElement.value = config.mainColor;

  const durationElement = document.getElementById('duration');
  const timeFormatElement = document.getElementById('time-format');
  const customTimeFormatElement = document.getElementById('custom-time-format');
  const showTimeElement = document.getElementById('show-time');

  if (durationElement) durationElement.value = config.duration;
  if (timeFormatElement) timeFormatElement.value = config.timeFormat;
  if (customTimeFormatElement) customTimeFormatElement.value = config.customTimeFormat;
  if (showTimeElement) showTimeElement.checked = config.showTime;
  
  // 自动化规则
  const autoRulesEnabledElement = document.getElementById('auto-rules-enabled');
  if (autoRulesEnabledElement) autoRulesEnabledElement.checked = config.autoRulesEnabled;
  
  // 数量设置
  const maxLinksPerPageElement = document.getElementById('max-links-per-page');
  if (maxLinksPerPageElement) maxLinksPerPageElement.value = config.maxLinksPerPage;
  
  // 更新自定义时间格式显示
  updateCustomTimeFormatDisplay();
  
  // 更新黑白名单
  updateBlacklistUI();
  updateWhitelistUI();

  // 清洁模式
  const cleanModeEnabledElement = document.getElementById('clean-mode-enabled');
  if (cleanModeEnabledElement) cleanModeEnabledElement.checked = config.cleanModeEnabled;

  updateCleanModeRulesUI();
}

// 更新自定义时间格式显示
function updateCustomTimeFormatDisplay() {
  const customGroup = document.getElementById('custom-time-format-group');
  const timeFormat = document.getElementById('time-format').value;
  
  if (timeFormat === 'custom') {
    customGroup.classList.remove('hidden');
  } else {
    customGroup.classList.add('hidden');
  }
}

// 更新黑名单UI
function updateBlacklistUI() {
  const list = document.getElementById('blacklist-list');
  list.innerHTML = '';
  
  config.blacklist.forEach((item, index) => {
    const li = document.createElement('li');
    const deleteText = chrome.i18n.getMessage('delete');
    li.innerHTML = `
      <span>${item}</span>
      <button class="remove-btn" data-type="blacklist" data-index="${index}">${deleteText}</button>
    `;
    list.appendChild(li);
  });
}

// 更新白名单UI
function updateWhitelistUI() {
  const list = document.getElementById('whitelist-list');
  list.innerHTML = '';
  
  config.whitelist.forEach((item, index) => {
    const li = document.createElement('li');
    const deleteText = chrome.i18n.getMessage('delete');
    li.innerHTML = `
      <span>${item}</span>
      <button class="remove-btn" data-type="whitelist" data-index="${index}">${deleteText}</button>
    `;
    list.appendChild(li);
  });
}

// 更新清洁模式规则UI
function updateCleanModeRulesUI() {
  const list = document.getElementById('clean-mode-rules-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (!config.cleanModeRules || config.cleanModeRules.length === 0) {
    list.innerHTML = '<p style="color: #888; padding: 10px; font-size: 13px;">暂无规则</p>';
    return;
  }
  
  config.cleanModeRules.forEach((rule, index) => {
    const li = document.createElement('li');
    const deleteText = chrome.i18n.getMessage('delete') || '删除';
    li.innerHTML = `
      <span><strong>${rule.domainPattern}</strong> → <code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${rule.cardSelector}</code></span>
      <button class="remove-btn" data-type="cleanmode" data-index="${index}">${deleteText}</button>
    `;
    list.appendChild(li);
  });
}

// 设置事件监听器
function setupEventListeners() {
  const boldElement = document.getElementById('bold');
  const italicElement = document.getElementById('italic');
  const strikethroughElement = document.getElementById('strikethrough');
  const highlightElement = document.getElementById('highlight');
  const highlightColorElement = document.getElementById('highlight-color');
  const highlightOpacityElement = document.getElementById('highlight-opacity');
  const highlightOpacityValueElement = document.getElementById('highlight-opacity-value');
  const mainColorElement = document.getElementById('main-color');

  if (boldElement) {
    boldElement.addEventListener('change', (e) => {
      config.bold = e.target.checked;
    });
  }

  if (italicElement) {
    italicElement.addEventListener('change', (e) => {
      config.italic = e.target.checked;
    });
  }

  if (strikethroughElement) {
    strikethroughElement.addEventListener('change', (e) => {
      config.strikethrough = e.target.checked;
    });
  }
  
  if (highlightElement) {
    highlightElement.addEventListener('change', (e) => {
      config.highlight = e.target.checked;
    });
  }
  
  if (highlightColorElement) {
    highlightColorElement.addEventListener('change', (e) => {
      config.highlightColor = e.target.value;
    });
  }
  
  if (highlightOpacityElement) {
    highlightOpacityElement.addEventListener('input', (e) => {
      config.highlightOpacity = parseInt(e.target.value);
      if (highlightOpacityValueElement) {
        highlightOpacityValueElement.textContent = config.highlightOpacity;
      }
    });
  }
  
  if (mainColorElement) {
    mainColorElement.addEventListener('change', (e) => {
      config.mainColor = e.target.value;
    });
  }
  
  // 时间设置
  const durationElement = document.getElementById('duration');
  const timeFormatElement = document.getElementById('time-format');
  const customTimeFormatElement = document.getElementById('custom-time-format');
  const showTimeElement = document.getElementById('show-time');
  
  if (durationElement) {
    durationElement.addEventListener('change', (e) => {
      config.duration = e.target.value;
    });
  }
  
  if (timeFormatElement) {
    timeFormatElement.addEventListener('change', (e) => {
      config.timeFormat = e.target.value;
      updateCustomTimeFormatDisplay();
    });
  }
  
  if (customTimeFormatElement) {
    customTimeFormatElement.addEventListener('input', (e) => {
      config.customTimeFormat = e.target.value;
    });
  }
  
  if (showTimeElement) {
    showTimeElement.addEventListener('change', (e) => {
      config.showTime = e.target.checked;
    });
  }
  
  // 自动化规则
  const autoRulesEnabledElement = document.getElementById('auto-rules-enabled');
  if (autoRulesEnabledElement) {
    autoRulesEnabledElement.addEventListener('change', (e) => {
      config.autoRulesEnabled = e.target.checked;
    });
  }
  
  // 添加黑名单
  const addBlacklistElement = document.getElementById('add-blacklist');
  if (addBlacklistElement) {
    addBlacklistElement.addEventListener('click', () => {
      const input = document.getElementById('blacklist-input');
      if (input) {
        const value = input.value.trim();
        if (value) {
          config.blacklist.push(value);
          updateBlacklistUI();
          input.value = '';
        }
      }
    });
  }
  
  // 添加白名单
  const addWhitelistElement = document.getElementById('add-whitelist');
  if (addWhitelistElement) {
    addWhitelistElement.addEventListener('click', () => {
      const input = document.getElementById('whitelist-input');
      if (input) {
        const value = input.value.trim();
        if (value) {
          config.whitelist.push(value);
          updateWhitelistUI();
          input.value = '';
        }
      }
    });
  }
  
  // 数量设置
  const maxLinksPerPageElement = document.getElementById('max-links-per-page');
  if (maxLinksPerPageElement) {
    maxLinksPerPageElement.addEventListener('change', (e) => {
      config.maxLinksPerPage = parseInt(e.target.value);
    });
  }
  
  // 清洁模式
  const cleanModeEnabledElement = document.getElementById('clean-mode-enabled');
  if (cleanModeEnabledElement) {
    cleanModeEnabledElement.addEventListener('change', (e) => {
      config.cleanModeEnabled = e.target.checked;
    });
  }

  // 添加清洁模式规则
  const addCleanModeRuleBtn = document.getElementById('add-clean-mode-rule');
  if (addCleanModeRuleBtn) {
    addCleanModeRuleBtn.addEventListener('click', () => {
      const domainInput = document.getElementById('clean-mode-domain');
      const selectorInput = document.getElementById('clean-mode-selector');
      const domainPattern = domainInput.value.trim();
      const cardSelector = selectorInput.value.trim();
      
      if (!domainPattern || !cardSelector) {
        showNotification('错误', '请填写域名和卡片选择器', 'error');
        return;
      }
      
      config.cleanModeRules.push({ domainPattern, cardSelector });
      updateCleanModeRulesUI();
      domainInput.value = '';
      selectorInput.value = '';
    });
  }

  // 清洁模式规则删除
  const cleanModeRulesList = document.getElementById('clean-mode-rules-list');
  if (cleanModeRulesList) {
    cleanModeRulesList.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-btn') && e.target.dataset.type === 'cleanmode') {
        const index = parseInt(e.target.dataset.index);
        config.cleanModeRules.splice(index, 1);
        updateCleanModeRulesUI();
      }
    });
  }
  
  // 保存按钮
  const saveBtnElement = document.getElementById('save-btn');
  if (saveBtnElement) {
    saveBtnElement.addEventListener('click', saveConfig);
  }
  
  // 重置按钮
  const resetBtnElement = document.getElementById('reset-btn');
  if (resetBtnElement) {
    resetBtnElement.addEventListener('click', resetConfig);
  }
  
  // 事件委托：处理删除按钮点击事件
  const blacklistListElement = document.getElementById('blacklist-list');
  const whitelistListElement = document.getElementById('whitelist-list');
  
  if (blacklistListElement) {
    blacklistListElement.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-btn') && e.target.dataset.type === 'blacklist') {
        const index = parseInt(e.target.dataset.index);
        removeFromBlacklist(index);
      }
    });
  }
  
  if (whitelistListElement) {
    whitelistListElement.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-btn') && e.target.dataset.type === 'whitelist') {
        const index = parseInt(e.target.dataset.index);
        removeFromWhitelist(index);
      }
    });
  }
}

// 从黑名单移除
function removeFromBlacklist(index) {
  config.blacklist.splice(index, 1);
  updateBlacklistUI();
}

// 从白名单移除
function removeFromWhitelist(index) {
  config.whitelist.splice(index, 1);
  updateWhitelistUI();
}

// 保存配置
function saveConfig() {
  // 获取旧配置，用于判断哪些配置项发生了变化
  chrome.storage.local.get('linkMarkerConfig', (result) => {
    const oldConfig = result.linkMarkerConfig || defaultConfig;
    
    // 保存新配置
    chrome.storage.local.set({ linkMarkerConfig: config }, () => {
      showNotification('保存成功', '所有设置已保存', 'success');
      
      // 关键修复：只要配置发生变化，就通知所有页面更新
      // 包括域名别名配置的变化
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          // 检查标签页URL是否有效，避免向扩展页面、文件系统页面等发送消息
          if (tab.url && tab.url.startsWith('http')) {
            chrome.tabs.sendMessage(tab.id, { action: 'configUpdated' }, () => {
              // 忽略错误
              if (chrome.runtime.lastError) {
                  // 静默处理错误，避免错误消息显示
                }
              });
            }
          });
        });
      })
    });
  };

// 重置配置
function resetConfig() {
  if (confirm(chrome.i18n.getMessage('clearConfirm'))) {
    config = { ...defaultConfig };
    updateUI();
    showNotification(chrome.i18n.getMessage('exportSuccess'), chrome.i18n.getMessage('importSuccess'), 'info');
  }
}

// 显示通知
function showNotification(title, message, type = 'info') {
  // 创建通知元素
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
  
  // 设置样式
  if (type === 'success') {
    notification.style.backgroundColor = '#4CAF50';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#f44336';
  } else if (type === 'warning') {
    notification.style.backgroundColor = '#ff9800';
  } else {
    notification.style.backgroundColor = '#2196f3';
  }
  
  // 设置内容
  notification.innerHTML = `
    <strong>${title}</strong>
    <p style="margin: 4px 0 0 0;">${message}</p>
  `;
  
  // 添加动画
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
  
  // 添加到页面
  document.body.appendChild(notification);
  
  // 3秒后移除
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      document.body.removeChild(notification);
      document.head.removeChild(style);
    }, 300);
  }, 3000);
}

// 域名别名映射功能
function setupDomainAliasListeners() {
  const addAliasBtn = document.getElementById('add-alias-group');
  if (addAliasBtn) {
    addAliasBtn.addEventListener('click', addAliasGroup);
  }
}

function addAliasGroup() {
  const primaryDomain = document.getElementById('alias-primary-domain').value.trim();
  const secondaryDomainsInput = document.getElementById('alias-secondary-domains').value.trim();
  
  if (!primaryDomain) {
    showNotification('错误', '请输入主域名', 'error');
    return;
  }

  const secondaryDomains = secondaryDomainsInput
    .split(/[,，]/)
    .map(d => d.trim())
    .filter(d => d.length > 0);

  const newGroup = {
    primary: primaryDomain,
    aliases: secondaryDomains
  };

  config.domainAliases.push(newGroup);
  updateAliasGroupsUI();
  
  document.getElementById('alias-primary-domain').value = '';
  document.getElementById('alias-secondary-domains').value = '';
}

function updateAliasGroupsUI() {
  const listContainer = document.getElementById('alias-groups-list');
  if (!listContainer) return;

  listContainer.innerHTML = '';

  if (config.domainAliases.length === 0) {
    listContainer.innerHTML = '<p style="color: #888; padding: 10px;">暂无别名组</p>';
    return;
  }

  config.domainAliases.forEach((group, index) => {
    const groupElement = document.createElement('div');
    groupElement.className = 'alias-group';
    groupElement.innerHTML = `
      <div class="alias-group-header">
        <strong>组 ${index + 1}:</strong>
        <div class="alias-group-actions">
          <button class="btn btn-small btn-secondary edit-alias-group" data-index="${index}">编辑</button>
          <button class="btn btn-small btn-danger remove-alias-group" data-index="${index}">删除</button>
        </div>
      </div>
      <div class="alias-group-content">
        <div class="alias-primary">
          <span>主域名:</span>
          <span class="domain-value">${group.primary}</span>
        </div>
        <div class="alias-secondary">
          <span>别名域名:</span>
          <span class="domain-value">${group.aliases.length > 0 ? group.aliases.join(', ') : '无'}</span>
        </div>
      </div>
      <div class="alias-group-edit hidden" data-index="${index}">
        <input type="text" class="edit-primary-domain" value="${group.primary}" placeholder="主域名">
        <input type="text" class="edit-secondary-domains" value="${group.aliases.join(', ')}" placeholder="别名域名（用逗号分隔）">
        <button class="btn btn-small btn-primary save-edit" data-index="${index}">保存</button>
        <button class="btn btn-small btn-secondary cancel-edit" data-index="${index}">取消</button>
      </div>
    `;
    listContainer.appendChild(groupElement);
  });

  // 添加删除按钮事件监听
  document.querySelectorAll('.remove-alias-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      removeAliasGroup(index);
    });
  });

  // 添加编辑按钮事件监听
  document.querySelectorAll('.edit-alias-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      toggleEditMode(index);
    });
  });

  // 添加保存编辑按钮事件监听
  document.querySelectorAll('.save-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      saveAliasGroupEdit(index);
    });
  });

  // 添加取消编辑按钮事件监听
  document.querySelectorAll('.cancel-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      toggleEditMode(index);
    });
  });
}

function toggleEditMode(index) {
  const groupElement = document.querySelector(`.alias-group-edit[data-index="${index}"]`);
  const contentElement = document.querySelectorAll('.alias-group-content')[index];
  const actionsElement = document.querySelectorAll('.alias-group-actions')[index];
  
  if (groupElement && contentElement && actionsElement) {
    groupElement.classList.toggle('hidden');
    contentElement.classList.toggle('hidden');
    actionsElement.classList.toggle('hidden');
  }
}

function saveAliasGroupEdit(index) {
  const groupElement = document.querySelector(`.alias-group-edit[data-index="${index}"]`);
  if (!groupElement) return;

  const primaryInput = groupElement.querySelector('.edit-primary-domain');
  const secondaryInput = groupElement.querySelector('.edit-secondary-domains');

  if (!primaryInput || !secondaryInput) return;

  const primaryDomain = primaryInput.value.trim();
  const secondaryDomains = secondaryInput.value
    .split(/[,，]/)
    .map(d => d.trim())
    .filter(d => d.length > 0);

  if (!primaryDomain) {
    showNotification('错误', '请输入主域名', 'error');
    return;
  }

  config.domainAliases[index] = {
    primary: primaryDomain,
    aliases: secondaryDomains
  };

  updateAliasGroupsUI();
}

function removeAliasGroup(index) {
  if (confirm('确定要删除这个别名组吗？')) {
    config.domainAliases.splice(index, 1);
    updateAliasGroupsUI();
  }
}

// 更新UI时也要更新域名别名UI
function updateUIAfterLoad() {
  updateUI();
  updateAliasGroupsUI();
}

// 重写loadConfig以加载域名别名配置
const originalLoadConfig = loadConfig;
function loadConfig() {
  chrome.storage.local.get('linkMarkerConfig', (result) => {
    if (result.linkMarkerConfig) {
      config = { ...defaultConfig, ...result.linkMarkerConfig };
    }
    updateUIAfterLoad();
  });
}

// 初始化
init();