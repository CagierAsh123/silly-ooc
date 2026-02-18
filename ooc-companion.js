/**
 * OOC 旁观者插件
 * 一个像朋友一样陪你看角色扮演的AI角色
 * 可以看到聊天内容并自动评论/陪伴
 */

console.log('=== OOC 旁观者 开始加载 ===');

// ========== 配置 ==========
const OOC_COMPANION_CONFIG_KEY = 'ooc_companion_config';

const DEFAULT_OOC_CONFIG = {
    // API配置
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-ai/DeepSeek-V3',
    
    // 角色设定
    name: '旁观者',
    personality: '友善、幽默的朋友，像在旁边看你玩游戏一样',
    greeting: '嘿！今天玩什么呢？',
    
    // 功能开关
    enabled: true,
    autoReply: true,      // 自动回复
    showInDetails: true,  // 显示在折叠详情中
    replyInterval: 3,    // 每隔几条消息回复一次
    
    // 显示设置
    showFloatingButton: true,
    showInChat: false,
};

let oocCompanionState = {
    messageCount: 0,
    lastReply: '',
    isProcessing: false,
};

// ========== 配置管理 ==========
function getOocConfig() {
    try {
        const saved = localStorage.getItem(OOC_COMPANION_CONFIG_KEY);
        if (saved) {
            return { ...DEFAULT_OOC_CONFIG, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('[OOC旁观者] 读取配置失败:', e);
    }
    return { ...DEFAULT_OOC_CONFIG };
}

function saveOocConfig(config) {
    try {
        localStorage.setItem(OOC_COMPANION_CONFIG_KEY, JSON.stringify(config));
        return true;
    } catch (e) {
        console.error('[OOC旁观者] 保存配置失败:', e);
        return false;
    }
}

// ========== 获取聊天内容 ==========
function getChatContext() {
    try {
        const context = getContext();
        if (!context) return null;
        
        // 获取最近N条消息
        const chat = context.chat || [];
        const recentMessages = chat.slice(-10); // 最近10条
        
        return {
            messages: recentMessages,
            characterName: context.name1 || '角色',
            userName: context.name2 || '用户',
        };
    } catch (e) {
        console.error('[OOC旁观者] 获取聊天上下文失败:', e);
        return null;
    }
}

function formatChatHistory(chatContext) {
    if (!chatContext || !chatContext.messages) return '';
    
    return chatContext.messages.map(msg => {
        const role = msg.role === 'assistant' ? chatContext.characterName : chatContext.userName;
        let content = msg.message || msg.content || '';
        // 移除HTML标签
        content = content.replace(/<[^>]*>/g, '');
        return `${role}: ${content}`;
    }).join('\n');
}

// ========== API 调用 ==========
async function callOocApi(prompt) {
    const config = getOocConfig();
    
    if (!config.apiKey) {
        console.warn('[OOC旁观者] 请配置 API Key');
        return null;
    }
    
    if (oocCompanionState.isProcessing) {
        console.log('[OOC旁观者] 正在处理中，跳过');
        return null;
    }
    
    oocCompanionState.isProcessing = true;
    
    try {
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    {
                        role: 'system',
                        content: `你是${config.name}，${config.personality}。你正在旁边观看用户和AI角色的角色扮演对话。请适时给出幽默、友善的评论或陪伴。用户希望你感受到陪伴的感觉，但不是每次都回复。`
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150,
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
            throw new Error(`API错误: ${response.status}`);
        }
        
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';
        oocCompanionState.lastReply = reply;
        return reply;
        
    } catch (error) {
        console.error('[OOC旁观者] API调用失败:', error);
        return null;
    } finally {
        oocCompanionState.isProcessing = false;
    }
}

// ========== 消息处理 ==========
async function onMessageReceived(messageId) {
    const config = getOocConfig();
    
    if (!config.enabled || !config.autoReply || !config.apiKey) {
        return;
    }
    
    oocCompanionState.messageCount++;
    
    // 每隔几条消息回复一次
    if (oocCompanionState.messageCount % config.replyInterval !== 0) {
        return;
    }
    
    const chatContext = getChatContext();
    if (!chatContext) return;
    
    const history = formatChatHistory(chatContext);
    const prompt = `以下是最近的角色扮演对话：
${history}

作为旁观者，请给出一句简短的陪伴性评论（20字以内），可以是：
- 调侃
- 鼓励
- 好奇
- 陪伴

只回复一句话，不要加描述。`;
    
    const reply = await callOocApi(prompt);
    
    if (reply && config.showInDetails) {
        // 显示在折叠详情中
        showOocInDetails(reply, messageId);
    }
}

// ========== UI 显示 ==========
function showOocInDetails(content, messageId) {
    const config = getOocConfig();
    
    // 尝试找到最后一条消息
    try {
        const lastMes = document.querySelector('.last_mes');
        if (!lastMes) return;
        
        // 检查是否已经有OOC旁观者内容
        let oocContainer = lastMes.querySelector('.ooc-companion-details');
        
        if (!oocContainer) {
            oocContainer = document.createElement('div');
            oocContainer.className = 'ooc-companion-details';
            oocContainer.style.cssText = `
                margin-top: 8px;
                padding: 8px 12px;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15));
                border-left: 3px solid #667eea;
                border-radius: 4px;
                font-size: 13px;
                color: #a8a8b3;
            `;
            lastMes.appendChild(oocContainer);
        }
        
        // 添加新评论
        const comment = document.createElement('div');
        comment.style.cssText = `
            padding: 4px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        `;
        comment.innerHTML = `<strong style="color:#667eea">${config.name}:</strong> ${content}`;
        oocContainer.appendChild(comment);
        
    } catch (e) {
        console.error('[OOC旁观者] 显示详情失败:', e);
    }
}

// ========== 悬浮按钮 ==========
function createFloatingButton() {
    const config = getOocConfig();
    if (!config.showFloatingButton) return;
    
    const btnId = 'ooc-companion-btn';
    if (document.getElementById(btnId)) return;
    
    const btn = document.createElement('div');
    btn.id = btnId;
    btn.innerHTML = '👀';
    btn.title = `${config.name} - 点击配置`;
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
    `;
    
    btn.onmouseenter = () => {
        btn.style.transform = 'scale(1.1)';
    };
    btn.onmouseleave = () => {
        btn.style.transform = 'scale(1)';
    };
    btn.onclick = () => openOocConfigDialog();
    
    document.body.appendChild(btn);
    console.log('[OOC旁观者] 悬浮按钮已创建');
}

// ========== 配置弹窗 ==========
async function openOocConfigDialog() {
    const config = getOocConfig();
    const { Popup, POPUP_TYPE } = SillyTavern.getContext();
    
    const html = `
        <div style="padding: 20px; min-width: 450px; max-width: 500px;">
            <h3 style="margin: 0 0 20px 0; color: #667eea;">👀 OOC 旁观者配置</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">启用功能</label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="ooc_enabled" ${config.enabled ? 'checked' : ''}>
                    启用 OOC 旁观者
                </label>
            </div>
            
            <hr style="border: none; border-top: 1px solid #333; margin: 15px 0;">
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">API 地址</label>
                <input id="ooc_apiUrl" type="text" value="${config.apiUrl}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">API Key *</label>
                <input id="ooc_apiKey" type="password" value="${config.apiKey}" placeholder="必填"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">模型名称</label>
                <input id="ooc_model" type="text" value="${config.model}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            
            <hr style="border: none; border-top: 1px solid #333; margin: 15px 0;">
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">旁观者名称</label>
                <input id="ooc_name" type="text" value="${config.name}"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">人设描述</label>
                <textarea id="ooc_personality" rows="2"
                    style="width: 100%; padding: 8px; box-sizing: border-box; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; resize: vertical;">${config.personality}</textarea>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">回复频率</label>
                <select id="ooc_replyInterval" style="width: 100%; padding: 8px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px;">
                    <option value="1" ${config.replyInterval == 1 ? 'selected' : ''}>每条消息都回复</option>
                    <option value="2" ${config.replyInterval == 2 ? 'selected' : ''}>每隔1条回复</option>
                    <option value="3" ${config.replyInterval == 3 ? 'selected' : ''}>每隔2条回复</option>
                    <option value="5" ${config.replyInterval == 5 ? 'selected' : ''}>每隔4条回复</option>
                    <option value="10" ${config.replyInterval == 10 ? 'selected' : ''}>每隔9条回复</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="ooc_autoReply" ${config.autoReply ? 'checked' : ''}>
                    自动回复
                </label>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="ooc_showInDetails" ${config.showInDetails ? 'checked' : ''}>
                    在聊天中显示评论（折叠详情）
                </label>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button id="ooc_testBtn" style="padding: 8px 16px; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    测试API
                </button>
                <button id="ooc_cancelBtn" style="padding: 8px 16px; background: #555; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    取消
                </button>
                <button id="ooc_saveBtn" style="padding: 8px 16px; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
                    保存
                </button>
            </div>
        </div>
    `;
    
    if (Popup && Popup.show) {
        await Popup.show.text('OOC 旁观者', html);
    }
    
    setTimeout(() => {
        // 保存按钮
        const saveBtn = document.getElementById('ooc_saveBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const newConfig = {
                    apiUrl: document.getElementById('ooc_apiUrl').value,
                    apiKey: document.getElementById('ooc_apiKey').value,
                    model: document.getElementById('ooc_model').value,
                    name: document.getElementById('ooc_name').value,
                    personality: document.getElementById('ooc_personality').value,
                    replyInterval: parseInt(document.getElementById('ooc_replyInterval').value),
                    autoReply: document.getElementById('ooc_autoReply').checked,
                    showInDetails: document.getElementById('ooc_showInDetails').checked,
                    enabled: document.getElementById('ooc_enabled').checked,
                    showFloatingButton: true,
                };
                
                if (!newConfig.apiKey) {
                    toastr.error('API Key 不能为空！', 'OOC旁观者');
                    return;
                }
                
                if (saveOocConfig(newConfig)) {
                    toastr.success('配置已保存！', 'OOC旁观者');
                    if (Popup && Popup.show) {
                        // 自动关闭
                    }
                }
            };
        }
        
        // 测试按钮
        const testBtn = document.getElementById('ooc_testBtn');
        if (testBtn) {
            testBtn.onclick = async () => {
                const apiUrl = document.getElementById('ooc_apiUrl').value;
                const apiKey = document.getElementById('ooc_apiKey').value;
                const model = document.getElementById('ooc_model').value;
                
                testBtn.textContent = '测试中...';
                testBtn.disabled = true;
                
                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [{ role: 'user', content: '你好！' }],
                            max_tokens: 50
                        })
                    });
                    
                    if (response.ok) {
                        toastr.success('API 连接成功！', 'OOC旁观者');
                    } else {
                        throw new Error(`错误: ${response.status}`);
                    }
                } catch (e) {
                    toastr.error('API 连接失败: ' + e.message, 'OOC旁观者');
                } finally {
                    testBtn.textContent = '测试API';
                    testBtn.disabled = false;
                }
            };
        }
    }, 300);
}

// ========== 事件监听 ==========
function setupOocEvents() {
    if (typeof eventOn !== 'undefined' && typeof tavern_events !== 'undefined') {
        // 监听AI回复
        eventOn(tavern_events.MESSAGE_RECEIVED, (messageId) => {
            onMessageReceived(messageId);
        });
        
        console.log('[OOC旁观者] 事件监听已注册');
    }
}

// ========== 斜杠命令 ==========
function registerOocCommand() {
    try {
        if (typeof SlashCommandParser !== 'undefined') {
            SlashCommandParser.addCommandObject(SlashCommand.fromProps({
                name: 'ooc',
                callback: () => {
                    setTimeout(() => openOocConfigDialog(), 100);
                    return '';
                },
                helpString: '打开 OOC 旁观者配置'
            }));
            console.log('[OOC旁观者] 斜杠命令已注册: /ooc');
        }
    } catch (e) {
        console.error('[OOC旁观者] 注册命令失败:', e);
    }
}

// ========== 初始化 ==========
function initOocCompanion() {
    const config = getOocConfig();
    
    // 创建悬浮按钮
    createFloatingButton();
    
    // 注册命令
    registerOocCommand();
    
    // 注册事件
    setupOocEvents();
    
    console.log('[OOC旁观者] 已加载');
    console.log('[OOC旁观者] 当前配置:', config);
    
    if (!config.apiKey) {
        setTimeout(() => {
            toastr.info('请点击右下角的 👀 按钮配置 OOC 旁观者', 'OOC旁观者 - 首次使用', { timeOut: 10000 });
        }, 3000);
    }
}

// 延迟初始化
setTimeout(initOocCompanion, 2000);
