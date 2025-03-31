import { utils, MAX_IMAGE_SIZE, IMAGE_QUALITY, showToast } from './utils.js';

// 图片管理模块
export class ImageManager {
  constructor(elements, toastContainer) {
    this.elements = elements;
    this.uploadedImages = [];
    this.activeModal = null;
    this.toastContainer = toastContainer;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
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
      
      this.uploadedImages = [...this.uploadedImages, ...newImages];
      this.updateImagePreview();
      
      showToast(`成功上传 ${newImages.length} 张图片`, 'success', this.toastContainer);
    } catch (error) {
      console.error('图片处理失败:', error);
      showToast('图片处理失败: ' + error.message, 'error', this.toastContainer);
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
    this.elements.imagePreviewContainer.innerHTML = this.uploadedImages
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
    this.uploadedImages.splice(index, 1);
    this.updateImagePreview();
    showToast('图片已删除', 'success', this.toastContainer);
  }

  // 清除所有图片
  clearAllImages() {
    if (!this.uploadedImages.length) return;
    
    this.uploadedImages = [];
    this.updateImagePreview();
    showToast('已清除所有图片', 'success', this.toastContainer);
  }

  // 获取所有已上传图片
  getImages() {
    return [...this.uploadedImages];
  }

  // 重置图片管理器
  reset() {
    this.uploadedImages = [];
    this.updateImagePreview();
  }

  // 显示全尺寸图片
  showFullImage(imageSrc) {
    // 关闭现有模态框
    if (this.activeModal) {
      document.body.removeChild(this.activeModal);
      this.activeModal = null;
    }
    
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <span class="close-modal">&times;</span>
      <img src="${imageSrc}" class="full-image" alt="全尺寸图片预览">
    `;
    
    document.body.appendChild(modal);
    this.activeModal = modal;
    
    setTimeout(() => modal.classList.add('active'), 10);
    
    // 关闭功能
    const close = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
        this.activeModal = null;
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

  hasImages() {
    return this.uploadedImages.length > 0;
  }

  // 初始化图片延迟加载
  initLazyLoading() {
    // 使用Intersection Observer API监视图片是否进入视口
    if ('IntersectionObserver' in window) {
      this.lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const dataSrc = img.getAttribute('data-src');
            
            if (dataSrc) {
              // 添加过渡效果，实现渐入显示
              img.style.opacity = '0';
              img.onload = () => {
                img.style.opacity = '1';
              };
              
              img.src = dataSrc;
              img.removeAttribute('data-src');
            }
            
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '200px 0px' // 提前200px加载
      });
      
      // 延时初始化，确保DOM已渲染完成
      setTimeout(() => {
        document.querySelectorAll('img[data-src]').forEach(img => {
          this.lazyLoadObserver.observe(img);
        });
      }, 100);
    } else {
      // 回退方案：为不支持IntersectionObserver的浏览器加载所有图片
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.getAttribute('data-src');
      });
    }
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
}

export default ImageManager;
