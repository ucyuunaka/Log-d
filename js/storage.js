class StorageSystem {
  constructor() {
    this.logs = JSON.parse(localStorage.getItem('logs')) || [];
  }

  // 保存日志到localStorage并备份到TXT
  async saveLog(logEntry) {
    this.logs.unshift(logEntry);
    localStorage.setItem('logs', JSON.stringify(this.logs));
    
    // 构建TXT内容
    const txtContent = this.formatLogEntry(logEntry);
    
    try {
      // 尝试使用File System Access API追加内容
      const handle = await window.showSaveFilePicker({
        suggestedName: 'mmc日志.txt',
        types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] }}]
      });
      
      const file = await handle.getFile();
      const existingContent = await file.text();
      const writable = await handle.createWritable();
      await writable.write(existingContent + txtContent);
      await writable.close();
    } catch (err) {
      // 降级方案：直接下载
      const blob = new Blob([txtContent], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'mmc日志.txt';
      link.click();
    }
  }

  // 格式化日志条目
  formatLogEntry(logEntry) {
    const tags = logEntry.tags.map(t => `#${t}`).join(' ');
    return `
[${logEntry.timestamp}] ${tags}
${logEntry.text.replace(/\n/g, '
')}
---
`;
  }

  // 删除日志
  deleteLog(index) {
    this.logs.splice(index, 1);
    localStorage.setItem('logs', JSON.stringify(this.logs));
  }
}

window.storageSystem = new StorageSystem();