// 主入口文件
document.addEventListener('DOMContentLoaded', () => {
  // 初始化所有模块
  window.tagSystem = new TagSystem();
  window.editor = new RichEditor();
  window.templateSystem = new TemplateSystem();
  window.storageSystem = new StorageSystem();

  // 保存日志事件
  document.getElementById('saveLog').addEventListener('click', () => {
    const content = editor.getContent();
    const selectedTags = tagSystem.tags
      .filter(t => t.selected)
      .map(t => t.name);

    const logEntry = {
      ...content,
      tags: selectedTags
    };

    storageSystem.saveLog(logEntry);
    editor.editor.innerHTML = ''; // 清空编辑器
    renderLogList();
  });

  // 初始化日志列表
  const renderLogList = () => {
    const container = document.getElementById('logList');
    container.innerHTML = storageSystem.logs.map((log, index) => 
      `<div class="log-item">
        <div class="log-header">
          <span class="log-time">${log.timestamp}</span>
          ${log.tags.map(t => `<span class="log-tag" style="background:${tagSystem.tags.find(tag => tag.name === t)?.color}">${t}</span>`).join('')}
        </div>
        <div class="log-preview">${log.text.substring(0, 30)}...</div>
        <button class="delete-btn" data-index="${index}">删除</button>
      </div>`
    ).join('');

    // 绑定删除事件
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        storageSystem.deleteLog(index);
        renderLogList();
      });
    });
  };

  // 初始渲染
  tagSystem.renderTags();
  renderLogList();
});