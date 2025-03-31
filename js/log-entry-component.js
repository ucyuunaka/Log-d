import { LogContentService } from './log-content-service.js';

export class LogEntryComponent {
  constructor(logData, logContentService) {
    this.logData = logData;
    this.logContentService = logContentService || new LogContentService();
    this.element = null;
    this.contentId = `log-content-${logData.id}`;
    this.eventHandlers = {};
  }

  // 渲染日志条目
  render() {
    const element = document.createElement('div');
    element.className = 'log-item';
    element.dataset.id = this.logData.id;
    
    element.innerHTML = this.getTemplate();
    this.element = element;
    
    this.setupEventListeners();
    
    // 应用保存的展开状态
    if (this.logContentService.isExpanded(this.contentId)) {
      const textPreview = element.querySelector('.text-preview');
      const expandBtn = element.querySelector('.expand-btn');
      if (textPreview && expandBtn) {
        textPreview.classList.add('expanded');
        textPreview.classList.remove('truncated');
        textPreview.setAttribute('aria-expanded', 'true');
        this.updateExpandButton(expandBtn, true);
      }
    }
    
    return element;
  }

  // 获取HTML模板
  getTemplate() {
    const needsTruncation = this.logContentService.shouldTruncate(this.logData.textContent);
    const truncatedClass = needsTruncation ? 'truncated' : '';
    const processedText = this.logContentService.formatLogContent(this.logData.textContent);
    const hasMood = this.logData.mood && this.logData.mood !== 'meh';
    
    return `
      <time datetime="${this.logData.timestamp}">
        ${this.logData.displayTime}
        ${hasMood ? this.getMoodIcon(this.logData.mood) : ''}
      </time>
      <div class="log-content">
        <div id="${this.contentId}" class="text-preview ${truncatedClass}" aria-expanded="${!needsTruncation}" tabindex="0">
          ${processedText}
        </div>
        ${needsTruncation ? this.getExpandButton() : ''}
        ${this.renderImages()}
      </div>
      <div class="log-actions">
        <button class="btn outline delete-btn" aria-label="删除日志">
          <i class="fas fa-trash-alt"></i> 删除
        </button>
      </div>
    `;
  }

  // 获取心情图标
  getMoodIcon(mood) {
    const moodIcons = {
      'happy': '<i class="fas fa-smile mood-icon happy" title="开心"></i>',
      'sad': '<i class="fas fa-frown mood-icon sad" title="伤心"></i>',
      'meh': '',
      'angry': '<i class="fas fa-angry mood-icon angry" title="生气"></i>',
      'excited': '<i class="fas fa-grin-stars mood-icon excited" title="兴奋"></i>'
    };
    return moodIcons[mood] || '';
  }

  // 获取展开按钮HTML
  getExpandButton() {
    return `
      <button class="expand-btn" data-action="expand" aria-controls="${this.contentId}" aria-expanded="false">
        更多内容 <i class="fas fa-chevron-down"></i>
      </button>
    `;
  }

