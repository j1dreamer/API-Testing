/**
 * Headless Capture Engine — Aruba API Analysis
 * Uses chrome.debugger (CDP) for high-fidelity traffic interception.
 */

const BACKEND_URL = 'http://localhost:8000';

// ===== STATE =====
const attachedTabs = new Set();
const pendingRequests = new Map(); // requestId -> request metadata
const pendingBatch = [];           // batch buffer
let batchTimer = null;
const BATCH_INTERVAL_MS = 2000;
const BATCH_MAX_SIZE = 50;

// ===== DEBUGGER LIFECYCLE =====

async function startCapture(tabId) {
    if (attachedTabs.has(tabId)) return;

    try {
        await chrome.debugger.attach({ tabId }, '1.3');
        await chrome.debugger.sendCommand({ tabId }, 'Network.enable');

        attachedTabs.add(tabId);

        if (!batchTimer) {
            batchTimer = setInterval(flushBatch, BATCH_INTERVAL_MS);
        }

        console.log(`[Capture Engine] 🚀 Global capture attached to tab ${tabId}`);
    } catch (err) {
        // Silently ignore if already attached or system tab
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
    // Greedy capture: if it's from any tab we're attached to
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
});

// ===== HANDLERS =====

function handleRequest(params) {
    const { requestId, request, timestamp, type } = params;

    // Filter out binary noise to focus on APIs/JSON
    const noise = ['Image', 'Font', 'Stylesheet', 'Media', 'Ping'];
    if (noise.includes(type)) return;

    console.log(`[Capture] 🔍 Request: ${request.method} ${request.url}`);

    // Extract Mandatory Headers for API Blueprint
    const headers = request.headers;
    const mandatory = {
        authorization: headers['Authorization'] || headers['authorization'] || null,
        csrf: headers['X-CSRF-Token'] || headers['x-csrf-token'] || null,
        cookie: headers['Cookie'] || headers['cookie'] || null,
        referer: headers['Referer'] || headers['referer'] || null,
        origin: headers['Origin'] || headers['origin'] || null
    };

    // Simple Execution Context Heuristics
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

    // Greedy Response Body Capture
    try {
        const result = await chrome.debugger.sendCommand(
            { tabId }, 'Network.getResponseBody', { requestId }
        );
        pending.response_body = result.body;
        if (result.base64Encoded) {
            pending.is_binary = true;
        }
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

    // Header check
    const authHeader = data.request_headers['Authorization'] || data.request_headers['authorization'] || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        sessions.push({
            token_type: 'bearer',
            token_value: authHeader.substring(7).trim(),
            source_url: data.url,
            headers_snapshot: data.request_headers
        });
    }

    // Body check (OAuth)
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

    // CSRF check
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
            console.log(`[Capture] ✅ Sent batch of ${batch.length} requests to backend`);
        } else {
            console.warn(`[Capture] ⚠️ Backend returned error: ${response.status}`);
        }
    } catch (err) {
        console.error('[Capture] ❌ Failed to send batch:', err.message);
    }
}

// ===== GLOBAL INITIALIZATION =====

async function initGlobalCapture() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith('chrome://')) {
            await startCapture(tab.id);
        }
    }
}

// Attach to new tabs
chrome.tabs.onCreated.addListener((tab) => {
    startCapture(tab.id);
});

// Re-attach or update capture on reload
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        startCapture(tabId);
    }
});

// Cleanup on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
    attachedTabs.delete(tabId);
});

// Run on extension load
initGlobalCapture();

console.log('[Capture Engine] 🌍 Global Chrome Capture Active');
