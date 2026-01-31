# OOC 元评论生成器

一个 SillyTavern 酒馆助手脚本，检测用户消息中的 `<ooc>` 标签，调用独立 API 生成元评论，自动追加到 AI 回复末尾。

## 功能

- 📝 **自动检测 OOC 内容**：监听用户消息中的 `<ooc>` 标签
- 🤖 **独立 API 调用**：使用 OpenAI 兼容 API（如 Gemini Flash）生成元评论
- 📋 **上下文感知**：结合用户的 OOC 内容和 AI 的剧情回复进行分析
- 🎯 **自动追加**：将生成的元评论用 `<details>` 折叠框包裹，追加到回复末尾
- ⚙️ **可视化配置**：内置配置弹窗，无需修改代码

## 使用方法

### 1. 导入脚本

在酒馆助手中导入 `ooc-meta-commentary.json`，启用脚本开关。

### 2. 配置 API

**首次使用时**：
1. 打开浏览器控制台（F12）
2. 输入 `__ooc_openConfig()` 并回车
3. 在弹出的配置窗口中填写：
   - **API 地址**：你的 API 端点（有默认值）
   - **API Key**：你的 API 密钥（必填）
   - **模型名称**：使用的模型（有默认值）
   - **折叠框标签**：显示的标签文字（有默认值）
4. 点击"保存"

**重新配置**：
- 随时在控制台输入 `__ooc_openConfig()` 修改配置

### 3. 配置示例

**OpenAI:**
```
API 地址: https://api.openai.com/v1/chat/completions
模型名称: gpt-4o-mini
```

**Gemini (OpenAI 兼容):**
```
API 地址: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
模型名称: gemini-2.0-flash-exp
```

**SiliconFlow:**
```
API 地址: https://api.siliconflow.cn/v1/chat/completions
模型名称: deepseek-ai/DeepSeek-V3
```

**其他兼容 API:**
修改对应的 API 地址和模型名称即可

### 4. 使用 OOC 标签

在消息中使用 `<ooc>` 标签：

```
（摸摸头）

<ooc>这个角色性格怎么样？</ooc>
```

AI 回复完成后，会自动追加元评论折叠框。

## 工作流程

```
用户发送 <ooc>内容</ooc>
       ↓
主 AI 生成剧情回复
       ↓
脚本调用独立 API 生成元评论
       ↓
追加 <details> 折叠框到回复末尾
```

## 安装

### 通过酒馆助手导入

1. 下载本仓库的 `ooc-meta-commentary.json` 文件
2. 在酒馆助手界面导入该文件
3. 启用脚本

### CDN 导入（推荐）

脚本已托管在 jsDelivr CDN，通过以下方式导入：

```json
{
  "type": "script",
  "enabled": false,
  "name": "OOC 元评论生成器",
  "id": "ooc-meta-commentary-001",
  "content": "import 'https://cdn.jsdelivr.net/gh/CagierAsh123/silly-ooc@main/ooc-meta-commentary.js'",
  ...
}
```

## 注意事项

1. **首次使用**：需要在浏览器控制台输入 `__ooc_openConfig()` 配置 API Key
2. **配置存储**：配置保存在浏览器 localStorage 中，刷新页面后保留
3. **网络访问**：确保 API 端点可访问
4. **响应时间**：元评论生成需要额外时间，请耐心等待
5. **错误排查**：如果 API 调用失败，查看浏览器控制台错误信息

## 许可证

MIT
