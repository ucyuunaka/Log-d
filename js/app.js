import stateManager from './state-manager.js';
import eventHandlers from './event-handlers.js';
import { utils, THEME_STORAGE_KEY } from './utils.js';
import componentLoader from './component-loader.js';

// 主应用模块 - 只负责初始化和协调
class App {
  constructor() {
    this.componentsLoaded = false;
    this.componentsQueue = [
      { path: 'components/header.html', target: '#header-container' },
      { path: 'components/editor.html', target: '#editor-section-container' },
      { path: 'components/image-upload.html', target: '#image-upload-container' },
      { path: 'components/logs-list.html', target: '#logs-section-container' },
      { path: 'components/footer.html', target: '#footer-container' },
      { path: 'components/modals.html', target: '#modals-container' }
    ];
  }

  // 初始化应用
  init() {
    // 确保DOM已加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initApp());
    } else {
      this.initApp();
    }
  }

  // 实际初始化逻辑
  async initApp() {
    console.log('正在初始化应用...');
    
    // 1. 首先加载所有组件
    await this.loadAllComponents();

    // 2. 初始化主题
    this.initTheme();
    
    // 3. DOM元素引用
    this.initDomReferences();
    
    // 4. 初始化状态管理器
    stateManager.initDomElements(this.dom);
    
    // 5. 初始化事件处理器
    eventHandlers.initDomElements(this.dom);
    
    // 6. 初始化编辑器
    this.initEditor();
    
    // 7. 设置事件监听
    eventHandlers.setupEventListeners();
    this.setupAdditionalEventListeners();
    
    // 8. 加载初始数据
    eventHandlers.loadLogs();
    
    // 9. 初始化字数统计
    eventHandlers.updateWordCount();
    
    console.log('应用初始化完成');
  }

  // 加载所有组件
  async loadAllComponents() {
    try {
      console.log('正在加载页面组件...');
      await componentLoader.loadComponents(this.componentsQueue);
      this.componentsLoaded = true;
      console.log('所有组件加载完成');
    } catch (error) {
      console.error('组件加载失败:', error);
    }
  }
  
  // DOM元素引用初始化
  initDomReferences() {
    console.log('正在初始化DOM引用...');
    // DOM元素缓存 - 在组件加载完成后
    this.dom = {
      editorContainer: document.getElementById('editor-container'),
      imageUpload: document.getElementById('image-upload'),
      dropZone: document.getElementById('dropZone'),
      imagePreviewContainer: document.getElementById('image-preview-container'),
      clearImagesBtn: document.getElementById('clear-images'),
      saveLogBtn: document.getElementById('saveLog'),
      clearAllLogsBtn: document.getElementById('clearAllLogs'),
      logList: document.getElementById('logList'),
      wordCount: document.getElementById('wordCount'),
      searchInput: document.getElementById('searchInput'),
      dateFilter: document.getElementById('dateFilter'),
      toastContainer: document.getElementById('toastContainer'),
      resetLogBtn: document.getElementById('resetLog'),
      clearFilters: document.getElementById('clearFilters'),
      editorFullscreen: document.getElementById('editorFullscreen'),
      quickTemplate: document.getElementById('quickTemplate'),
      themeToggle: document.getElementById('themeToggle')
    };
  }

  // 初始化主题
  initTheme() {
    console.log('正在初始化主题...');
    // 应用保存的主题偏好
    const preferredTheme = utils.getPreferredTheme();
    utils.setTheme(preferredTheme);
    
    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (localStorage.getItem(THEME_STORAGE_KEY) === 'auto') {
        const systemTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', systemTheme);
        this.updateThemeToggleIcon(systemTheme);
      }
    });
  }
  
  // 更新主题切换按钮图标
  updateThemeToggleIcon(theme) {
    if (!this.dom?.themeToggle) return;
    
    const themeIcon = this.dom.themeToggle.querySelector('i');
    if (themeIcon) {
      themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }
  
  // 设置其他事件监听器
  setupAdditionalEventListeners() {
    if (!this.componentsLoaded) {
      console.error('组件未加载完成，无法设置事件监听');
      return;
    }
    
    console.log('正在设置附加事件监听器...');
    
    // 重置日志按钮
    this.dom.resetLogBtn?.addEventListener('click', () => {
      eventHandlers.resetEditorAndImages();
    });
    
    // 清除筛选条件
    this.dom.clearFilters?.addEventListener('click', () => {
      this.dom.searchInput.value = '';
      this.dom.dateFilter.value = '';
      eventHandlers.filterLogs();
    });
    
    // 全屏编辑功能
    this.dom.editorFullscreen?.addEventListener('click', this.toggleFullscreenEditor.bind(this));
    
    // 模板按钮
    this.dom.quickTemplate?.addEventListener('click', () => {
      const templatesModal = document.getElementById('templatesModal');
      templatesModal.classList.add('active');
      
      // 关闭按钮
      document.getElementById('templateClose')?.addEventListener('click', () => {
        templatesModal.classList.remove('active');
      });
      
      // 点击模板应用
      document.querySelectorAll('.template-item')?.forEach(item => {
        item.addEventListener('click', (e) => {
          const templateType = e.currentTarget.dataset.template;
          this.applyTemplate(templateType);
          templatesModal.classList.remove('active');
        });
      });
    });
    
    // 主题切换
    this.dom.themeToggle?.addEventListener('click', () => {
      const newTheme = utils.toggleTheme();
      this.updateThemeToggleIcon(newTheme);
      this.showToast(`已切换为${newTheme === 'dark' ? '深色' : '浅色'}主题`, 'info');
    });
    
    // 设置面板中的主题选择
    document.getElementById('themeSetting')?.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      utils.setTheme(selectedTheme);
      this.updateThemeToggleIcon(utils.getPreferredTheme());
      this.showToast(`主题设置已更新`, 'success');
    });

    // 设置按钮
    document.getElementById('showSettings')?.addEventListener('click', (e) => {
      if (e.currentTarget.tagName === 'A') e.preventDefault();
      const settingsModal = document.getElementById('settingsModal');
      settingsModal.classList.add('active');
      
      document.getElementById('settingsCancel')?.addEventListener('click', () => {
        settingsModal.classList.remove('active');
      });
      
      document.getElementById('settingsSave')?.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        this.showToast('设置已保存', 'success');
      });
    });

    // 为所有模态框添加Esc关闭事件
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
          modal.classList.remove('active');
        });
      }
    });

    // 点击模态框背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // 心情选择按钮
    const moodButtons = document.querySelectorAll('.mood-btn');
    if (moodButtons.length > 0) {
      moodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // 移除所有按钮的active类
          moodButtons.forEach(b => b.classList.remove('active'));
          
          // 给当前点击的按钮添加active类
          btn.classList.add('active');
          
          // 保存选中的心情到状态管理器
          const selectedMood = btn.dataset.mood;
          stateManager.setCurrentMood(selectedMood);
          
          this.showToast(`已选择心情: ${this.getMoodLabel(selectedMood)}`, 'info');
        });
      });
    }
  }

  // 获取心情文本标签
  getMoodLabel(mood) {
    const moodLabels = {
      'happy': '开心',
      'sad': '伤心',
      'meh': '一般',
      'angry': '生气',
      'excited': '兴奋'
    };
    return moodLabels[mood] || '未指定';
  }

  // 初始化编辑器
  initEditor() {
    console.log('正在初始化编辑器...');
    const quill = new Quill(this.dom.editorContainer, {
      modules: {
        toolbar: false, // 移除工具栏，精简界面
        clipboard: {
          matchVisual: false
        }
      },
      placeholder: '写下今天的所思所想...',
      theme: 'snow'
    });

    // 将Quill实例存储到状态管理器
    stateManager.setQuill(quill);

    // 添加文本变化监听
    quill.on('text-change', utils.debounce(() => {
      eventHandlers.updateWordCount();
    }, 300));
    
    console.log('编辑器初始化完成');
  }
  
  // 切换全屏编辑模式
  toggleFullscreenEditor() {
    const editorSection = this.dom.editorContainer.closest('.editor-section');
    editorSection.classList.toggle('fullscreen-editor');
    
    const isFullscreen = editorSection.classList.contains('fullscreen-editor');
    this.dom.editorFullscreen.innerHTML = isFullscreen ? 
      '<i class="fas fa-compress-alt"></i>' : 
      '<i class="fas fa-expand-alt"></i>';
    
    this.dom.editorFullscreen.setAttribute('data-tooltip', 
      isFullscreen ? '退出全屏' : '全屏编辑');
  }
  
  // 应用模板
  applyTemplate(templateType) {
    const templates = {
      daily: `# ${new Date().toLocaleDateString('zh-CN')} 日记\n\n今天的主要事项：\n- \n\n收获与感悟：\n\n明天计划：\n- `,
      gratitude: `# 感恩记录\n\n今天，我要感谢：\n\n1. \n2. \n3. \n\n这些人/事物给我带来的影响：\n\n`,
      idea: `# 创意记录\n\n灵感描述：\n\n可能的应用场景：\n\n后续行动计划：\n- `,
      travel: `# ${new Date().toLocaleDateString('zh-CN')} 旅行笔记\n\n地点：\n\n见闻：\n\n感受：\n\n值得推荐：\n- `
    };
    
    const template = templates[templateType] || '';
    if(template && stateManager.quill) {
      stateManager.quill.setText('');
      stateManager.quill.clipboard.dangerouslyPasteHTML(0, template.replace(/\n/g, '<br>'));
      this.showToast('已应用模板', 'success');
    }
  }

  // 显示提示消息
  showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas ${this.getToastIcon(type)}"></i>
      <span>${message}</span>
    `;
    
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    
    // 自动消失
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          this.dom.toastContainer.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // 获取通知图标
  getToastIcon(type) {
    switch (type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-exclamation-circle';
      case 'warning': return 'fa-exclamation-triangle';
      default: return 'fa-info-circle';
    }
  }
}

// 创建并初始化应用
const app = new App();
app.init();

export default app;