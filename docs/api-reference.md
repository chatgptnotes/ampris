# GridVision SCADA - API Reference

Version 1.0.0 | Base URL: `http://localhost:3001/api`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Real-Time Data](#real-time-data)
3. [Historian](#historian)
4. [Control Operations](#control-operations)
5. [Alarms](#alarms)
6. [Reports](#reports)
7. [Audit](#audit)
8. [WebSocket Events](#websocket-events)

---

## Authentication

All API endpoints (except login and register) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### POST /api/auth/login

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "admin@gridvision.local",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "admin@gridvision.local",
    "name": "Admin",
    "role": "admin"
  },
  "expiresIn": 3600
}
```

**Error (401):**
```json
{
  "error": "Invalid credentials"
}
```

### POST /api/auth/register

Register a new user account (admin only).

**Request Body:**
```json
{
  "email": "operator@gridvision.local",
  "password": "securepassword",
  "name": "John Doe",
  "role": "operator"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "email": "operator@gridvision.local",
  "name": "John Doe",
  "role": "operator"
}
```

### POST /api/auth/refresh

Refresh an expired access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

---

## Real-Time Data

### GET /api/realtime/snapshot

Get the current value of all monitored tags.

**Response (200):**
```json
{
  "timestamp": "2026-03-01T10:30:00Z",
  "tags": [
    {
      "name": "SUB1.TX1.VOLTAGE_33KV",
      "value": 33.2,
      "unit": "kV",
      "quality": "good",
      "timestamp": "2026-03-01T10:30:00Z"
    },
    {
      "name": "SUB1.TX1.CURRENT_R",
      "value": 245.8,
      "unit": "A",
      "quality": "good",
      "timestamp": "2026-03-01T10:30:00Z"
    }
  ]
}
```

### GET /api/realtime/tags

List all available tags with metadata.

**Query Parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `search`  | string | Filter tags by name (partial match) |
| `category`| string | Filter by category (voltage, current, power, temperature) |
| `limit`   | number | Max results (default: 100) |
| `offset`  | number | Pagination offset |

**Response (200):**
```json
{
  "total": 56,
  "tags": [
    {
      "name": "SUB1.TX1.VOLTAGE_33KV",
      "description": "33kV Bus Voltage - Transformer 1",
      "unit": "kV",
      "category": "voltage",
      "min": 28.0,
      "max": 38.0,
      "alarmHigh": 36.3,
      "alarmLow": 29.7
    }
  ]
}
```

---

## Historian

### GET /api/historian/query

Query historical data for specified tags and time range.

**Query Parameters:**

| Parameter    | Type     | Required | Description |
|-------------|----------|----------|-------------|
| `tags`      | string[] | Yes      | Comma-separated tag names |
| `startTime` | string   | Yes      | ISO 8601 start time |
| `endTime`   | string   | Yes      | ISO 8601 end time |
| `interval`  | string   | No       | Aggregation interval (1m, 5m, 15m, 1h, 1d) |
| `aggregate` | string   | No       | Aggregation function (avg, min, max, sum, count) |

**Example:**
```
GET /api/historian/query?tags=SUB1.TX1.VOLTAGE_33KV,SUB1.TX1.CURRENT_R&startTime=2026-03-01T00:00:00Z&endTime=2026-03-01T12:00:00Z&interval=5m&aggregate=avg
```

**Response (200):**
```json
{
  "startTime": "2026-03-01T00:00:00Z",
  "endTime": "2026-03-01T12:00:00Z",
  "interval": "5m",
  "series": [
    {
      "tag": "SUB1.TX1.VOLTAGE_33KV",
      "data": [
        { "timestamp": "2026-03-01T00:00:00Z", "value": 33.1, "quality": "good" },
        { "timestamp": "2026-03-01T00:05:00Z", "value": 33.2, "quality": "good" }
      ]
    }
  ]
}
```

### GET /api/historian/latest

Get the most recent historical values for specified tags.

**Query Parameters:**

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `tags`    | string[] | Yes      | Comma-separated tag names |
| `count`   | number   | No       | Number of recent values per tag (default: 1) |

**Response (200):**
```json
{
  "tags": [
    {
      "name": "SUB1.TX1.VOLTAGE_33KV",
      "values": [
        { "timestamp": "2026-03-01T10:30:00Z", "value": 33.2, "quality": "good" }
      ]
    }
  ]
}
```

### GET /api/historian/statistics

Get statistical summary for tags over a time range.

**Query Parameters:**

| Parameter    | Type     | Required | Description |
|-------------|----------|----------|-------------|
| `tags`      | string[] | Yes      | Comma-separated tag names |
| `startTime` | string   | Yes      | ISO 8601 start time |
| `endTime`   | string   | Yes      | ISO 8601 end time |

**Response (200):**
```json
{
  "statistics": [
    {
      "tag": "SUB1.TX1.VOLTAGE_33KV",
      "min": 32.8,
      "max": 33.5,
      "avg": 33.15,
      "stdDev": 0.12,
      "count": 1440,
      "minTimestamp": "2026-03-01T03:15:00Z",
      "maxTimestamp": "2026-03-01T14:30:00Z"
    }
  ]
}
```

---

## Control Operations

### POST /api/control/execute

Execute a control operation (requires Operator or Admin role).

**Request Body:**
```json
{
  "device": "SUB1.CB1",
  "command": "open",
  "parameters": {},
  "reason": "Scheduled maintenance"
}
```

**Supported Commands:**

| Device Type      | Commands |
|-----------------|----------|
| Circuit Breaker | `open`, `close` |
| Tap Changer     | `raise`, `lower`, `set_position` |
| Isolator        | `open`, `close` |

**Response (202):**
```json
{
  "commandId": "uuid",
  "device": "SUB1.CB1",
  "command": "open",
  "status": "queued",
  "operator": "admin@gridvision.local",
  "timestamp": "2026-03-01T10:30:00Z",
  "expiresAt": "2026-03-01T10:30:30Z"
}
```

### GET /api/control/queue

Get pending and recent control commands.

**Query Parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `status`  | string | Filter by status (queued, executing, completed, failed, expired) |
| `limit`   | number | Max results (default: 50) |

**Response (200):**
```json
{
  "commands": [
    {
      "commandId": "uuid",
      "device": "SUB1.CB1",
      "command": "open",
      "status": "completed",
      "operator": "admin@gridvision.local",
      "timestamp": "2026-03-01T10:30:00Z",
      "completedAt": "2026-03-01T10:30:02Z",
      "result": "success"
    }
  ]
}
```

---

## Alarms

### GET /api/alarms

Get alarms with filtering and pagination.

**Query Parameters:**

| Parameter  | Type   | Description |
|-----------|--------|-------------|
| `state`   | string | Filter: active, acknowledged, cleared, all (default: all) |
| `priority`| string | Filter: critical, high, medium, low |
| `startTime`| string | ISO 8601 start time |
| `endTime` | string | ISO 8601 end time |
| `tag`     | string | Filter by tag name (partial match) |
| `limit`   | number | Max results (default: 100) |
| `offset`  | number | Pagination offset |
| `sort`    | string | Sort field (timestamp, priority) |
| `order`   | string | Sort order (asc, desc) |

**Response (200):**
```json
{
  "total": 42,
  "alarms": [
    {
      "id": "uuid",
      "tag": "SUB1.TX1.WINDING_TEMP",
      "description": "Transformer winding temperature high",
      "priority": "high",
      "state": "active",
      "value": 95.2,
      "threshold": 90.0,
      "unit": "C",
      "timestamp": "2026-03-01T10:25:00Z",
      "acknowledgedBy": null,
      "acknowledgedAt": null,
      "notes": null
    }
  ]
}
```

### POST /api/alarms/:id/acknowledge

Acknowledge an active alarm.

**Request Body:**
```json
{
  "notes": "Operator aware, monitoring transformer load"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "state": "acknowledged",
  "acknowledgedBy": "admin@gridvision.local",
  "acknowledgedAt": "2026-03-01T10:35:00Z",
  "notes": "Operator aware, monitoring transformer load"
}
```

---

## Reports

### GET /api/reports/daily

Generate or retrieve the daily report.

**Query Parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `date`    | string | Date in YYYY-MM-DD format (default: today) |
| `format`  | string | Output format: json, csv (default: json) |

**Response (200):**
```json
{
  "date": "2026-03-01",
  "summary": {
    "peakDemand": { "value": 12.5, "unit": "MW", "time": "14:30" },
    "totalEnergy": { "value": 245.6, "unit": "MWh" },
    "avgPowerFactor": 0.95,
    "avgVoltage33kV": 33.1,
    "avgVoltage11kV": 11.02,
    "totalAlarms": 12,
    "criticalAlarms": 1
  },
  "hourlyLoad": [
    { "hour": 0, "activePower": 8.2, "reactivePower": 2.1 },
    { "hour": 1, "activePower": 7.8, "reactivePower": 2.0 }
  ]
}
```

### GET /api/reports/monthly

Generate or retrieve the monthly report.

**Query Parameters:**

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `year`    | number | Year (default: current) |
| `month`   | number | Month 1-12 (default: current) |
| `format`  | string | Output format: json, csv (default: json) |

**Response (200):**
```json
{
  "year": 2026,
  "month": 2,
  "summary": {
    "totalEnergy": { "value": 7234.5, "unit": "MWh" },
    "peakDemand": { "value": 15.2, "unit": "MW", "date": "2026-02-15" },
    "availability": 99.7,
    "totalAlarms": 156,
    "mttr": { "value": 12.5, "unit": "minutes" }
  },
  "dailyTotals": [
    { "date": "2026-02-01", "energy": 245.6, "peakDemand": 12.5 }
  ]
}
```

### GET /api/reports/custom

Generate a custom report.

**Query Parameters:**

| Parameter    | Type     | Required | Description |
|-------------|----------|----------|-------------|
| `startDate` | string   | Yes      | Start date (YYYY-MM-DD) |
| `endDate`   | string   | Yes      | End date (YYYY-MM-DD) |
| `metrics`   | string[] | Yes      | Comma-separated: energy, demand, voltage, alarms |
| `format`    | string   | No       | json, csv (default: json) |

---

## Audit

### GET /api/audit/logs

Retrieve audit log entries (admin and supervisor only).

**Query Parameters:**

| Parameter    | Type   | Description |
|-------------|--------|-------------|
| `startTime` | string | ISO 8601 start time |
| `endTime`   | string | ISO 8601 end time |
| `user`      | string | Filter by user email |
| `action`    | string | Filter: login, logout, control, alarm_ack, config_change |
| `limit`     | number | Max results (default: 100) |
| `offset`    | number | Pagination offset |

**Response (200):**
```json
{
  "total": 1250,
  "logs": [
    {
      "id": "uuid",
      "timestamp": "2026-03-01T10:30:00Z",
      "user": "admin@gridvision.local",
      "action": "control",
      "details": "Opened circuit breaker SUB1.CB1",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0..."
    }
  ]
}
```

---

## WebSocket Events

Connect to `ws://localhost:3001/ws` for real-time updates.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onopen = () => {
  // Subscribe to channels
  ws.send(JSON.stringify({ type: 'subscribe', channels: ['realtime', 'alarms'] }));
};
```

### Event Types

#### realtime:update
```json
{
  "type": "realtime:update",
  "timestamp": "2026-03-01T10:30:01Z",
  "tags": [
    { "name": "SUB1.TX1.VOLTAGE_33KV", "value": 33.2, "quality": "good" }
  ]
}
```

#### alarm:new
```json
{
  "type": "alarm:new",
  "alarm": {
    "id": "uuid",
    "tag": "SUB1.TX1.WINDING_TEMP",
    "priority": "high",
    "value": 95.2,
    "timestamp": "2026-03-01T10:25:00Z"
  }
}
```

#### alarm:cleared
```json
{
  "type": "alarm:cleared",
  "alarmId": "uuid",
  "clearedAt": "2026-03-01T10:35:00Z"
}
```

#### control:status
```json
{
  "type": "control:status",
  "commandId": "uuid",
  "status": "completed",
  "result": "success"
}
```
