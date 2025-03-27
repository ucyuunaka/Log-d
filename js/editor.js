class RichEditor {
  constructor() {
    this.editor = document.getElementById('editor');
    this.initPasteHandler();
    this.uploadBtn = this.initImageUpload();
    this.setupToolbar();
  }

  setupToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'image-upload-toolbar';
    
    const uploadButton = document.createElement('button');
    uploadButton.textContent = '上传图片';
    uploadButton.addEventListener('click', () => this.uploadBtn.click());
    
    toolbar.appendChild(uploadButton);
    this.editor.before(toolbar);
  }

  initPasteHandler() {
    this.editor.addEventListener('paste', (e) => {
      const items = e.clipboardData.items;
      for (let item of items) {
        if (item.type.indexOf('image') === 0) {
          this.handleImage(item.getAsFile());
          e.preventDefault();
        }
      }
    });
  }

  initImageUpload() {
    const uploadBtn = document.createElement('input');
    uploadBtn.type = 'file';
    uploadBtn.accept = 'image/*';
    uploadBtn.style.display = 'none';
    document.body.appendChild(uploadBtn);

    // 移除直接绑定到编辑器的点击事件

    uploadBtn.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleImage(file);
    });
  }

  handleImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.maxWidth = '100%';
      this.insertAtCursor(img);
    };
    reader.readAsDataURL(file);
  }

  insertAtCursor(node) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.insertNode(node);
      range.setStartAfter(node);
    } else {
      this.editor.appendChild(node);
    }
  }

  getTimestamp() {
    const now = new Date();
    return `[${now.toISOString().replace('T', ' ').substr(0, 19)}]`;
  }

  getContent() {
    return {
      html: this.editor.innerHTML,
      timestamp: this.getTimestamp(),
      text: this.editor.innerText
    };
  }
}

window.editor = new RichEditor();