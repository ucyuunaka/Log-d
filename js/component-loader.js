/**
 * HTML组件加载器 - 负责动态加载HTML组件
 */
export class ComponentLoader {
  constructor() {
    this.loadedComponents = new Map();
    this.componentCache = new Map();
  }

  /**
   * 加载HTML组件到指定容器
   * @param {string} componentPath - 组件路径
   * @param {HTMLElement|string} targetElement - 目标容器元素或选择器
   * @param {Object} data - 可选的数据对象，用于简单模板替换
   * @returns {Promise<HTMLElement>} - 返回加载完成的容器元素
   */
  async loadComponent(componentPath, targetElement, data = {}) {
    try {
      // 获取目标元素
      const target = typeof targetElement === 'string' 
        ? document.querySelector(targetElement) 
        : targetElement;
      
      if (!target) {
        throw new Error(`目标元素 ${targetElement} 不存在`);
      }
      
      // 从缓存获取或加载组件内容
      let html;
      if (this.componentCache.has(componentPath)) {
        html = this.componentCache.get(componentPath);
      } else {
        const response = await fetch(componentPath);
        if (!response.ok) {
          throw new Error(`加载组件失败: ${response.status}`);
        }
        html = await response.text();
        this.componentCache.set(componentPath, html);
      }
      
      // 简单的模板替换
      if (data) {
        Object.keys(data).forEach(key => {
          const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          html = html.replace(placeholder, data[key]);
        });
      }
      
      // 将HTML插入到目标元素
      target.innerHTML = html;
      this.loadedComponents.set(target, componentPath);
      
      // 触发组件加载完成事件
      const event = new CustomEvent('componentLoaded', {
        detail: { target, componentPath }
      });
      document.dispatchEvent(event);
      
      return target;
    } catch (error) {
      console.error('组件加载错误:', error);
      return null;
    }
  }
  
  /**
   * 加载多个组件
   * @param {Array<{path: string, target: string|HTMLElement, data: Object}>} components 
   * @returns {Promise<Array>}
   */
  async loadComponents(components) {
    const promises = components.map(comp => 
      this.loadComponent(comp.path, comp.target, comp.data)
    );
    return Promise.all(promises);
  }
  
  /**
   * 重新加载组件
   * @param {HTMLElement|string} targetElement 
   * @param {Object} newData 
   */
  async reloadComponent(targetElement, newData = {}) {
    const target = typeof targetElement === 'string' 
      ? document.querySelector(targetElement) 
      : targetElement;
      
    if (!target || !this.loadedComponents.has(target)) {
      console.error('无法重新加载未加载的组件');
      return null;
    }
    
    const componentPath = this.loadedComponents.get(target);
    return this.loadComponent(componentPath, target, newData);
  }
}

// 创建并导出单例实例
export default new ComponentLoader();
