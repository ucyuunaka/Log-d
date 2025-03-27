/**
 * 富文本编辑器模块
 * 负责初始化Quill编辑器并处理图片上传功能
 */

class Editor {
    constructor() {
        this.quill = null;
        this.init();
    }

    /**
     * 初始化Quill编辑器
     */
    init() {
        // 配置Quill工具栏选项
        const toolbarOptions = [
            ['bold', 'italic', 'underline', 'strike'],        // 文字格式
            ['blockquote', 'code-block'],                     // 引用和代码块
            [{ 'header': 1 }, { 'header': 2 }],               // 标题
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],     // 列表
            [{ 'script': 'sub'}, { 'script': 'super' }],       // 上标/下标
            [{ 'indent': '-1'}, { 'indent': '+1' }],          // 缩进
            [{ 'size': ['small', false, 'large', 'huge'] }],   // 字体大小
            [{ 'color': [] }, { 'background': [] }],           // 字体颜色和背景色
            [{ 'font': [] }],                                  // 字体
            [{ 'align': [] }],                                 // 对齐方式
            ['clean'],                                         // 清除格式
            ['image']                                          // 图片上传按钮
        ];

        // 初始化Quill编辑器
        this.quill = new Quill('#editor', {
            modules: {
                toolbar: toolbarOptions
            },
            placeholder: '请输入日志内容...',
            theme: 'snow'
        });

        // 设置图片上传处理
        this.setupImageUpload();

        // 设置清空编辑器按钮
        document.getElementById('clear-editor').addEventListener('click', () => {
            this.clearEditor();
        });
    }

    /**
     * 设置图片上传功能
     * 支持点击上传和粘贴上传
     */
    setupImageUpload() {
        // 获取工具栏中的图片按钮
        const toolbar = this.quill.getModule('toolbar');
        toolbar.addHandler('image', () => {
            // 创建隐藏的文件输入
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.click();

            // 监听文件选择
            input.onchange = () => {
                if (input.files != null && input.files[0] != null) {
                    this.uploadImage(input.files[0]);
                }
            };
        });

        // 监听粘贴事件
        this.quill.root.addEventListener('paste', (e) => {
            const clipboardData = e.clipboardData || window.clipboardData;
            if (clipboardData && clipboardData.items) {
                for (let i = 0; i < clipboardData.items.length; i++) {
                    if (clipboardData.items[i].type.indexOf('image') !== -1) {
                        const file = clipboardData.items[i].getAsFile();
                        this.uploadImage(file);
                        e.preventDefault(); // 阻止默认粘贴行为
                        break;
                    }
                }
            }
        });
    }

    /**
     * 上传图片并插入到编辑器
     * @param {File} file - 图片文件
     */
    uploadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const range = this.quill.getSelection(true);
            this.quill.insertEmbed(range.index, 'image', e.target.result, 'user');
            this.quill.setSelection(range.index + 1);
        };
        reader.readAsDataURL(file);
    }

    /**
     * 获取编辑器内容
     * @returns {Object} 包含HTML和Delta格式的内容
     */
    getContent() {
        return {
            html: this.quill.root.innerHTML,
            delta: this.quill.getContents(),
            text: this.quill.getText()
        };
    }

    /**
     * 设置编辑器内容
     * @param {Object} content - 编辑器内容对象
     */
    setContent(content) {
        if (content.delta) {
            this.quill.setContents(content.delta);
        } else if (content.html) {
            this.quill.root.innerHTML = content.html;
        }
    }

    /**
     * 清空编辑器内容
     */
    clearEditor() {
        this.quill.setText('');
    }
}

// 导出编辑器类
window.Editor = Editor;