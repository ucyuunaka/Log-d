import { utils } from './utils.js';

export class LogContentService {
  constructor() {
    this.expandedStates = new Map();
    this.loadPreferences();
    
    // 监听页面卸载事件，保存状态
    window.addEventListener('beforeunload', () => this.savePreferences());
    
    // 添加节流保存函数
    this.debouncedSave = utils.debounce(() => this.savePreferences(), 500);
    
    // 检测设备类型
    this.isMobileDevice = window.innerWidth < 768;
    window.addEventListener('resize', utils.debounce(() => {
      this.isMobileDevice = window.innerWidth < 768;
    }, 250));
  }

  // 格式化日志内容
  formatLogContent(text) {
    if (!text) return '<p class="no-text">[无文本内容]</p>';
    
    // HTML转义
    const processedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
    
    return processedText;
  }

  // 判断文本是否需要截断
  shouldTruncate(text) {
    if (!text) return false;
    
    // 根据设备屏幕宽度调整截断阈值
    const lengthThreshold = this.isMobileDevice ? 200 : 300;
    const lineThreshold = this.isMobileDevice ? 4 : 6;
    
    return text.length > lengthThreshold || text.split('\n').length > lineThreshold;
  }

  // 展开特定日志内容
  expandText(elementId) {
    this.expandedStates.set(elementId, true);
    const element = document.getElementById(elementId);
    if (element) {
      element.setAttribute('aria-expanded', 'true');
      element.classList.remove('truncated');
      element.classList.add('expanded');
      
      // 添加加载状态，用于长文本
      if (element.textContent.length > 1000) {
        element.classList.add('loading');
        setTimeout(() => element.classList.remove('loading'), 300);
      }
      
      // 平滑滚动到内容位置
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      
      // 触发自定义事件
      document.dispatchEvent(new CustomEvent('logContentExpanded', {
        detail: { elementId }
      }));
      
      // 节流保存
      this.debouncedSave();
    }
  }

  // 收起特定日志内容
  collapseText(elementId) {
    this.expandedStates.set(elementId, false);
    const element = document.getElementById(elementId);
    if (element) {
      element.setAttribute('aria-expanded', 'false');
      element.classList.add('truncated');
      element.classList.remove('expanded');
      
      // 触发自定义事件
      document.dispatchEvent(new CustomEvent('logContentCollapsed', {
        detail: { elementId }
      }));
      
      // 节流保存
      this.debouncedSave();
    }
  }

  // 切换展开/收起状态
  toggleExpansion(elementId) {
    try {
      const isExpanded = this.expandedStates.get(elementId) || false;
      if (isExpanded) {
        this.collapseText(elementId);
      } else {
        this.expandText(elementId);
      }
      return !isExpanded;
    } catch (error) {
      console.error('展开/收起状态切换失败:', error);
      return false;
    }
  }

  // 检查元素是否已展开
  isExpanded(elementId) {
    return this.expandedStates.get(elementId) || false;
  }
  
  // 保存用户偏好到LocalStorage
  savePreferences() {
    try {
      // 限制存储大小，只保留最近100个状态
      if (this.expandedStates.size > 100) {
        // 转换为数组，只保留最近的100个元素
        const entries = Array.from(this.expandedStates.entries()).slice(-100);
        this.expandedStates = new Map(entries);
      }
      
      const preferences = Object.fromEntries(this.expandedStates);
      localStorage.setItem('logContentPreferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('无法保存日志内容偏好:', error);
    }
  }

  // 从LocalStorage加载用户偏好
  loadPreferences() {
    try {
      const preferences = localStorage.getItem('logContentPreferences');
      if (preferences) {
        this.expandedStates = new Map(Object.entries(JSON.parse(preferences)));
      }
    } catch (error) {
      console.error('无法加载日志内容偏好:', error);
      this.expandedStates = new Map();
    }
  }
  
  // 清理过期或无效的状态
  cleanupStaleStates() {
    // 获取当前所有日志ID
    const logIds = Array.from(document.querySelectorAll('.log-item'))
      .map(item => item.dataset.id)
      .filter(Boolean)
      .map(id => `log-content-${id}`);
    
    // 创建一个新的Map只包含当前显示的日志状态
    const currentStates = new Map();
    logIds.forEach(id => {
      if (this.expandedStates.has(id)) {
        currentStates.set(id, this.expandedStates.get(id));
      }
    });
    
    this.expandedStates = currentStates;
    this.savePreferences();
  }
}