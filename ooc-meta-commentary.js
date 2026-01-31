console.log('=== OOC 脚本开始加载 ===');

// ========== 配置区 ==========
const CONFIG = {
    // API 配置（请修改为你的配置）
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: 'YOUR_API_KEY_HERE',
    model: 'deepseek-ai/DeepSeek-V3',

    // 折叠框标签
    detailsLabel: '📝 OOC 元评论'
};

// 提示词模板
const PROMPT_TEMPLATE = `你是一个元评论助手。请分析以下用户在角色扮演中的OOC（角色外）评论，并结合AI的剧情回复，提供一个简短的建设性反馈。

用户OOC内容：
{userOoc}

AI剧情回复：
{aiResponse}

请提供：
1. 对用户OOC意图的理解
2. 简短的建议或观察

回复要简洁（50字以内），友好且有帮助。`;

// ========== 状态管理 ==========
let state = {
    pendingOocContent: null
};

// ========== 工具函数 ==========

// 提取 OOC 内容
function extractOocContent(text) {
    const oocRegex = /<ooc>([\s\S]*?)<\/ooc>/i;
    const match = text.match(oocRegex);
    return match ? match[1].trim() : null;
}

// 生成折叠框 HTML
function generateDetails(content) {
    return `\n\n<details>\n<summary>${CONFIG.detailsLabel}</summary>\n\n${content}\n\n</details>`;
}

// 调用 API
async function callApi(prompt) {
    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200
            })
        });

        if (!response.ok) {
            throw new Error(`API 错误: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (error) {
        console.error('[OOC 元评论] API 调用失败:', error);
        return null;
    }
}

// ========== 事件处理 ==========
console.log('[OOC 元评论] 开始注册事件监听...');

// 监听消息发送事件
eventOn(tavern_events.MESSAGE_SENT, async (messageId) => {
    try {
        console.log('[OOC 元评论] MESSAGE_SENT 事件触发, messageId:', messageId);
        const messages = getChatMessages(messageId);
        if (!messages || messages.length === 0) {
            return;
        }

        const userMessage = messages[0];
        const oocContent = extractOocContent(userMessage.message);

        if (oocContent) {
            state.pendingOocContent = oocContent;
            console.log('[OOC 元评论] 检测到 OOC 内容:', oocContent);
        }
    } catch (error) {
        console.error('[OOC 元评论] MESSAGE_SENT 处理错误:', error);
    }
});

// 监听消息接收事件
eventOn(tavern_events.MESSAGE_RECEIVED, async (messageId) => {
    console.log('[OOC 元评论] MESSAGE_RECEIVED 事件触发, messageId:', messageId);

    if (!state.pendingOocContent) {
        return;
    }

    try {
        const messages = getChatMessages(messageId);
        if (!messages || messages.length === 0) {
            return;
        }

        const aiMessage = messages[0];
        const aiResponse = aiMessage.message;

        if (!aiResponse) {
            return;
        }

        console.log('[OOC 元评论] AI 回复完成，正在生成元评论...');

        // 构建提示词
        const prompt = PROMPT_TEMPLATE
            .replace('{userOoc}', state.pendingOocContent)
            .replace('{aiResponse}', aiResponse);

        // 调用 API
        const commentary = await callApi(prompt);

        if (commentary) {
            const enhancedResponse = aiResponse + generateDetails(commentary);

            // 更新消息
            setChatMessages([
                { message_id: messageId, message: enhancedResponse }
            ]);

            console.log('[OOC 元评论] 元评论已追加');
        }

        // 重置状态
        state.pendingOocContent = null;

    } catch (error) {
        console.error('[OOC 元评论] MESSAGE_RECEIVED 处理错误:', error);
        state.pendingOocContent = null;
    }
});

console.log('[OOC 元评论] 事件监听注册完成');

// ========== 初始化日志 ==========
console.log('[OOC 元评论] 脚本已加载');
console.log('[OOC 元评论] 当前配置:', CONFIG.model, '@', CONFIG.apiUrl);
console.log('[OOC 元评论] 请确保已配置正确的 API Key');
