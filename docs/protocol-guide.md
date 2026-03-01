# GridVision SCADA - Protocol Integration Guide

Version 1.0.0 | GridVision Technologies

---

## Table of Contents

1. [Overview](#overview)
2. [Modbus TCP](#modbus-tcp)
3. [IEC 61850 (MMS)](#iec-61850-mms)
4. [DNP3](#dnp3)
5. [Simulator Mode](#simulator-mode)
6. [Tag Naming Conventions](#tag-naming-conventions)
7. [Data Point Mapping](#data-point-mapping)

---

## Overview

GridVision SCADA supports three industrial communication protocols for connecting to field devices (IEDs, RTUs, PLCs):

| Protocol    | Standard      | Use Case | Transport |
|------------|---------------|----------|-----------|
| Modbus TCP | Modbus.org    | General purpose, PLCs, meters | TCP/IP |
| IEC 61850  | IEC 61850     | Substation automation, IEDs | MMS over TCP |
| DNP3       | IEEE 1815     | SCADA communication, RTUs | TCP/IP or Serial |

All protocols are configured through the server configuration files and map to the unified tag namespace.

---

## Modbus TCP

### Configuration

Configure Modbus TCP connections in the server environment or configuration:

```json
{
  "modbus": {
    "connections": [
      {
        "id": "meter-1",
        "name": "Main Incomer Meter",
        "host": "192.168.1.100",
        "port": 502,
        "unitId": 1,
        "pollInterval": 1000,
        "timeout": 5000,
        "retries": 3
      }
    ]
  }
}
```

### Register Mapping

Modbus uses register-based addressing:

| Register Type      | Function Code | Address Range | Access |
|-------------------|---------------|---------------|--------|
| Coils             | FC01/FC05     | 0-65535       | R/W    |
| Discrete Inputs   | FC02          | 0-65535       | R      |
| Holding Registers | FC03/FC06     | 0-65535       | R/W    |
| Input Registers   | FC04          | 0-65535       | R      |

### Data Type Mapping

```json
{
  "tags": [
    {
      "name": "SUB1.TX1.VOLTAGE_33KV",
      "connection": "meter-1",
      "registerType": "input",
      "address": 0,
      "dataType": "float32",
      "byteOrder": "big-endian",
      "wordOrder": "big-endian",
      "scaleFactor": 0.1,
      "offset": 0
    },
    {
      "name": "SUB1.CB1.STATUS",
      "connection": "meter-1",
      "registerType": "coil",
      "address": 100,
      "dataType": "boolean"
    }
  ]
}
```

### Supported Data Types

| Type     | Registers | Description |
|----------|-----------|-------------|
| boolean  | 1 coil    | Single bit |
| int16    | 1         | Signed 16-bit integer |
| uint16   | 1         | Unsigned 16-bit integer |
| int32    | 2         | Signed 32-bit integer |
| uint32   | 2         | Unsigned 32-bit integer |
| float32  | 2         | IEEE 754 single precision |
| float64  | 4         | IEEE 754 double precision |

### Byte/Word Order

Common configurations for multi-register values:

| Device Vendor | Byte Order  | Word Order  |
|--------------|-------------|-------------|
| ABB          | Big-endian  | Big-endian  |
| Schneider    | Big-endian  | Big-endian  |
| Siemens      | Big-endian  | Big-endian  |
| GE           | Big-endian  | Little-endian |

---

## IEC 61850 (MMS)

### Overview

IEC 61850 uses a hierarchical data model:
```
Server → Logical Device → Logical Node → Data Object → Data Attribute
```

### Configuration

```json
{
  "iec61850": {
    "connections": [
      {
        "id": "ied-bay1",
        "name": "Bay 1 Protection IED",
        "host": "192.168.1.200",
        "port": 102,
        "iedName": "BAY1_P",
        "pollInterval": 1000,
        "reportControlBlocks": ["brcbStatus01", "urcbMeas01"]
      }
    ]
  }
}
```

### Data Model Mapping

IEC 61850 logical nodes commonly used in substations:

| Logical Node | Class | Description |
|-------------|-------|-------------|
| XCBR        | Circuit Breaker | CB status and control |
| XSWI        | Disconnector | Isolator status and control |
| MMXU        | Measurement | Voltage, current, power |
| MMTR        | Metering | Energy measurements |
| PTOC        | Overcurrent | Protection functions |
| PTOV        | Overvoltage | Voltage protection |
| CSWI        | Switch Controller | Control operations |
| GGIO        | Generic I/O | General purpose signals |

### Tag Mapping Example

```json
{
  "tags": [
    {
      "name": "SUB1.TX1.VOLTAGE_33KV",
      "connection": "ied-bay1",
      "reference": "BAY1_P/MMXU1.PhV.phsA.cVal.mag.f",
      "triggerOption": "report"
    },
    {
      "name": "SUB1.CB1.STATUS",
      "connection": "ied-bay1",
      "reference": "BAY1_P/XCBR1.Pos.stVal",
      "triggerOption": "report"
    }
  ]
}
```

### GOOSE Messages

For high-speed tripping and interlocking, configure GOOSE subscriptions:

```json
{
  "goose": {
    "subscriptions": [
      {
        "appId": "0x0001",
        "multicastAddress": "01:0C:CD:01:00:01",
        "dataSet": "BAY1_P/LLN0$GOOSEDataSet1",
        "confRev": 1
      }
    ]
  }
}
```

---

## DNP3

### Configuration

```json
{
  "dnp3": {
    "connections": [
      {
        "id": "rtu-1",
        "name": "Remote Terminal Unit 1",
        "host": "192.168.1.150",
        "port": 20000,
        "masterAddress": 1,
        "outStationAddress": 10,
        "pollInterval": 2000,
        "integrityPollInterval": 60000,
        "unsolicitedEnabled": true
      }
    ]
  }
}
```

### Data Point Types

| DNP3 Type               | Index | Description |
|-------------------------|-------|-------------|
| Binary Input            | 0-n   | Digital status (CB position, alarms) |
| Binary Output           | 0-n   | Digital control (CB trip/close) |
| Analog Input            | 0-n   | Measured values (voltage, current) |
| Analog Output           | 0-n   | Setpoints (tap position) |
| Counter                 | 0-n   | Accumulated values (energy pulses) |

### Tag Mapping

```json
{
  "tags": [
    {
      "name": "SUB1.TX1.VOLTAGE_33KV",
      "connection": "rtu-1",
      "pointType": "analogInput",
      "index": 0,
      "scaleFactor": 0.01,
      "offset": 0,
      "deadband": 0.1
    },
    {
      "name": "SUB1.CB1.STATUS",
      "connection": "rtu-1",
      "pointType": "binaryInput",
      "index": 0
    }
  ]
}
```

### Control Operations

DNP3 supports Select-Before-Operate (SBO) for safety:

```json
{
  "control": {
    "device": "SUB1.CB1",
    "pointType": "binaryOutput",
    "index": 0,
    "operationType": "selectBeforeOperate",
    "tripValue": "LATCH_ON",
    "closeValue": "LATCH_OFF",
    "timeout": 5000
  }
}
```

---

## Simulator Mode

GridVision includes a built-in simulator for testing and demonstration without real field devices.

### Enabling Simulator

The simulator runs automatically when no real device connections are configured. It generates realistic data for 50+ tags across a model substation.

### Simulated Tags

The simulator generates the following tag categories:

| Category        | Tags | Update Rate | Profile |
|----------------|------|-------------|---------|
| Voltage (33kV) | 4    | 1s          | Day/night with noise |
| Voltage (11kV) | 8    | 1s          | Load-dependent |
| Current        | 16   | 1s          | Load profile |
| Power          | 8    | 1s          | Calculated |
| Temperature    | 6    | 5s          | Thermal model |
| Frequency      | 1    | 1s          | Stable with drift |
| CB Status      | 8    | Event-based | Random events |
| Tap Position   | 2    | Event-based | Voltage regulation |

### Day/Night Profiles

The simulator models realistic load profiles:

- **Night (00:00–06:00)**: Low load, ~40% of peak
- **Morning Ramp (06:00–09:00)**: Increasing load
- **Day Peak (09:00–17:00)**: Peak load, ~90-100%
- **Evening Peak (17:00–21:00)**: Secondary peak, ~80-95%
- **Night Ramp (21:00–00:00)**: Decreasing load

### Simulated Events

The simulator periodically generates:
- Voltage sags and swells
- Overcurrent events
- Temperature excursions
- CB trip/close operations
- Communication failures

---

## Tag Naming Conventions

GridVision uses a hierarchical dot-separated tag naming convention:

```
<Substation>.<Equipment>.<Measurement>
```

### Structure

| Level        | Format   | Example | Description |
|-------------|----------|---------|-------------|
| Substation  | SUBn     | SUB1    | Substation identifier |
| Equipment   | TYPE+ID  | TX1     | Equipment type + number |
| Measurement | NAME     | VOLTAGE_33KV | Measurement name |

### Equipment Type Codes

| Code | Equipment |
|------|-----------|
| TX   | Transformer |
| CB   | Circuit Breaker |
| ISO  | Isolator |
| FDR  | Feeder |
| BUS  | Busbar |
| CAP  | Capacitor Bank |
| PT   | Potential Transformer |
| CT   | Current Transformer |

### Measurement Names

| Name            | Unit | Description |
|----------------|------|-------------|
| VOLTAGE_33KV   | kV   | 33kV voltage |
| VOLTAGE_11KV   | kV   | 11kV voltage |
| CURRENT_R      | A    | Phase R current |
| CURRENT_Y      | A    | Phase Y current |
| CURRENT_B      | A    | Phase B current |
| ACTIVE_POWER   | MW   | Active power |
| REACTIVE_POWER | MVAR | Reactive power |
| POWER_FACTOR   | -    | Power factor |
| FREQUENCY      | Hz   | System frequency |
| WINDING_TEMP   | C    | Winding temperature |
| OIL_TEMP       | C    | Oil temperature |
| OIL_LEVEL      | %    | Oil level percentage |
| TAP_POSITION   | -    | Tap changer position |
| STATUS         | -    | Binary status (0/1) |
| LOADING        | %    | Loading percentage |

### Tag Examples

```
SUB1.TX1.VOLTAGE_33KV     → Substation 1, Transformer 1, 33kV Voltage
SUB1.TX1.WINDING_TEMP     → Substation 1, Transformer 1, Winding Temperature
SUB1.CB1.STATUS            → Substation 1, Circuit Breaker 1, Open/Closed Status
SUB1.FDR1.CURRENT_R        → Substation 1, Feeder 1, Phase R Current
SUB1.BUS.VOLTAGE_11KV      → Substation 1, 11kV Bus Voltage
```

---

## Data Point Mapping

### Mapping Workflow

1. **Identify field devices** — List IEDs, RTUs, meters with IP addresses
2. **Document registers** — Get register maps from device manuals
3. **Create tag names** — Follow the naming convention above
4. **Configure connections** — Add device connections to config
5. **Map data points** — Associate tags with device registers
6. **Set scaling** — Configure scale factors and offsets
7. **Configure alarms** — Set alarm thresholds per tag
8. **Test** — Verify readings match expected values

### Example: Mapping a Power Meter

For an ABB B23 power meter on Modbus TCP:

```json
{
  "connection": {
    "id": "meter-incomer",
    "host": "192.168.1.100",
    "port": 502,
    "unitId": 1
  },
  "mapping": [
    { "tag": "SUB1.TX1.VOLTAGE_33KV", "register": 0x5000, "type": "float32", "scale": 0.001 },
    { "tag": "SUB1.TX1.CURRENT_R", "register": 0x5002, "type": "float32", "scale": 0.001 },
    { "tag": "SUB1.TX1.CURRENT_Y", "register": 0x5004, "type": "float32", "scale": 0.001 },
    { "tag": "SUB1.TX1.CURRENT_B", "register": 0x5006, "type": "float32", "scale": 0.001 },
    { "tag": "SUB1.TX1.ACTIVE_POWER", "register": 0x5012, "type": "float32", "scale": 0.001 },
    { "tag": "SUB1.TX1.REACTIVE_POWER", "register": 0x5014, "type": "float32", "scale": 0.001 },
    { "tag": "SUB1.TX1.POWER_FACTOR", "register": 0x5016, "type": "float32", "scale": 0.001 },
    { "tag": "SUB1.TX1.FREQUENCY", "register": 0x5018, "type": "float32", "scale": 0.001 }
  ]
}
```

### Common Pitfalls

1. **Byte order mismatch** — Always verify the device's byte/word order
2. **Scaling errors** — Check if values need scaling (some devices use raw integers)
3. **Address offset** — Some devices use 0-based, others 1-based addressing
4. **Register size** — Verify if float values span 2 or 4 registers
5. **Poll rate** — Don't poll faster than the device can respond
6. **Timeout tuning** — Increase timeout for slow networks or RS485 converters
