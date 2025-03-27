// 标签管理系统
class TagSystem {
  constructor() {
    this.tags = JSON.parse(localStorage.getItem('tags')) || [];
    this.colorPalette = ['#ff7675', '#74b9ff', '#55efc4', '#a29bfe', '#ffeaa7'];
    this.initEventListeners();
  }

  initEventListeners() {
    document.getElementById('newTagBtn').addEventListener('click', () => this.createTag());
  }

  createTag() {
    const tagName = prompt('请输入新标签名称：');
    if (tagName && !this.tags.some(t => t.name === tagName)) {
      const newTag = {
        name: tagName,
        color: this.getNextColor(),
        selected: false
      };
      this.tags.push(newTag);
      this.saveTags();
      this.renderTags();
    }
  }

  getNextColor() {
    const usedColors = new Set(this.tags.map(t => t.color));
    return this.colorPalette.find(c => !usedColors.has(c)) || 
      this.colorPalette[this.tags.length % this.colorPalette.length];
  }

  saveTags() {
    localStorage.setItem('tags', JSON.stringify(this.tags));
  }

  renderTags() {
    const container = document.getElementById('tagList');
    container.innerHTML = this.tags.map((tag, index) => 
      `<div class="tag-item tag-color-${index % 5 + 1}" data-index="${index}">
        <span class="color-dot" style="background:${tag.color}"></span>
        ${tag.name}
        <span class="checkmark">${tag.selected ? '✓' : ''}</span>
      </div>`
    ).join('');

    container.querySelectorAll('.tag-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const index = parseInt(item.dataset.index);
        this.tags[index].selected = !this.tags[index].selected;
        this.saveTags();
        item.querySelector('.checkmark').textContent = this.tags[index].selected ? '✓' : '';
        item.classList.toggle('selected');
      });
    });
  }
}

// 初始化标签系统
window.tagSystem = new TagSystem();
window.addEventListener('DOMContentLoaded', () => window.tagSystem.renderTags());