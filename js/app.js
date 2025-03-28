// 常量定义
const LOG_STORAGE_KEY = 'userLogs';
const MAX_IMAGE_SIZE = 800;
const IMAGE_QUALITY = 0.8;
const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB

// DOM元素缓存
const dom = {
  editorContainer: document.getElementById('editor-container'),
  imageUpload: document.getElementById('image-upload'),
  dropZone: document.getElementById('dropZone'),
  imagePreviewContainer: document.getElementById('image-preview-container'),
  clearImagesBtn: document.getElementById('clear-images'),
  saveLogBtn: document.getElementById('saveLog'),
  clearAllLogsBtn: document.getElementById('clearAllLogs'),
  logList: document.getElementById('logList'),
  wordCount: document.getElementById('wordCount'),
  searchInput: document.getElementById('searchInput'),
  dateFilter: document.getElementById('dateFilter'),
  toastContainer: document.getElementById('toastContainer')
};

// 应用状态
const state = {
  quill: null,
  uploadedImages: [],
  currentLogs: [],
  activeModal: null
};

// 工具函数
const utils = {
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

// 初始化应用
function initApp() {
  initEditor();
  setupEventListeners();
  loadLogs();
  updateWordCount();
}

// 初始化编辑器
function initEditor() {
  state.quill = new Quill(dom.editorContainer, {
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ],
      clipboard: {
        matchVisual: false
      }
    },
    placeholder: '写下今天的所思所想...',
    theme: 'snow'
  });

  state.quill.on('text-change', utils.debounce(updateWordCount, 300));
}

// 设置事件监听器
function setupEventListeners() {
  // 图片上传
  dom.imageUpload.addEventListener('change', handleImageUpload);
  
  // 拖放上传
  dom.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropZone.classList.add('dragover');
  });
  
  dom.dropZone.addEventListener('dragleave', () => {
    dom.dropZone.classList.remove('dragover');
  });
  
  dom.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      dom.imageUpload.files = e.dataTransfer.files;
      handleImageUpload({ target: dom.imageUpload });
    }
  });
  
  // 清除图片
  dom.clearImagesBtn.addEventListener('click', clearAllImages);
  
  // 保存日志
  dom.saveLogBtn.addEventListener('click', saveLog);
  
  // 清空日志
  dom.clearAllLogsBtn.addEventListener('click', confirmClearAllLogs);
  
  // 搜索过滤
  dom.searchInput.addEventListener('input', utils.debounce(filterLogs, 300));
  dom.dateFilter.addEventListener('change', filterLogs);
  
  // 图片预览点击事件委托
  dom.logList.addEventListener('click', (e) => {
    if (e.target.classList.contains('thumbnail')) {
      showFullImage(e.target.dataset.fullimg);
    }
  });
  
  // 日志删除事件委托
  dom.logList.addEventListener('click', (e) => {
    if (e.target.closest('.log-actions button')) {
      const logId = e.target.closest('.log-item').dataset.id;
      deleteLog(logId);
    }
  });
  
  // 窗口关闭前提示
  window.addEventListener('beforeunload', (e) => {
    const hasContent = state.quill.getText().trim() || state.uploadedImages.length;
    if (hasContent) {
      e.preventDefault();
      e.returnValue = '您有未保存的内容，确定要离开吗？';
    }
  });
}

// 更新字数统计
function updateWordCount() {
  const text = state.quill.getText().trim();
  const count = text ? text.split(/\s+/).length : 0;
  dom.wordCount.textContent = count;
}

// 图片上传处理
async function handleImageUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  try {
    showToast('正在处理图片...', 'info');
    
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        showToast(`跳过非图片文件: ${file.name}`, 'warning');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`图片过大已跳过: ${file.name}`, 'warning');
        return false;
      }
      return true;
    });
    
    const imageProcessing = validFiles.map(processImageFile);
    const newImages = await Promise.all(imageProcessing);
    
    state.uploadedImages = [...state.uploadedImages, ...newImages];
    updateImagePreview();
    
    showToast(`成功上传 ${newImages.length} 张图片`, 'success');
  } catch (error) {
    console.error('图片处理失败:', error);
    showToast('图片处理失败: ' + error.message, 'error');
  } finally {
    event.target.value = '';
  }
}

