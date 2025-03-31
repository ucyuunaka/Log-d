// 键盘快捷键管理模块

export class KeyboardShortcutsManager {
  constructor(options = {}) {
    this.app = options.app;
    this.eventHandlers = options.eventHandlers;
    this.toastContainer = options.toastContainer;
    
    this.shortcuts = [
      { key: 's', ctrl: true, desc: '保存日志', action: this.saveLog.bind(this) },
      { key: 'n', ctrl: true, desc: '新建/重置', action: this.resetEditor.bind(this) },
      { key: 'f', ctrl: true, desc: '全屏编辑', action: this.toggleFullscreen.bind(this) },
      { key: '/', ctrl: true, desc: '聚焦搜索框', action: this.focusSearch.bind(this) },
      { key: 'h', ctrl: true, desc: '显示帮助', action: this.showHelp.bind(this) },
      { key: 'b', ctrl: true, desc: '创建备份', action: this.createBackup.bind(this) },
      { key: 'e', ctrl: true, desc: '导出日志', action: this.exportLogs.bind(this) }
    ];
    
    this.init();
  }
  
  init() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // 创建快捷键帮助面板
    this.createHelpPanel();
  }
  
  handleKeyDown(e) {
    // 不处理输入框内的快捷键，除非特别指定
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.classList.contains('ql-editor')) {
      // 仅处理ctrl+s (保存)
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        this.saveLog(e);
        return;
      }
      return;
    }
    
    // 查找匹配的快捷键
    const shortcut = this.shortcuts.find(s => 
      s.key.toLowerCase() === e.key.toLowerCase() && 
      !!s.ctrl === e.ctrlKey
    );
    
    if (shortcut) {
      e.preventDefault();
      shortcut.action(e);
    }
  }
  
  // 快捷键处理函数
  saveLog(e) {
    e.preventDefault();
    this.eventHandlers.saveLog();
  }
  
  resetEditor(e) {
    e.preventDefault();
    this.eventHandlers.resetEditorAndImages();
  }
  
  toggleFullscreen(e) {
    e.preventDefault();
    this.app.toggleFullscreenEditor();
  }
  
  focusSearch(e) {
    e.preventDefault();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
  
  showHelp(e) {
    e.preventDefault();
    this.toggleHelpPanel();
  }
  
  createBackup(e) {
    e.preventDefault();
    // 显示备份面板
    const backupsModal = document.getElementById('backupsModal');
    if (backupsModal) backupsModal.classList.add('active');
  }
  
  exportLogs(e) {
    e.preventDefault();
    // 调用导出功能
    try {
      const { exportLogsToJSON } = require('./utils.js');
      exportLogsToJSON();
      this.showToast('日志已成功导出', 'success');
    } catch (error) {
      this.showToast('导出日志失败: ' + error.message, 'error');
    }
  }
  
  // 创建快捷键帮助面板
  createHelpPanel() {
    // 检查是否已存在
    if (document.getElementById('shortcutsHelp')) return;
    
    const helpPanel = document.createElement('div');
    helpPanel.id = 'shortcutsHelp';
    helpPanel.className = 'shortcuts-help';
    
    helpPanel.innerHTML = `
      <div class="shortcuts-header">
        <h3><i class="fas fa-keyboard"></i> 键盘快捷键</h3>
        <button class="close-shortcuts"><i class="fas fa-times"></i></button>
      </div>
      <div class="shortcuts-list">
        ${this.shortcuts.map(shortcut => `
          <div class="shortcut-item">
            <div class="key-combo">
              ${shortcut.ctrl ? '<kbd>Ctrl</kbd> + ' : ''}
              <kbd>${shortcut.key.toUpperCase()}</kbd>
            </div>
            <div class="key-desc">${shortcut.desc}</div>
          </div>
        `).join('')}
      </div>
    `;
    
    document.body.appendChild(helpPanel);
    
    // 添加关闭按钮事件
    const closeBtn = helpPanel.querySelector('.close-shortcuts');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        helpPanel.classList.remove('active');
      });
    }
  }
  
  // 切换帮助面板显示状态
  toggleHelpPanel() {
    const helpPanel = document.getElementById('shortcutsHelp');
    if (helpPanel) {
      helpPanel.classList.toggle('active');
    }
  }
  
  // 显示提示消息
  showToast(message, type) {
    if (this.app && typeof this.app.showToast === 'function') {
      this.app.showToast(message, type);
    } else if (this.toastContainer) {
      const { showToast } = require('./utils.js');
      showToast(message, type, this.toastContainer);
    }
  }
}

export default KeyboardShortcutsManager;
