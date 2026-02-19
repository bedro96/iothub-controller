from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import json

ISO_FMT = "%Y-%m-%dT%H:%M:%SZ"

def iso_now() -> str:
    return datetime.now(timezone.utc).strftime(ISO_FMT)

class MessageEnvelope:
    def __init__(
        self,
        action: str,
        type: str = "command",
        payload: Optional[Dict[str, Any]] = None,
        status: Optional[str] = None,
        correlationId: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
        version: int = 1,
        id: Optional[str] = None,
        ts: Optional[str] = None,
    ):
        self.version = version
        self.type = type
        self.id = id or str(uuid.uuid4())
        self.correlationId = correlationId or self.id
        self.ts = ts or iso_now()
        self.action = action
        self.status = status
        self.payload = payload or {}
        self.meta = meta or {}

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "version": self.version,
            "type": self.type,
            "id": self.id,
            "correlationId": self.correlationId,
            "ts": self.ts,
            "action": self.action,
            "payload": self.payload,
            "meta": self.meta,
        }
        if self.status is not None:
            d["status"] = self.status
        return d

    def to_json(self, **kwargs) -> str:
        return json.dumps(self.to_dict(), **kwargs)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MessageEnvelope":
        return cls(
            action=data.get("action", ""),
            type=data.get("type", "command"),
            payload=data.get("payload"),
            status=data.get("status"),
            correlationId=data.get("correlationId"),
            meta=data.get("meta"),
            version=data.get("version", 1),
            id=data.get("id"),
            ts=data.get("ts"),
        )