// 图片处理
async function processImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        img.src = e.target.result;
        await img.decode();
        
        const { width, height } = calculateResizedDimensions(img);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        const orientation = utils.getImageOrientation(file);
        
        if (orientation && orientation > 1) {
          utils.fixImageOrientation(ctx, img, orientation);
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

// 计算调整后的图片尺寸
function calculateResizedDimensions(img) {
  let { width, height } = img;
  
  if (width > height && width > MAX_IMAGE_SIZE) {
    height = height * (MAX_IMAGE_SIZE / width);
    width = MAX_IMAGE_SIZE;
  } else if (height > MAX_IMAGE_SIZE) {
    width = width * (MAX_IMAGE_SIZE / height);
    height = MAX_IMAGE_SIZE;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

// 更新图片预览
function updateImagePreview() {
  dom.imagePreviewContainer.innerHTML = state.uploadedImages
    .map((imgSrc, index) => `
      <div class="preview-image-container">
        <img src="${imgSrc}" class="preview-image" 
             alt="预览图片 ${index + 1}" 
             data-fullimg="${imgSrc}">
        <button class="remove-image-btn" 
                aria-label="删除图片"
                data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `)
    .join('');
  
  // 添加删除按钮事件
  dom.imagePreviewContainer.querySelectorAll('.remove-image-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeImage(parseInt(btn.dataset.index));
    });
  });
  
  // 添加预览点击事件
  dom.imagePreviewContainer.querySelectorAll('.preview-image').forEach(img => {
    img.addEventListener('click', () => showFullImage(img.dataset.fullimg));
  });
}

// 删除单张图片
function removeImage(index) {
  state.uploadedImages.splice(index, 1);
  updateImagePreview();
  showToast('图片已删除', 'success');
}

// 清除所有图片
function clearAllImages() {
  if (!state.uploadedImages.length) return;
  
  state.uploadedImages = [];
  updateImagePreview();
  showToast('已清除所有图片', 'success');
}

// 保存日志
async function saveLog() {
  try {
    const textContent = state.quill.getText().trim();
    if (!textContent && !state.uploadedImages.length) {
      showToast('请输入日志内容或上传图片', 'warning');
      return;
    }
    
    // 创建日志对象并估算大小
    const logEntry = createLogEntry();
    const entrySize = new Blob([JSON.stringify(logEntry)]).size;
    
    if (!hasSufficientStorage(entrySize)) {
      showToast('存储空间不足，请删除旧日志', 'error');
      return;
    }
    
    // 保存到本地存储
    const logs = getLogsFromStorage();
    logs.unshift(logEntry);
    
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        showToast('存储空间已满，无法保存', 'error');
        return;
      }
      throw error;
    }
    
    // 重置状态
    resetEditor();
    showToast('日志保存成功', 'success');
    loadLogs();
  } catch (error) {
    console.error('保存日志失败:', error);
    showToast(`保存失败: ${error.message}`, 'error');
  }
}

// 创建日志条目
function createLogEntry() {
  return {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    displayTime: utils.formatDate(new Date()),
    textContent: state.quill.getText(),
    htmlContent: state.quill.root.innerHTML,
    delta: state.quill.getContents(),
    images: [...state.uploadedImages],
    searchText: state.quill.getText().toLowerCase()
  };
}

// 从存储获取日志
function getLogsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  } catch (error) {
    console.error('解析日志数据失败:', error);
    return [];
  }
}

// 检查存储空间
function hasSufficientStorage(requiredSize = 100 * 1024) {
  const { used, total } = getStorageUsage();
  return (total - used) > requiredSize;
}

