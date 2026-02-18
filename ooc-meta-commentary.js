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
async function openConfigDialog() {
    const { Popup } = SillyTavern.getContext();
    const config = getConfig();

    const html = `
        <div style="padding: 20px; min-width: 400px;">
            <h3 style="margin: 0 0 15px 0;">OOC 元评论配置</h3>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">API 地址</label>
                <input id="ooc_apiUrl" type="text" value="${config.apiUrl}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">API Key * (必填)</label>
                <input id="ooc_apiKey" type="password" value="${config.apiKey}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">模型名称</label>
                <input id="ooc_model" type="text" value="${config.model}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">折叠框标签</label>
                <input id="ooc_detailsLabel" type="text" value="${config.detailsLabel}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="ooc_cancelBtn"
                    style="padding: 8px 16px; background: #555; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    取消
                </button>
                <button id="ooc_saveBtn"
                    style="padding: 8px 16px; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    保存
                </button>
            </div>
        </div>
    `;

    // 优先使用新 API，回退到旧 API
    if (Popup && Popup.show) {
        await Popup.show.text('OOC 元评论配置', html);
        bindDialogEvents();
    } else if (typeof callGenericPopup === 'function') {
        callGenericPopup(html, 'text', '');
        bindDialogEvents();
    } else {
        console.error('[OOC 元评论] 无法打开弹窗: Popup 和 callGenericPopup 都不可用');
        toastr.error('无法打开配置窗口', 'OOC 元评论');
    }

    function bindDialogEvents() {
        setTimeout(() => {
            const saveBtn = document.getElementById('ooc_saveBtn');
            const cancelBtn = document.getElementById('ooc_cancelBtn');

            if (saveBtn) {
                saveBtn.onclick = () => {
                    const newConfig = {
                        apiUrl: document.getElementById('ooc_apiUrl')?.value || DEFAULT_CONFIG.apiUrl,
                        apiKey: document.getElementById('ooc_apiKey')?.value || '',
                        model: document.getElementById('ooc_model')?.value || DEFAULT_CONFIG.model,
                        detailsLabel: document.getElementById('ooc_detailsLabel')?.value || DEFAULT_CONFIG.detailsLabel
                    };

                    if (!newConfig.apiKey) {
                        toastr.error('API Key 不能为空！', 'OOC 元评论');
                        return;
                    }

                    if (saveConfig(newConfig)) {
                        toastr.success('配置已保存！', 'OOC 元评论');
                        if (Popup && Popup.show) {
                            // Popup 会自动关闭
                        } else if (typeof closeGenericPopup === 'function') {
                            closeGenericPopup();
                        }
                    } else {
                        toastr.error('配置保存失败！', 'OOC 元评论');
                    }
                };
            }

            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    if (Popup && Popup.show) {
                        // Popup 会自动关闭
                    } else if (typeof closeGenericPopup === 'function') {
                        closeGenericPopup();
                    }
                };
            }
        }, 100);
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
    const config = getConfig();
    return `\n\n<details>\n<summary>${config.detailsLabel}</summary>\n\n${content}\n\n</details>`;
}

// 调用 API
async function callApi(prompt) {
    const config = getConfig();

    if (!config.apiKey) {
        console.error('[OOC 元评论] API Key 未配置！');
        toastr.warning('请输入 /oocedit 命令来配置 API Key', 'OOC 元评论 - 需要配置');
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

// ========== 注册斜杠命令 ==========
function registerSlashCommand() {
    try {
        if (typeof SlashCommandParser !== 'undefined' && typeof SlashCommand !== 'undefined') {
            SlashCommandParser.addCommandObject(SlashCommand.fromProps({
                name: 'oocedit',
                callback: () => {
                    setTimeout(() => openConfigDialog(), 100);
                    return '';
                },
                aliases: ['oocedit'],
                returns: '',
                namedArgumentList: [],
                helpString: '打开 OOC 元评论配置'
            }));
            console.log('[OOC 元评论] 斜杠命令已注册: /oocedit');
        } else if (typeof registerMacroLike === 'function') {
            registerMacroLike(
                /^\/oocedit$/i,
                () => {
                    setTimeout(() => openConfigDialog(), 100);
                    return '';
                }
            );
            console.log('[OOC 元评论] 斜杠命令已注册 (旧 API): /oocedit');
        } else {
            console.warn('[OOC 元评论] 无法注册斜杠命令: 所有 API 都不可用');
        }
    } catch (e) {
        console.error('[OOC 元评论] 注册斜杠命令失败:', e);
    }
}

// 尝试立即注册，如果失败则在 APP_READY 后重试
function tryRegisterCommand() {
    try {
        registerSlashCommand();
    } catch (e) {
        // 延迟重试
        setTimeout(registerSlashCommand, 1000);
    }
}

// 如果 SillyTavern 已就绪，立即注册；否则等待 APP_READY 事件
if (typeof SillyTavern !== 'undefined') {
    const { eventSource, event_types } = SillyTavern.getContext();
    if (eventSource && event_types) {
        eventSource.once(event_types.APP_READY, tryRegisterCommand);
    } else {
        setTimeout(tryRegisterCommand, 1000);
    }
} else {
    setTimeout(tryRegisterCommand, 1000);
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

// 注册全局配置函数（备用）
try {
    const topWindow = window.parent || window.top || window;
    topWindow.__ooc_openConfig = openConfigDialog;
    window.__ooc_openConfig = openConfigDialog;
} catch (e) {
    window.__ooc_openConfig = openConfigDialog;
}

if (!config.apiKey) {
    console.warn('[OOC 元评论] ⚠️ API Key 未配置');
    setTimeout(() => {
        toastr.info('请输入命令 <b>/oocedit</b> 来配置 API Key', 'OOC 元评论 - 首次使用需配置', { timeOut: 0, extendedTimeOut: 0, closeButton: true, tapToDismiss: false });
    }, 2000);
}
