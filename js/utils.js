// 常量定义
export const LOG_STORAGE_KEY = 'userLogs';
export const MAX_IMAGE_SIZE = 800;
export const IMAGE_QUALITY = 0.8;
export const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB
export const THEME_STORAGE_KEY = 'preferredTheme'; // 主题存储键名

// 工具函数
export const utils = {
  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  formatDate(date) {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },

  getImageOrientation(file) {
    // 实现EXIF方向检测
    return 1; // 简化版，实际项目应完整实现
  },

  fixImageOrientation(ctx, img, orientation) {
    // 根据方向调整图片
    ctx.drawImage(img, 0, 0);
  },

  // 主题相关功能
  getPreferredTheme() {
    // 从本地存储中获取偏好主题
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    
    // 如果没有保存的主题或者选择了"自动"，则根据系统偏好决定
    if (!savedTheme || savedTheme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    return savedTheme;
  },
  
  setTheme(theme) {
    // 保存主题偏好到本地存储
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    // 如果是自动模式，检测系统偏好
    if (theme === 'auto') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', systemTheme);
      return;
    }
    
    // 应用主题到 HTML 元素
    document.documentElement.setAttribute('data-theme', theme);
  },
  
  toggleTheme() {
    // 切换主题（dark/light）
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  }
};

// 存储相关功能
export function getLogsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  } catch (error) {
    console.error('解析日志数据失败:', error);
    return [];
  }
}

export function getStorageUsage() {
  try {
    const logs = getLogsFromStorage();
    const used = new Blob([JSON.stringify(logs)]).size;
    return {
      used,
      total: STORAGE_LIMIT,
      remaining: (STORAGE_LIMIT - used) / STORAGE_LIMIT
    };
  } catch (error) {
    console.error('存储空间计算失败:', error);
    return { used: 0, total: STORAGE_LIMIT, remaining: 1 };
  }
}

export function hasSufficientStorage(requiredSize = 100 * 1024) {
  const { used, total } = getStorageUsage();
  return (total - used) > requiredSize;
}

// 导出日志数据到JSON文件
export function exportLogsToJson(filename = 'log-d-backup.json') {
  try {
    const logs = getLogsFromStorage();
    if (logs.length === 0) {
      return { success: false, message: '没有可导出的日志数据' };
    }
    
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true, message: `成功导出 ${logs.length} 条日志` };
  } catch (error) {
    console.error('导出日志失败:', error);
    return { success: false, message: `导出失败: ${error.message}` };
  }
}

// 从JSON文件导入日志数据
export function importLogsFromJson(file, mode = 'merge') {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const importedLogs = JSON.parse(e.target.result);
          
          if (!Array.isArray(importedLogs)) {
            reject({ success: false, message: '导入文件格式错误，不是有效的日志数据' });
            return;
          }
          
          // 确保每个日志条目都有合法的ID
          const validatedLogs = importedLogs.map(log => {
            if (!log.id) log.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            return log;
          });
          
          let currentLogs = getLogsFromStorage();
          let resultLogs = [];
          
          if (mode === 'replace') {
            // 完全替换当前日志
            resultLogs = validatedLogs;
          } else if (mode === 'merge') {
            // 合并日志，避免ID重复
            const existingIds = new Set(currentLogs.map(log => log.id));
            const newLogs = validatedLogs.filter(log => !existingIds.has(log.id));
            resultLogs = [...currentLogs, ...newLogs];
            
            // 按时间戳排序
            resultLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          }
          
          localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(resultLogs));
          
          resolve({ 
            success: true, 
            message: `成功导入 ${validatedLogs.length} 条日志记录`,
            count: validatedLogs.length
          });
        } catch (parseError) {
          reject({ success: false, message: `解析导入文件失败: ${parseError.message}` });
        }
      };
      
      reader.onerror = function() {
        reject({ success: false, message: '读取文件时出错' });
      };
      
      reader.readAsText(file);
      
    } catch (error) {
      reject({ success: false, message: `导入过程出错: ${error.message}` });
    }
  });
}

// 提示消息功能
export function showToast(message, type = 'info', container) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${getToastIcon(type)}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 自动消失
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// 获取提示图标
function getToastIcon(type) {
  switch (type) {
    case 'success': return 'fa-check-circle';
    case 'error': return 'fa-exclamation-circle';
    case 'warning': return 'fa-exclamation-triangle';
    default: return 'fa-info-circle';
  }
}
