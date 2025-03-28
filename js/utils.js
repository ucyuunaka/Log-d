// 常量定义
export const LOG_STORAGE_KEY = 'userLogs';
export const MAX_IMAGE_SIZE = 800;
export const IMAGE_QUALITY = 0.8;
export const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB

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
