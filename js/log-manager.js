import { LOG_STORAGE_KEY, utils, getLogsFromStorage, hasSufficientStorage, showToast } from './utils.js';

// 日志管理模块
export class LogManager {
  constructor(elements, toastContainer) {
    this.elements = elements;
    this.currentLogs = [];
    this.toastContainer = toastContainer;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 搜索过滤
    this.elements.searchInput.addEventListener('input', 
      utils.debounce(this.filterLogs.bind(this), 300));
    this.elements.dateFilter.addEventListener('change', this.filterLogs.bind(this));
    
    // 清空日志
    this.elements.clearAllLogsBtn.addEventListener('click', this.confirmClearAllLogs.bind(this));
    
    // 日志列表点击事件委托
    this.elements.logList.addEventListener('click', this.handleLogListClick.bind(this));
  }

  // 处理日志列表点击事件
  handleLogListClick(e) {
    // 处理图片点击
    if (e.target.classList.contains('thumbnail')) {
      this.showFullImage(e.target.dataset.fullimg);
      return;
    }
    
    // 处理删除按钮点击
    const deleteButton = e.target.closest('.log-actions button');
    if (deleteButton) {
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
      return;
    }
  }

  // 显示全尺寸图片 - 复用功能或可以调用外部函数
  showFullImage(imageSrc) {
    // 需要实现或调用 ImageManager 中的同名方法
    const event = new CustomEvent('showFullImage', { detail: imageSrc });
    document.dispatchEvent(event);
  }

  // 加载日志
  loadLogs() {
    this.currentLogs = getLogsFromStorage();
    this.renderLogList(this.currentLogs);
  }

  // 过滤日志
  filterLogs() {
    const searchTerm = this.elements.searchInput.value.toLowerCase();
    const dateFilter = this.elements.dateFilter.value;
    
    const filtered = this.currentLogs.filter(log => {
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
      this.elements.logList.innerHTML = `
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
    
    this.elements.logList.innerHTML = '';
    this.elements.logList.appendChild(fragment);
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

  // 创建日志条目
  createLogEntry(textContent, htmlContent, delta, images) {
    return {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      displayTime: utils.formatDate(new Date()),
      textContent,
      htmlContent,
      delta,
      images,
      searchText: textContent.toLowerCase()
    };
  }

  // 保存日志
  async saveLog(textContent, htmlContent, delta, images) {
    try {
      if (!textContent && !images.length) {
        showToast('请输入日志内容或上传图片', 'warning', this.toastContainer);
        return false;
      }
      
      // 获取当前心情
      const mood = stateManager.getCurrentMood();
      
      // 创建日志对象，包含心情信息
      const logEntry = {
        id: Date.now().toString(),
        content: textContent,
        html: stateManager.getEditorHTML(),
        images: images || [],
        timestamp: new Date().toISOString(),
        mood: mood || 'meh' // 默认为"一般"心情
      };
      
      const entrySize = new Blob([JSON.stringify(logEntry)]).size;
      
      if (!hasSufficientStorage(entrySize)) {
        showToast('存储空间不足，请删除旧日志', 'error', this.toastContainer);
        return false;
      }
      
      // 保存到本地存储
      const logs = getLogsFromStorage();
      logs.unshift(logEntry);
      
      try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          showToast('存储空间已满，无法保存', 'error', this.toastContainer);
          return false;
        }
        throw error;
      }
      
      showToast('日志保存成功', 'success', this.toastContainer);
      this.loadLogs();
      
      // 重置心情按钮状态
      document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      return true;
      
    } catch (error) {
      console.error('保存日志失败:', error);
      showToast(`保存失败: ${error.message}`, 'error', this.toastContainer);
      return false;
    }
  }

  // 删除日志
  deleteLog(logId) {
    if (!confirm('确定要删除这条日志吗？此操作不可恢复！')) return;
    
    const logs = getLogsFromStorage().filter(log => log.id !== logId);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    this.loadLogs();
    showToast('日志已删除', 'success', this.toastContainer);
  }

  // 确认清空所有日志
  confirmClearAllLogs() {
    if (!confirm('确定要清空所有日志吗？此操作不可恢复！')) return;
    
    localStorage.setItem(LOG_STORAGE_KEY, '[]');
    this.loadLogs();
    showToast('所有日志已清空', 'success', this.toastContainer);
  }
}

export default LogManager;
