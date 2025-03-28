import stateManager, { LOG_STORAGE_KEY, MAX_IMAGE_SIZE, IMAGE_QUALITY } from './state-manager.js';
import { utils, showToast, hasSufficientStorage, getLogsFromStorage } from './utils.js';

// 事件处理器模块
class EventHandlers {
  constructor() {
    this.dom = null;
  }

  // 初始化DOM元素引用
  initDomElements(elements) {
    this.dom = elements;
  }

  // 设置所有事件监听器
  setupEventListeners() {
    // 图片上传
    this.dom.imageUpload.addEventListener('change', this.handleImageUpload.bind(this));
    
    // 拖放上传
    this.dom.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dom.dropZone.classList.add('dragover');
    });
    
    this.dom.dropZone.addEventListener('dragleave', () => {
      this.dom.dropZone.classList.remove('dragover');
    });
    
    this.dom.dropZone.addEventListener('drop', this.handleDrop.bind(this));
    
    // 清除图片
    this.dom.clearImagesBtn.addEventListener('click', this.clearAllImages.bind(this));
    
    // 保存日志
    this.dom.saveLogBtn.addEventListener('click', this.saveLog.bind(this));
    
    // 清空日志
    this.dom.clearAllLogsBtn.addEventListener('click', this.confirmClearAllLogs.bind(this));
    
    // 搜索过滤
    this.dom.searchInput.addEventListener('input', 
      utils.debounce(this.filterLogs.bind(this), 300));
    this.dom.dateFilter.addEventListener('change', this.filterLogs.bind(this));
    
    // 日志列表点击事件委托
    this.dom.logList.addEventListener('click', this.handleLogListClick.bind(this));
    
    // 窗口关闭前提示
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  // 拖放处理
  handleDrop(e) {
    e.preventDefault();
    this.dom.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      this.dom.imageUpload.files = e.dataTransfer.files;
      this.handleImageUpload({ target: this.dom.imageUpload });
    }
  }

  // 图片上传处理
  async handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      showToast('正在处理图片...', 'info', this.dom.toastContainer);
      
      const validFiles = files.filter(file => {
        if (!file.type.startsWith('image/')) {
          showToast(`跳过非图片文件: ${file.name}`, 'warning', this.dom.toastContainer);
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          showToast(`图片过大已跳过: ${file.name}`, 'warning', this.dom.toastContainer);
          return false;
        }
        return true;
      });
      
      const imageProcessing = validFiles.map(this.processImageFile.bind(this));
      const newImages = await Promise.all(imageProcessing);
      
      stateManager.addImages(newImages);
      this.updateImagePreview();
      
      showToast(`成功上传 ${newImages.length} 张图片`, 'success', this.dom.toastContainer);
    } catch (error) {
      console.error('图片处理失败:', error);
      showToast('图片处理失败: ' + error.message, 'error', this.dom.toastContainer);
    } finally {
      event.target.value = '';
    }
  }

  // 图片处理
  async processImageFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          img.src = e.target.result;
          await img.decode();
          
          const { width, height } = this.calculateResizedDimensions(img);
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
  calculateResizedDimensions(img) {
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
  updateImagePreview() {
    const images = stateManager.getImages();
    this.dom.imagePreviewContainer.innerHTML = images
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
    this.dom.imagePreviewContainer.querySelectorAll('.remove-image-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeImage(parseInt(btn.dataset.index));
      });
    });
    
    // 添加预览点击事件
    this.dom.imagePreviewContainer.querySelectorAll('.preview-image').forEach(img => {
      img.addEventListener('click', () => this.showFullImage(img.dataset.fullimg));
    });
  }

  // 删除单张图片
  removeImage(index) {
    stateManager.removeImage(index);
    this.updateImagePreview();
    showToast('图片已删除', 'success', this.dom.toastContainer);
  }

  // 清除所有图片
  clearAllImages() {
    if (!stateManager.getImages().length) return;
    
    stateManager.clearImages();
    this.updateImagePreview();
    showToast('已清除所有图片', 'success', this.dom.toastContainer);
  }

  // 保存日志
  async saveLog() {
    try {
      const textContent = stateManager.getEditorText();
      const images = stateManager.getImages();
      
      if (!textContent && !images.length) {
        showToast('请输入日志内容或上传图片', 'warning', this.dom.toastContainer);
        return;
      }
      
      // 创建日志对象并估算大小
      const logEntry = this.createLogEntry();
      const entrySize = new Blob([JSON.stringify(logEntry)]).size;
      
      if (!hasSufficientStorage(entrySize)) {
        showToast('存储空间不足，请删除旧日志', 'error', this.dom.toastContainer);
        return;
      }
      
      // 保存到本地存储
      const logs = getLogsFromStorage();
      logs.unshift(logEntry);
      
      try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          showToast('存储空间已满，无法保存', 'error', this.dom.toastContainer);
          return;
        }
        throw error;
      }
      
      // 重置状态
      this.resetEditorAndImages();
      showToast('日志保存成功', 'success', this.dom.toastContainer);
      this.loadLogs();
      
    } catch (error) {
      console.error('保存日志失败:', error);
      showToast(`保存失败: ${error.message}`, 'error', this.dom.toastContainer);
    }
  }

  // 创建日志条目
  createLogEntry() {
    return {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      displayTime: utils.formatDate(new Date()),
      textContent: stateManager.getEditorText(),
      htmlContent: stateManager.getEditorHTML(),
      delta: stateManager.getEditorDelta(),
      images: stateManager.getImages(),
      searchText: stateManager.getEditorText().toLowerCase()
    };
  }

  // 重置编辑器和图片状态
  resetEditorAndImages() {
    stateManager.resetEditor();
    stateManager.clearImages();
    this.updateImagePreview();
    this.updateWordCount();
  }

  // 更新字数统计
  updateWordCount() {
    const text = stateManager.getEditorText();
    const count = text ? text.split(/\s+/).length : 0;
    this.dom.wordCount.textContent = count;
  }

  // 加载日志
  loadLogs() {
    const logs = getLogsFromStorage();
    stateManager.setLogs(logs);
    this.renderLogList(logs);
  }

  // 过滤日志
  filterLogs() {
    const searchTerm = this.dom.searchInput.value.toLowerCase();
    const dateFilter = this.dom.dateFilter.value;
    
    const filtered = stateManager.getLogs().filter(log => {
      const matchesSearch = !searchTerm || 
        log.searchText.includes(searchTerm) || 
        log.displayTime.toLowerCase().includes(searchTerm);
      
      const matchesDate = !dateFilter || 
        new Date(log.timestamp).toISOString().split('T')[0] === dateFilter;
      
      return matchesSearch && matchesDate;
    });
    
    this.renderLogList(filtered);
  }

  // 渲染日志列表
  renderLogList(logs) {
    if (logs.length === 0) {
      this.dom.logList.innerHTML = `
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
          ${this.renderTextContent(log)}
          ${this.renderImages(log)}
        </div>
        <div class="log-actions">
          <button class="btn outline">
            <i class="fas fa-trash-alt"></i> 删除
          </button>
        </div>
      `;
      
      fragment.appendChild(logItem);
    });
    
    this.dom.logList.innerHTML = '';
    this.dom.logList.appendChild(fragment);
  }

  renderTextContent(log) {
    if (!log.textContent) return '<p class="no-text">[无文本内容]</p>';
    
    const previewText = log.textContent.length > 200 
      ? log.textContent.substring(0, 200) + '...' 
      : log.textContent;
    
    return `<div class="text-preview">${previewText}</div>`;
  }

  renderImages(log) {
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

  // 处理日志列表点击事件
  handleLogListClick(e) {
    if (e.target.classList.contains('thumbnail')) {
      this.showFullImage(e.target.dataset.fullimg);
      return;
    }
    
    if (e.target.closest('.log-actions button')) {
      const logId = e.target.closest('.log-item').dataset.id;
      this.deleteLog(logId);
    }
  }

  // 显示全尺寸图片
  showFullImage(imageSrc) {
    // 关闭现有模态框
    const activeModal = stateManager.getActiveModal();
    if (activeModal) {
      document.body.removeChild(activeModal);
      stateManager.setActiveModal(null);
    }
    
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <span class="close-modal">&times;</span>
      <img src="${imageSrc}" class="full-image" alt="全尺寸图片预览">
    `;
    
    document.body.appendChild(modal);
    stateManager.setActiveModal(modal);
    
    setTimeout(() => modal.classList.add('active'), 10);
    
    // 关闭功能
    const close = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
        stateManager.setActiveModal(null);
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
  deleteLog(logId) {
    if (!confirm('确定要删除这条日志吗？此操作不可恢复！')) return;
    
    const logs = getLogsFromStorage().filter(log => log.id !== logId);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    this.loadLogs();
    showToast('日志已删除', 'success', this.dom.toastContainer);
  }

  // 确认清空所有日志
  confirmClearAllLogs() {
    if (!confirm('确定要清空所有日志吗？此操作不可恢复！')) return;
    
    localStorage.setItem(LOG_STORAGE_KEY, '[]');
    this.loadLogs();
    showToast('所有日志已清空', 'success', this.dom.toastContainer);
  }

  // 窗口关闭前处理
  handleBeforeUnload(e) {
    if (stateManager.hasUnsavedContent()) {
      e.preventDefault();
      e.returnValue = '您有未保存的内容，确定要离开吗？';
    }
  }
}

export default new EventHandlers();
