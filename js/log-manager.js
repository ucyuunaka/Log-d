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
      
      // 创建日志对象
      const logEntry = this.createLogEntry(textContent, htmlContent, delta, images);
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
