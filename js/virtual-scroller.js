// 创建虚拟滚动组件文件

export class VirtualScroller {
  constructor(options) {
    this.container = options.container;
    this.items = options.items || [];
    this.renderItem = options.renderItem;
    this.itemHeight = options.itemHeight || 100;
    this.buffer = options.buffer || 5;
    this.visibleItems = [];
    
    this.scrollContainer = this.container.parentElement;
    this.totalHeight = 0;
    
    this.init();
  }
  
  init() {
    // 创建占位元素
    this.placeholder = document.createElement('div');
    this.placeholder.style.height = '0px';
    this.container.appendChild(this.placeholder);
    
    // 绑定滚动事件
    this.scrollContainer.addEventListener('scroll', this.onScroll.bind(this));
    window.addEventListener('resize', this.onResize.bind(this));
    
    // 初始渲染
    this.updateTotalHeight();
    this.render();
  }
  
  updateTotalHeight() {
    this.totalHeight = this.items.length * this.itemHeight;
    this.placeholder.style.height = `${this.totalHeight}px`;
  }
  
  onScroll() {
    this.render();
  }
  
  onResize() {
    this.render();
  }
  
  render() {
    // 计算可视区域
    const scrollTop = this.scrollContainer.scrollTop;
    const viewportHeight = this.scrollContainer.clientHeight;
    
    // 计算需要渲染的项目范围
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
    const endIndex = Math.min(this.items.length - 1, Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.buffer);
    
    // 清空容器
    this.container.innerHTML = '';
    
    // 创建并插入占位元素
    this.placeholder = document.createElement('div');
    this.placeholder.style.height = `${this.totalHeight}px`;
    this.placeholder.style.position = 'relative';
    this.container.appendChild(this.placeholder);
    
    // 渲染可见项
    for (let i = startIndex; i <= endIndex; i++) {
      const item = this.renderItem(this.items[i], i);
      item.style.position = 'absolute';
      item.style.top = `${i * this.itemHeight}px`;
      item.style.width = '100%';
      this.placeholder.appendChild(item);
    }
  }
  
  setItems(items) {
    this.items = items;
    this.updateTotalHeight();
    this.render();
  }
}
