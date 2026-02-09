/**
 * Inject Script - Runs in the page context to intercept fetch and XMLHttpRequest
 * Captures request/response data and sends it to the content script
 */

(function () {
    'use strict';

    const BACKEND_URL = 'http://localhost:8000';
    const MAX_BODY_SIZE = 1024 * 1024; // 1MB limit

    /**
     * Safely parse response body as text or JSON
     */
    function parseBody(body) {
        if (!body) return null;
        if (typeof body === 'string') {
            try {
                return JSON.parse(body);
            } catch {
                return body;
            }
        }
        if (typeof body === 'object') {
            return body;
        }
        return String(body);
    }

    /**
     * Truncate body if it exceeds max size
     */
    function truncateBody(body) {
        if (!body) return null;
        const str = typeof body === 'string' ? body : JSON.stringify(body);
        if (str && str.length > MAX_BODY_SIZE) {
            return str.substring(0, MAX_BODY_SIZE) + '... [TRUNCATED]';
        }
        return body;
    }

    /**
     * Convert Headers object to plain object
     */
    function headersToObject(headers) {
        const obj = {};
        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                obj[key] = value;
            });
        } else if (headers && typeof headers === 'object') {
            Object.assign(obj, headers);
        }
        return obj;
    }

    /**
     * Send captured log to content script
     */
    function sendLog(logData) {
        window.postMessage({
            type: 'API_CAPTURE_LOG',
            payload: logData
        }, '*');
    }

    /**
     * Check if URL should be captured (exclude our backend)
     */
    function shouldCapture(url) {
        return !url.startsWith(BACKEND_URL);
    }

    // =============================================
    // FETCH INTERCEPTION
    // =============================================

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const startTime = performance.now();
        const [resource, init = {}] = args;

        // Get URL
        const url = typeof resource === 'string' ? resource : resource.url;

        // Skip capturing our own backend calls
        if (!shouldCapture(url)) {
            return originalFetch.apply(this, args);
        }

        // Capture request details
        const method = (init.method || 'GET').toUpperCase();
        const requestHeaders = headersToObject(init.headers || {});
        let requestBody = null;

        // Only capture body for methods that have one
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && init.body) {
            if (typeof init.body === 'string') {
                requestBody = parseBody(init.body);
            } else if (init.body instanceof FormData) {
                // Skip FormData (not text/JSON)
                requestBody = '[FormData - not captured]';
            } else if (init.body instanceof URLSearchParams) {
                requestBody = init.body.toString();
            } else {
                requestBody = '[Binary data - not captured]';
            }
        }

        try {
            const response = await originalFetch.apply(this, args);
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            // Clone response to read body without consuming it
            const clonedResponse = response.clone();

            // Try to get response body as text
            let responseBody = null;
            try {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json') || contentType.includes('text/')) {
                    const text = await clonedResponse.text();
                    responseBody = parseBody(text);
                } else {
                    responseBody = '[Non-text content - not captured]';
                }
            } catch (e) {
                responseBody = '[Failed to read response body]';
            }

            // Send log
            sendLog({
                url: url,
                method: method,
                request_headers: requestHeaders,
                request_body: truncateBody(requestBody),
                status_code: response.status,
                response_headers: headersToObject(response.headers),
                response_body: truncateBody(responseBody),
                duration_ms: duration,
                initiator_type: 'fetch'
            });

            return response;
        } catch (error) {
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            // Log failed requests too
            sendLog({
                url: url,
                method: method,
                request_headers: requestHeaders,
                request_body: truncateBody(requestBody),
                status_code: 0,
                response_headers: {},
                response_body: `Error: ${error.message}`,
                duration_ms: duration,
                initiator_type: 'fetch'
            });

            throw error;
        }
    };

    // =============================================
    // XMLHttpRequest INTERCEPTION
    // =============================================

    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._captureData = {
            method: method.toUpperCase(),
            url: url,
            requestHeaders: {},
            startTime: null
        };
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        if (this._captureData) {
            this._captureData.requestHeaders[name] = value;
        }
        return originalXHRSetRequestHeader.apply(this, [name, value]);
    };

    XMLHttpRequest.prototype.send = function (body) {
        if (this._captureData && shouldCapture(this._captureData.url)) {
            this._captureData.startTime = performance.now();

            // Capture request body
            let requestBody = null;
            if (body) {
                if (typeof body === 'string') {
                    requestBody = parseBody(body);
                } else if (body instanceof FormData) {
                    requestBody = '[FormData - not captured]';
                } else if (body instanceof Document) {
                    requestBody = '[Document - not captured]';
                } else {
                    requestBody = '[Binary data - not captured]';
                }
            }
            this._captureData.requestBody = requestBody;

            // Listen for completion
            this.addEventListener('loadend', () => {
                const endTime = performance.now();
                const duration = Math.round(endTime - this._captureData.startTime);

                // Get response headers
                const responseHeaders = {};
                const headerString = this.getAllResponseHeaders();
                if (headerString) {
                    headerString.split('\r\n').forEach(line => {
                        const parts = line.split(': ');
                        if (parts.length === 2) {
                            responseHeaders[parts[0]] = parts[1];
                        }
                    });
                }

                // Get response body (text/JSON only)
                let responseBody = null;
                const contentType = this.getResponseHeader('content-type') || '';
                if (contentType.includes('application/json') || contentType.includes('text/')) {
                    try {
                        responseBody = parseBody(this.responseText);
                    } catch (e) {
                        responseBody = '[Failed to read response body]';
                    }
                } else {
                    responseBody = '[Non-text content - not captured]';
                }

                sendLog({
                    url: this._captureData.url,
                    method: this._captureData.method,
                    request_headers: this._captureData.requestHeaders,
                    request_body: truncateBody(this._captureData.requestBody),
                    status_code: this.status,
                    response_headers: responseHeaders,
                    response_body: truncateBody(responseBody),
                    duration_ms: duration,
                    initiator_type: 'xhr'
                });
            });
        }

        return originalXHRSend.apply(this, [body]);
    };

    console.log('[API Capture Tool] Request interception active');
})();
