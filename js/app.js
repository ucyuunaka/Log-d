import stateManager from './state-manager.js';
import eventHandlers from './event-handlers.js';
import { utils, THEME_STORAGE_KEY } from './utils.js';

// 主应用模块 - 只负责初始化和协调
class App {
  constructor() {
    // DOM元素缓存
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
      // 添加缺失的DOM元素引用
      resetLogBtn: document.getElementById('resetLog'),
      clearFilters: document.getElementById('clearFilters'),
      exportLogs: document.getElementById('exportLogs'),
      importLogs: document.getElementById('importLogs'),
      editorFullscreen: document.getElementById('editorFullscreen'),
      quickTemplate: document.getElementById('quickTemplate'),
      themeToggle: document.getElementById('themeToggle')
    };
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
  initApp() {
    // 初始化主题
    this.initTheme();
    
    // 初始化状态管理器
    stateManager.initDomElements(this.dom);
    
    // 初始化事件处理器
    eventHandlers.initDomElements(this.dom);
    
    // 初始化编辑器
    this.initEditor();
    
    // 设置事件监听
    eventHandlers.setupEventListeners();
    this.setupAdditionalEventListeners();
    
    // 加载初始数据
    eventHandlers.loadLogs();
    
    // 初始化字数统计
    eventHandlers.updateWordCount();
    
    // 监听自定义事件
    document.addEventListener('showFullImage', (event) => {
      eventHandlers.showFullImage(event.detail);
    });
    
    console.log('应用初始化完成');
  }
  
  // 初始化主题
  initTheme() {
    // 应用保存的主题偏好
    const preferredTheme = utils.getPreferredTheme();
    utils.setTheme(preferredTheme);
    
    // 更新主题切换按钮图标
    this.updateThemeToggleIcon(preferredTheme);
    
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
    const themeIcon = this.dom.themeToggle.querySelector('i');
    if (theme === 'dark') {
      themeIcon.className = 'fas fa-moon';
    } else {
      themeIcon.className = 'fas fa-sun';
    }
  }
  
  // 设置其他事件监听器
  setupAdditionalEventListeners() {
    // 重置日志按钮
    this.dom.resetLogBtn.addEventListener('click', () => {
      if (confirm('确定要清空当前编辑内容吗？')) {
        eventHandlers.resetEditorAndImages();
      }
    });
    
    // 清除筛选条件
    this.dom.clearFilters.addEventListener('click', () => {
      this.dom.searchInput.value = '';
      this.dom.dateFilter.value = '';
      eventHandlers.filterLogs();
    });
    
    // 全屏编辑功能
    this.dom.editorFullscreen.addEventListener('click', this.toggleFullscreenEditor.bind(this));
    
    // 模板按钮
    this.dom.quickTemplate.addEventListener('click', () => {
      const templatesModal = document.getElementById('templatesModal');
      templatesModal.classList.add('active');
      
      // 关闭按钮
      document.getElementById('templateClose').addEventListener('click', () => {
        templatesModal.classList.remove('active');
      });
      
      // 点击模板应用
      document.querySelectorAll('.template-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const templateType = e.currentTarget.dataset.template;
          this.applyTemplate(templateType);
          templatesModal.classList.remove('active');
        });
      });
    });
    
    // 主题切换
    this.dom.themeToggle.addEventListener('click', () => {
      const newTheme = utils.toggleTheme();
      this.updateThemeToggleIcon(newTheme);
      showToast(`已切换为${newTheme === 'dark' ? '深色' : '浅色'}主题`, 'info', this.dom.toastContainer);
    });
    
    // 设置面板中的主题选择
    document.getElementById('themeSetting')?.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      utils.setTheme(selectedTheme);
      this.updateThemeToggleIcon(utils.getPreferredTheme());
      showToast(`主题设置已更新`, 'success', this.dom.toastContainer);
    });
  }

  // 初始化编辑器
  initEditor() {
    const quill = new Quill(this.dom.editorContainer, {
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['link', 'image'],
          ['clean']
        ],
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
      showToast('已应用模板', 'success', this.dom.toastContainer);
    }
  }
}

// 创建并初始化应用
const app = new App();
app.init();

export default app;

// 辅助函数 - 显示通知
function showToast(message, type, container) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${getToastIcon(type)}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 自动消失
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// 获取通知图标
function getToastIcon(type) {
  switch (type) {
    case 'success': return 'fa-check-circle';
    case 'error': return 'fa-exclamation-circle';
    case 'warning': return 'fa-exclamation-triangle';
    default: return 'fa-info-circle';
  }
}