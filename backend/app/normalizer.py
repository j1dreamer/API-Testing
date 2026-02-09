"""URL Normalization utility for API Inventory."""
import re
from urllib.parse import urlparse


# Patterns for path parameter detection
UUID_PATTERN = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE
)
NUMERIC_ID_PATTERN = re.compile(r'^\d+$')
LONG_HASH_PATTERN = re.compile(r'^[a-zA-Z0-9]{20,}$')


def normalize_path_segment(segment: str) -> str:
    """
    Normalize a single path segment to a placeholder if it looks like a dynamic value.
    
    Rules:
    - Numeric IDs (e.g., 123) -> {id}
    - UUIDs -> {uuid}
    - Long alphanumeric strings (hash-like) -> {param}
    """
    if not segment:
        return segment
    
    # Check for UUID
    if UUID_PATTERN.match(segment):
        return "{uuid}"
    
    # Check for numeric ID
    if NUMERIC_ID_PATTERN.match(segment):
        return "{id}"
    
    # Check for long hash/token (20+ alphanumeric chars)
    if LONG_HASH_PATTERN.match(segment):
        return "{param}"
    
    return segment


def normalize_url(url: str) -> tuple[str, str]:
    """
    Normalize a URL to extract domain and normalized path.
    
    Returns:
        tuple: (domain, normalized_path)
    """
    parsed = urlparse(url)
    domain = parsed.netloc or "unknown"
    
    # Normalize each path segment
    path_segments = parsed.path.split("/")
    normalized_segments = [normalize_path_segment(seg) for seg in path_segments]
    normalized_path = "/".join(normalized_segments)
    
    # Ensure path starts with /
    if not normalized_path.startswith("/"):
        normalized_path = "/" + normalized_path
    
    # Remove trailing slash unless it's the root
    if normalized_path != "/" and normalized_path.endswith("/"):
        normalized_path = normalized_path.rstrip("/")
    
    return domain, normalized_path


def generate_api_key(domain: str, path: str, method: str) -> str:
    """Generate a unique key for an API endpoint."""
    return f"{domain}|{path}|{method.upper()}"
