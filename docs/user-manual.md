# GridVision SCADA - User Manual

Version 1.0.0 | GridVision Technologies

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Alarm Management](#alarm-management)
4. [Trends & Historical Data](#trends--historical-data)
5. [Single Line Diagram (SLD)](#single-line-diagram)
6. [Control Operations](#control-operations)
7. [Reports & Analytics](#reports--analytics)
8. [User Management & Roles](#user-management--roles)
9. [Settings & Configuration](#settings--configuration)
10. [Notifications](#notifications)

---

## Getting Started

### Logging In

1. Open your browser to `http://localhost:5173` (or your configured URL)
2. Enter your credentials:
   - **Default Admin**: admin@gridvision.local / admin123
3. Click **Sign In**

### First-Time Setup

After logging in for the first time:

1. Navigate to **Settings** to change the default admin password
2. Configure your substation parameters
3. Set up alarm thresholds appropriate for your equipment
4. Create user accounts for operators and supervisors

### Navigation

The main navigation sidebar provides access to all modules:

- **Dashboard** — Real-time overview of all substations
- **SLD** — Single Line Diagram with live overlays
- **Alarms** — Active and historical alarm management
- **Trends** — Real-time and historical trend charts
- **Reports** — Daily, monthly, and custom reports
- **Analytics** — Advanced data analysis and predictions
- **Control** — Equipment control operations
- **Settings** — System configuration

---

## Dashboard Overview

The dashboard provides a comprehensive real-time view of your substation.

### Key Panels

#### Power Summary
- **Total Active Power (MW)** — Aggregate load across all feeders
- **Total Reactive Power (MVAR)** — Reactive power measurement
- **Power Factor** — System-wide power factor
- **Frequency (Hz)** — Grid frequency

#### Voltage Overview
- 33kV bus voltage (incoming)
- 11kV bus voltage (outgoing)
- Per-feeder voltage readings

#### Current Monitoring
- Per-feeder current readings (Amps)
- Phase-wise current display (R, Y, B)
- Current loading percentage bars

#### Transformer Status
- Temperature readings (winding, oil)
- Tap changer position
- Loading percentage
- Oil level indication

#### Environmental
- Ambient temperature
- Humidity
- Wind speed (for outdoor substations)

### Live Updates

All dashboard values update in real-time via WebSocket connections. The green pulse indicator in the header confirms the live connection is active.

### Quick Actions

- Click any feeder card to jump to its detailed SLD view
- Click an alarm count badge to view filtered alarms
- Click trend sparklines to open full trend charts

---

## Alarm Management

### Alarm Priorities

GridVision uses four alarm priority levels:

| Priority | Color  | Description | Example |
|----------|--------|-------------|---------|
| Critical | Red    | Immediate action required | Overcurrent trip, transformer failure |
| High     | Orange | Urgent attention needed | Voltage deviation > 10% |
| Medium   | Yellow | Monitor closely | Temperature approaching limit |
| Low      | Blue   | Informational | Communication glitch |

### Active Alarms Panel

- Displays all currently active (unacknowledged) alarms
- Sorted by priority (critical first) and timestamp
- Shows: Tag name, description, priority, value, timestamp

### Acknowledging Alarms

1. Click the alarm row to expand details
2. Click **Acknowledge** button
3. Enter optional notes explaining the action taken
4. The alarm moves from Active to Acknowledged state

### Alarm Filtering

Filter alarms by:
- **Priority** — Critical, High, Medium, Low
- **State** — Active, Acknowledged, Cleared
- **Time Range** — Last hour, 24 hours, 7 days, custom
- **Tag/Source** — Search by tag name or equipment
- **Category** — Voltage, Current, Temperature, Communication

### Alarm History

Access historical alarms through the Alarm History tab. Export alarm data to CSV for external analysis.

### Alarm Configuration

Administrators can configure:
- Alarm thresholds (high-high, high, low, low-low)
- Deadband values to prevent alarm chatter
- Escalation rules and notification targets
- Alarm shelving (temporary suppression)

---

## Trends & Historical Data

### Real-Time Trends

1. Navigate to **Trends** from the sidebar
2. Select tags to plot using the tag selector
3. Multiple tags can be plotted simultaneously (up to 8)
4. Trends auto-scroll showing the last 5 minutes by default

### Historical Queries

1. Click **Historical** tab
2. Set the date/time range
3. Select tags to query
4. Click **Query**
5. Data loads with interactive pan/zoom

### Trend Controls

- **Zoom** — Mouse wheel or pinch gesture
- **Pan** — Click and drag on the chart
- **Cursor** — Hover for exact values at any timestamp
- **Reset** — Double-click to reset zoom level

### Data Export

Click **Export** to download trend data as:
- CSV (spreadsheet compatible)
- JSON (for API integration)

---

## Single Line Diagram

The SLD provides a graphical representation of the electrical network.

### Navigation

- **Pan** — Click and drag the canvas
- **Zoom** — Mouse wheel or pinch to zoom
- **Fit** — Click the "Fit" button to auto-fit the diagram

### Live Overlays

The SLD displays real-time values overlaid on equipment:
- Voltage readings at each bus
- Current flow on feeders (with direction arrows)
- Circuit breaker status (green = closed, red = open)
- Transformer tap position
- Power flow values

### Equipment Interaction

Click any equipment on the SLD to:
- View detailed readings
- Access historical trends
- Initiate control operations (if authorized)
- View associated alarms

### Status Indicators

| Symbol | Meaning |
|--------|---------|
| Green circle | Equipment energized / CB closed |
| Red circle | Equipment de-energized / CB open |
| Yellow triangle | Warning / alarm active |
| Gray | Communication lost |

---

## Control Operations

**Important**: Control operations modify live equipment. Only authorized personnel (Operator role or above) should execute control commands.

### Circuit Breaker Control

1. Navigate to the SLD or Control Panel
2. Select the circuit breaker
3. Choose **Open** or **Close**
4. Confirm the operation in the dialog
5. Enter your authorization credentials
6. The command is queued and executed

### Tap Changer Control

1. Select the transformer on the SLD
2. Click **Tap Changer**
3. Choose **Raise** or **Lower** (or enter target position)
4. Confirm and authorize

### Control Queue

All control commands are queued and logged:
- View pending commands in **Tools → Control Panel**
- Each command shows: operator, timestamp, command, status
- Commands can be cancelled while pending

### Safety Features

- **Select-Before-Operate (SBO)** — Two-step confirmation
- **Interlocking** — Prevents dangerous switching sequences
- **Timeout** — Commands expire if not executed within 30 seconds
- **Audit Trail** — Every command is permanently logged

---

## Reports & Analytics

### Daily Report

Automatically generated at midnight, includes:
- 24-hour load profile
- Maximum demand and time of occurrence
- Voltage excursions
- Alarm summary
- Energy consumption (kWh)

### Monthly Report

Generated on the 1st of each month:
- Monthly energy totals
- Peak demand analysis
- Availability statistics
- Alarm frequency analysis
- Comparison with previous month

### Custom Reports

1. Navigate to **Reports → Custom**
2. Select date range
3. Choose metrics and parameters
4. Select output format (PDF, CSV, Excel)
5. Click **Generate**

### Analytics Dashboard

The Analytics module provides:
- **Load Forecasting** — Predicted demand based on historical patterns
- **Anomaly Detection** — AI-flagged unusual readings
- **Equipment Health** — Transformer aging analysis
- **Energy Balance** — Loss calculation and tracking
- **Trend Predictions** — Statistical projections

### Exporting Data

All reports support export in multiple formats:
- **PDF** — Formatted report with charts
- **CSV** — Raw data for spreadsheet analysis
- **Excel** — Formatted spreadsheet with charts

---

## User Management & Roles

### Role Hierarchy

| Role       | Permissions |
|------------|-------------|
| **Admin**      | Full system access, user management, configuration |
| **Supervisor** | View all data, acknowledge alarms, generate reports, limited control |
| **Operator**   | View data, acknowledge alarms, execute control operations |
| **Viewer**     | Read-only access to dashboards and trends |

### Managing Users

Administrators can:
1. Navigate to **Settings → Users**
2. Click **Add User** to create new accounts
3. Assign roles and substation access
4. Enable/disable accounts
5. Reset passwords

### Session Security

- Sessions expire after configurable inactivity timeout (default: 30 minutes)
- Concurrent session limit per user
- Failed login attempt lockout (5 attempts)
- All login/logout events are audit logged

---

## Settings & Configuration

### General Settings

- **System Name** — Display name for the installation
- **Time Zone** — System time zone configuration
- **Date Format** — Choose date display format
- **Refresh Interval** — Dashboard update frequency

### Communication Settings

- **Server URL** — Backend API endpoint
- **WebSocket** — Real-time connection settings
- **Protocol Configuration** — Modbus, IEC 61850, DNP3 parameters

### Notification Settings

- **Email** — SMTP configuration for email alerts
- **SMS** — SMS gateway settings (optional)
- **Sound** — Alarm sound configuration

### Data Retention

- **Real-time data** — Buffer size and duration
- **Historical data** — Retention period (default: 1 year)
- **Audit logs** — Retention period (default: 5 years)
- **Alarm history** — Retention period (default: 2 years)

---

## Notifications

### Notification Center

Access the notification center by clicking the bell icon in the header:
- View recent notifications
- Filter by type (alarm, system, info)
- Mark as read or dismiss
- Click to navigate to the source

### Desktop Notifications

When using the Electron desktop app, critical alarms trigger native OS notifications with:
- Taskbar flashing
- Sound alert
- Click-to-focus behavior

### Email Notifications

Configure email alerts in Settings → Notifications:
- Per-alarm-priority email rules
- Escalation chains with delays
- Daily digest option
