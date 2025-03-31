import stateManager from './state-manager.js';
import eventHandlers from './event-handlers.js';
import { utils, THEME_STORAGE_KEY, showToast } from './utils.js';
import componentLoader from './component-loader.js';
import backupManager from './backup-manager.js';
import editorManager from './editor.js';
import imageManager from './image-manager.js';
import { KeyboardShortcutsManager } from './keyboard-shortcuts.js';

// 主应用模块 - 只负责初始化和协调
class App {
  constructor() {
    this.componentsLoaded = false;
    this.dom = null;
    this.keyboardShortcuts = null;
    this.modalHandlers = new Map(); // 存储模态框处理程序
    this.componentsQueue = [
      { path: 'components/header.html', target: '#header-container' },
      { path: 'components/editor.html', target: '#editor-section-container' },
      { path: 'components/image-upload.html', target: '#image-upload-container' },
      { path: 'components/logs-list.html', target: '#logs-section-container' },
      { path: 'components/footer.html', target: '#footer-container' },
      { path: 'components/modals.html', target: '#modals-container' }
    ];
    
    // 注册ServiceWorker
    this.registerServiceWorker();
  }

  // 初始化应用
  async init() {
    console.log('正在初始化应用...');
    
    try {
      await this.initApp();
      console.log('应用初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
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
    
    // 6. 初始化图像管理器
    imageManager.elements = {
      imageUpload: this.dom.imageUpload,
      dropZone: this.dom.dropZone,
      imagePreviewContainer: this.dom.imagePreviewContainer,
      clearImagesBtn: this.dom.clearImagesBtn
    };
    imageManager.toastContainer = this.dom.toastContainer;
    imageManager.setupEventListeners();
    
    // 7. 初始化编辑器
    editorManager.editorContainer = this.dom.editorContainer;
    editorManager.wordCountElement = this.dom.wordCount;
    editorManager.toastContainer = this.dom.toastContainer;
    editorManager.initialize();
    
    // 8. 设置事件监听
    eventHandlers.setupEventListeners();
    this.setupAdditionalEventListeners();
    
    // 9. 加载初始数据
    eventHandlers.loadLogs();
    
    // 10. 初始化键盘快捷键
    this.keyboardShortcuts = new KeyboardShortcutsManager({
      app: this,
      eventHandlers,
      editorManager,
      toastContainer: this.dom.toastContainer
    });

    // 添加测试黑白拼接效果的功能
    if (process.env.NODE_ENV !== 'production') {
      this.addSplitThemeTestElements();
    }
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

  // 更新主题切换按钮图标
  updateThemeToggleIcon(theme) {
    if (!this.dom?.themeToggle) return;
    
    const themeIcon = this.dom.themeToggle.querySelector('i');
    if (themeIcon) {
      themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  // 通用模态框处理方法
  setupModalHandlers() {
    // 通用模态框关闭功能
    document.querySelectorAll('.modal').forEach(modal => {
      // 点击背景关闭
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
          // 执行可能存在的自定义处理程序
          const handler = this.modalHandlers.get(modal.id);
          if (handler && typeof handler.onClose === 'function') {
            handler.onClose();
          }
        }
      });

      // 关闭按钮
      const closeBtn = modal.querySelector('.close-modal, [data-action="close-modal"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.classList.remove('active');
          // 执行可能存在的自定义处理程序
          const handler = this.modalHandlers.get(modal.id);
          if (handler && typeof handler.onClose === 'function') {
            handler.onClose();
          }
        });
      }
    });
  }

