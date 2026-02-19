import os, base64, dotenv
import sys
from datetime import datetime
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, status, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
# use application logger from utils.applogging
import sqlalchemy as sa
import uvicorn
from sqlalchemy.ext.asyncio import AsyncSession
from utils.applogging import setup_logging
from utils.dbconnection import DeviceId, lifespan, get_db, AsyncSession
from utils.device import generate_symmetric_key, generate_device_credentials, generate_device_credential, delete_device_credential
from utils.message_envelope import MessageEnvelope
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import threading
from azure.eventhub import EventHubConsumerClient
import json
import asyncio
from concurrent.futures import Future

dotenv.load_dotenv()

# Initialize logger
logger = setup_logging()

# Global variables
initialRetryTimeout = 30
maxRetry = 10
messageIntervalSeconds = 5

# Generate 32byte base64 random uuid (defined early so it's available where needed)
def generate_uuid() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).rstrip(b'=').decode('utf-8')

# Generate IoTHub Connection String from env
def generate_iothub_connection_string(device_id: str) -> str:
    host_name = os.getenv("IOT_CONNECTION_STRING").split(";")[0].split("=")[1]
    shared_access_key = os.getenv("IOT_PRIMARY_KEY_DEVICE")
    return f"HostName={host_name};DeviceId={device_id};SharedAccessKey={shared_access_key}"
app = FastAPI(
    title="IoT Simulator Server",
    description="IoT 시뮬레이터 클라이언트와 통신하는 서버",
    version="1.0.0",
    lifespan=lifespan
)

# Bearer token for simple auth (set in environment)
API_BEARER_TOKEN = os.getenv("API_BEARER_TOKEN")


