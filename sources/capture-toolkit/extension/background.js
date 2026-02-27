// ===== CONFIGURATION =====
const TARGET_DOMAINS = [
    'portal.instant-on.hpe.com',
    'arubainstanton.com'
];

function isTargetUrl(url) {
    if (!url) return false;
    return TARGET_DOMAINS.some(domain => url.includes(domain));
}

const BACKEND_URL = 'http://localhost:8000';

// ===== STATE =====
const attachedTabs = new Set();
const pendingRequests = new Map();
const pendingBatch = [];
let batchTimer = null;
const BATCH_INTERVAL_MS = 2000;
const BATCH_MAX_SIZE = 50;

// ===== DEBUGGER LIFECYCLE =====

async function startCapture(tabId) {
    if (attachedTabs.has(tabId)) return;

    try {
        const tab = await chrome.tabs.get(tabId);
        if (!isTargetUrl(tab.url)) return;

        await chrome.debugger.attach({ tabId }, '1.3');
        await chrome.debugger.sendCommand({ tabId }, 'Network.enable');

        attachedTabs.add(tabId);
        console.log(`[Capture Engine] 🚀 Attached to Aruba Portal (Tab ${tabId})`);

        if (!batchTimer) {
            batchTimer = setInterval(flushBatch, BATCH_INTERVAL_MS);
        }
    } catch (err) {
        // Find if it was a user cancel or other error
        if (err.message && err.message.includes("canceled")) {
            console.log(`[Capture Engine] 🛑 User canceled attachment`);
        }
    }
}

async function stopCapture(tabId) {
    if (!attachedTabs.has(tabId)) return;
    try {
        await chrome.debugger.detach({ tabId });
    } catch (e) { }
    attachedTabs.delete(tabId);
}

// Global cleanup on suspend
chrome.runtime.onSuspend.addListener(() => {
    flushBatch();
});

// ===== EVENT LISTENERS =====

chrome.debugger.onEvent.addListener(async (source, method, params) => {
    if (!attachedTabs.has(source.tabId)) return;

    switch (method) {
        case 'Network.requestWillBeSent':
            handleRequest(params);
            break;
        case 'Network.responseReceived':
            handleResponse(params);
            break;
        case 'Network.loadingFinished':
            await handleFinished(source.tabId, params);
            break;
    }
});

chrome.debugger.onDetach.addListener((source) => {
    attachedTabs.delete(source.tabId);
    console.log(`[Capture Engine] 🔌 Detached from Tab ${source.tabId}`);
});

// ===== HANDLERS =====

function handleRequest(params) {
    const { requestId, request, timestamp, type } = params;

    // 1. URL Filter: Only relevant API domains
    if (!isTargetUrl(request.url)) return;

    // 2. Type Filter: APIs only (Fetch/XHR)
    // Note: Sometimes APIs are loaded as 'Other' or 'Script' in rare cases, but XHR/Fetch is standard
    if (!['Fetch', 'XHR', 'Other'].includes(type) && request.method === 'GET') {
        // Allow POST/PUT/etc regardless of type just in case
        return;
    }

    console.log(`[Capture] 🔍 Request: ${request.method} ${request.url}`);

    const headers = request.headers;
    const mandatory = {
        authorization: headers['Authorization'] || headers['authorization'] || null,
        csrf: headers['X-CSRF-Token'] || headers['x-csrf-token'] || null,
        cookie: headers['Cookie'] || headers['cookie'] || null,
        referer: headers['Referer'] || headers['referer'] || null,
        origin: headers['Origin'] || headers['origin'] || null
    };

    let context = 'DATA_FETCH';
    if (request.method !== 'GET') context = 'CONFIG_CHANGE';
    if (request.url.includes('login') || request.url.includes('auth') || request.url.includes('sso')) {
        context = 'AUTH_FLOW';
    }

    pendingRequests.set(requestId, {
        url: request.url,
        method: request.method,
        request_headers: headers,
        mandatory_headers: mandatory,
        execution_context: context,
        request_body: request.postData || null,
        timestamp: timestamp,
        start_time: Date.now()
    });
}

function handleResponse(params) {
    const { requestId, response } = params;
    const pending = pendingRequests.get(requestId);
    if (!pending) return;

    pending.status_code = response.status;
    pending.response_headers = response.headers;
    pending.mime_type = response.mimeType;
}

async function handleFinished(tabId, params) {
    const { requestId } = params;
    const pending = pendingRequests.get(requestId);
    if (!pending) return;

    pending.duration_ms = Date.now() - pending.start_time;

    try {
        const result = await chrome.debugger.sendCommand(
            { tabId }, 'Network.getResponseBody', { requestId }
        );
        pending.response_body = result.body;
        if (result.base64Encoded) pending.is_binary = true;
    } catch (err) {
        pending.response_body = null;
    }

    pending.request_body = tryParse(pending.request_body);
    pending.response_body = tryParse(pending.response_body);

    trackAuthSequence(pending);

    pendingBatch.push(pending);
    pendingRequests.delete(requestId);

    if (pendingBatch.length >= BATCH_MAX_SIZE) flushBatch();
}

