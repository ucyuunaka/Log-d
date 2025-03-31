import stateManager, { LOG_STORAGE_KEY } from './state-manager.js';
import { utils, showToast, hasSufficientStorage, getLogsFromStorage, showConfirmDialog } from './utils.js';
import imageManager from './image-manager.js';
import editorManager from './editor.js';

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
    if (!this.dom) {
      console.error('事件处理器初始化失败：缺少必要的DOM元素');
      return;
    }
    
    // 保存日志
    this.dom.saveLogBtn.addEventListener('click', this.saveLog.bind(this));
    
    // 清空所有日志按钮
    this.dom.clearAllLogsBtn?.addEventListener('click', this.confirmClearAllLogs.bind(this));
    
    // 搜索筛选
    this.dom.searchInput?.addEventListener('input', 
      utils.debounce(this.filterLogs.bind(this), 300));
    
    // 日期筛选
    this.dom.dateFilter?.addEventListener('change', this.filterLogs.bind(this));
    
    // 窗口关闭前检查未保存内容
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  // 窗口关闭前处理
  handleBeforeUnload(e) {
    if (stateManager.hasUnsavedContent()) {
      const message = '您有未保存的内容，确定要离开吗？';
      e.returnValue = message;
      return message;
    }
  }

  // 更新字数统计 - 代理到editorManager
  updateWordCount() {
    editorManager.updateWordCount();
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
    const textContent = stateManager.getEditorText();
    const htmlContent = stateManager.getEditorHTML();
    const delta = stateManager.getEditorDelta();
    const images = stateManager.getImages();
    const tags = this.extractTags(textContent);
    
    return {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      displayTime: utils.formatDate(new Date()),
      textContent,
      htmlContent,
      delta,
      images,
      tags,
      mood: stateManager.getCurrentMood() || 'meh',
      searchText: textContent.toLowerCase()
    };
  }
  
  // 从文本中提取标签
  extractTags(text) {
    const tagRegex = /#([^\s#]+)/g;
    const matches = text.match(tagRegex);
    if (!matches) return [];
    
    return matches.map(tag => tag.substring(1).toLowerCase());
  }
  
  // 渲染标签
  renderTags(tags) {
    if (!tags || !tags.length) return '';
    
    return `
      <div class="log-tags">
        ${tags.map(tag => `
          <span class="tag" data-tag="${tag}">#${tag}</span>
        `).join('')}
      </div>
    `;
  }

  // 重置编辑器和图片状态
  resetEditorAndImages() {
    showConfirmDialog(
      '确认重置',
      '确定要清空当前编辑内容吗？',
      () => {
        stateManager.resetEditor();
        stateManager.clearImages();
        imageManager.updateImagePreview(); // 使用imageManager方法
        this.updateWordCount();
        showToast('已重置编辑内容', 'info', this.dom.toastContainer);
      }
    );
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
    if (!this.dom.logList) return;
    
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
          ${imageManager.renderImages(log)}
          ${this.renderTags(log.tags || [])}
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

  // 处理日志列表点击事件
  handleLogListClick(e) {
    if (e.target.classList.contains('thumbnail')) {
      imageManager.showFullImage(e.target.dataset.fullimg);
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
      
      // 更新按钮文本和图标 - 修复：使用切换后的状态，所以要用!isExpanded
      if (!isExpanded) { // 现在是展开状态
        expandButton.innerHTML = '收起内容 <i class="fas fa-chevron-up"></i>';
        expandButton.setAttribute('data-action', 'collapse');
        
        // 滚动到展开的内容顶部，使用延时确保DOM更新后滚动
        setTimeout(() => {
          textPreview.scrollIntoView({behavior: 'smooth', block: 'start'});
        }, 100);
      } else { // 现在是折叠状态
        expandButton.innerHTML = '更多内容 <i class="fas fa-chevron-down"></i>';
        expandButton.setAttribute('data-action', 'expand');
      }
    }
  }

  // 删除日志
  deleteLog(logId) {
    showConfirmDialog(
      '确认删除',
      '确定要删除此条日志吗？此操作不可撤销。',
      () => {
        try {
          const logs = getLogsFromStorage();
          const updatedLogs = logs.filter(log => log.id !== logId);
          localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(updatedLogs));
          
          // 更新状态
          stateManager.setLogs(updatedLogs);
          this.renderLogList(updatedLogs);
          showToast('日志已删除', 'success', this.dom.toastContainer);
        } catch (error) {
          console.error('删除日志失败:', error);
          showToast('删除失败: ' + error.message, 'error', this.dom.toastContainer);
        }
      }
    );
  }

  // 确认清空所有日志
  confirmClearAllLogs() {
    showConfirmDialog(
      '确认清空',
      '确定要删除所有日志吗？此操作不可恢复。',
      () => {
        try {
          localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify([]));
          stateManager.setLogs([]);
          this.renderLogList([]);
          showToast('已清空所有日志', 'success', this.dom.toastContainer);
        } catch (error) {
          console.error('清空日志失败:', error);
          showToast('操作失败: ' + error.message, 'error', this.dom.toastContainer);
        }
      }
    );
  }
}

export default new EventHandlers();
