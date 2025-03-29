# Log-d 应用架构

## 项目结构

```
Log-d/
├── components/            # HTML组件
│   ├── header.html        # 头部组件
│   ├── editor.html        # 编辑器组件
│   ├── image-upload.html  # 图片上传组件
│   ├── logs-list.html     # 日志列表组件
│   ├── footer.html        # 页脚组件
│   └── modals.html        # 各种模态框组件
│
├── css/                   # 样式文件
│   ├── base.css           # 基础样式和变量
│   ├── components.css     # UI组件样式
│   ├── editor.css         # 编辑器相关样式
│   ├── layout.css         # 布局样式
│   └── style.css          # 主样式文件(导入其他CSS)
│
├── js/                    # JavaScript模块
│   ├── app.js             # 应用入口和初始化
│   ├── component-loader.js # 组件加载器
│   ├── editor.js          # 编辑器管理
│   ├── event-handlers.js  # 事件处理器
│   ├── image-manager.js   # 图片处理管理
│   ├── log-manager.js     # 日志管理器
│   ├── state-manager.js   # 状态管理
│   └── utils.js           # 工具函数
│
├── index.html             # 主HTML文件(组件容器)
└── README.md              # 项目说明
```

## 架构说明

### 组件化架构

Log-d 采用组件化架构，将UI拆分为多个独立的HTML组件，通过组件加载器动态加载。这种方式有以下优势：

1. **高内聚低耦合**：每个组件只关注自己的职责
2. **易于维护**：可以单独修改某个组件而不影响其他部分
3. **按需加载**：可以根据需要动态加载组件
4. **清晰的文件结构**：避免单个文件过大

### 核心模块

- **ComponentLoader**: 负责动态加载HTML组件
- **StateManager**: 管理应用状态，避免全局变量
- **EventHandlers**: 集中处理DOM事件
- **LogManager**: 管理日志相关操作
- **ImageManager**: 处理图片上传和显示
- **Utils**: 提供通用工具函数

### 数据流

```
用户操作 -> 事件处理器 -> 状态更新 -> UI更新
```

### 组件通信

组件之间通过以下方式通信：

1. 状态管理器共享数据
2. 自定义事件
3. 直接DOM引用(谨慎使用)

## 开发指南

### 添加新组件

1. 在 `components` 目录创建HTML组件文件
2. 在 `app.js` 中的 `componentsQueue` 添加新组件路径
3. 为组件添加相应的样式和事件处理

### 组件命名规范

- 组件文件名使用短横线命名法，如：`image-upload.html`
- 组件ID使用驼峰命名法，如：`imagePreview`
- 组件内使用有意义的类名，避免过度使用ID

### 样式管理

- 共用变量和基础样式位于 `base.css`
- 组件特定样式可以单独添加到对应的CSS文件
- 通过 `style.css` 统一导入所有样式
