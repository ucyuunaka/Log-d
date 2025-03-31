import { LOG_STORAGE_KEY, utils, getLogsFromStorage, hasSufficientStorage, showToast, showConfirmDialog } from './utils.js';
import { LogEntryComponent } from './log-entry-component.js';
import { LogContentService } from './log-content-service.js';

// 日志管理模块
export class LogManager {
  constructor(elements, toastContainer) {
    this.elements = elements;
    this.currentLogs = [];
    this.toastContainer = toastContainer;
    this.logComponents = new Map(); // 存储组件实例以便管理生命周期
    this.logContentService = new LogContentService();
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 搜索过滤
    this.elements.searchInput.addEventListener('input', 
      utils.debounce(this.filterLogs.bind(this), 300));
    this.elements.dateFilter.addEventListener('change', this.filterLogs.bind(this));
    
    // 清空日志
    this.elements.clearAllLogsBtn.addEventListener('click', this.confirmClearAllLogs.bind(this));
    
    // 使用事件委托处理日志列表事件
    this.elements.logList.addEventListener('logDelete', (e) => {
      e.stopPropagation();
      if (e.detail && e.detail.logId) {
        this.deleteLog(e.detail.logId);
      }
    });
    
    // 处理图片预览事件
    document.addEventListener('showFullImage', (e) => {
      if (e.detail) {
        this.showFullImage(e.detail);
      }
    });
    
    // 监听窗口大小变化，可能需要重新计算截断高度
    window.addEventListener('resize', utils.debounce(() => {
      if (this.currentLogs.length > 0) {
        this.renderLogList(this.currentLogs);
      }
    }, 500));
  }

  // 加载日志
  loadLogs() {
    try {
      this.currentLogs = getLogsFromStorage();
      this.renderLogList(this.currentLogs);
    } catch (error) {
      console.error('加载日志失败:', error);
      showToast('加载日志失败，请刷新页面重试', 'error', this.toastContainer);
    }
  }

  // 过滤日志
  filterLogs() {
    try {
      const searchTerm = this.elements.searchInput.value.toLowerCase();
      const dateFilter = this.elements.dateFilter.value;
      
      const filtered = this.currentLogs.filter(log => {
        const matchesSearch = !searchTerm || 
          (log.searchText && log.searchText.includes(searchTerm)) || 
          log.displayTime.toLowerCase().includes(searchTerm);
        
        const matchesDate = !dateFilter || 
          new Date(log.timestamp).toISOString().split('T')[0] === dateFilter;
        
        return matchesSearch && matchesDate;
      });
      
      this.renderLogList(filtered);
    } catch (error) {
      console.error('过滤日志失败:', error);
      showToast('过滤日志失败', 'error', this.toastContainer);
    }
  }

  // 渲染日志列表
  renderLogList(logs) {
    // 清理之前的组件实例，避免内存泄漏
    this.cleanupLogComponents();
    
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
      // 使用共享的LogContentService服务实例
      const logEntry = new LogEntryComponent(log, this.logContentService);
      const element = logEntry.render();
      
      // 存储组件实例以便后续清理
      this.logComponents.set(log.id, logEntry);
      fragment.appendChild(element);
    });
    
    this.elements.logList.innerHTML = '';
    this.elements.logList.appendChild(fragment);
  }

  // 清理组件实例，避免内存泄漏
  cleanupLogComponents() {
    if (this.logComponents.size > 0) {
      this.logComponents.forEach(component => {
        component.destroy();
      });
      this.logComponents.clear();
    }
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
      mood: stateManager.getCurrentMood() || 'meh', // 默认为"一般"心情
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
    showConfirmDialog(
      '确认删除',
      '确定要删除这条日志吗？此操作不可恢复！',
      () => {
        const logs = getLogsFromStorage().filter(log => log.id !== logId);
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
        this.loadLogs();
        showToast('日志已删除', 'success', this.toastContainer);
      }
    );
  }

  // 确认清空所有日志
  confirmClearAllLogs() {
    showConfirmDialog(
      '确认清空',
      '确定要清空所有日志吗？此操作不可恢复！',
      () => {
        localStorage.setItem(LOG_STORAGE_KEY, '[]');
        this.loadLogs();
        showToast('所有日志已清空', 'success', this.toastContainer);
      }
    );
  }
  
  // 显示全尺寸图片
  showFullImage(imageSrc) {
    // 分发事件，让外部的图片查看器处理
    const event = new CustomEvent('showFullImage', { detail: imageSrc });
    document.dispatchEvent(event);
  }
}

export default LogManager;
