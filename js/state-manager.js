// 常量定义
export const LOG_STORAGE_KEY = 'userLogs';
export const MAX_IMAGE_SIZE = 800;
export const IMAGE_QUALITY = 0.8;
export const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB

// 应用状态
class StateManager {
  constructor() {
    this.quill = null;
    this.uploadedImages = [];
    this.currentLogs = [];
    this.activeModal = null;
    this.domElements = null;
  }

  // 初始化DOM元素引用
  initDomElements(elements) {
    this.domElements = elements;
  }

  // 设置编辑器实例
  setQuill(quillInstance) {
    this.quill = quillInstance;
  }

  // 获取当前编辑器文本内容
  getEditorText() {
    return this.quill ? this.quill.getText().trim() : '';
  }

  // 获取当前编辑器HTML内容
  getEditorHTML() {
    return this.quill ? this.quill.root.innerHTML : '';
  }

  // 获取编辑器Delta内容
  getEditorDelta() {
    return this.quill ? this.quill.getContents() : null;
  }

  // 重置编辑器内容
  resetEditor() {
    if (this.quill) {
      this.quill.setContents([]);
    }
  }

  // 添加图片到上传列表
  addImages(images) {
    this.uploadedImages = [...this.uploadedImages, ...images];
    return this.uploadedImages;
  }

  // 获取所有图片
  getImages() {
    return [...this.uploadedImages];
  }

  // 移除指定索引的图片
  removeImage(index) {
    this.uploadedImages.splice(index, 1);
    return this.uploadedImages;
  }

  // 清空所有图片
  clearImages() {
    this.uploadedImages = [];
    return this.uploadedImages;
  }

  // 设置当前日志列表
  setLogs(logs) {
    this.currentLogs = logs;
    return this.currentLogs;
  }

  // 获取当前日志列表
  getLogs() {
    return [...this.currentLogs];
  }

  // 设置当前活动的模态框
  setActiveModal(modal) {
    this.activeModal = modal;
  }

  // 获取当前活动的模态框
  getActiveModal() {
    return this.activeModal;
  }

  // 检查是否有未保存内容
  hasUnsavedContent() {
    const hasText = this.getEditorText().length > 0;
    const hasImages = this.uploadedImages.length > 0;
    return hasText || hasImages;
  }

  // 重置所有状态
  resetState() {
    this.resetEditor();
    this.clearImages();
    // 不重置日志列表，因为它是从存储读取的
    this.activeModal = null;
  }
}

export default new StateManager();
