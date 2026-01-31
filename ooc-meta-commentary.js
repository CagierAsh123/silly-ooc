console.log('=== OOC 脚本开始加载 ===');

// ========== 配置区 ==========
// 从酒馆助手变量读取配置，如果没有则使用默认值
function getConfig() {
    const variables = getVariables({ type: 'script', script_id: getScriptId() }) || {};

    return {
        apiUrl: variables.apiUrl || 'https://api.siliconflow.cn/v1/chat/completions',
        apiKey: variables.apiKey || '',
        model: variables.model || 'deepseek-ai/DeepSeek-V3',
        detailsLabel: variables.detailsLabel || '📝 OOC 元评论'
    };
}

// 获取配置（每次使用时重新读取，支持动态更新）
function CONFIG() {
    return getConfig();
}

// 初始化默认配置
function initConfig() {
    const variables = getVariables({ type: 'script', script_id: getScriptId() }) || {};
    let needsUpdate = false;

    if (!variables.apiUrl) {
        variables.apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
        needsUpdate = true;
    }
    if (!variables.model) {
        variables.model = 'deepseek-ai/DeepSeek-V3';
        needsUpdate = true;
    }
    if (!variables.detailsLabel) {
        variables.detailsLabel = '📝 OOC 元评论';
        needsUpdate = true;
    }
    // apiKey 不设置默认值，让用户自己配置

    if (needsUpdate) {
        insertVariables(variables, { type: 'script', script_id: getScriptId() });
    }
}

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
    return `\n\n<details>\n<summary>${CONFIG().detailsLabel}</summary>\n\n${content}\n\n</details>`;
}

// 调用 API
async function callApi(prompt) {
    const config = CONFIG();

    if (!config.apiKey) {
        console.error('[OOC 元评论] API Key 未配置！');
        toastr.warning('请先在酒馆助手脚本设置中配置 API Key', 'OOC 元评论');
        return null;
    }

    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
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

// ========== 初始化 ==========
initConfig();
const config = CONFIG();
console.log('[OOC 元评论] 脚本已加载');
console.log('[OOC 元评论] 当前配置:', config.model, '@', config.apiUrl);
if (!config.apiKey) {
    console.warn('[OOC 元评论] ⚠️ 请在酒馆助手脚本设置中配置 API Key');
    toastr.info('请在脚本设置中配置 API Key 后使用', 'OOC 元评论');
}
