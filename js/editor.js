import { utils, showToast, showConfirmDialog } from './utils.js';
import stateManager from './state-manager.js';
import imageManager from './image-manager.js';

// 编辑器管理模块
export class EditorManager {
  constructor() {
    this.editorContainer = null;
    this.wordCountElement = null;
    this.toastContainer = null;
    this.quill = null;
    this.templates = {
      completed: `# 已完成\n\n${new Date().toLocaleDateString('zh-CN')}\n\n- \n- \n- \n\n完成感想：\n\n`,
      todo: `# 待完成\n\n优先级高：\n- \n- \n\n优先级中：\n- \n- \n\n优先级低：\n- \n- \n\n截止时间：\n\n`,
      ideas: `# 一点想法\n\n灵感内容：\n\n可能的发展方向：\n\n需要准备的资源：\n- \n`
    };
  }

  // 初始化编辑器
  initialize() {
    if (!this.editorContainer) {
      console.error('编辑器初始化失败：缺少必要的DOM元素');
      return null;
    }
    
    this.quill = new Quill(this.editorContainer, {
      modules: {
        toolbar: false, // 移除工具栏，保持纯文本编辑功能
        clipboard: {
          matchVisual: false
        }
      },
      placeholder: '写下今天的所思所想...',
      theme: 'snow'
    });

    // 将Quill实例存储到状态管理器
    stateManager.setQuill(this.quill);

    // 添加文本变化监听
    this.quill.on('text-change', utils.debounce(this.updateWordCount.bind(this), 300));
    
    return this.quill;
  }

  // 更新字数统计
  updateWordCount() {
    const text = this.getText();
    // 使用中文友好的字数统计方法
    const count = text ? text.replace(/\s+/g, '').length : 0;
    if (this.wordCountElement) {
      this.wordCountElement.textContent = count;
    }
  }

  // 获取编辑器文本内容
  getText() {
    return this.quill ? this.quill.getText().trim() : '';
  }

  // 获取HTML内容
  getHTML() {
    return this.quill ? this.quill.root.innerHTML : '';
  }

  // 获取Delta内容
  getContents() {
    return this.quill ? this.quill.getContents() : null;
  }

  // 重置编辑器
  reset() {
    if (this.quill) {
      this.quill.setContents([]);
      this.updateWordCount();
    }
  }

  // 应用模板
  applyTemplate(templateType) {
    const template = this.templates[templateType] || '';
    if (template && this.quill) {
      this.quill.setText(''); // 清空编辑器
      this.quill.insertText(0, template); // 直接以纯文本形式插入内容
      showToast('已应用模板', 'success', this.toastContainer);
      this.updateWordCount();
    }
  }

  // 重置编辑器和图片状态
  resetEditorAndImages() {
    showConfirmDialog(
      '确认重置',
      '确定要清空当前编辑内容吗？',
      () => {
        this.reset();
        stateManager.clearImages();
        imageManager.updateImagePreview();
        showToast('已重置编辑内容', 'info', this.toastContainer);
      }
    );
  }

  // 切换全屏编辑模式
  toggleFullscreenEditor(editorFullscreenBtn) {
    const editorSection = this.editorContainer.closest('.editor-section');
    editorSection.classList.toggle('fullscreen-editor');
    
    const isFullscreen = editorSection.classList.contains('fullscreen-editor');
    editorFullscreenBtn.innerHTML = isFullscreen ? 
      '<i class="fas fa-compress-alt"></i>' : 
      '<i class="fas fa-expand-alt"></i>';
    
    editorFullscreenBtn.setAttribute('data-tooltip', 
      isFullscreen ? '退出全屏' : '全屏编辑');
  }

  // 检查是否有内容
  hasContent() {
    return this.getText().length > 0 || stateManager.getImages().length > 0;
  }

  // 添加新方法：设置编辑器内容
  setContent(content) {
    if (this.quill) {
      this.quill.setText(content);
      this.updateWordCount();
    }
  }
}

// 创建单例实例
const editorManager = new EditorManager();
export default editorManager;
