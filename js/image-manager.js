import { utils, showToast } from './utils.js';
import stateManager, { IMAGE_QUALITY, MAX_IMAGE_SIZE } from './state-manager.js';

// 图片管理模块
export class ImageManager {
  constructor(elements, toastContainer) {
    this.elements = elements;
    this.toastContainer = toastContainer;
    
    // 构造函数中不立即调用setupEventListeners，因为可能元素还不存在
    // 这将在app.js中初始化后再调用
  }

  setupEventListeners() {
    if (!this.elements) {
      console.error('图片管理器初始化失败：缺少必要的DOM元素');
      return;
    }
    
    // 图片上传
    this.elements.imageUpload.addEventListener('change', this.handleImageUpload.bind(this));
    
    // 拖放上传
    this.elements.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.add('dragover');
    });
    
    this.elements.dropZone.addEventListener('dragleave', () => {
      this.elements.dropZone.classList.remove('dragover');
    });
    
    this.elements.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.elements.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        this.elements.imageUpload.files = e.dataTransfer.files;
        this.handleImageUpload({ target: this.elements.imageUpload });
      }
    });
    
    // 清除图片
    this.elements.clearImagesBtn.addEventListener('click', this.clearAllImages.bind(this));
    
    // 优化图片 - 添加新的事件监听
    const optimizeBtn = document.getElementById('optimize-images');
    if (optimizeBtn) {
      optimizeBtn.addEventListener('click', this.optimizeImages.bind(this));
    }
  }

  // 图片上传处理
  async handleImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      showToast('正在处理图片...', 'info', this.toastContainer);
      
      const validFiles = files.filter(file => {
        if (!file.type.startsWith('image/')) {
          showToast(`跳过非图片文件: ${file.name}`, 'warning', this.toastContainer);
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          showToast(`图片过大已跳过: ${file.name}`, 'warning', this.toastContainer);
          return false;
        }
        return true;
      });
      
      const imageProcessing = validFiles.map(this.processImageFile.bind(this));
      const newImages = await Promise.all(imageProcessing);
      
      stateManager.addImages(newImages);
      this.updateImagePreview();
      
      if (validFiles.length) {
        showToast(`已上传 ${validFiles.length} 张图片`, 'success', this.toastContainer);
        this.elements.imageUpload.value = '';
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      showToast(`图片处理失败: ${error.message}`, 'error', this.toastContainer);
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
    const maxSize = MAX_IMAGE_SIZE;
    let { width, height } = img;
    
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = Math.round(height * (maxSize / width));
        width = maxSize;
      } else {
        width = Math.round(width * (maxSize / height));
        height = maxSize;
      }
    }
    
    return { width, height };
  }
  
  // 计算最优尺寸
  calculateOptimalDimensions(img) {
    const { width, height } = img;
    const maxSize = MAX_IMAGE_SIZE;
    
    if (width <= maxSize && height <= maxSize) {
      return { width, height }; // 已经足够小，不需要调整
    }
    
    let newWidth, newHeight;
    if (width > height) {
      newWidth = maxSize;
      newHeight = Math.round(height * (maxSize / width));
    } else {
      newHeight = maxSize;
      newWidth = Math.round(width * (maxSize / height));
    }
    
    return { width: newWidth, height: newHeight };
  }

  // 更新图片预览
  updateImagePreview() {
    const images = stateManager.getImages();
    this.elements.imagePreviewContainer.innerHTML = images
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
    this.elements.imagePreviewContainer.querySelectorAll('.remove-image-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeImage(parseInt(btn.dataset.index));
      });
    });
    
    // 添加预览点击事件
    this.elements.imagePreviewContainer.querySelectorAll('.preview-image').forEach(img => {
      img.addEventListener('click', () => this.showFullImage(img.dataset.fullimg));
    });
  }

  // 删除单张图片
  removeImage(index) {
    stateManager.removeImage(index);
    this.updateImagePreview();
    showToast('图片已删除', 'success', this.toastContainer);
  }

  // 清除所有图片
  clearAllImages() {
    if (!stateManager.getImages().length) return;
    
    stateManager.clearImages();
    this.updateImagePreview();
    showToast('已清除所有图片', 'success', this.toastContainer);
  }

  // 优化图片
  async optimizeImages() {
    const images = stateManager.getImages();
    if (!images.length) {
      showToast('没有可优化的图片', 'warning', this.toastContainer);
      return;
    }

    try {
      showToast('正在优化图片...', 'info', this.toastContainer);
      
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
      
      showToast(`优化完成，减少了约 ${reduction}% 的体积`, 'success', this.toastContainer);
    } catch (error) {
      console.error('图片优化失败:', error);
      this.hideOptimizeProgressModal();
      showToast('图片优化失败: ' + error.message, 'error', this.toastContainer);
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
            compressionQuality = Math.min(IMAGE_QUALITY + 0.1, 0.9); // 增加质量但不超过0.9
          }
          
          resolve(canvas.toDataURL('image/jpeg', compressionQuality));
        };
        
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = imgSrc;
      } catch (error) {
        reject(error);
      }
    });
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
      
      // 计算亮度标准差
      const avg = brightnessValues.reduce((sum, val) => sum + val, 0) / brightnessValues.length;
      const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / brightnessValues.length;
      const stdDev = Math.sqrt(variance);
      
      // 高对比度判定：标准差大于某个阈值
      return stdDev > 50;
    } catch (e) {
      console.error('检测高对比度图片时出错:', e);
      return false;
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
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.className === 'close-modal') {
        close();
      }
    });
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    }, { once: true });
  }

  // 计算base64图片大小
  getBase64Size(base64String) {
    const stringLength = base64String.length;
    const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.75;
    return sizeInBytes;
  }
  
  // 计算总图片大小
  calculateTotalImageSize(images) {
    return images.reduce((total, imgSrc) => total + this.getBase64Size(imgSrc), 0);
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
    
    // 使用通用方法显示模态框
    this.showModal(modal);
  }
  
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
  
  hideOptimizeProgressModal() {
    const modal = document.getElementById('optimizeProgressModal');
    // 使用通用方法隐藏模态框
    this.hideModal(modal);
  }

  // 添加懒加载支持的图片渲染
  renderLazyLoadedImages(log) {
    if (!log.images?.length) return '';
    
    return `
      <div class="thumbnails">
        ${log.images.map((img, idx) => `
          <div class="thumbnail-container">
            <img data-src="${img}" class="thumbnail lazyload" 
                 alt="日志图片 ${idx + 1}"
                 loading="lazy"
                 data-fullimg="${img}">
            <div class="thumbnail-placeholder"></div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  hasImages() {
    return stateManager.getImages().length > 0;
  }

  // 渲染图片 - 统一图片渲染逻辑，供日志列表使用
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

  // 显示模态对话框的通用方法
  showModal(modalElement, timeout = 10) {
    if (modalElement) {
      setTimeout(() => modalElement.classList.add('active'), timeout);
    }
  }
  
  // 隐藏模态对话框的通用方法
  hideModal(modalElement, removeAfter = 300) {
    if (modalElement) {
      modalElement.classList.remove('active');
      if (removeAfter && modalElement.parentNode) {
        setTimeout(() => {
          if (modalElement.parentNode) {
            modalElement.parentNode.removeChild(modalElement);
          }
        }, removeAfter);
      }
    }
  }
}

export default new ImageManager();
