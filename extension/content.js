/**
 * Content Script - Bridge between injected script and background service worker
 * Injects the capture script into the page context and relays captured data
 */

// Inject the capture script into the page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injected script
window.addEventListener('message', function(event) {
    // Only accept messages from the same window
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'API_CAPTURE_LOG') {
        // Forward the captured data to the background service worker
        chrome.runtime.sendMessage({
            type: 'CAPTURED_REQUEST',
            data: event.data.payload
        });
    }
});
