// 常量定义
const LOG_STORAGE_KEY = 'userLogs';
const MAX_IMAGE_SIZE = 800;
const IMAGE_QUALITY = 0.8;
const STORAGE_LIMIT = 5 * 1024 * 1024;

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
  currentLogs: []
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

  // 监听内容变化更新字数
  state.quill.on('text-change', updateWordCount);
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
  dom.searchInput.addEventListener('input', filterLogs);
  dom.dateFilter.addEventListener('change', filterLogs);
  
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
    
    const imageProcessing = files
      .filter(file => file.type.startsWith('image/'))
      .map(processImageFile);
    
    const newImages = await Promise.all(imageProcessing);
    state.uploadedImages = [...state.uploadedImages, ...newImages];
    updateImagePreview();
    
    showToast(`成功上传 ${newImages.length} 张图片`, 'success');
  } catch (error) {
    console.error('图片处理失败:', error);
    showToast('图片处理失败', 'error');
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
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
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
             onclick="showFullImage('${imgSrc}')">
        <button class="remove-image-btn" 
                aria-label="删除图片"
                onclick="removeImage(${index})">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `)
    .join('');
}

// 删除单张图片
window.removeImage = function(index) {
  state.uploadedImages.splice(index, 1);
  updateImagePreview();
  showToast('图片已删除', 'success');
};

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
    // 验证内容
    const textContent = state.quill.getText().trim();
    if (!textContent && !state.uploadedImages.length) {
      showToast('请输入日志内容或上传图片', 'warning');
      return;
    }
    
    // 检查存储空间
    if (!hasSufficientStorage()) {
      showToast('存储空间不足，请删除旧日志', 'error');
      return;
    }
    
    // 创建日志对象
    const logEntry = createLogEntry();
    
    // 保存到本地存储
    const logs = getLogsFromStorage();
    logs.unshift(logEntry);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    
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
    displayTime: new Date().toLocaleString('zh-CN'),
    textContent: state.quill.getText(),
    htmlContent: state.quill.root.innerHTML,
    delta: state.quill.getContents(),
    images: [...state.uploadedImages],
    searchText: state.quill.getText().toLowerCase()
  };
}

// 从存储获取日志
function getLogsFromStorage() {
  return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
}

// 检查存储空间
function hasSufficientStorage() {
  const { remaining } = getStorageUsage();
  return remaining > 0.1;
}

// 获取存储使用情况
function getStorageUsage() {
  const logs = getLogsFromStorage();
  const used = encodeURIComponent(JSON.stringify(logs)).length;
  return {
    used,
    total: STORAGE_LIMIT,
    remaining: (STORAGE_LIMIT - used) / STORAGE_LIMIT
  };
}

// 重置编辑器状态
function resetEditor() {
  state.quill.setContents([]);
  state.uploadedImages = [];
  updateImagePreview();
  updateWordCount();
}

// 加载日志
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

// 渲染日志列表
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
  
  dom.logList.innerHTML = logs.map(log => `
    <div class="log-item" data-id="${log.id}">
      <time datetime="${log.timestamp}">${log.displayTime}</time>
      <div class="log-content">
        ${log.textContent ? `
          <div class="text-preview">
            ${log.textContent.length > 200 ? 
              log.textContent.substring(0, 200) + '...' : 
              log.textContent}
          </div>
        ` : '<p class="no-text">[无文本内容]</p>'}
        
        ${log.images?.length ? `
          <div class="thumbnails">
            ${log.images.map((img, idx) => `
              <div class="thumbnail-container">
                <img src="${img}" class="thumbnail" 
                     alt="日志图片 ${idx + 1}"
                     loading="lazy"
                     onclick="showFullImage('${img}')">
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="log-actions">
        <button class="btn outline" onclick="deleteLog('${log.id}')">
          <i class="fas fa-trash-alt"></i> 删除
        </button>
      </div>
    </div>
  `).join('');
}

// 显示全尺寸图片
window.showFullImage = function(imageSrc) {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.innerHTML = `
    <span class="close-modal">&times;</span>
    <img src="${imageSrc}" class="full-image" alt="全尺寸图片预览">
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('active'), 10);
  
  // 关闭功能
  const close = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  };
  
  modal.querySelector('.close-modal').addEventListener('click', close);
  modal.addEventListener('click', e => e.target === modal && close());
  document.addEventListener('keydown', e => e.key === 'Escape' && close());
};

// 删除日志
window.deleteLog = function(logId) {
  if (!confirm('确定要删除这条日志吗？此操作不可恢复！')) return;
  
  const logs = getLogsFromStorage().filter(log => log.id !== logId);
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  loadLogs();
  showToast('日志已删除', 'success');
};

// 确认清空所有日志
function confirmClearAllLogs() {
  if (!confirm('确定要清空所有日志吗？此操作不可恢复！')) return;
  
  localStorage.setItem(LOG_STORAGE_KEY, '[]');
  loadLogs();
  showToast('所有日志已清空', 'success');
};

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
    setTimeout(() => toast.remove(), 300);
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