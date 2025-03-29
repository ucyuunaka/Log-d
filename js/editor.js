import { utils } from './utils.js';

// 编辑器管理模块
export class EditorManager {
  constructor(editorContainer, wordCountElement) {
    this.editorContainer = editorContainer;
    this.wordCountElement = wordCountElement;
    this.quill = null;
  }

  // 初始化编辑器
  initialize() {
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

    this.quill.on('text-change', utils.debounce(this.updateWordCount.bind(this), 300));
    return this.quill;
  }

  // 更新字数统计
  updateWordCount() {
    const text = this.quill.getText().trim();
    // 使用中文友好的字数统计方法
    const count = text ? text.replace(/\s+/g, '').length : 0;
    this.wordCountElement.textContent = count;
  }

  // 获取编辑器内容
  getText() {
    return this.quill.getText().trim();
  }

  // 获取HTML内容
  getHTML() {
    return this.quill.root.innerHTML;
  }

  // 获取Delta内容
  getContents() {
    return this.quill.getContents();
  }

  // 重置编辑器
  reset() {
    this.quill.setContents([]);
    this.updateWordCount();
  }

  // 检查是否有内容
  hasContent() {
    return this.getText().length > 0;
  }
}

// 导出默认编辑器实例
export default EditorManager;
