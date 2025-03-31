/**
 * 主题适配器 - 处理黑白拼接主题的元素适配
 */
class ThemeAdapter {
  constructor() {
    this.init();
  }
  
  init() {
    this.setupEventListeners();
    this.detectElementsPosition();
    
    // 初始化时检测一次
    window.addEventListener('DOMContentLoaded', () => {
      this.detectElementsPosition();
    });
  }
  
  setupEventListeners() {
    // 监听窗口大小变化，重新计算元素位置
    window.addEventListener('resize', this.debounce(() => {
      this.detectElementsPosition();
    }, 100));
    
    // 监听滚动事件
    window.addEventListener('scroll', this.debounce(() => {
      this.detectElementsPosition();
    }, 100));
    
    // 监听DOM变化
    const observer = new MutationObserver(this.debounce(() => {
      this.detectElementsPosition();
    }, 100));
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  /**
   * 检测元素位置并应用相应的样式
   */
  detectElementsPosition() {
    // 获取所有需要自适应的元素
    const adaptElements = document.querySelectorAll('.adapt-text, [data-auto-text-color]');
    
    adaptElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      // 计算元素中心点
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // 计算对角线位置，左上为黑区域，右下为白区域
      const isInDarkZone = centerX / windowWidth + centerY / windowHeight < 1;
      
      // 移除之前的类
      element.classList.remove('adapt-text-light', 'adapt-text-dark');
      
      // 应用适当的类
      if (isInDarkZone) {
        element.classList.add('adapt-text-light');
        element.setAttribute('data-zone', 'dark');
      } else {
        element.classList.add('adapt-text-dark');
        element.setAttribute('data-zone', 'light');
      }
    });
    
    // 处理卡片元素
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const isInDarkZone = centerX / windowWidth + centerY / windowHeight < 1;
      
      card.classList.remove('dark-zone', 'light-zone');
      
      if (isInDarkZone) {
        card.classList.add('dark-zone');
      } else {
        card.classList.add('light-zone');
      }
    });
  }
  
  /**
   * 防抖函数
   */
  debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(context, args);
      }, wait);
    };
  }
}

// 导出适配器
export default ThemeAdapter;
