const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
// DOM Elements
const elements = {
    apiKeyModal: document.getElementById('api-key-modal'),
    apiKeyInput: document.getElementById('api-key-input'),
    saveApiKeyBtn: document.getElementById('save-api-key'),
    settingsBtn: document.getElementById('settings-btn'),

    chatHistory: document.getElementById('chat-history'),
    newChatBtn: document.getElementById('new-chat-btn'),
    clearChatBtn: document.getElementById('clear-chat'),

    messagesContainer: document.getElementById('messages-container'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
};

// State
let state = {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    history: [], // For future implementation of chat sessions
    currentChat: [],
    isTyping: false,
    staticPrompts: ''
};

// Initialize
function init() {
    checkApiKey();
    setupEventListeners();
    loadStaticPrompts();
}

async function loadStaticPrompts() {
    try {
        const response = await fetch('prompts.txt');
        if (response.ok) {
            state.staticPrompts = await response.text();
            console.log('Static prompts loaded.');
        } else {
            console.warn('prompts.txt not found or could not be loaded.');
        }
    } catch (error) {
        console.warn('Error loading prompts.txt:', error);
    }
}

function checkApiKey() {
    if (!state.apiKey) {
        elements.apiKeyModal.classList.add('active');
    } else {
        elements.apiKeyModal.classList.remove('active');
    }
}

// Event Listeners
function setupEventListeners() {
    // API Key Handling
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveApiKey();
    });

    elements.settingsBtn.addEventListener('click', () => {
        elements.apiKeyInput.value = state.apiKey;
        elements.apiKeyModal.classList.add('active');
    });

    // Chat Interaction
    elements.sendBtn.addEventListener('click', handleSendMessage);
    elements.userInput.addEventListener('input', toggleSendButton);
    elements.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Chat Management
    elements.newChatBtn.addEventListener('click', resetChat);
    elements.clearChatBtn.addEventListener('click', clearMessages);
}

// Actions
function saveApiKey() {
    const key = elements.apiKeyInput.value.trim();
    if (key) {
        state.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
        elements.apiKeyModal.classList.remove('active');
        // Optional: Show success toast
    } else {
        // Optional: Show error
        elements.apiKeyInput.style.borderColor = '#ef4444';
    }
}

function toggleSendButton() {
    const text = elements.userInput.value.trim();
    elements.sendBtn.disabled = !text || state.isTyping;
}

async function handleSendMessage() {
    const userText = elements.userInput.value.trim();
    if (!userText || state.isTyping) return;

    // UI Updates
    addMessageToUI(userText, 'user');
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto'; // Reset height
    toggleSendButton();
    state.isTyping = true;

    // Show Loading
    const loadingId = addLoadingIndicator();

    try {
        const responseText = await fetchGeminiResponse(userText);
        removeMessage(loadingId);
        addMessageToUI(responseText, 'bot');
    } catch (error) {
        removeMessage(loadingId);
        addMessageToUI("Sorry, something went wrong. Please check your API key or internet connection.", 'bot', true);
        console.error(error);
    } finally {
        state.isTyping = false;
        toggleSendButton();
    }
}

// Logic
async function fetchGeminiResponse(prompt) {
    if (!state.apiKey) {
        throw new Error("No API Key");
    }

    const fullPrompt = state.staticPrompts
        ? `${state.staticPrompts}\n\nUser: ${prompt}`
        : prompt;

    const response = await fetch(`${API_URL}?key=${state.apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: fullPrompt
                }]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'API Error');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// UI Helpers
function addMessageToUI(text, sender, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    if (isError) messageDiv.classList.add('error');

    const avatarHtml = sender === 'bot'
        ? `<div class="avatar bot-avatar"><span class="material-symbols-rounded">smart_toy</span></div>`
        : ``; // User avatar on right (handled by flex-direction) generally no avatar for user in this design or add one if needed.

    // Parse Markdown for bot
    const contentHtml = sender === 'bot' ? marked.parse(text) : `<p>${escapeHtml(text)}</p>`;

    messageDiv.innerHTML = `
        ${sender === 'bot' ? avatarHtml : ''}
        <div class="message-content glass-bubble">
            ${contentHtml}
        </div>
    `;

    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addLoadingIndicator() {
    const id = 'loading-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message bot-message`;
    messageDiv.id = id;

    messageDiv.innerHTML = `
        <div class="avatar bot-avatar"><span class="material-symbols-rounded">smart_toy</span></div>
        <div class="message-content glass-bubble">
            <div class="typing-indicator">
                <span class="dot-pulse"></span>
                <span class="dot-pulse"></span>
                <span class="dot-pulse"></span>
            </div>
        </div>
    `;

    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function resetChat() {
    // Clear only messages, keep API key
    clearMessages();
}

function clearMessages() {
    // Keep first welcome message
    const welcome = elements.messagesContainer.querySelector('.welcome-message');
    elements.messagesContainer.innerHTML = '';
    if (welcome) elements.messagesContainer.appendChild(welcome);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-resize textarea
elements.userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Run
init();
