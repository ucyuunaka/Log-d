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
  },

  // 获取图片质量评估
  estimateImageQuality(imgElement) {
    // 根据图片尺寸和加载时间评估质量
    const loadTime = imgElement.complete ? 0 : performance.now();
    const imgSize = imgElement.naturalWidth * imgElement.naturalHeight;
    
    // 简单的质量评估，更复杂的实现可以考虑更多因素
    let quality = 1.0;
    
    // 大图降低质量
    if (imgSize > 4000000) quality = 0.7;      // > 4MP
    else if (imgSize > 2000000) quality = 0.8; // > 2MP
    else if (imgSize > 1000000) quality = 0.85; // > 1MP
    else quality = 0.9;
    
    return quality;
  },
  
  // 将Data URL转换为Blob
  dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
  },
  
  // 获取Blob大小（字节）
  getBlobSize(blob) {
    return blob.size;
  }
};

// 存储相关功能
export function getLogsFromStorage() {
  try {
    const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY)) || [];
    return logs;
  } catch (e) {
    console.error('加载日志失败:', e);
    return [];
  }
}

export function getStorageUsage() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    total += (key.length + value.length) * 2; // UTF-16 每个字符2字节
  }
  return total;
}

export function hasSufficientStorage(requiredSize = 100 * 1024) {
  const currentUsage = getStorageUsage();
  return currentUsage + requiredSize <= STORAGE_LIMIT;
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

// 显示确认对话框
export function showConfirmDialog(title, message, confirmCallback, cancelCallback) {
  const confirmModal = document.getElementById('confirmModal');
  const confirmTitle = document.getElementById('confirmModalTitle');
  const confirmMessage = document.getElementById('confirmModalMessage');
  const confirmButton = document.getElementById('confirmAction');
  const cancelButton = document.getElementById('confirmCancel');
  
  if (!confirmModal || !confirmTitle || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('确认对话框元素未找到');
    return;
  }
  
  // 设置对话框内容
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  
  // 移除旧的事件监听器
  const newConfirmButton = confirmButton.cloneNode(true);
  const newCancelButton = cancelButton.cloneNode(true);
  
  confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
  cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
  
  // 添加新的事件监听器
  newConfirmButton.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    if (typeof confirmCallback === 'function') {
      confirmCallback();
    }
  });
  
  newCancelButton.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    if (typeof cancelCallback === 'function') {
      cancelCallback();
    }
  });
  
  // 点击背景关闭
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      confirmModal.classList.remove('active');
      if (typeof cancelCallback === 'function') {
        cancelCallback();
      }
    }
  });
  
  // 显示确认对话框
  confirmModal.classList.add('active');
}
