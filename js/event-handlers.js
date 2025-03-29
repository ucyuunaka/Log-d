import stateManager, { LOG_STORAGE_KEY, MAX_IMAGE_SIZE, IMAGE_QUALITY } from './state-manager.js';
import { utils, showToast, hasSufficientStorage, getLogsFromStorage, showConfirmDialog } from './utils.js';

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
    
    // 优化图片 - 添加新的事件监听
    const optimizeBtn = document.getElementById('optimize-images');
    if (optimizeBtn) {
      optimizeBtn.addEventListener('click', this.optimizeImages.bind(this));
    }
    
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

  // 优化图片
  async optimizeImages() {
    const images = stateManager.getImages();
    if (!images.length) {
      showToast('没有可优化的图片', 'warning', this.dom.toastContainer);
      return;
    }

    try {
      showToast('正在优化图片...', 'info', this.dom.toastContainer);
      
      // 显示优化进度模态框
      this.showOptimizeProgressModal(images.length);
      
      // 进行图片优化处理
      const optimizedImages = [];
      let processedCount = 0;
      
      for (const imgSrc of images) {
        const optimizedImage = await this.optimizeImage(imgSrc);
        optimizedImages.push(optimizedImage);
        
        // 更新进度
        processedCount++;
        this.updateOptimizeProgress(processedCount, images.length);
        
        // 小延时，让UI有时间更新
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 使用优化后的图片替换原图片
      stateManager.clearImages();
      stateManager.addImages(optimizedImages);
      this.updateImagePreview();
      
      // 关闭模态框并显示结果
      this.hideOptimizeProgressModal();
      
      // 计算大小减少百分比
      const originalSize = this.calculateTotalImageSize(images);
      const optimizedSize = this.calculateTotalImageSize(optimizedImages);
      const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
      
      showToast(`优化完成，减少了约 ${reduction}% 的体积`, 'success', this.dom.toastContainer);
    } catch (error) {
      console.error('图片优化失败:', error);
      this.hideOptimizeProgressModal();
      showToast('图片优化失败: ' + error.message, 'error', this.dom.toastContainer);
    }
  }
  
  // 优化单张图片
  async optimizeImage(imgSrc) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          const { width, height } = this.calculateOptimalDimensions(img);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // 根据图片特性选择不同的压缩率
          let compressionQuality = IMAGE_QUALITY;
          
          // 检测亮度和对比度，对于高对比度图片使用更高的质量
          if (this.detectHighContrastImage(ctx, width, height)) {
            compressionQuality = Math.min(IMAGE_QUALITY + 0.1, 0.9);
          }
          
          // 对于大图片使用更激进的压缩
          const originalSize = this.getBase64Size(imgSrc);
          if (originalSize > 500 * 1024) { // 大于500KB
            compressionQuality = Math.max(IMAGE_QUALITY - 0.1, 0.6);
          }
          
          resolve(canvas.toDataURL('image/jpeg', compressionQuality));
        };
        
        img.onerror = () => reject(new Error('加载图片失败'));
        img.src = imgSrc;
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // 计算最优尺寸
  calculateOptimalDimensions(img) {
    let { width, height } = img;
    const maxSize = Math.max(width, height);
    let targetSize;
    
    // 根据图片大小决定目标尺寸
    if (maxSize > 2000) targetSize = 1500;      // 超大图片
    else if (maxSize > 1500) targetSize = 1200; // 大图片
    else if (maxSize > 1000) targetSize = 800;  // 中大图片
    else if (maxSize > 600) targetSize = 600;   // 中等图片
    else targetSize = maxSize;                  // 保持原尺寸
    
    // 计算缩放比例，保持宽高比
    const scale = targetSize / maxSize;
    if (scale < 1) {
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    
    return { width, height };
  }
  
  // 检测高对比度图片
  detectHighContrastImage(ctx, width, height) {
    try {
      // 采样点进行亮度分析
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const sampleSize = Math.min(width * height, 10000); // 最多采样10000点
      const samplingRatio = Math.floor(width * height / sampleSize);
      
      let brightnessValues = [];
      
      for (let i = 0; i < data.length; i += 4 * samplingRatio) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // 计算亮度
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        brightnessValues.push(brightness);
      }
      
      // 计算亮度标准差来检测对比度
      const avgBrightness = brightnessValues.reduce((acc, val) => acc + val, 0) / brightnessValues.length;
      let variance = 0;
      
      for (const brightness of brightnessValues) {
        variance += Math.pow(brightness - avgBrightness, 2);
      }
      
      variance /= brightnessValues.length;
      const stdDev = Math.sqrt(variance);
      
      // 高对比度的图片标准差通常较大
      return stdDev > 60;
    } catch (e) {
      console.warn('对比度检测失败，返回默认值', e);
      return false;
    }
  }
  
  // 计算base64图片大小
  getBase64Size(base64String) {
    // 去掉数据前缀，如"data:image/jpeg;base64,"
    const base64 = base64String.split(',')[1];
    return base64 ? base64.length * 3 / 4 : 0;
  }
  
  // 计算总图片大小
  calculateTotalImageSize(images) {
    return images.reduce((total, img) => total + this.getBase64Size(img), 0);
  }
  
  // 显示优化进度模态框
  showOptimizeProgressModal(totalImages) {
    // 检查是否已存在模态框
    let modal = document.getElementById('optimizeProgressModal');
    
    if (!modal) {
      // 创建新的模态框
      modal = document.createElement('div');
      modal.id = 'optimizeProgressModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content card" style="max-width: 400px;">
          <h3><i class="fas fa-compress-arrows-alt"></i> 图片优化中</h3>
          <div class="progress-container" style="margin: 20px 0;">
            <div class="progress-bar" id="optimizeProgressBar" style="height: 8px; background: var(--primary-light); border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; width: 0%; background: linear-gradient(90deg, var(--primary-color), var(--accent-color)); transition: width 0.3s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px;">
              <span id="optimizeProgressText">处理中 0/${totalImages}</span>
              <span id="optimizeProgressPercent">0%</span>
            </div>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center;">
            正在优化图片质量和大小，请稍候...
          </p>
        </div>
      `;
      
      document.body.appendChild(modal);
    }
    
    // 显示模态框
    setTimeout(() => modal.classList.add('active'), 10);
  }
  
  // 更新优化进度
  updateOptimizeProgress(current, total) {
    const progressBar = document.querySelector('#optimizeProgressBar > div');
    const progressText = document.getElementById('optimizeProgressText');
    const progressPercent = document.getElementById('optimizeProgressPercent');
    
    if (progressBar && progressText && progressPercent) {
      const percentage = Math.round((current / total) * 100);
      progressBar.style.width = `${percentage}%`;
      progressText.textContent = `处理中 ${current}/${total}`;
      progressPercent.textContent = `${percentage}%`;
    }
  }
  
  // 隐藏优化进度模态框
  hideOptimizeProgressModal() {
    const modal = document.getElementById('optimizeProgressModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    }
  }

  // 保存日志
  async saveLog() {
    try {
      const textContent = stateManager.getEditorText();
      const htmlContent = stateManager.getEditorHTML();
      const delta = stateManager.getEditorDelta();
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
    showConfirmDialog(
      '确认重置',
      '确定要清空当前编辑内容吗？',
      () => {
        if (stateManager.quill) {
          stateManager.quill.setText('');
        }
        stateManager.clearImages();
        this.updateImagePreview();
        this.updateWordCount();
        showToast('已重置编辑内容', 'info', this.dom.toastContainer);
      }
    );
  }

  // 更新字数统计
  updateWordCount() {
    const text = stateManager.getEditorText();
    // 使用中文友好的字数统计方法
    const count = text ? text.replace(/\s+/g, '').length : 0;
    if (this.dom.wordCount) {
      this.dom.wordCount.textContent = count;
    }
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
    
    // 检查内容是否需要被截断
    const needsTruncation = log.textContent.length > 300 || log.textContent.split('\n').length > 6;
    
    // 根据内容是否需要截断来添加类
    const truncatedClass = needsTruncation ? 'truncated' : '';
    
    // 预处理文本，保留空行，同时进行HTML转义
    const processedText = log.textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
    
    // 先构建文本预览元素
    const previewHtml = `<div class="text-preview ${truncatedClass}">${processedText}</div>`;
    
    // 如果需要截断，添加展开按钮
    if (needsTruncation) {
      return `
        ${previewHtml}
        <button class="expand-btn" data-action="expand">
          更多内容 <i class="fas fa-chevron-down"></i>
        </button>
      `;
    } else {
      return previewHtml;
    }
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
      return;
    }
    
    // 处理展开/收起按钮
    const expandButton = e.target.closest('.expand-btn');
    if (expandButton) {
      // 查找按钮对应的文本预览元素
      const textPreview = expandButton.previousElementSibling;
      if (!textPreview || !textPreview.classList.contains('text-preview')) {
        return; // 安全检查，确保找到了正确的元素
      }
      
      const isExpanded = textPreview.classList.contains('expanded');
      
      // 切换展开状态
      textPreview.classList.toggle('expanded');
      expandButton.classList.toggle('expanded');
      
      // 更新按钮文本和图标
      if (isExpanded) {
        expandButton.innerHTML = '更多内容 <i class="fas fa-chevron-down"></i>';
        expandButton.setAttribute('data-action', 'expand');
      } else {
        expandButton.innerHTML = '收起内容 <i class="fas fa-chevron-up"></i>';
        expandButton.setAttribute('data-action', 'collapse');
        
        // 滚动到展开的内容顶部，使用延时确保DOM更新后滚动
        setTimeout(() => {
          textPreview.scrollIntoView({behavior: 'smooth', block: 'start'});
        }, 100);
      }
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
    showConfirmDialog(
      '确认删除',
      '确定要删除这条日志吗？此操作不可恢复！',
      () => {
        const logs = getLogsFromStorage().filter(log => log.id !== logId);
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
        this.loadLogs();
        showToast('日志已删除', 'success', this.dom.toastContainer);
      }
    );
  }

  // 确认清空所有日志
  confirmClearAllLogs() {
    showConfirmDialog(
      '确认清空',
      '确定要清空所有日志吗？此操作无法撤销！',
      () => {
        localStorage.setItem(LOG_STORAGE_KEY, '[]');
        this.loadLogs();
        showToast('所有日志已清空', 'success', this.dom.toastContainer);
      }
    );
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
