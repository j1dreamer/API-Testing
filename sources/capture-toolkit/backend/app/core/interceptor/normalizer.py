"""URL normalization — converts raw URLs into parameterized API paths."""
import re
from urllib.parse import urlparse, parse_qs

# Patterns for detecting dynamic path segments
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
NUMERIC_ID_PATTERN = re.compile(r"^\d+$")
LONG_HASH_PATTERN = re.compile(r"^[a-zA-Z0-9]{20,}$")
# Aruba-specific patterns (MAC addresses, serial numbers)
MAC_PATTERN = re.compile(r"^([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}$")
ARUBA_SERIAL_PATTERN = re.compile(r"^[A-Z0-9]{10,14}$")


def normalize_path_segment(segment: str) -> str:
    """Replace dynamic path segments with OpenAPI-style placeholders."""
    if not segment:
        return segment
    if UUID_PATTERN.match(segment):
        return "{uuid}"
    if NUMERIC_ID_PATTERN.match(segment):
        return "{id}"
    if MAC_PATTERN.match(segment):
        return "{mac_address}"
    if ARUBA_SERIAL_PATTERN.match(segment) and not segment.isalpha():
        return "{serial}"
    if LONG_HASH_PATTERN.match(segment):
        return "{param}"
    return segment


def normalize_url(url: str) -> tuple[str, str, dict]:
    """Parse and normalize a URL.
    
    Returns:
        (domain, normalized_path, query_params)
    """
    parsed = urlparse(url)
    domain = parsed.netloc or "unknown"

    # Normalize path segments
    segments = parsed.path.split("/")
    normalized = [normalize_path_segment(s) for s in segments]
    normalized_path = "/".join(normalized)

    if not normalized_path.startswith("/"):
        normalized_path = "/" + normalized_path
    if normalized_path != "/" and normalized_path.endswith("/"):
        normalized_path = normalized_path.rstrip("/")

    # Parse query parameters
    query_params = {}
    for key, values in parse_qs(parsed.query).items():
        query_params[key] = values[0] if values else ""

    return domain, normalized_path, query_params


def generate_api_key(domain: str, path: str, method: str) -> str:
    """Generate a unique key for an API endpoint."""
    return f"{domain}|{path}|{method.upper()}"
