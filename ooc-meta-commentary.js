console.log('=== OOC 脚本开始加载 ===');

// ========== 配置管理 ==========
const CONFIG_STORAGE_KEY = 'ooc_meta_commentary_config';

// 默认配置
const DEFAULT_CONFIG = {
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-ai/DeepSeek-V3',
    detailsLabel: '📝 OOC 元评论'
};

// 从 localStorage 读取配置
function getConfig() {
    try {
        const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (saved) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('[OOC 元评论] 读取配置失败:', e);
    }
    return { ...DEFAULT_CONFIG };
}

// 保存配置到 localStorage
function saveConfig(config) {
    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
        return true;
    } catch (e) {
        console.error('[OOC 元评论] 保存配置失败:', e);
        return false;
    }
}

// 打开配置弹窗
function openConfigDialog() {
    const config = getConfig();

    const html = `
        <div style="padding: 20px; min-width: 400px;">
            <h3 style="margin: 0 0 15px 0;">OOC 元评论配置</h3>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">API 地址</label>
                <input id="ooc apiUrl" type="text" value="${config.apiUrl}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">API Key * (必填)</label>
                <input id="ooc apiKey" type="password" value="${config.apiKey}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">模型名称</label>
                <input id="ooc model" type="text" value="${config.model}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">折叠框标签</label>
                <input id="ooc detailsLabel" type="text" value="${config.detailsLabel}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="ooc cancelBtn"
                    style="padding: 8px 16px; background: #555; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    取消
                </button>
                <button id="ooc saveBtn"
                    style="padding: 8px 16px; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    保存
                </button>
            </div>
        </div>
    `;

    callGenericPopup(html, 'text', '');

    // 等待DOM插入后绑定事件
    setTimeout(() => {
        const saveBtn = document.getElementById('ooc saveBtn');
        const cancelBtn = document.getElementById('ooc cancelBtn');

        if (saveBtn) {
            saveBtn.onclick = () => {
                const newConfig = {
                    apiUrl: document.getElementById('ooc apiUrl')?.value || DEFAULT_CONFIG.apiUrl,
                    apiKey: document.getElementById('ooc apiKey')?.value || '',
                    model: document.getElementById('ooc model')?.value || DEFAULT_CONFIG.model,
                    detailsLabel: document.getElementById('ooc detailsLabel')?.value || DEFAULT_CONFIG.detailsLabel
                };

                if (!newConfig.apiKey) {
                    toastr.error('API Key 不能为空！', 'OOC 元评论');
                    return;
                }

                if (saveConfig(newConfig)) {
                    toastr.success('配置已保存！', 'OOC 元评论');
                    closeGenericPopup();
                } else {
                    toastr.error('配置保存失败！', 'OOC 元评论');
                }
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                closeGenericPopup();
            };
        }
    }, 100);
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
    const config = getConfig();
    return `\n\n<details>\n<summary>${config.detailsLabel}</summary>\n\n${content}\n\n</details>`;
}

// 调用 API
async function callApi(prompt) {
    const config = getConfig();

    if (!config.apiKey) {
        console.error('[OOC 元评论] API Key 未配置！');
        // 尝试多种方式提示配置
        toastr.warning('<a href="#" style="color: #fff; text-decoration: underline;" onclick="window.__ooc_openConfig?.(); return false;">点击此处配置 API Key</a>', 'OOC 元评论 - 需要配置', { timeOut: 0, extendedTimeOut: 0, closeButton: true });
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
        toastr.error(error.message || 'API 调用失败，请检查配置', 'OOC 元评论');
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
const config = getConfig();
console.log('[OOC 元评论] 脚本已加载');
console.log('[OOC 元评论] 当前配置:', config.model, '@', config.apiUrl);

// 注册全局配置函数到所有可访问的窗口
try {
    // 尝试注册到顶层窗口
    const topWindow = window.parent || window.top || window;
    topWindow.__ooc_openConfig = openConfigDialog;
    // 也注册到当前窗口（备用）
    window.__ooc_openConfig = openConfigDialog;
    console.log('[OOC 元评论] 配置函数已注册');
} catch (e) {
    // 如果无法访问顶层窗口，只注册到当前窗口
    window.__ooc_openConfig = openConfigDialog;
    console.log('[OOC 元评论] 配置函数已注册（本地窗口）');
}

if (!config.apiKey) {
    console.warn('[OOC 元评论] ⚠️ API Key 未配置');
    // 延迟显示提示，确保页面加载完成
    setTimeout(() => {
        toastr.info('<a href="#" style="color: #fff; text-decoration: underline;" onclick="window.__ooc_openConfig?.(); return false;">点击此处配置 API Key</a>', 'OOC 元评论 - 首次使用需配置', { timeOut: 0, extendedTimeOut: 0, closeButton: true, tapToDismiss: false });
    }, 2000);
}