function tryParse(data) {
    if (!data || typeof data !== 'string') return data;
    try {
        return JSON.parse(data);
    } catch {
        return data;
    }
}

// ===== AUTH SEQUENCE TRACKER =====
async function trackAuthSequence(data) {
    const sessions = [];

    const authHeader = data.request_headers['Authorization'] || data.request_headers['authorization'] || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        sessions.push({
            token_type: 'bearer',
            token_value: authHeader.substring(7).trim(),
            source_url: data.url,
            headers_snapshot: data.request_headers
        });
    }

    if (data.response_body && typeof data.response_body === 'object') {
        const body = data.response_body;
        if (body.access_token) {
            sessions.push({
                token_type: 'bearer',
                token_value: body.access_token,
                refresh_token: body.refresh_token,
                expires_in: body.expires_in,
                source_url: data.url,
                headers_snapshot: data.request_headers
            });
        }
    }

    const csrf = data.request_headers['X-CSRF-Token'] || data.request_headers['x-csrf-token'] || '';
    if (csrf) {
        sessions.push({
            token_type: 'csrf',
            token_value: csrf,
            source_url: data.url,
            headers_snapshot: data.request_headers
        });
    }

    for (const session of sessions) {
        try {
            await fetch(`${BACKEND_URL}/api/auth-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(session)
            });
        } catch (e) { }
    }

    // ===== BLUEPRINT CAPTURE =====
    const isLoginRequest = data.url.includes('login') || data.url.includes('oauth') || data.url.includes('token');
    const hasTokenInResponse = data.response_body && (data.response_body.access_token || data.response_body.id_token);

    if (isLoginRequest || hasTokenInResponse) {
        console.log(`[Capture] 💎 Detected Auth Blueprint for: ${data.url}`);

        // 1. Mask sensitive headers
        const safeHeaders = { ...data.request_headers };
        const sensitiveHeaders = ['authorization', 'Authorization', 'cookie', 'Cookie', 'x-csrf-token', 'X-CSRF-Token'];
        sensitiveHeaders.forEach(h => {
            if (safeHeaders[h]) safeHeaders[h] = "[MASKED]";
        });

        // 2. Mask sensitive body fields
        let safeBody = null;
        if (data.request_body && typeof data.request_body === 'object') {
            safeBody = { ...data.request_body };
            const sensitiveKeys = ['password', 'secret', 'client_secret', 'username', 'email'];
            sensitiveKeys.forEach(k => {
                if (safeBody[k]) safeBody[k] = `{{${k}}}`;
            });
        }

        // 3. Extract tokens to watch
        const detectedTokens = [];
        if (data.response_body && typeof data.response_body === 'object') {
            if (data.response_body.access_token) detectedTokens.push("access_token");
            if (data.response_body.id_token) detectedTokens.push("id_token");
        }

        const blueprint = {
            base_url: new URL(data.url).origin,
            endpoint: new URL(data.url).pathname,
            method: data.method,
            headers: safeHeaders,
            body_template: safeBody,
            detected_tokens: detectedTokens
        };

        try {
            await fetch(`${BACKEND_URL}/api/capture-blueprint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(blueprint)
            });
            console.log(`[Capture] ✅ Sent Auth Blueprint to backend`);
        } catch (e) {
            console.error(`[Capture] ❌ Failed to send blueprint:`, e);
        }
    }
}

// ===== BATCH SENDER =====

async function flushBatch() {
    if (pendingBatch.length === 0) return;
    const batch = pendingBatch.splice(0, pendingBatch.length);

    try {
        const response = await fetch(`${BACKEND_URL}/api/capture/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: batch })
        });
        if (response.ok) {
            console.log(`[Capture] ✅ Sent batch of ${batch.length} requests`);
        }
    } catch (err) {
        console.error('[Capture] ❌ Failed to send batch:', err.message);
    }
}

// ===== GLOBAL INITIALIZATION =====

// Only attach to existing tabs if they match
async function initGlobalCapture() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (isTargetUrl(tab.url)) {
            await startCapture(tab.id);
        }
    }
}

chrome.tabs.onCreated.addListener(async (tab) => {
    // onCreated might not have URL yet, wait for update
});

// Re-attach or update capture on reload
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (isTargetUrl(tab.url)) {
        startCapture(tabId);
    } else {
        // Navigate away from target -> stop capture to remove banner
        stopCapture(tabId);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    attachedTabs.delete(tabId);
});

initGlobalCapture();

console.log('[Capture Engine] 🌍 Smart Capture Active (Aruba Only)');