class BearerAuthMiddleware(BaseHTTPMiddleware):
    """Simple middleware that enforces a single shared Bearer token for HTTP requests.

    Exempt paths (health/docs/openapi) are allowed without a token for convenience.
    """
    def __init__(self, app, exempt_paths: set[str] | None = None):
        super().__init__(app)
        self.exempt_paths = exempt_paths or {"/api/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request, call_next):
        # If no token configured, allow requests (make auth opt-in)
        if not API_BEARER_TOKEN:
            return await call_next(request)

        path = request.url.path
        if path in self.exempt_paths:
            return await call_next(request)

        auth = request.headers.get("authorization")
        if not auth or not auth.lower().startswith("bearer "):
            return JSONResponse({"detail": "Missing or invalid Authorization header"}, status_code=401)
        token = auth.split(" ", 1)[1]
        if token != API_BEARER_TOKEN:
            return JSONResponse({"detail": "Invalid token"}, status_code=403)

        return await call_next(request)


# register middleware
app.add_middleware(BearerAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # 개발용, 운영에서는 제한 필요
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 클라이언트 연결 관리
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {} # uuid: WebSocket
    async def connect(self, uuid: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[uuid] = websocket
        
    def disconnect(self, uuid: str):
        self.active_connections.pop(uuid, None)

    async def send_command(self, uuid: str, command: dict):
        ws = self.active_connections.get(uuid)
        if ws:
            try:
                await ws.send_json(command)
            except Exception:
                logger.exception("Failed to send command to %s; disconnecting", uuid)
                self.disconnect(uuid)

    async def broadcast(self, command: dict):
        # iterate over a static list of items to avoid runtime dict size changes
        for uuid, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(command)
                logger.info("Broadcast command sent to %s", uuid)
            except Exception:
                # Log and remove the dead connection, but continue broadcasting to others
                logger.exception("Failed to broadcast to %s; removing connection", uuid)
                self.disconnect(uuid)

# 연결 관리자 인스턴스
manager = ConnectionManager()
@app.websocket("/ws/{uuid}")
async def websocket_endpoint(websocket: WebSocket, uuid: str, db: AsyncSession = Depends(get_db)):
    # WebSocket auth: allow token via Authorization header or ?token=<token> query param
    if API_BEARER_TOKEN:
        auth = websocket.headers.get("authorization")
        token = None
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
        else:
            # fallback to query param
            token = websocket.query_params.get("token")
        if token != API_BEARER_TOKEN:
            await websocket.close(code=1008)
            return
    await manager.connect(uuid, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            logger.info(
                "Received message from %s: Type: %s, Id: %s, Correlation_Id: %s, Action: %s, payload: %s, status: %s",
                uuid,
                data.get("type", ""),
                data.get("id", ""),
                data.get("correlationId", ""),
                data.get("action", ""),
                data.get("payload", {}),
                data.get("status", "")
            )
            if "type" in data and data["type"] == "request":
                # Create a logic to handle acquire type message and generate a response.
                logger.info("Received from %s: %s", uuid, data)
                # 클라이언트가 서버로 상태/결과를 보낼 때 처리
                # assign_device_id requires DB access via dependency injection; for websocket usage
                # call it and handle DB/HTTP exceptions locally so ASGI doesn't see an HTTP response
                try:
                    assigned_device_id = await assign_device_id(data.get("id", ""), db)
                except HTTPException as he:
                    # Send an error envelope back to the client and continue listening
                    envelope = MessageEnvelope(
                        action=data.get("action", "unknown"),
                        type="error",
                        id=generate_uuid(),
                        correlation_id=data.get("id", ""),
                        payload={},
                        status="failure",
                        meta={"http_detail": he.detail, "http_status": he.status_code},
                    )
                    try:
                        await websocket.send_json(envelope.to_dict())
                    except Exception:
                        # If sending fails, break the loop to let disconnect handling run
                        logger.exception("Failed to send error envelope to %s", uuid)
                        break
                    logger.warning("assign_device_id failed for %s: %s", uuid, he.detail)
                    continue
                except Exception as e:
                    envelope = MessageEnvelope(
                        action=data.get("action", "unknown"),
                        type="error",
                        id=generate_uuid(),
                        correlation_id=data.get("id", ""),
                        payload={},
                        status="failure",
                        meta={"error": str(e)},
                    )
                    try:
                        await websocket.send_json(envelope.to_dict())
                    except Exception:
                        logger.exception("Failed to send internal error envelope to %s", uuid)
                        break
                    logger.exception("Unexpected error assigning device id for %s", uuid)
                    break
                envelope = MessageEnvelope(
                    version=1,
                    type="response",
                    id=generate_uuid(),
                    correlationId=data.get("id", ""),
                    action="device.config.update",
                    payload={
                        "device_id": assigned_device_id, 
                        "IOTHUB_DEVICE_CONNECTION_STRING": generate_iothub_connection_string(assigned_device_id),
                        "initialRetryTimeout": initialRetryTimeout,
                        "maxRetry": maxRetry,
                        "messageIntervalSeconds": messageIntervalSeconds
                        },
                    status="success",
                )
                await websocket.send_json(envelope.to_dict())
                logger.info(
                    "Sent message Type: %s, Id: %s, Correlation_Id: %s, Action: %s, payload: %s, status: %s",
                    envelope.type, envelope.id, envelope.correlationId, envelope.action, envelope.payload, envelope.status
                )
                # 필요시 DB 저장 등 추가
            if "type" in data and data["type"] == "report":
                envelope = MessageEnvelope(
                    version=1,
                    type="response",
                    action="none",
                    id=generate_uuid(),
                    correlationId=data.get("id", ""),
                    status="received",
                )
                await websocket.send_json(envelope.to_dict())
                # DB에 저장 할까? 해야 하나?
                logger.info("Report received send to %s with %s : %s", envelope.correlationId, envelope.type, envelope.status)
                
    except WebSocketDisconnect:
        manager.disconnect(uuid)
        logger.info("%s disconnected", uuid)
                # 필요시 DB 저장 등 추가

@app.post("/generate_device/{number_of_devices}", status_code=status.HTTP_201_CREATED)
async def generate_devices(number_of_devices: int, db: AsyncSession = Depends(get_db)):
    device_ids = []
    for i in range(number_of_devices):
        device_id = f"simdevice{(i+1):04d}"
        try:
            generated = generate_device_credential(device_id)
            device_ids.append(generated)
            logger.info("Generated device %s in Azure, IoT Hub", device_id)
        except Exception as e:
            logger.error("Error generating device %s in Azure IoT Hub: %s", device_id, e)
            raise HTTPException(status_code=500, detail="Azure IoT Hub error")

        db.add(DeviceId(device_id=device_id))
        try:
            await db.flush()
            logger.info("Device ID %s saved to DB", device_id)
        except Exception as e:
            logger.error("Error saving device ID %s to DB: %s", device_id, e)
            raise HTTPException(status_code=500, detail="Database error")
        try:
            await db.commit()
            logger.info("Database commit successful for device %s", device_id)
        except Exception as e:
            await db.rollback()
            logger.error("Error during database commit for device %s: %s", device_id, e)
            raise HTTPException(status_code=500, detail="Database commit error")

    return JSONResponse({"generated_device_ids": device_ids})

@app.post("/delete_device/{device_id}", status_code=status.HTTP_200_OK)
async def delete_device(device_id: str, db: AsyncSession = Depends(get_db)):
    try:
        delete_device_credential(device_id)
        logger.info("Deleted device %s from Azure IoT Hub", device_id)
    except Exception as e:
        logger.error("Error deleting device %s from Azure IoT Hub: %s", device_id, e)
        raise HTTPException(status_code=500, detail="Azure IoT Hub deletion error")
    try:
        result = await db.execute(
            "DELETE FROM device_ids WHERE device_id = :device_id",
            {"device_id": device_id}
        )
        if result.rowcount == 0:
            logger.warning("Device ID %s not found in DB", device_id)
            raise HTTPException(status_code=404, detail="Device ID not found in DB")
        await db.commit()
        logger.info("Deleted device ID %s from DB", device_id)
    except Exception as e:
        await db.rollback()
        logger.error("Error deleting device ID %s from DB: %s", device_id, e)
        raise HTTPException(status_code=500, detail="Database deletion error")
    return JSONResponse({"deleted_device_id": device_id})

@app.post("/delete_all_devices", status_code=status.HTTP_200_OK)
async def delete_all_devices(db: AsyncSession = Depends(get_db)):
    # Implementation for deleting all devices goes here
    result = await db.execute(sa.select(DeviceId))
    rows = result.scalars().all()
    device_ids: list[str] = []

    # rows may be ORM DeviceId objects; extract string ids
    if rows:
        for r in rows:
            # r can be DeviceId instance or plain string
            if hasattr(r, 'device_id'):
                device_ids.append(r.device_id)
            else:
                device_ids.append(str(r))
    else:
        # fallback: generate a reasonable set if DB empty
        for i in range(1000):
            device_ids.append(f"simdevice{(i+1):04d}")

    # delete in Azure IoT Hub; handle per-device errors and continue
    for device_id in device_ids:
        try:
            delete_device_credential(device_id)
            logger.info("Deleted device %s from Azure IoT Hub", device_id)
        except Exception as e:
            logger.error("Failed to delete device %s from Azure IoT Hub: %s", device_id, e)
            # continue with next device

    # remove all entries from DB (use SQLAlchemy delete expression)
    try:
        await db.execute(sa.delete(DeviceId))
        await db.commit()
        logger.info("Deleted all device IDs from DB")
    except Exception as e:
        await db.rollback()
        logger.error("Error deleting all device IDs from DB: %s", e)
        raise HTTPException(status_code=500, detail="Database deletion error")
    return JSONResponse({"status": "all devices deleted"})

@app.post("/clear_mappings", status_code=status.HTTP_200_OK)
async def clear_mappings(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(
            sa.text("UPDATE deviceids SET device_uuid = NULL")
        )
        await db.commit()
        logger.info("Cleared all device ID to UUID mappings in DB")
    except Exception as e:
        await db.rollback()
        logger.error("Error clearing device ID to UUID mappings in DB: %s", e)
        raise HTTPException(status_code=500, detail="Database update error")
    return JSONResponse({"status": "all mappings cleared"})

# REST API: 전체 클라이언트에 브로드캐스트 명령
@app.post("/command/broadcast")
async def broadcast_command(request: Request):
    body = await request.json()
    logger.info("Broadcasting command to all clients: %s", body)
    await manager.broadcast(body)
    logger.info("Broadcast command sent to all clients")
    return JSONResponse({"status": "broadcasted"})

# REST API: 서버 관리자가 명령을 내림
@app.post("/command/{uuid}")
async def send_command(uuid: str, request: Request):
    body = await request.json()
    # 예: {"action": "start", "iot_hub_connection_string": "...", "initial_retry_timeout": 30, "max_retry": 10}
    await manager.send_command(uuid, body)
    return JSONResponse({"status": "sent", "uuid": uuid})

# REST API: 클라이언트가 상태/결과를 보고
@app.post("/report/{device_id}")
async def report_status(device_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    logger.info("Report from %s: %s", device_id, body)
    # Convert body to dictionary
    data = dict(body)
    deviceid=data.get("deviceId", "")
    type=data.get("Type", "")
    modelid=data.get("modelId", "")
    status=data.get("Status", "")
    temp=data.get("temp", 20)
    humidity=data.get("Humidity", 50)
    ts=data.get("ts","")           
    try:
        result = await db.execute(
            sa.text("INSERT INTO telemetries (deviceid, type, modelid, status, temp, humidity, ts) VALUES (:device_id, :type, :modelid, :status, :temp, :humidity, :ts)"),
            {"device_id": deviceid, "type": type, "modelid": modelid, "status": status, "temp": temp, "humidity": humidity, "ts": ts}
    )
        await db.commit()
        logger.info("Report from %s saved to telemetries table", device_id)
    except Exception as e:
        await db.rollback()
        logger.error("Error saving report from %s to telemetries table: %s", device_id, e)
        raise HTTPException(status_code=500, detail="Database error") from e
    # Response to client with success status
    return JSONResponse({"status": "saved", "device_id": device_id})

# REST API: 현재 연결된 클라이언트 목록 조회
@app.get("/clients")
def get_clients():
    return {"connected_clients": list(manager.active_connections.keys())}

# API 헬스체크 엔드포인트
@app.get("/api/health")
async def api_health(request: Request):
    return JSONResponse({"status": "ok"}, 200)  # call FastAPI health handler

async def assign_device_id(message_id: str, db: AsyncSession = Depends(get_db)) -> str:
    # Query the device_id in asc in DeviceId table where device_uuid is not assigned yet and 
    # assign the device_id with device_uuid = message_id in this row by updating the row.
    # Return the assigned device_id.
    
    result = await db.execute(
        sa.text("SELECT device_id FROM deviceids WHERE device_uuid IS NULL ORDER BY device_id ASC LIMIT 1")
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="No available device IDs to assign")
    device_id = row[0]
    # Update the row to set device_uuid
    await db.execute(
        sa.text("UPDATE deviceids SET device_uuid = :message_id WHERE device_id = :device_id"),
        {"message_id": message_id, "device_id": device_id}
    )
    await db.commit()
    logger.info("Assigned device_id %s to message_id %s", device_id, message_id)
    return device_id




# Start Event Hub listener in a separate thread

# 서버 실행 중
if __name__ == "__main__":
    # Reload disabled to avoid continuous log file detection by watchfiles
    # For development with auto-reload, use: uvicorn iot_simulator_server:app --reload --reload-exclude 'logs/**'
    uvicorn.run(
        "iot_simulator_server:app", 
        host="0.0.0.0", 
        port=5555, 
        reload=False
    )


# { 
#   "v": 1,                       // 프로토콜/스키마 버전
#   "type": "command",            // command | query | event | response | error | ack | heartbeat
#   "id": "b5c0...-uuid",         // 이 메시지 자체의 고유 ID (UUID)
#   "correlationId": "b5c0...-uuid", // 요청-응답 상관관계 ID. 요청이면 보통 id와 동일, 응답/에러는 요청의 id를 넣음
#   "ts": "2025-11-28T05:15:37Z", // ISO8601 타임스탬프 (서버/클라이언트 생성 시각)
#   "action": "device.restart",   // 수행/발생하는 구체 동작명 (네임스페이스.액션 형태 권장)
#   "status": "success",         // 옵션: success | failure | pending | ... (응답/이벤트용)
#   "payload": { },               // 실제 데이터
#   "meta": {                     // 옵션: 헤더/추적/라우팅/권한 등
#     "source": "client:web:abc",
#     "target": "svc:device",
#     "seq": 42,                  // 옵션: 연결 내 순번(순서 보장/재전송 식별에 유용)
#     "traceId": "1-...-...",     // 분산 추적과 연동 시
#     "auth": { "tokenRef": "mi:..."} // 옵션: 권한/토큰 레퍼런스
#   }
# }
