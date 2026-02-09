/**
 * Background Service Worker - Receives captured data and sends to backend
 */

const BACKEND_URL = 'http://localhost:8000';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CAPTURED_REQUEST') {
        sendToBackend(message.data);
    }
    return true;
});

/**
 * Send captured log to the backend API
 */
async function sendToBackend(logData) {
    try {
        const response = await fetch(`${BACKEND_URL}/logs/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        });

        if (!response.ok) {
            console.error('[API Capture Tool] Failed to send log:', response.status);
        }
    } catch (error) {
        console.error('[API Capture Tool] Error sending log:', error.message);
    }
}

console.log('[API Capture Tool] Background service worker started');
