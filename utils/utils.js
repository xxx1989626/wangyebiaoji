// 工具函数库

const StorageUtils = {
  get: function(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  },

  set: function(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  },

  remove: function(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, () => {
        resolve();
      });
    });
  },

  clear: function() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }
};

const TimeUtils = {
  format: function(timestamp, format) {
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
    } else {
      return date.toLocaleString();
    }
  },

  getTimestamp: function() {
    return Date.now();
  }
};

const UrlUtils = {
  getDomain: function(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname;
    } catch (e) {
      return '';
    }
  },

  normalize: function(url) {
    try {
      const u = new URL(url);
      return u.origin + u.pathname.replace(/\/$/, '');
    } catch (e) {
      return url;
    }
  },

  matchesPattern: function(domain, pattern) {
    if (pattern === domain) {
      return true;
    }

    if (pattern.startsWith('*.')) {
      const wildcardDomain = pattern.substring(2);
      return domain === wildcardDomain || domain.endsWith('.' + wildcardDomain);
    }

    return false;
  }
};

const DataUtils = {
  exportData: function() {
    return new Promise(async (resolve) => {
      const config = await StorageUtils.get('linkMarkerConfig');
      const data = await StorageUtils.get('linkMarkerData');

      const exportData = {
        config,
        data,
        exportTime: TimeUtils.getTimestamp(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = TimeUtils.format(TimeUtils.getTimestamp(), 'YYYY-MM-DD_HH-MM-SS');
      const fileName = `link-marker-data-${timestamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      resolve(fileName);
    });
  },

  cleanData: function(data) {
    const cleanedData = {};
    Object.keys(data).forEach(domain => {
      const domainData = data[domain];
      cleanedData[domain] = {};
      Object.keys(domainData).forEach(link => {
        const mark = domainData[link];
        cleanedData[domain][link] = {
          timestamp: mark.timestamp,
          duration: mark.duration
        };
      });
    });
    return cleanedData;
  },

  importData: function(jsonData, mode) {
    return new Promise(async (resolve) => {
      try {
        const importData = JSON.parse(jsonData);

        if (mode === 'replace') {
          if (importData.config) {
            await StorageUtils.set('linkMarkerConfig', importData.config);
          }
          if (importData.data) {
            await StorageUtils.set('linkMarkerData', DataUtils.cleanData(importData.data));
          }
        } else if (mode === 'append') {
          if (importData.config) {
            const currentConfig = await StorageUtils.get('linkMarkerConfig') || {};
            const mergedConfig = { ...currentConfig, ...importData.config };
            await StorageUtils.set('linkMarkerConfig', mergedConfig);
          }
          if (importData.data) {
            const currentData = await StorageUtils.get('linkMarkerData') || {};
            const mergedData = { ...currentData };
            const cleanedImportData = DataUtils.cleanData(importData.data);

            Object.keys(cleanedImportData).forEach(domain => {
              if (!mergedData[domain]) {
                mergedData[domain] = {};
              }
              Object.keys(cleanedImportData[domain]).forEach(link => {
                mergedData[domain][link] = cleanedImportData[domain][link];
              });
            });

            await StorageUtils.set('linkMarkerData', mergedData);
          }
        }

        resolve({ success: true });
      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    });
  },

  deleteRecord: function(domain, link) {
    return new Promise(async (resolve) => {
      try {
        const data = await StorageUtils.get('linkMarkerData') || {};

        if (data[domain] && data[domain][link]) {
          delete data[domain][link];

          if (Object.keys(data[domain]).length === 0) {
            delete data[domain];
          }

          await StorageUtils.set('linkMarkerData', data);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'Record not found' });
        }
      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    });
  }
};

const NotificationUtils = {
  show: function(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `link-marker-notification link-marker-notification-${type}`;
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
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StorageUtils,
    TimeUtils,
    UrlUtils,
    DataUtils,
    NotificationUtils
  };
}