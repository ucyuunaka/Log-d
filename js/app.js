import stateManager from './state-manager.js';
import eventHandlers from './event-handlers.js';
import { utils } from './utils.js';

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
      toastContainer: document.getElementById('toastContainer')
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
    // 初始化状态管理器
    stateManager.initDomElements(this.dom);
    
    // 初始化事件处理器
    eventHandlers.initDomElements(this.dom);
    
    // 初始化编辑器
    this.initEditor();
    
    // 设置事件监听
    eventHandlers.setupEventListeners();
    
    // 加载初始数据
    eventHandlers.loadLogs();
    
    // 初始化字数统计
    eventHandlers.updateWordCount();
    
    console.log('应用初始化完成');
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
}

// 创建并初始化应用
const app = new App();
app.init();

export default app;