  // 打开指定ID的模态框
  openModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      // 存储自定义处理程序
      if (options.onOpen || options.onClose) {
        this.modalHandlers.set(modalId, {
          onOpen: options.onOpen,
          onClose: options.onClose
        });
      }
      // 执行打开回调
      if (options.onOpen) {
        options.onOpen(modal);
      }
    }
    return modal;
  }

  // 关闭指定ID的模态框
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      // 执行可能存在的自定义处理程序
      const handler = this.modalHandlers.get(modalId);
      if (handler && typeof handler.onClose === 'function') {
        handler.onClose();
      }
    }
  }

  // 设置其他事件监听器
  setupAdditionalEventListeners() {
    if (!this.componentsLoaded) {
      console.error('组件未加载完成，无法设置事件监听');
      return;
    }
    
    console.log('正在设置附加事件监听器...');
    
    // 初始化模态框处理
    this.setupModalHandlers();
    
    // 重置日志按钮
    this.dom.resetLogBtn?.addEventListener('click', () => {
      editorManager.resetEditorAndImages();
      this.dom.dateFilter.value = '';
      eventHandlers.filterLogs();
    });
    
    // 全屏编辑功能
    this.dom.editorFullscreen?.addEventListener('click', () => {
      editorManager.toggleFullscreenEditor(this.dom.editorFullscreen);
    });
    
    // 快速模板按钮
    this.dom.quickTemplate?.addEventListener('click', () => {
      this.openModal('templatesModal', {
        onOpen: () => {
          // 使用事件委托处理模板项点击
          const modal = document.getElementById('templatesModal');
          // 避免重复绑定，先移除可能存在的处理程序
          const newModal = modal.cloneNode(true);
          modal.parentNode.replaceChild(newModal, modal);
          
          newModal.addEventListener('click', (e) => {
            const templateItem = e.target.closest('.template-item');
            if (templateItem) {
              const templateType = templateItem.dataset.template;
              editorManager.applyTemplate(templateType);
              this.closeModal('templatesModal');
            }
          });
        }
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
      this.showToast('主题设置已更新', 'success');
    });

    // 设置按钮
    document.getElementById('showSettings')?.addEventListener('click', (e) => {
      if (e.currentTarget.tagName === 'A') e.preventDefault();
      this.openModal('settingsModal');
    });

    // 日志列表操作
    this.dom.logList?.addEventListener('click', (e) => {
      eventHandlers.handleLogListClick(e);
    });

    // 备份管理相关事件
    this.setupBackupEvents();

    // 心情选择按钮
    this.setupMoodSelectors();
  }

  // 备份管理相关事件
  setupBackupEvents() {
    document.getElementById('backupManager')?.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const backupsModal = document.getElementById('backupsModal');
      const backupsList = document.getElementById('backupsList');
      
      try {
        const backups = await backupManager.getBackupsList();
        
        // 渲染备份列表
        backupsList.innerHTML = backups.length
          ? backups.map(backup => `
              <div class="backup-item">
                <div class="backup-info">
                  <span class="backup-name">${backup.filename}</span>
                  <span class="backup-date">${new Date(backup.timestamp).toLocaleString('zh-CN')}</span>
                </div>
                <div class="backup-actions">
                  <button class="btn outline btn-sm restore-backup" data-filename="${backup.filename}">
                    <i class="fas fa-undo"></i> 恢复
                  </button>
                  <button class="btn outline btn-sm danger delete-backup" data-filename="${backup.filename}">
                    <i class="fas fa-trash"></i> 删除
                  </button>
                </div>
              </div>
            `).join('')
          : '<div class="empty-backup">没有找到备份记录</div>';
        
        this.openModal('backupsModal', {
          onOpen: () => {
            this.attachBackupActionHandlers(backupsList);
          }
        });
        
      } catch (error) {
        backupsList.innerHTML = '<div class="empty-backup">加载备份失败</div>';
        console.error('获取备份列表失败:', error);
      }
    });

    // 创建备份按钮
    document.getElementById('createBackupBtn')?.addEventListener('click', async () => {
      try {
        const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const data = JSON.stringify(stateManager.getLogs());
        await backupManager.saveBackupToIDB(filename, data);
        this.showToast(`备份创建成功: ${filename}`, 'success');
        
        // 刷新备份列表
        document.getElementById('backupManager')?.click();
      } catch (error) {
        this.showToast(`创建备份失败: ${error.message}`, 'error');
      }
    });
  }
  
  // 添加备份操作处理程序
  attachBackupActionHandlers(backupsList) {
    // 绑定恢复备份事件
    backupsList.querySelectorAll('.restore-backup').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename;
        try {
          await backupManager.restoreFromBackup(filename);
          this.closeModal('backupsModal');
          eventHandlers.loadLogs();
        } catch (error) {
          this.showToast(`恢复备份失败: ${error.message}`, 'error');
        }
      });
    });
    
    // 绑定删除备份事件
    backupsList.querySelectorAll('.delete-backup').forEach(btn => {
      btn.addEventListener('click', async () => {
        const filename = btn.dataset.filename;
        try {
          await backupManager.deleteBackup(filename);
          btn.closest('.backup-item').remove();
          this.showToast(`已删除备份: ${filename}`, 'success');
          
          // 检查是否还有备份
          if (backupsList.children.length === 0) {
            backupsList.innerHTML = '<div class="empty-backup">没有找到备份记录</div>';
          }
        } catch (error) {
          this.showToast(`删除备份失败: ${error.message}`, 'error');
        }
      });
    });
  }
  
  // 心情选择按钮
  setupMoodSelectors() {
    const moodButtons = document.querySelectorAll('.mood-btn');
    if (moodButtons.length > 0) {
      moodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // 检查当前按钮是否已经激活
          const isActive = btn.classList.contains('active');
          const selectedMood = btn.dataset.mood;
          
          // 移除所有按钮的active类
          moodButtons.forEach(b => b.classList.remove('active'));
          
          // 如果按钮不是激活状态，则激活它；否则保持取消状态
          if (!isActive) {
            btn.classList.add('active');
            stateManager.setCurrentMood(selectedMood);
          } else {
            stateManager.setCurrentMood(null);
          }
        });
      });
    }
  }

  // 显示提示消息，封装showToast
  showToast(message, type = 'info') {
    showToast(message, type, this.dom.toastContainer);
  }

  // 注册ServiceWorker
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('ServiceWorker注册成功:', registration.scope);
          })
          .catch(error => {
            console.error('ServiceWorker注册失败:', error);
          });
      });
    }
  }
}

// 创建并初始化应用
const app = new App();
app.init();

export default app;