// 获取存储使用情况
function getStorageUsage() {
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

// 重置编辑器状态
function resetEditor() {
  state.quill.setContents([]);
  state.uploadedImages = [];
  updateImagePreview();
  updateWordCount();
}

// 加载日志 - 确保一次性加载全部
function loadLogs() {
  state.currentLogs = getLogsFromStorage();
  renderLogList(state.currentLogs);
}

// 过滤日志
function filterLogs() {
  const searchTerm = dom.searchInput.value.toLowerCase();
  const dateFilter = dom.dateFilter.value;
  
  const filtered = state.currentLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.searchText.includes(searchTerm) || 
      log.displayTime.toLowerCase().includes(searchTerm);
    
    const matchesDate = !dateFilter || 
      new Date(log.timestamp).toISOString().split('T')[0] === dateFilter;
    
    return matchesSearch && matchesDate;
  });
  
  renderLogList(filtered);
}

// 渲染日志列表 - 一次性渲染所有日志，不分页
function renderLogList(logs) {
  if (logs.length === 0) {
    dom.logList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <p>暂无日志记录</p>
      </div>
    `;
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  logs.forEach(log => {
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    logItem.dataset.id = log.id;
    
    logItem.innerHTML = `
      <time datetime="${log.timestamp}">${log.displayTime}</time>
      <div class="log-content">
        ${renderTextContent(log)}
        ${renderImages(log)}
      </div>
      <div class="log-actions">
        <button class="btn outline">
          <i class="fas fa-trash-alt"></i> 删除
        </button>
      </div>
    `;
    
    fragment.appendChild(logItem);
  });
  
  dom.logList.innerHTML = '';
  dom.logList.appendChild(fragment);
}

function renderTextContent(log) {
  if (!log.textContent) return '<p class="no-text">[无文本内容]</p>';
  
  const previewText = log.textContent.length > 200 
    ? log.textContent.substring(0, 200) + '...' 
    : log.textContent;
  
  return `<div class="text-preview">${previewText}</div>`;
}

function renderImages(log) {
  if (!log.images?.length) return '';
  
  return `
    <div class="thumbnails">
      ${log.images.map((img, idx) => `
        <div class="thumbnail-container">
          <img src="${img}" class="thumbnail" 
               alt="日志图片 ${idx + 1}"
               loading="lazy"
               data-fullimg="${img}">
        </div>
      `).join('')}
    </div>
  `;
}

// 显示全尺寸图片
function showFullImage(imageSrc) {
  // 关闭现有模态框
  if (state.activeModal) {
    document.body.removeChild(state.activeModal);
    state.activeModal = null;
  }
  
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.innerHTML = `
    <span class="close-modal">&times;</span>
    <img src="${imageSrc}" class="full-image" alt="全尺寸图片预览">
  `;
  
  document.body.appendChild(modal);
  state.activeModal = modal;
  
  setTimeout(() => modal.classList.add('active'), 10);
  
  // 关闭功能
  const close = () => {
    modal.classList.remove('active');
    setTimeout(() => {
      if (modal.parentNode) {
        document.body.removeChild(modal);
      }
      state.activeModal = null;
    }, 300);
  };
  
  modal.querySelector('.close-modal').addEventListener('click', close);
  modal.addEventListener('click', e => e.target === modal && close());
  
  const keyHandler = e => {
    if (e.key === 'Escape') close();
  };
  
  document.addEventListener('keydown', keyHandler);
  
  // 清理事件监听器
  modal._closeHandler = close;
  modal._keyHandler = keyHandler;
}

// 删除日志
function deleteLog(logId) {
  if (!confirm('确定要删除这条日志吗？此操作不可恢复！')) return;
  
  const logs = getLogsFromStorage().filter(log => log.id !== logId);
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  loadLogs();
  showToast('日志已删除', 'success');
}

// 确认清空所有日志
function confirmClearAllLogs() {
  if (!confirm('确定要清空所有日志吗？此操作不可恢复！')) return;
  
  localStorage.setItem(LOG_STORAGE_KEY, '[]');
  loadLogs();
  showToast('所有日志已清空', 'success');
}

// 显示提示消息
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${getToastIcon(type)}"></i>
    <span>${message}</span>
  `;
  
  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 自动消失
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        dom.toastContainer.removeChild(toast);
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

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);