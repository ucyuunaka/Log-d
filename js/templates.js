class TemplateSystem {
  constructor() {
    this.templates = {
      task: '我完成了______任务',
      todo: '______待完成',
      followup: '需跟进：______'
    };
    this.initTemplateButtons();
  }

  initTemplateButtons() {
    document.querySelectorAll('.template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const templateType = e.target.dataset.template;
        this.insertTemplate(templateType);
      });
    });
  }

  insertTemplate(type) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(this.templates[type]));
    } else {
      editor.editor.textContent += this.templates[type];
    }
    editor.editor.focus();
  }
}

window.templateSystem = new TemplateSystem();