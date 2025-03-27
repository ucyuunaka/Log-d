// 初始化Quill编辑器
const quill = new Quill('#editor-container', {
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      ['image']
    ]
  },
  placeholder: '请输入日志内容...',
  theme: 'snow'
});

// 日志存储键名
const LOG_STORAGE_KEY = 'userLogs';

// 图片处理函数
function convertImageToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// 保存日志
document.getElementById('saveLog').addEventListener('click', async () => {
  try {
    const delta = quill.getContents();
    const timestamp = new Date().toLocaleString('zh-CN');
    
    // 转换图片为Base64
    const images = await Promise.all(
      delta.ops
        .filter(op => op.insert.image)
        .map(async op => ({
          ...op,
          insert: {
            image: await convertImageToBase64(
              await fetch(op.insert.image).then(r => r.blob())
            )
          }
        }))
    );

    const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
    logs.unshift({
      timestamp,
      content: { ops: images },
      html: quill.root.innerHTML
    });

    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    showStatus('✅ 日志保存成功', 2000);
    refreshLogList();
  } catch (error) {
    showStatus('❌ 保存失败：' + error.message, 3000);
  }
});

// 显示状态提示
function showStatus(message, duration) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  setTimeout(() => statusEl.textContent = '', duration);
}

// 刷新日志列表
function refreshLogList() {
  const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  const listEl = document.getElementById('logList');
  
  listEl.innerHTML = logs.map((log, index) => `
    <div class="log-item">
      <time>${log.timestamp}</time>
      <div class="preview">${log.html.substring(0, 50)}...</div>
      <button onclick="deleteLog(${index})">删除</button>
    </div>
  `).join('');
}

// 删除日志
window.deleteLog = (index) => {
  const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
  logs.splice(index, 1);
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  refreshLogList();
  showStatus('🗑️ 日志已删除', 1500);
};

// 初始化加载日志
refreshLogList();