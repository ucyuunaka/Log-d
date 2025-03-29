const express = require('express');
const path = require('path');
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');

// 创建 Express 应用
const app = express();
const port = process.env.PORT || 3000;

// 创建 LiveReload 服务器，监视项目文件变化
const liveReloadServer = livereload.createServer({
  // 排除某些文件夹/文件以避免不必要的刷新
  exts: ['html', 'css', 'js', 'png', 'jpg', 'jpeg', 'gif'],
  debug: true
});

// 监视当前目录下的所有文件
liveReloadServer.watch(path.join(__dirname));

// 注入 LiveReload 脚本到所有 HTML 请求
app.use(connectLivereload());

// 提供静态文件
app.use(express.static(__dirname));

// 所有路由都返回 index.html (单页应用支持)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
app.listen(port, () => {
  console.log(`墨记服务器已启动: http://localhost:${port}`);
  console.log('Live Reload 功能已启用');
  console.log('按 Ctrl+C 停止服务器');
});
