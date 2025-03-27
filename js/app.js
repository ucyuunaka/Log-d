// 初始化Quill编辑器
const quill = new Quill('#editor-container', {
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      ['image']
    ]
  },
  placeholder: '请输入日志内容...',
  theme: 'snow'
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
    
    // 处理所有内容（包括文本和图片）
    const processedOps = await Promise.all(
      delta.ops.map(async op => {
        // 如果是图片，转换为Base64
        if (op.insert && op.insert.image) {
          return {
            ...op,
            insert: {
              image: await convertImageToBase64(
                await fetch(op.insert.image).then(r => r.blob())
              )
            }
          };
        }
        // 如果是文本或其他内容，保持原样
        return op;
      })
    );

    const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
    logs.unshift({
      timestamp,
      content: { ops: processedOps },
      html: quill.root.innerHTML
    });

    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    showStatus('✅ 日志保存成功', 2000);
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
    // 创建临时DOM元素来解析HTML内容
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = log.html;
    
    // 处理图片，创建缩略图
    const images = tempDiv.querySelectorAll('img');
    images.forEach(img => {
      // 为每个图片创建缩略图容器
      const imgContainer = document.createElement('div');
      imgContainer.className = 'thumbnail-container';
      
      // 创建缩略图
      const thumbnail = document.createElement('img');
      thumbnail.src = img.src;
      thumbnail.className = 'thumbnail';
      thumbnail.setAttribute('data-original', img.src);
      thumbnail.onclick = function() { showFullImage(this.getAttribute('data-original')); };
      
      imgContainer.appendChild(thumbnail);
      img.parentNode.replaceChild(imgContainer, img);
    });
    
    // 提取完整文本（不包括HTML标签）
    let previewText = tempDiv.textContent;
    
    // 构建预览HTML，包含文本和缩略图
    const previewHTML = tempDiv.innerHTML;
    
    return `
      <div class="log-item">
        <time>${log.timestamp}</time>
        <div class="preview">
          ${previewText}
          ${images.length > 0 ? '<div class="thumbnails">' + Array.from(images).map(img => 
            `<div class="thumbnail-container">
              <img src="${img.src}" class="thumbnail" onclick="showFullImage('${img.src}')" />
            </div>`).join('') + '</div>' : ''}
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