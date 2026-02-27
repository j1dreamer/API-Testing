"""WebSocket manager for real-time traffic broadcasts."""
from typing import List, Dict, Any
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections and broadcasts."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        """Send a message to all connected clients."""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might be dead
                pass


manager = ConnectionManager()
