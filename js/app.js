// 初始化Quill编辑器
const quill = new Quill('#editor-container', {
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline']
      // 移除图片按钮，改为单独的图片上传区域
    ]
  },
  placeholder: '请输入日志内容...',
  theme: 'snow'
});

// 图片上传相关变量
let uploadedImages = [];

// 初始化图片上传功能
document.getElementById('image-upload').addEventListener('change', async function(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  // 处理所有选择的图片
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith('image/')) continue;
    
    try {
      const base64Image = await convertImageToBase64(file);
      uploadedImages.push(base64Image);
      updateImagePreview();
    } catch (error) {
      console.error('图片处理失败:', error);
      showStatus('❌ 图片处理失败', 2000);
    }
  }
  
  // 清空input，允许重复选择相同文件
  e.target.value = '';
});

// 更新图片预览
function updateImagePreview() {
  const previewContainer = document.getElementById('image-preview-container');
  previewContainer.innerHTML = '';
  
  uploadedImages.forEach((imgSrc, index) => {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'preview-image-container';
    
    const img = document.createElement('img');
    img.src = imgSrc;
    img.className = 'preview-image';
    img.onclick = function() { showFullImage(imgSrc); };
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = function(e) {
      e.stopPropagation();
      uploadedImages.splice(index, 1);
      updateImagePreview();
    };
    
    imgContainer.appendChild(img);
    imgContainer.appendChild(removeBtn);
    previewContainer.appendChild(imgContainer);
  });
}

// 清除所有图片
document.getElementById('clear-images').addEventListener('click', function() {
  uploadedImages = [];
  updateImagePreview();
  showStatus('🗑️ 已清除所有图片', 1500);
});

// 日志存储键名
const LOG_STORAGE_KEY = 'userLogs';

// 图片处理函数
function convertImageToBase64(file) {
  return new Promise(async (resolve) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      img.src = e.target.result;
      await img.decode();
      
      // 调整图片最大尺寸为800px
      const maxSize = 800;
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > maxSize) {
        height = height * (maxSize / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = width * (maxSize / height);
        height = maxSize;
      }
      
      // 创建Canvas进行压缩
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // 压缩质量至80%
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    
    reader.readAsDataURL(file);
  });
}

// 保存日志
document.getElementById('saveLog').addEventListener('click', async () => {
  try {
    // 检查存储空间
    const storageUsage = getStorageUsage();
    if (storageUsage.remaining < 0.5) {
      showStatus('❌ 存储空间不足，请删除旧日志', 3000);
      return;
    }

    const delta = quill.getContents();
    const timestamp = new Date().toLocaleString('zh-CN');
    
    // 获取文本内容
    const textContent = quill.getText();
    if (textContent.trim() === '' && uploadedImages.length === 0) {
      showStatus('❌ 请输入日志内容或上传图片', 2000);
      return;
    }
    
    // 获取HTML内容，保留格式
    const htmlContent = quill.root.innerHTML;
    
    // 创建日志对象，包含文本和图片
    const logEntry = {
      timestamp,
      textContent: textContent,
      htmlContent: htmlContent,
      images: uploadedImages,
      // 保存原始Delta格式，以便将来可能的编辑
      delta: delta
    };

    const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
    logs.unshift(logEntry);

    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    showStatus('✅ 日志保存成功', 2000);
    
    // 清空编辑器和图片
    quill.setText('');
    uploadedImages = [];
    updateImagePreview();
    
    refreshLogList();
  } catch (error) {
    showStatus('❌ 保存失败：' + error.message, 3000);
  }
});

// 显示状态提示
function showStatus(message, duration) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  setTimeout(() => statusEl.textContent = '', duration);
}

// 刷新日志列表
function refreshLogList() {
  const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  const listEl = document.getElementById('logList');
  
  listEl.innerHTML = logs.map((log, index) => {
    // 文本内容预览（截取前100个字符）
    const textPreview = log.textContent ? 
      (log.textContent.length > 100 ? log.textContent.substring(0, 100) + '...' : log.textContent) : '';
    
    // 处理HTML内容，保留格式
    const formattedHTML = log.htmlContent || '';
    
    // 生成图片缩略图HTML
    const thumbnailsHTML = log.images && log.images.length > 0 ? 
      `<div class="thumbnails">${
        log.images.map((imgSrc, imgIndex) => 
          `<div class="thumbnail-container">
            <img src="${imgSrc}" class="thumbnail" 
                 data-index="${imgIndex}" 
                 data-log-index="${index}" 
                 onclick="showFullImage('${imgSrc}')" />
          </div>`
        ).join('')
      }</div>` : '';
    
    return `
      <div class="log-item">
        <time>${log.timestamp}</time>
        <div class="preview">
          <div class="content-preview">
            <div class="text-preview">${textPreview}</div>
            ${thumbnailsHTML}
          </div>
        </div>
        <button onclick="deleteLog(${index})">删除</button>
      </div>
    `;
  }).join('');
}

// 显示全尺寸图片
window.showFullImage = function(imageSrc) {
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  
  // 创建图片元素
  const fullImg = document.createElement('img');
  fullImg.src = imageSrc;
  fullImg.className = 'full-image';
  
  // 创建关闭按钮
  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-modal';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = function() { document.body.removeChild(modal); };
  
  // 点击模态框背景也可关闭
  modal.onclick = function(e) {
    if (e.target === modal) document.body.removeChild(modal);
  };
  
  // 组装并添加到页面
  modal.appendChild(closeBtn);
  modal.appendChild(fullImg);
  document.body.appendChild(modal);
}

// 删除日志
window.deleteLog = (index) => {
  const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  logs.splice(index, 1);
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  refreshLogList();
  showStatus('🗑️ 日志已删除', 1500);
};

// 初始化加载日志
refreshLogList();

// 新增存储空间计算函数
function getStorageUsage() {
  const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  const used = encodeURIComponent(JSON.stringify(logs)).length;
  return {
    used: used,
    total: 5 * 1024 * 1024, // 5MB
    remaining: (5 * 1024 * 1024 - used) / (5 * 1024 * 1024)
  };
}

// 清空所有日志
window.clearAllLogs = () => {
  if (confirm('确定要清空所有历史日志吗？此操作不可恢复！')) {
    localStorage.setItem(LOG_STORAGE_KEY, '[]');
    refreshLogList();
    showStatus('🗑️ 所有日志已清空', 2000);
  }
};