  // 渲染图片
  renderImages() {
    if (!this.logData.images?.length) return '';
    
    return `
      <div class="thumbnails">
        ${this.logData.images.map((img, idx) => `
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

  // 设置事件监听
  setupEventListeners() {
    // 展开按钮点击事件
    const expandBtn = this.element.querySelector('.expand-btn');
    if (expandBtn) {
      this.eventHandlers.expandClick = (e) => {
        e.stopPropagation();
        const isNowExpanded = this.logContentService.toggleExpansion(this.contentId);
        this.updateExpandButton(expandBtn, isNowExpanded);
      };
      expandBtn.addEventListener('click', this.eventHandlers.expandClick);
    }
    
    // 删除按钮点击事件
    const deleteBtn = this.element.querySelector('.delete-btn');
    if (deleteBtn) {
      this.eventHandlers.deleteClick = (e) => {
        e.stopPropagation();
        this.dispatchDeleteEvent();
      };
      deleteBtn.addEventListener('click', this.eventHandlers.deleteClick);
    }
    
    // 图片点击事件
    const thumbnails = this.element.querySelectorAll('.thumbnail');
    if (thumbnails.length > 0) {
      this.eventHandlers.thumbnailClicks = [];
      thumbnails.forEach((thumbnail, index) => {
        const handler = (e) => {
          e.stopPropagation();
          this.dispatchImageClickEvent(thumbnail.dataset.fullimg);
        };
        this.eventHandlers.thumbnailClicks[index] = handler;
        thumbnail.addEventListener('click', handler);
      });
    }
    
    // 为长文本内容添加点击展开功能
    const textPreview = this.element.querySelector('.text-preview');
    if (textPreview && textPreview.classList.contains('truncated')) {
      // 点击展开
      this.eventHandlers.textPreviewClick = (e) => {
        if (e.target === textPreview) {
          const isNowExpanded = this.logContentService.toggleExpansion(this.contentId);
          this.updateExpandButton(expandBtn, isNowExpanded);
        }
      };
      textPreview.addEventListener('click', this.eventHandlers.textPreviewClick);
      
      // 键盘访问支持
      this.eventHandlers.textPreviewKeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const isNowExpanded = this.logContentService.toggleExpansion(this.contentId);
          this.updateExpandButton(expandBtn, isNowExpanded);
        }
      };
      textPreview.addEventListener('keydown', this.eventHandlers.textPreviewKeydown);
    }
  }

  // 更新展开按钮状态
  updateExpandButton(button, isExpanded) {
    if (!button) return;
    
    if (isExpanded) {
      button.innerHTML = '收起内容 <i class="fas fa-chevron-up"></i>';
      button.setAttribute('data-action', 'collapse');
      button.setAttribute('aria-expanded', 'true');
      button.classList.add('expanded');
    } else {
      button.innerHTML = '更多内容 <i class="fas fa-chevron-down"></i>';
      button.setAttribute('data-action', 'expand');
      button.setAttribute('aria-expanded', 'false');
      button.classList.remove('expanded');
    }
  }

  // 分发删除事件
  dispatchDeleteEvent() {
    const event = new CustomEvent('logDelete', { 
      detail: { logId: this.logData.id },
      bubbles: true 
    });
    this.element.dispatchEvent(event);
  }

  // 分发图片点击事件
  dispatchImageClickEvent(imageSrc) {
    const event = new CustomEvent('showFullImage', { 
      detail: imageSrc,
      bubbles: true 
    });
    this.element.dispatchEvent(event);
  }
  
  // 销毁组件，清除事件监听
  destroy() {
    if (!this.element) return;
    
    // 清除展开按钮事件
    const expandBtn = this.element.querySelector('.expand-btn');
    if (expandBtn && this.eventHandlers.expandClick) {
      expandBtn.removeEventListener('click', this.eventHandlers.expandClick);
    }
    
    // 清除删除按钮事件
    const deleteBtn = this.element.querySelector('.delete-btn');
    if (deleteBtn && this.eventHandlers.deleteClick) {
      deleteBtn.removeEventListener('click', this.eventHandlers.deleteClick);
    }
    
    // 清除图片点击事件
    const thumbnails = this.element.querySelectorAll('.thumbnail');
    if (thumbnails.length > 0 && this.eventHandlers.thumbnailClicks) {
      thumbnails.forEach((thumbnail, index) => {
        if (this.eventHandlers.thumbnailClicks[index]) {
          thumbnail.removeEventListener('click', this.eventHandlers.thumbnailClicks[index]);
        }
      });
    }
    
    // 清除文本预览点击事件
    const textPreview = this.element.querySelector('.text-preview');
    if (textPreview && this.eventHandlers.textPreviewClick) {
      textPreview.removeEventListener('click', this.eventHandlers.textPreviewClick);
    }
    if (textPreview && this.eventHandlers.textPreviewKeydown) {
      textPreview.removeEventListener('keydown', this.eventHandlers.textPreviewKeydown);
    }
    
    // 清空事件处理器和元素引用，帮助垃圾回收
    this.eventHandlers = {};
    this.element = null;
  }
}