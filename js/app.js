// 常量定义
const LOG_STORAGE_KEY = 'userLogs';
const MAX_IMAGE_SIZE = 800; // 图片最大尺寸
const IMAGE_QUALITY = 0.8; // 图片压缩质量
const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB存储限制

// DOM元素缓存
const domElements = {
  editorContainer: document.getElementById('editor-container'),
  imageUpload: document.getElementById('image-upload'),
  imagePreviewContainer: document.getElementById('image-preview-container'),
  clearImagesBtn: document.getElementById('clear-images'),
  saveLogBtn: document.getElementById('saveLog'),
  clearAllLogsBtn: document.getElementById('clearAllLogs'),
  logList: document.getElementById('logList'),
  status: document.getElementById('status')
};

// 状态管理
let state = {
  uploadedImages: [],
  quill: null
};

// 初始化应用
function initApp() {
  initEditor();
  setupEventListeners();
  refreshLogList();
}

// 初始化Quill编辑器
function initEditor() {
  state.quill = new Quill(domElements.editorContainer, {
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
      ],
      clipboard: {
        matchVisual: false // 防止自动转换格式
      }
    },
    placeholder: '请输入日志内容...',
    theme: 'snow'
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 图片上传
  domElements.imageUpload.addEventListener('change', handleImageUpload);
  
  // 清除图片
  domElements.clearImagesBtn.addEventListener('click', clearAllImages);
  
  // 保存日志
  domElements.saveLogBtn.addEventListener('click', saveLog);
  
  // 窗口关闭前提示保存
  window.addEventListener('beforeunload', (e) => {
    const hasContent = state.quill.getText().trim() !== '' || state.uploadedImages.length > 0;
    if (hasContent) {
      e.preventDefault();
      e.returnValue = '您有未保存的日志内容，确定要离开吗？';
    }
  });
}

// 图片上传处理
async function handleImageUpload(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  
  try {
    const imageProcessingPromises = files
      .filter(file => file.type.startsWith('image/'))
      .map(processImageFile);
    
    const newImages = await Promise.all(imageProcessingPromises);
    state.uploadedImages = [...state.uploadedImages, ...newImages];
    updateImagePreview();
    showStatus(`✅ 成功上传 ${newImages.length} 张图片`, 2000);
  } catch (error) {
    console.error('图片处理失败:', error);
    showStatus('❌ 图片处理失败', 2000);
  } finally {
    e.target.value = ''; // 清空input
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
  domElements.imagePreviewContainer.innerHTML = state.uploadedImages
    .map((imgSrc, index) => `
      <div class="preview-image-container">
        <img src="${imgSrc}" class="preview-image" 
             alt="预览图片 ${index + 1}" 
             onclick="showFullImage('${imgSrc}')">
        <button class="remove-image-btn" 
                aria-label="删除图片"
                onclick="removeImage(${index})">
          ×
        </button>
      </div>
    `)
    .join('');
}

// 删除单张图片
window.removeImage = function(index) {
  state.uploadedImages.splice(index, 1);
  updateImagePreview();
  showStatus('🗑️ 图片已删除', 1500);
};

// 清除所有图片
function clearAllImages() {
  if (state.uploadedImages.length === 0) return;
  
  state.uploadedImages = [];
  updateImagePreview();
  showStatus('🗑️ 已清除所有图片', 1500);
}

// 保存日志
async function saveLog() {
  try {
    // 验证内容
    const textContent = state.quill.getText().trim();
    if (textContent === '' && state.uploadedImages.length === 0) {
      showStatus('❌ 请输入日志内容或上传图片', 2000);
      return;
    }
    
    // 检查存储空间
    if (!hasSufficientStorage()) {
      showStatus('❌ 存储空间不足，请删除旧日志', 3000);
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
    showStatus('✅ 日志保存成功', 2000);
    refreshLogList();
  } catch (error) {
    console.error('保存日志失败:', error);
    showStatus(`❌ 保存失败: ${error.message}`, 3000);
  }
}

// 创建日志条目
function createLogEntry() {
  return {
    timestamp: new Date().toLocaleString('zh-CN'),
    textContent: state.quill.getText(),
    htmlContent: state.quill.root.innerHTML,
    delta: state.quill.getContents(),
    images: [...state.uploadedImages]
  };
}

// 从存储获取日志
function getLogsFromStorage() {
  return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
}

// 检查存储空间
function hasSufficientStorage() {
  const { remaining } = getStorageUsage();
  return remaining > 0.1; // 保留10%空间
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
}

// 刷新日志列表
function refreshLogList() {
  const logs = getLogsFromStorage();
  
  domElements.logList.innerHTML = logs.length > 0 
    ? logs.map(renderLogItem).join('')
    : '<p class="no-logs">暂无日志记录</p>';
  
  // 添加图片点击事件
  document.querySelectorAll('.thumbnail').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      showFullImage(img.src);
    });
  });
}

// 渲染单个日志项
function renderLogItem(log, index) {
  const textPreview = log.textContent
    ? log.textContent.length > 100 
      ? log.textContent.substring(0, 100) + '...' 
      : log.textContent
    : '[无文本内容]';
  
  const thumbnailsHTML = log.images?.length > 0
    ? `<div class="thumbnails">
        ${log.images.map((imgSrc, imgIndex) => `
          <div class="thumbnail-container">
            <img src="${imgSrc}" class="thumbnail" 
                 alt="日志图片 ${imgIndex + 1}" 
                 loading="lazy">
          </div>
        `).join('')}
       </div>`
    : '';
  
  return `
    <div class="log-item" data-index="${index}">
      <time datetime="${new Date(log.timestamp).toISOString()}">
        ${log.timestamp}
      </time>
      <div class="content-preview">
        <div class="text-preview">${escapeHtml(textPreview)}</div>
        ${thumbnailsHTML}
      </div>
      <button class="btn danger" onclick="deleteLog(${index})" aria-label="删除日志">
        <span class="icon">🗑️</span> 删除
      </button>
    </div>
  `;
}

// HTML转义
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 显示全尺寸图片
window.showFullImage = function(imageSrc) {
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '图片预览');
  
  modal.innerHTML = `
    <button class="close-modal" aria-label="关闭图片预览">&times;</button>
    <img src="${imageSrc}" class="full-image" alt="全尺寸图片预览">
  `;
  
  // 关闭功能
  const close = () => document.body.removeChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', close);
  modal.addEventListener('click', (e) => e.target === modal && close());
  
  // 键盘导航
  modal.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  
  document.body.appendChild(modal);
  modal.focus();
};

// 删除日志
window.deleteLog = function(index) {
  if (!confirm('确定要删除这条日志吗？此操作不可恢复！')) return;
  
  const logs = getLogsFromStorage();
  logs.splice(index, 1);
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  refreshLogList();
  showStatus('🗑️ 日志已删除', 1500);
};

// 清空所有日志
window.clearAllLogs = function() {
  if (!confirm('确定要清空所有历史日志吗？此操作不可恢复！')) return;
  
  localStorage.setItem(LOG_STORAGE_KEY, '[]');
  refreshLogList();
  showStatus('🗑️ 所有日志已清空', 2000);
};

// 显示状态消息
function showStatus(message, duration = 2000) {
  domElements.status.textContent = message;
  domElements.status.style.display = 'block';
  
  if (duration > 0) {
    setTimeout(() => {
      domElements.status.textContent = '';
      domElements.status.style.display = 'none';
    }, duration);
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', initApp);