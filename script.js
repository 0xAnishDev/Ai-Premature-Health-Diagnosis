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

    // Auth Elements
    authModal: document.getElementById('auth-modal'),
    authForm: document.getElementById('auth-form'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    authSubmitText: document.getElementById('auth-submit-text'),
    toggleAuthModeBtn: document.getElementById('toggle-auth-mode'),
    authSubtitle: document.getElementById('auth-subtitle'),
    userDisplayName: document.getElementById('user-display-name'),
    logoutBtn: document.getElementById('logout-btn'),
};

// State
let state = {
    apiKey: localStorage.getItem('gemini_api_key') || '',
    history: [],
    currentChat: [],
    isTyping: false,
    staticPrompts: '',
    user: null, // Firebase User
    isSignupMode: false
};

// RELEASE_NOTE: REPLACE THIS WITH YOUR FIREBASE CONFIG FROM CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyDI-bwjmf7KFPzYWOiIeh76KA79DLpQISM",
    authDomain: "healio-2e391.firebaseapp.com",
    projectId: "healio-2e391",
    storageBucket: "healio-2e391.firebasestorage.app",
    messagingSenderId: "891730049218",
    appId: "1:891730049218:web:9e3cfd490f00a59ab5635b",
    measurementId: "G-3XP0YJWTKT"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase Initialized");
} catch (e) {
    console.error("Firebase Init Error (Did you add your config?):", e);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize
function init() {
    setupAuthListener();
    setupEventListeners();
    loadStaticPrompts();
}

function setupAuthListener() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in.
            state.user = user;
            elements.userDisplayName.textContent = user.email.split('@')[0]; // Simple display name
            elements.authModal.classList.remove('active');
            checkApiKey(); // Process to API key check after auth
        } else {
            // No user is signed in.
            state.user = null;
            elements.userDisplayName.textContent = "Guest";
            elements.authModal.classList.add('active');
            // Ensure API Key modal is hidden if we are back at auth
            elements.apiKeyModal.classList.remove('active');
        }
    });
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
    if (!state.user) return; // Don't check API key if not logged in
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

    // Auth Events
    elements.authForm.addEventListener('submit', handleAuthSubmit);
    elements.toggleAuthModeBtn.addEventListener('click', toggleAuthMode);
    elements.logoutBtn.addEventListener('click', handleLogout);
}

// Auth Functions
async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = elements.authEmail.value;
    const password = elements.authPassword.value;

    try {
        if (state.isSignupMode) {
            await auth.createUserWithEmailAndPassword(email, password);
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
        // Listener handles UI updates
    } catch (error) {
        alert(error.message);
    }
}

function toggleAuthMode(e) {
    e.preventDefault();
    state.isSignupMode = !state.isSignupMode;

    if (state.isSignupMode) {
        elements.authSubmitText.textContent = "Sign Up";
        elements.authSubtitle.textContent = "Create an account to get started";
        elements.toggleAuthModeBtn.textContent = "Sign In";
    } else {
        elements.authSubmitText.textContent = "Sign In";
        elements.authSubtitle.textContent = "Sign in to continue your health journey";
        elements.toggleAuthModeBtn.textContent = "Sign Up";
    }
}

function handleLogout(e) {
    e.preventDefault();
    auth.signOut();
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
