import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import {
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Magnet,
  Eye,
  Trash2,
  Copy,
  RotateCw,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Type,
  Square,
  Circle,
  Minus,
  ArrowUpToLine,
  ArrowDownToLine,
  Search,
  FileText,
  Link,
  Home,
  ArrowLeft,
} from 'lucide-react';
import * as ScadaSymbols from '@/components/scada-symbols';

// ─── Symbol type → Component mapping ─────────────
const SYMBOL_MAP: Record<string, React.ComponentType<any>> = {
  CB: ScadaSymbols.CBSymbol,
  VacuumCB: ScadaSymbols.VacuumCBSymbol,
  SF6CB: ScadaSymbols.SF6CBSymbol,
  ACB: ScadaSymbols.ACBSymbol,
  MCCB: ScadaSymbols.MCCBSymbol,
  MCB: ScadaSymbols.MCBSymbol,
  RCCB: ScadaSymbols.RCCBSymbol,
  Isolator: ScadaSymbols.IsolatorSymbol,
  EarthSwitch: ScadaSymbols.EarthSwitchSymbol,
  Fuse: ScadaSymbols.FuseSymbol,
  Contactor: ScadaSymbols.ContactorSymbol,
  LoadBreakSwitch: ScadaSymbols.LoadBreakSwitchSymbol,
  AutoRecloser: ScadaSymbols.AutoRecloserSymbol,
  Sectionalizer: ScadaSymbols.SectionalizerSymbol,
  RingMainUnit: ScadaSymbols.RingMainUnitSymbol,
  GIS: ScadaSymbols.GISSymbol,
  Transformer: ScadaSymbols.TransformerSymbol,
  AutoTransformer: ScadaSymbols.AutoTransformerSymbol,
  ZigZagTransformer: ScadaSymbols.ZigZagTransformerSymbol,
  InstrumentTransformer: ScadaSymbols.InstrumentTransformerSymbol,
  StepVoltageRegulator: ScadaSymbols.StepVoltageRegulatorSymbol,
  ShuntReactor: ScadaSymbols.ShuntReactorSymbol,
  SeriesReactor: ScadaSymbols.SeriesReactorSymbol,
  SaturableReactor: ScadaSymbols.SaturableReactorSymbol,
  Reactor: ScadaSymbols.ReactorSymbol,
  Generator: ScadaSymbols.GeneratorSymbol,
  SyncGenerator: ScadaSymbols.SyncGeneratorSymbol,
  Motor: ScadaSymbols.MotorSymbol,
  AsyncMotor: ScadaSymbols.AsyncMotorSymbol,
  SyncMotor: ScadaSymbols.SyncMotorSymbol,
  VFD: ScadaSymbols.VFDSymbol,
  SoftStarter: ScadaSymbols.SoftStarterSymbol,
  Rectifier: ScadaSymbols.RectifierSymbol,
  Inverter: ScadaSymbols.InverterSymbol,
  UPSDetail: ScadaSymbols.UPSDetailSymbol,
  StaticTransferSwitch: ScadaSymbols.StaticTransferSwitchSymbol,
  SVC: ScadaSymbols.SVCSymbol,
  STATCOM: ScadaSymbols.STATCOMSymbol,
  Thyristor: ScadaSymbols.ThyristorSymbol,
  CapacitorBank: ScadaSymbols.CapacitorBankSymbol,
  Battery: ScadaSymbols.BatterySymbol,
  SolarPanel: ScadaSymbols.SolarPanelSymbol,
  SolarInverter: ScadaSymbols.SolarInverterSymbol,
  WindTurbine: ScadaSymbols.WindTurbineSymbol,
  BESS: ScadaSymbols.BESSSymbol,
  SolarString: ScadaSymbols.SolarStringSymbol,
  CT: ScadaSymbols.CTSymbol,
  PT: ScadaSymbols.PTSymbol,
  Meter: ScadaSymbols.MeterSymbol,
  Transducer: ScadaSymbols.TransducerSymbol,
  EnergyMeter: ScadaSymbols.EnergyMeterSymbol,
  PowerAnalyzer: ScadaSymbols.PowerAnalyzerSymbol,
  MaxDemandIndicator: ScadaSymbols.MaxDemandIndicatorSymbol,
  FrequencyMeter: ScadaSymbols.FrequencyMeterSymbol,
  Synchroscope: ScadaSymbols.SynchroscopeSymbol,
  PowerFactorMeter: ScadaSymbols.PowerFactorMeterSymbol,
  Ammeter: ScadaSymbols.AmmeterSymbol,
  Voltmeter: ScadaSymbols.VoltmeterSymbol,
  Wattmeter: ScadaSymbols.WattmeterSymbol,
  Relay: ScadaSymbols.RelaySymbol,
  OvercurrentRelay: ScadaSymbols.OvercurrentRelaySymbol,
  EarthFaultRelay: ScadaSymbols.EarthFaultRelaySymbol,
  DistanceRelay: ScadaSymbols.DistanceRelaySymbol,
  DifferentialRelay: ScadaSymbols.DifferentialRelaySymbol,
  DirectionalRelay: ScadaSymbols.DirectionalRelaySymbol,
  UnderFrequencyRelay: ScadaSymbols.UnderFrequencyRelaySymbol,
  OverFrequencyRelay: ScadaSymbols.OverFrequencyRelaySymbol,
  LockoutRelay: ScadaSymbols.LockoutRelaySymbol,
  BuchholzRelay: ScadaSymbols.BuchholzRelaySymbol,
  OvervoltageRelay: ScadaSymbols.OvervoltageRelaySymbol,
  UndervoltageRelay: ScadaSymbols.UndervoltageRelaySymbol,
  NegativeSequenceRelay: ScadaSymbols.NegativeSequenceRelaySymbol,
  ThermalOverloadRelay: ScadaSymbols.ThermalOverloadRelaySymbol,
  ReversePowerRelay: ScadaSymbols.ReversePowerRelaySymbol,
  SynchCheckRelay: ScadaSymbols.SynchCheckRelaySymbol,
  BusBar: ScadaSymbols.BusBarSymbol,
  DoubleBusBar: ScadaSymbols.DoubleBusBarSymbol,
  BusSection: ScadaSymbols.BusSectionSymbol,
  BusTie: ScadaSymbols.BusTieSymbol,
  Cable: ScadaSymbols.CableSymbol,
  OverheadLine: ScadaSymbols.OverheadLineSymbol,
  UndergroundCable: ScadaSymbols.UndergroundCableSymbol,
  Junction: ScadaSymbols.JunctionSymbol,
  Crossover: ScadaSymbols.CrossoverSymbol,
  Terminal: ScadaSymbols.TerminalSymbol,
  LightningArrester: ScadaSymbols.LightningArresterSymbol,
  Ground: ScadaSymbols.GroundSymbol,
  Feeder: ScadaSymbols.FeederSymbol,
  IndicatorLamp: ScadaSymbols.IndicatorLampSymbol,
  AlarmHorn: ScadaSymbols.AlarmHornSymbol,
  PushButton: ScadaSymbols.PushButtonSymbol,
  SelectorSwitch: ScadaSymbols.SelectorSwitchSymbol,
  LEDIndicator: ScadaSymbols.LEDIndicatorSymbol,
  DigitalDisplay: ScadaSymbols.DigitalDisplaySymbol,
  Annunciator: ScadaSymbols.AnnunciatorSymbol,
  Panel: ScadaSymbols.PanelSymbol,
  MCC: ScadaSymbols.MCCSymbol,
  PLC: ScadaSymbols.PLCSymbol,
  HMI: ScadaSymbols.HMISymbol,
  Communication: ScadaSymbols.CommunicationSymbol,
  Antenna: ScadaSymbols.AntennaSymbol,
  Enclosure: ScadaSymbols.EnclosureSymbol,
  Valve: ScadaSymbols.ValveSymbol,
  Pump: ScadaSymbols.PumpSymbol,
  Compressor: ScadaSymbols.CompressorSymbol,
  Tank: ScadaSymbols.TankSymbol,
  HeatExchanger: ScadaSymbols.HeatExchangerSymbol,
  Filter: ScadaSymbols.FilterSymbol,
  FlowMeter: ScadaSymbols.FlowMeterSymbol,
  PressureGauge: ScadaSymbols.PressureGaugeSymbol,
  TemperatureSensor: ScadaSymbols.TemperatureSensorSymbol,
  LevelSensor: ScadaSymbols.LevelSensorSymbol,
  DGSet: ScadaSymbols.DGSetSymbol,
  AVR: ScadaSymbols.AVRSymbol,
  RTCC: ScadaSymbols.RTCCSymbol,
};

// ─── Types ───────────────────────────────────────
interface MimicElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  properties: {
    tagBinding?: string;
    label?: string;
    fontSize?: number;
    color?: string;
    animationRules?: { condition: string; property: string; value: string }[];
    text?: string;
    shapeType?: string;
    strokeWidth?: number;
    fill?: string;
    stroke?: string;
    [key: string]: any;
  };
}

interface MimicConnection {
  id: string;
  fromId: string;
  toId: string;
  points: { x: number; y: number }[];
  color: string;
  thickness: number;
}

interface PageData {
  id: string;
  name: string;
  projectId: string;
  pageOrder: number;
  width: number;
  height: number;
  backgroundColor: string;
  gridSize: number;
  elements: MimicElement[];
  connections: MimicConnection[];
  isHomePage: boolean;
}

interface ProjectData {
  id: string;
  name: string;
  mimicPages: { id: string; name: string; pageOrder: number; isHomePage: boolean }[];
  userRole: string;
}

// ─── Symbol Palette ──────────────────────────────
const SYMBOL_CATEGORIES = [
  {
    name: 'Switchgear',
    symbols: [
      { type: 'CB', label: 'Circuit Breaker', w: 60, h: 60 },
      { type: 'VacuumCB', label: 'Vacuum CB', w: 60, h: 60 },
      { type: 'SF6CB', label: 'SF6 CB', w: 60, h: 60 },
      { type: 'ACB', label: 'ACB', w: 60, h: 60 },
      { type: 'MCCB', label: 'MCCB', w: 60, h: 60 },
      { type: 'MCB', label: 'MCB', w: 50, h: 50 },
      { type: 'RCCB', label: 'RCCB', w: 60, h: 60 },
      { type: 'Isolator', label: 'Isolator', w: 60, h: 40 },
      { type: 'EarthSwitch', label: 'Earth Switch', w: 50, h: 50 },
      { type: 'Fuse', label: 'Fuse', w: 40, h: 50 },
      { type: 'Contactor', label: 'Contactor', w: 60, h: 60 },
      { type: 'LoadBreakSwitch', label: 'Load Break Switch', w: 60, h: 50 },
      { type: 'AutoRecloser', label: 'Auto Recloser', w: 60, h: 60 },
      { type: 'Sectionalizer', label: 'Sectionalizer', w: 60, h: 60 },
      { type: 'RingMainUnit', label: 'RMU', w: 80, h: 60 },
      { type: 'GIS', label: 'GIS', w: 70, h: 60 },
    ],
  },
  {
    name: 'Transformers & Reactors',
    symbols: [
      { type: 'Transformer', label: 'Transformer', w: 80, h: 100 },
      { type: 'AutoTransformer', label: 'Auto Transformer', w: 60, h: 70 },
      { type: 'ZigZagTransformer', label: 'Zig-Zag Xfmr', w: 60, h: 70 },
      { type: 'InstrumentTransformer', label: 'Instr. Xfmr', w: 60, h: 60 },
      { type: 'StepVoltageRegulator', label: 'SVR', w: 60, h: 70 },
      { type: 'ShuntReactor', label: 'Shunt Reactor', w: 60, h: 60 },
      { type: 'SeriesReactor', label: 'Series Reactor', w: 60, h: 50 },
      { type: 'SaturableReactor', label: 'Sat. Reactor', w: 60, h: 60 },
      { type: 'Reactor', label: 'Reactor', w: 50, h: 60 },
    ],
  },
  {
    name: 'Rotating Machines',
    symbols: [
      { type: 'Generator', label: 'Generator', w: 70, h: 70 },
      { type: 'SyncGenerator', label: 'Sync Gen', w: 70, h: 60 },
      { type: 'Motor', label: 'Motor', w: 70, h: 70 },
      { type: 'AsyncMotor', label: 'Induction Motor', w: 60, h: 60 },
      { type: 'SyncMotor', label: 'Sync Motor', w: 60, h: 60 },
      { type: 'VFD', label: 'VFD', w: 80, h: 60 },
      { type: 'SoftStarter', label: 'Soft Starter', w: 70, h: 60 },
    ],
  },
  {
    name: 'Power Electronics',
    symbols: [
      { type: 'Rectifier', label: 'Rectifier', w: 60, h: 50 },
      { type: 'Inverter', label: 'Inverter', w: 60, h: 50 },
      { type: 'UPSDetail', label: 'UPS System', w: 100, h: 50 },
      { type: 'StaticTransferSwitch', label: 'STS', w: 80, h: 50 },
      { type: 'SVC', label: 'SVC', w: 70, h: 60 },
      { type: 'STATCOM', label: 'STATCOM', w: 70, h: 60 },
      { type: 'Thyristor', label: 'Thyristor', w: 50, h: 50 },
      { type: 'CapacitorBank', label: 'Capacitor Bank', w: 60, h: 60 },
      { type: 'Battery', label: 'Battery', w: 60, h: 40 },
    ],
  },
  {
    name: 'Renewable Energy',
    symbols: [
      { type: 'SolarPanel', label: 'Solar Panel', w: 60, h: 50 },
      { type: 'SolarInverter', label: 'Solar Inverter', w: 70, h: 50 },
      { type: 'WindTurbine', label: 'Wind Turbine', w: 60, h: 60 },
      { type: 'BESS', label: 'BESS', w: 80, h: 50 },
      { type: 'SolarString', label: 'Solar String', w: 80, h: 50 },
    ],
  },
  {
    name: 'Metering',
    symbols: [
      { type: 'CT', label: 'CT', w: 50, h: 40 },
      { type: 'PT', label: 'PT', w: 50, h: 40 },
      { type: 'Meter', label: 'Meter', w: 60, h: 60 },
      { type: 'Transducer', label: 'Transducer', w: 50, h: 50 },
      { type: 'EnergyMeter', label: 'Energy Meter', w: 50, h: 50 },
      { type: 'PowerAnalyzer', label: 'Power Analyzer', w: 50, h: 50 },
      { type: 'MaxDemandIndicator', label: 'Max Demand', w: 50, h: 50 },
      { type: 'FrequencyMeter', label: 'Freq Meter', w: 50, h: 50 },
      { type: 'Synchroscope', label: 'Synchroscope', w: 50, h: 50 },
      { type: 'PowerFactorMeter', label: 'PF Meter', w: 50, h: 50 },
      { type: 'Ammeter', label: 'Ammeter', w: 50, h: 50 },
      { type: 'Voltmeter', label: 'Voltmeter', w: 50, h: 50 },
      { type: 'Wattmeter', label: 'Wattmeter', w: 50, h: 50 },
    ],
  },
  {
    name: 'Protection Relays',
    symbols: [
      { type: 'Relay', label: 'Relay', w: 50, h: 50 },
      { type: 'OvercurrentRelay', label: '50/51 OC', w: 50, h: 50 },
      { type: 'EarthFaultRelay', label: '51N E/F', w: 50, h: 50 },
      { type: 'DistanceRelay', label: '21 Dist', w: 50, h: 50 },
      { type: 'DifferentialRelay', label: '87 Diff', w: 50, h: 50 },
      { type: 'DirectionalRelay', label: '67 Dir', w: 50, h: 50 },
      { type: 'UnderFrequencyRelay', label: '81U U/F', w: 50, h: 50 },
      { type: 'OverFrequencyRelay', label: '81O O/F', w: 50, h: 50 },
      { type: 'LockoutRelay', label: '86 Lockout', w: 50, h: 50 },
      { type: 'BuchholzRelay', label: 'Buchholz', w: 50, h: 50 },
      { type: 'OvervoltageRelay', label: '59 O/V', w: 50, h: 50 },
      { type: 'UndervoltageRelay', label: '27 U/V', w: 50, h: 50 },
      { type: 'NegativeSequenceRelay', label: '46 Neg Seq', w: 50, h: 50 },
      { type: 'ThermalOverloadRelay', label: '49 Thermal', w: 50, h: 50 },
      { type: 'ReversePowerRelay', label: '32 Rev Pwr', w: 50, h: 50 },
      { type: 'SynchCheckRelay', label: '25 Synch', w: 50, h: 50 },
    ],
  },
  {
    name: 'Bus & Connections',
    symbols: [
      { type: 'BusBar', label: 'Bus Bar', w: 200, h: 10 },
      { type: 'DoubleBusBar', label: 'Double Bus', w: 120, h: 30 },
      { type: 'BusSection', label: 'Bus Section', w: 80, h: 30 },
      { type: 'BusTie', label: 'Bus Tie', w: 40, h: 50 },
      { type: 'Cable', label: 'Cable', w: 100, h: 10 },
      { type: 'OverheadLine', label: 'OH Line', w: 120, h: 30 },
      { type: 'UndergroundCable', label: 'UG Cable', w: 120, h: 15 },
      { type: 'Junction', label: 'Junction', w: 40, h: 40 },
      { type: 'Crossover', label: 'Crossover', w: 40, h: 40 },
      { type: 'Terminal', label: 'Terminal', w: 30, h: 30 },
      { type: 'LightningArrester', label: 'Surge Arrester', w: 40, h: 60 },
      { type: 'Ground', label: 'Ground', w: 40, h: 40 },
      { type: 'Feeder', label: 'Feeder', w: 60, h: 80 },
    ],
  },
  {
    name: 'Indicators',
    symbols: [
      { type: 'IndicatorLamp', label: 'Indicator Lamp', w: 30, h: 30 },
      { type: 'AlarmHorn', label: 'Alarm Horn', w: 50, h: 40 },
      { type: 'PushButton', label: 'Push Button', w: 40, h: 40 },
      { type: 'SelectorSwitch', label: 'Selector Sw', w: 50, h: 40 },
      { type: 'LEDIndicator', label: 'LED', w: 20, h: 25 },
      { type: 'DigitalDisplay', label: 'Digital Display', w: 60, h: 30 },
      { type: 'Annunciator', label: 'Annunciator', w: 80, h: 50 },
    ],
  },
  {
    name: 'Infrastructure',
    symbols: [
      { type: 'Panel', label: 'Control Panel', w: 80, h: 50 },
      { type: 'MCC', label: 'MCC', w: 80, h: 60 },
      { type: 'PLC', label: 'PLC/RTU', w: 70, h: 50 },
      { type: 'HMI', label: 'HMI', w: 70, h: 40 },
      { type: 'Communication', label: 'Comm Link', w: 80, h: 25 },
      { type: 'Antenna', label: 'Antenna', w: 40, h: 40 },
      { type: 'Enclosure', label: 'Enclosure', w: 80, h: 50 },
    ],
  },
  {
    name: 'Piping & Mechanical',
    symbols: [
      { type: 'Valve', label: 'Valve', w: 50, h: 40 },
      { type: 'Pump', label: 'Pump', w: 60, h: 50 },
      { type: 'Compressor', label: 'Compressor', w: 60, h: 50 },
      { type: 'Tank', label: 'Tank', w: 60, h: 60 },
      { type: 'HeatExchanger', label: 'Heat Exch.', w: 60, h: 50 },
      { type: 'Filter', label: 'Filter', w: 50, h: 40 },
      { type: 'FlowMeter', label: 'Flow Meter', w: 50, h: 40 },
      { type: 'PressureGauge', label: 'Pressure', w: 50, h: 40 },
      { type: 'TemperatureSensor', label: 'Temp Sensor', w: 40, h: 50 },
      { type: 'LevelSensor', label: 'Level Sensor', w: 40, h: 50 },
    ],
  },
  {
    name: 'Miscellaneous',
    symbols: [
      { type: 'DGSet', label: 'DG Set', w: 80, h: 80 },
      { type: 'AVR', label: 'AVR', w: 60, h: 50 },
      { type: 'RTCC', label: 'RTCC', w: 60, h: 50 },
    ],
  },
  {
    name: 'Controls',
    symbols: [
      { type: 'ctrl-push-button', label: 'Push Button', w: 100, h: 40 },
      { type: 'ctrl-toggle-button', label: 'Toggle Button', w: 100, h: 40 },
      { type: 'ctrl-value-setter', label: 'Value Setter', w: 120, h: 40 },
      { type: 'ctrl-slider', label: 'Slider Control', w: 160, h: 40 },
    ],
  },
  {
    name: 'Navigation',
    symbols: [
      { type: 'page-link', label: 'Page Link', w: 120, h: 40 },
      { type: 'back-button', label: 'Back Button', w: 100, h: 40 },
      { type: 'home-button', label: 'Home Button', w: 100, h: 40 },
    ],
  },
];

let nextId = 1;
function genId() { return `el-${Date.now()}-${nextId++}`; }

export default function MimicEditor() {
  const { projectId, pageId } = useParams<{ projectId: string; pageId?: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [page, setPage] = useState<PageData | null>(null);
  const [activePageId, setActivePageId] = useState(pageId || '');
  const [elements, setElements] = useState<MimicElement[]>([]);
  const [connections, setConnections] = useState<MimicConnection[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [pageName, setPageName] = useState('');
  const [history, setHistory] = useState<MimicElement[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elStartX: number; elStartY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string; startX: number; startY: number; startW: number; startH: number; startEX: number; startEY: number } | null>(null);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<string[]>(SYMBOL_CATEGORIES.map((c) => c.name));
  const [drawingLine, setDrawingLine] = useState<{ points: { x: number; y: number }[] } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [clipboard, setClipboard] = useState<MimicElement[]>([]);
  const [tool, setTool] = useState<'select' | 'text' | 'rect' | 'circle' | 'line'>('select');
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ elementId: string; point: string } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Load project and page data
  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setProject(data);
      const pid = pageId || data.mimicPages?.[0]?.id;
      if (pid) setActivePageId(pid);
    });
  }, [projectId, pageId]);

  useEffect(() => {
    if (!projectId || !activePageId) return;
    api.get(`/projects/${projectId}/pages/${activePageId}`).then(({ data }) => {
      setPage(data);
      const els = (data.elements || []) as MimicElement[];
      setElements(els);
      setConnections((data.connections || []) as MimicConnection[]);
      setGridSize(data.gridSize || 20);
      setBgColor(data.backgroundColor || '#FFFFFF');
      setPageName(data.name || '');
      setHistory([els]);
      setHistoryIdx(0);
    });
  }, [projectId, activePageId]);

  const snap = useCallback((v: number) => snapToGrid ? Math.round(v / gridSize) * gridSize : v, [snapToGrid, gridSize]);

  const pushHistory = useCallback((newEls: MimicElement[]) => {
    setHistory((prev) => [...prev.slice(0, historyIdx + 1), newEls]);
    setHistoryIdx((prev) => prev + 1);
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setElements(history[historyIdx - 1]);
    }
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(historyIdx + 1);
      setElements(history[historyIdx + 1]);
    }
  }, [history, historyIdx]);

  // Save page
  const save = useCallback(async () => {
    if (!projectId || !activePageId) return;
    setSaving(true);
    try {
      await api.put(`/projects/${projectId}/pages/${activePageId}`, {
        name: pageName,
        elements,
        connections,
        gridSize,
        backgroundColor: bgColor,
      });
    } finally {
      setSaving(false);
    }
  }, [projectId, activePageId, pageName, elements, connections, gridSize, bgColor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Delete' && selectedIds.length > 0) {
        const newEls = elements.filter((el) => !selectedIds.includes(el.id));
        setElements(newEls);
        pushHistory(newEls);
        setSelectedIds([]);
      }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
      if (e.ctrlKey && e.key === 'c') {
        setClipboard(elements.filter((el) => selectedIds.includes(el.id)));
      }
      if (e.ctrlKey && e.key === 'v' && clipboard.length > 0) {
        const pasted = clipboard.map((el) => ({ ...el, id: genId(), x: el.x + 20, y: el.y + 20 }));
        const newEls = [...elements, ...pasted];
        setElements(newEls);
        pushHistory(newEls);
        setSelectedIds(pasted.map((el) => el.id));
      }
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setDrawingLine(null);
        setContextMenu(null);
        setTool('select');
      }
      // Arrow key movement
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
        e.preventDefault();
        const step = e.ctrlKey ? gridSize : e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        const newEls = elements.map((el) =>
          selectedIds.includes(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
        );
        setElements(newEls);
        pushHistory(newEls);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, elements, clipboard, undo, redo, save, pushHistory, gridSize]);

  // Drop from palette
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const parsed = JSON.parse(data);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const x = snap((e.clientX - svgRect.left - pan.x) / zoom);
    const y = snap((e.clientY - svgRect.top - pan.y) / zoom);
    const isNav = ['page-link', 'back-button', 'home-button'].includes(parsed.type);
    const isCtrl = parsed.type.startsWith('ctrl-');
    const newEl: MimicElement = {
      id: genId(),
      type: parsed.type,
      x,
      y,
      width: parsed.w || 60,
      height: parsed.h || 60,
      rotation: 0,
      zIndex: elements.length,
      properties: {
        label: parsed.label || parsed.type,
        ...(isNav ? { buttonText: parsed.label, buttonColor: '#3B82F6', targetPageId: '' } : {}),
        ...(isCtrl ? {
          targetTag: '',
          controlAction: parsed.type === 'ctrl-toggle-button' ? 'toggle' : 'setValue',
          controlValue: '',
          buttonText: parsed.label,
          buttonColor: parsed.type === 'ctrl-push-button' ? '#EF4444' : parsed.type === 'ctrl-toggle-button' ? '#10B981' : '#3B82F6',
          controlScript: '',
        } : {}),
      },
    };
    const newEls = [...elements, newEl];
    setElements(newEls);
    pushHistory(newEls);
    setSelectedIds([newEl.id]);
  }, [elements, pan, zoom, snap, pushHistory]);

  // Connection point click
  const handleConnectionPointClick = useCallback((elementId: string, point: string) => {
    if (!connectingFrom) {
      setConnectingFrom({ elementId, point });
      return;
    }
    if (connectingFrom.elementId === elementId) return;
    const fromEl = elements.find((el) => el.id === connectingFrom.elementId);
    const toEl = elements.find((el) => el.id === elementId);
    if (!fromEl || !toEl) return;
    const getPoint = (el: MimicElement, p: string) => {
      switch (p) {
        case 'top': return { x: el.x + el.width / 2, y: el.y };
        case 'bottom': return { x: el.x + el.width / 2, y: el.y + el.height };
        case 'left': return { x: el.x, y: el.y + el.height / 2 };
        case 'right': return { x: el.x + el.width, y: el.y + el.height / 2 };
        default: return { x: el.x, y: el.y };
      }
    };
    const from = getPoint(fromEl, connectingFrom.point);
    const to = getPoint(toEl, point);
    const newConn: MimicConnection = {
      id: genId(),
      fromId: connectingFrom.elementId,
      toId: elementId,
      points: [from, to],
      color: '#374151',
      thickness: 2,
    };
    setConnections((prev) => [...prev, newConn]);
    setConnectingFrom(null);
  }, [connectingFrom, elements]);

  // Canvas click to add shapes/text
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (connectingFrom) {
      setConnectingFrom(null);
      return;
    }
    if (tool === 'select') {
      if (!(e.target as Element).closest('[data-element-id]')) {
        setSelectedIds([]);
        setContextMenu(null);
      }
      return;
    }
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const x = snap((e.clientX - svgRect.left - pan.x) / zoom);
    const y = snap((e.clientY - svgRect.top - pan.y) / zoom);
    let newEl: MimicElement | null = null;
    if (tool === 'text') {
      newEl = { id: genId(), type: 'text', x, y, width: 120, height: 30, rotation: 0, zIndex: elements.length, properties: { text: 'Text', fontSize: 14, color: '#000000' } };
    } else if (tool === 'rect') {
      newEl = { id: genId(), type: 'shape', x, y, width: 100, height: 80, rotation: 0, zIndex: elements.length, properties: { shapeType: 'rect', fill: '#E5E7EB', stroke: '#6B7280', strokeWidth: 2 } };
    } else if (tool === 'circle') {
      newEl = { id: genId(), type: 'shape', x, y, width: 80, height: 80, rotation: 0, zIndex: elements.length, properties: { shapeType: 'circle', fill: '#E5E7EB', stroke: '#6B7280', strokeWidth: 2 } };
    } else if (tool === 'line') {
      newEl = { id: genId(), type: 'shape', x, y, width: 150, height: 0, rotation: 0, zIndex: elements.length, properties: { shapeType: 'line', stroke: '#374151', strokeWidth: 2 } };
    }
    if (newEl) {
      const newEls = [...elements, newEl];
      setElements(newEls);
      pushHistory(newEls);
      setSelectedIds([newEl.id]);
      setTool('select');
    }
  }, [tool, elements, pan, zoom, snap, pushHistory]);

  // Element mouse down
  const handleElementMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (e.button === 2) return; // right click handled separately
    const el = elements.find((el) => el.id === id);
    if (!el) return;
    if (e.shiftKey) {
      setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    } else if (!selectedIds.includes(id)) {
      setSelectedIds([id]);
    }
    setDragging({ id, startX: e.clientX, startY: e.clientY, elStartX: el.x, elStartY: el.y });
  }, [elements, selectedIds]);

  // Mouse move for dragging/resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / zoom;
        const dy = (e.clientY - dragging.startY) / zoom;
        setElements((prev) => prev.map((el) => {
          if (selectedIds.includes(el.id)) {
            const base = el.id === dragging.id ? dragging : { elStartX: el.x - (elements.find((e) => e.id === dragging.id)!.x - dragging.elStartX), elStartY: el.y - (elements.find((e) => e.id === dragging.id)!.y - dragging.elStartY) };
            return { ...el, x: snap(base.elStartX + dx), y: snap(base.elStartY + dy) };
          }
          return el;
        }));
      }
      if (resizing) {
        const dx = (e.clientX - resizing.startX) / zoom;
        const dy = (e.clientY - resizing.startY) / zoom;
        setElements((prev) => prev.map((el) => {
          if (el.id === resizing.id) {
            let { startW, startH, startEX, startEY } = resizing;
            let w = startW, h = startH, x = startEX, y = startEY;
            if (resizing.handle.includes('e')) w = Math.max(20, startW + dx);
            if (resizing.handle.includes('s')) h = Math.max(20, startH + dy);
            if (resizing.handle.includes('w')) { w = Math.max(20, startW - dx); x = startEX + (startW - w); }
            if (resizing.handle.includes('n')) { h = Math.max(20, startH - dy); y = startEY + (startH - h); }
            return { ...el, x: snap(x), y: snap(y), width: snap(w), height: snap(h) };
          }
          return el;
        }));
      }
      if (isPanning.current) {
        setPan((prev) => ({
          x: prev.x + (e.clientX - panStart.current.x),
          y: prev.y + (e.clientY - panStart.current.y),
        }));
        panStart.current = { x: e.clientX, y: e.clientY };
      }
    };
    const handleMouseUp = () => {
      if (dragging) {
        pushHistory(elements);
        setDragging(null);
      }
      if (resizing) {
        pushHistory(elements);
        setResizing(null);
      }
      isPanning.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, elements, selectedIds, zoom, snap, pushHistory]);

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.includes(id)) setSelectedIds([id]);
    setContextMenu({ x: e.clientX, y: e.clientY, elementId: id });
  }, [selectedIds]);

  const rotate = useCallback((id: string) => {
    const newEls = elements.map((el) => el.id === id ? { ...el, rotation: (el.rotation + 90) % 360 } : el);
    setElements(newEls);
    pushHistory(newEls);
    setContextMenu(null);
  }, [elements, pushHistory]);

  const deleteSelected = useCallback(() => {
    const newEls = elements.filter((el) => !selectedIds.includes(el.id));
    setElements(newEls);
    pushHistory(newEls);
    setSelectedIds([]);
    setContextMenu(null);
  }, [elements, selectedIds, pushHistory]);

  const bringToFront = useCallback((id: string) => {
    const maxZ = Math.max(...elements.map((el) => el.zIndex), 0);
    const newEls = elements.map((el) => el.id === id ? { ...el, zIndex: maxZ + 1 } : el);
    setElements(newEls);
    pushHistory(newEls);
    setContextMenu(null);
  }, [elements, pushHistory]);

  const sendToBack = useCallback((id: string) => {
    const minZ = Math.min(...elements.map((el) => el.zIndex), 0);
    const newEls = elements.map((el) => el.id === id ? { ...el, zIndex: minZ - 1 } : el);
    setElements(newEls);
    pushHistory(newEls);
    setContextMenu(null);
  }, [elements, pushHistory]);

  // Zoom
  const zoomIn = () => setZoom((z) => Math.min(z * 1.2, 5));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.1));
  const zoomFit = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom((z) => Math.max(0.1, Math.min(5, z - e.deltaY * 0.001)));
    }
  }, []);

  // Middle-mouse pan
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  // Create new page
  const createPage = async () => {
    if (!projectId) return;
    const { data } = await api.post(`/projects/${projectId}/pages`, { name: `Page ${(project?.mimicPages.length || 0) + 1}` });
    setProject((prev) => prev ? { ...prev, mimicPages: [...prev.mimicPages, { id: data.id, name: data.name, pageOrder: data.pageOrder, isHomePage: false }] } : prev);
    setActivePageId(data.id);
  };

  // Update element property
  const updateElement = useCallback((id: string, updates: Partial<MimicElement>) => {
    const newEls = elements.map((el) => el.id === id ? { ...el, ...updates } : el);
    setElements(newEls);
  }, [elements]);

  const updateElementProps = useCallback((id: string, props: Partial<MimicElement['properties']>) => {
    const newEls = elements.map((el) =>
      el.id === id ? { ...el, properties: { ...el.properties, ...props } } : el,
    );
    setElements(newEls);
  }, [elements]);

  const selectedEl = selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) : null;

  // Render element on canvas
  const renderElement = (el: MimicElement) => {
    const isSelected = selectedIds.includes(el.id);
    return (
      <g
        key={el.id}
        data-element-id={el.id}
        transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}, ${el.width / 2}, ${el.height / 2})`}
        onMouseDown={(e) => handleElementMouseDown(e, el.id)}
        onMouseEnter={() => setHoveredElementId(el.id)}
        onMouseLeave={() => setHoveredElementId(null)}
        onContextMenu={(e) => handleContextMenu(e, el.id)}
        style={{ cursor: 'move' }}
      >
        {el.type === 'text' ? (
          <text
            x={0}
            y={el.properties.fontSize || 14}
            fontSize={el.properties.fontSize || 14}
            fill={el.properties.color || '#000'}
            fontFamily="sans-serif"
          >
            {el.properties.text || 'Text'}
          </text>
        ) : el.type === 'shape' ? (
          el.properties.shapeType === 'circle' ? (
            <ellipse
              cx={el.width / 2}
              cy={el.height / 2}
              rx={el.width / 2}
              ry={el.height / 2}
              fill={el.properties.fill || '#E5E7EB'}
              stroke={el.properties.stroke || '#6B7280'}
              strokeWidth={el.properties.strokeWidth || 2}
            />
          ) : el.properties.shapeType === 'line' ? (
            <line
              x1={0}
              y1={0}
              x2={el.width}
              y2={el.height}
              stroke={el.properties.stroke || '#374151'}
              strokeWidth={el.properties.strokeWidth || 2}
            />
          ) : (
            <rect
              width={el.width}
              height={el.height}
              fill={el.properties.fill || '#E5E7EB'}
              stroke={el.properties.stroke || '#6B7280'}
              strokeWidth={el.properties.strokeWidth || 2}
              rx={4}
            />
          )
        ) : el.type === 'value-display' ? (
          <g>
            <rect width={el.width} height={el.height} fill="#F0F9FF" stroke="#3B82F6" strokeWidth={1} rx={4} />
            <text x={el.width / 2} y={el.height / 2 + 5} textAnchor="middle" fontSize={12} fill="#1E40AF" fontFamily="monospace">
              {el.properties.tagBinding || '---'}
            </text>
          </g>
        ) : el.type.startsWith('ctrl-') ? (
          <g>
            <rect
              width={el.width}
              height={el.height}
              fill={el.properties.buttonColor || '#3B82F6'}
              stroke={el.type === 'ctrl-slider' ? '#6B7280' : '#1E3A5F'}
              strokeWidth={1.5}
              rx={6}
            />
            {el.type === 'ctrl-slider' ? (
              <>
                <line x1={10} y1={el.height / 2} x2={el.width - 10} y2={el.height / 2} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
                <circle cx={el.width / 2} cy={el.height / 2} r={8} fill="#FFFFFF" stroke="#3B82F6" strokeWidth={2} />
                <text x={el.width / 2} y={el.height - 4} textAnchor="middle" fontSize={8} fill="#FFFFFF" fontFamily="sans-serif">{el.properties.targetTag || 'Slider'}</text>
              </>
            ) : el.type === 'ctrl-value-setter' ? (
              <>
                <rect x={4} y={6} width={el.width - 40} height={el.height - 12} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth={1} rx={3} />
                <text x={(el.width - 36) / 2 + 4} y={el.height / 2 + 4} textAnchor="middle" fontSize={10} fill="#6B7280" fontFamily="monospace">0.00</text>
                <rect x={el.width - 32} y={6} width={28} height={el.height - 12} fill="#1E40AF" rx={3} />
                <text x={el.width - 18} y={el.height / 2 + 4} textAnchor="middle" fontSize={9} fill="#FFFFFF" fontWeight="600">SET</text>
              </>
            ) : (
              <text
                x={el.width / 2}
                y={el.height / 2 + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill="#FFFFFF"
                fontFamily="sans-serif"
                fontWeight="600"
              >
                {el.properties.buttonText || el.properties.label || el.type}
              </text>
            )}
          </g>
        ) : ['page-link', 'back-button', 'home-button'].includes(el.type) ? (
          <g>
            <rect
              width={el.width}
              height={el.height}
              fill={el.properties.buttonColor || '#3B82F6'}
              stroke="#1E40AF"
              strokeWidth={1.5}
              rx={6}
            />
            <text
              x={el.width / 2}
              y={el.height / 2 + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fill="#FFFFFF"
              fontFamily="sans-serif"
              fontWeight="600"
            >
              {el.properties.buttonText || el.properties.label || el.type}
            </text>
          </g>
        ) : SYMBOL_MAP[el.type] ? (
          <foreignObject width={el.width} height={el.height}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: el.width, height: el.height, pointerEvents: 'none' }}>
              {React.createElement(SYMBOL_MAP[el.type], { width: el.width, height: el.height })}
            </div>
          </foreignObject>
        ) : (
          <g>
            <rect
              width={el.width}
              height={el.height}
              fill="#F8FAFC"
              stroke="#94A3B8"
              strokeWidth={1.5}
              rx={4}
            />
            <text
              x={el.width / 2}
              y={el.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.min(10, el.width / 6)}
              fill="#475569"
              fontFamily="sans-serif"
            >
              {el.type}
            </text>
          </g>
        )}

        {/* Selection handles */}
        {isSelected && (
          <g>
            <rect
              x={-2}
              y={-2}
              width={el.width + 4}
              height={el.height + 4}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            {/* Resize handles */}
            {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map((handle) => {
              const pos: Record<string, { x: number; y: number }> = {
                nw: { x: -4, y: -4 }, ne: { x: el.width - 4, y: -4 },
                sw: { x: -4, y: el.height - 4 }, se: { x: el.width - 4, y: el.height - 4 },
                n: { x: el.width / 2 - 4, y: -4 }, s: { x: el.width / 2 - 4, y: el.height - 4 },
                e: { x: el.width - 4, y: el.height / 2 - 4 }, w: { x: -4, y: el.height / 2 - 4 },
              };
              return (
                <rect
                  key={handle}
                  x={pos[handle].x}
                  y={pos[handle].y}
                  width={8}
                  height={8}
                  fill="white"
                  stroke="#3B82F6"
                  strokeWidth={1.5}
                  style={{ cursor: `${handle}-resize` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizing({ id: el.id, handle, startX: e.clientX, startY: e.clientY, startW: el.width, startH: el.height, startEX: el.x, startEY: el.y });
                  }}
                />
              );
            })}
          </g>
        )}

        {/* Connection points on hover */}
        {(hoveredElementId === el.id || connectingFrom?.elementId === el.id) && el.type !== 'text' && el.type !== 'shape' && (
          <g>
            {[
              { point: 'top', cx: el.width / 2, cy: 0 },
              { point: 'bottom', cx: el.width / 2, cy: el.height },
              { point: 'left', cx: 0, cy: el.height / 2 },
              { point: 'right', cx: el.width, cy: el.height / 2 },
            ].map(({ point, cx, cy }) => (
              <circle
                key={point}
                cx={cx}
                cy={cy}
                r={5}
                fill={connectingFrom?.elementId === el.id && connectingFrom.point === point ? '#2563EB' : '#60A5FA'}
                stroke="#FFFFFF"
                strokeWidth={2}
                style={{ cursor: 'crosshair' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleConnectionPointClick(el.id, point);
                }}
              />
            ))}
          </g>
        )}
      </g>
    );
  };

  const canvasW = page?.width || 1920;
  const canvasH = page?.height || 1080;

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Top Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => navigate(`/app/projects`)} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="Back to Projects">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-gray-700 mr-2">{project?.name}</span>
        <div className="w-px h-6 bg-gray-200" />

        {/* Page selector */}
        <select
          value={activePageId}
          onChange={(e) => setActivePageId(e.target.value)}
          className="text-sm border border-gray-200 rounded px-2 py-1 text-gray-700 bg-white"
        >
          {project?.mimicPages.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={createPage} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="New Page">
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200" />

        <button onClick={undo} disabled={historyIdx <= 0} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30" title="Undo (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={redo} disabled={historyIdx >= history.length - 1} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30" title="Redo (Ctrl+Y)">
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200" />

        <button onClick={zoomOut} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={zoomFit} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="Zoom to Fit">
          <Maximize className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200" />

        <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 rounded ${showGrid ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`} title="Toggle Grid">
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button onClick={() => setSnapToGrid(!snapToGrid)} className={`p-1.5 rounded ${snapToGrid ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`} title="Toggle Snap">
          <Magnet className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-200" />

        {/* Drawing tools */}
        {[
          { t: 'text' as const, icon: Type, label: 'Text' },
          { t: 'rect' as const, icon: Square, label: 'Rectangle' },
          { t: 'circle' as const, icon: Circle, label: 'Circle' },
          { t: 'line' as const, icon: Minus, label: 'Line' },
        ].map(({ t, icon: Icon, label }) => (
          <button
            key={t}
            onClick={() => setTool(tool === t ? 'select' : t)}
            className={`p-1.5 rounded ${tool === t ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        <div className="flex-1" />

        <button onClick={() => navigate(`/app/projects/${projectId}`)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded" title="Preview">
          <Eye className="w-4 h-4" /> Preview
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Component Palette */}
        <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search symbols..."
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {SYMBOL_CATEGORIES.map((cat) => {
              const filtered = cat.symbols.filter((s) =>
                s.label.toLowerCase().includes(paletteSearch.toLowerCase()),
              );
              if (filtered.length === 0) return null;
              const expanded = expandedCats.includes(cat.name);
              return (
                <div key={cat.name} className="mb-1">
                  <button
                    onClick={() => setExpandedCats((prev) => expanded ? prev.filter((c) => c !== cat.name) : [...prev, cat.name])}
                    className="flex items-center gap-1 w-full text-left px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded"
                  >
                    {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    {cat.name}
                  </button>
                  {expanded && (
                    <div className="grid grid-cols-2 gap-1 px-1">
                      {filtered.map((sym) => (
                        <div
                          key={sym.type}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify(sym));
                          }}
                          className="flex flex-col items-center p-2 rounded border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 cursor-grab text-center transition-colors"
                        >
                          <div className="w-10 h-10 flex items-center justify-center mb-1">
                            {['page-link', 'back-button', 'home-button'].includes(sym.type) ? (
                              <div className="w-8 h-6 bg-blue-500 rounded flex items-center justify-center">
                                {sym.type === 'page-link' ? <Link className="w-3 h-3 text-white" /> : sym.type === 'back-button' ? <ArrowLeft className="w-3 h-3 text-white" /> : <Home className="w-3 h-3 text-white" />}
                              </div>
                            ) : SYMBOL_MAP[sym.type] ? (
                              React.createElement(SYMBOL_MAP[sym.type], { width: 32, height: 32 })
                            ) : (
                              <div className="w-8 h-8 bg-white border border-gray-200 rounded flex items-center justify-center">
                                <span className="text-[8px] font-mono text-gray-500">{sym.type.slice(0, 3)}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-600 leading-tight">{sym.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Value display */}
            <div className="mt-2 px-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1.5">Displays</div>
              <div
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'value-display', label: 'Value Display', w: 100, h: 30 }))}
                className="flex items-center gap-2 p-2 rounded border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 cursor-grab transition-colors"
              >
                <div className="w-8 h-8 bg-white border border-gray-200 rounded flex items-center justify-center">
                  <span className="text-[8px] font-mono text-blue-500">VAL</span>
                </div>
                <span className="text-xs text-gray-600">Value Display</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center - SVG Canvas */}
        <div
          className="flex-1 overflow-hidden relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ background: '#E5E7EB' }}
            onMouseDown={handleSvgMouseDown}
            onClick={handleCanvasClick}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Canvas background */}
              <rect x={0} y={0} width={canvasW} height={canvasH} fill={bgColor} stroke="#CBD5E1" strokeWidth={1} />

              {/* Grid */}
              {showGrid && (
                <g opacity={0.3}>
                  {Array.from({ length: Math.ceil(canvasW / gridSize) + 1 }, (_, i) => (
                    <line key={`v${i}`} x1={i * gridSize} y1={0} x2={i * gridSize} y2={canvasH} stroke="#CBD5E1" strokeWidth={0.5} />
                  ))}
                  {Array.from({ length: Math.ceil(canvasH / gridSize) + 1 }, (_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * gridSize} x2={canvasW} y2={i * gridSize} stroke="#CBD5E1" strokeWidth={0.5} />
                  ))}
                </g>
              )}

              {/* Connections */}
              {connections.map((conn) => (
                <polyline
                  key={conn.id}
                  points={conn.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={conn.color || '#374151'}
                  strokeWidth={conn.thickness || 2}
                />
              ))}

              {/* Elements sorted by zIndex */}
              {[...elements].sort((a, b) => a.zIndex - b.zIndex).map(renderElement)}
            </g>
          </svg>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              {selectedEl ? 'Properties' : 'Page Properties'}
            </h3>
          </div>

          {selectedEl ? (
            <div className="p-3 space-y-3">
              <div className="text-xs text-gray-400 font-mono">{selectedEl.type} - {selectedEl.id.slice(0, 8)}</div>

              {/* Position */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400">X</span>
                    <input type="number" value={selectedEl.x} onChange={(e) => updateElement(selectedEl.id, { x: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">Y</span>
                    <input type="number" value={selectedEl.y} onChange={(e) => updateElement(selectedEl.id, { y: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white" />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400">W</span>
                    <input type="number" value={selectedEl.width} onChange={(e) => updateElement(selectedEl.id, { width: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">H</span>
                    <input type="number" value={selectedEl.height} onChange={(e) => updateElement(selectedEl.id, { height: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white" />
                  </div>
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rotation</label>
                <select
                  value={selectedEl.rotation}
                  onChange={(e) => updateElement(selectedEl.id, { rotation: Number(e.target.value) })}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                >
                  {[0, 90, 180, 270].map((r) => (
                    <option key={r} value={r}>{r}°</option>
                  ))}
                </select>
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={selectedEl.properties.label || ''}
                  onChange={(e) => updateElementProps(selectedEl.id, { label: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                />
              </div>

              {/* Tag Binding */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tag Binding</label>
                <input
                  type="text"
                  value={selectedEl.properties.tagBinding || ''}
                  onChange={(e) => updateElementProps(selectedEl.id, { tagBinding: e.target.value })}
                  placeholder="e.g. WALUJ_33KV_INC1_CB_STATUS"
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                />
              </div>

              {/* Control element properties */}
              {selectedEl.type.startsWith('ctrl-') && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Target Tag</label>
                    <input
                      type="text"
                      value={selectedEl.properties.targetTag || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { targetTag: e.target.value })}
                      placeholder="e.g. CB1.status"
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
                    <select
                      value={selectedEl.properties.controlAction || 'setValue'}
                      onChange={(e) => updateElementProps(selectedEl.id, { controlAction: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                    >
                      <option value="setValue">Set Value</option>
                      <option value="toggle">Toggle</option>
                      <option value="increment">Increment</option>
                      <option value="script">Script</option>
                    </select>
                  </div>
                  {selectedEl.properties.controlAction !== 'script' && selectedEl.properties.controlAction !== 'toggle' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Value to Set</label>
                      <input
                        type="text"
                        value={selectedEl.properties.controlValue || ''}
                        onChange={(e) => updateElementProps(selectedEl.id, { controlValue: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                      />
                    </div>
                  )}
                  {selectedEl.properties.controlAction === 'script' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Script</label>
                      <textarea
                        value={selectedEl.properties.controlScript || ''}
                        onChange={(e) => updateElementProps(selectedEl.id, { controlScript: e.target.value })}
                        rows={3}
                        placeholder='setTag("CB1.status", !getTag("CB1.status"))'
                        className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded text-gray-700 bg-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Text</label>
                    <input
                      type="text"
                      value={selectedEl.properties.buttonText || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonText: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Color</label>
                    <input
                      type="color"
                      value={selectedEl.properties.buttonColor || '#3B82F6'}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonColor: e.target.value })}
                      className="w-full h-8 rounded border border-gray-200 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Navigation properties */}
              {['page-link', 'back-button', 'home-button'].includes(selectedEl.type) && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Text</label>
                    <input
                      type="text"
                      value={selectedEl.properties.buttonText || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonText: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                    />
                  </div>
                  {selectedEl.type === 'page-link' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Target Page</label>
                      <select
                        value={selectedEl.properties.targetPageId || ''}
                        onChange={(e) => updateElementProps(selectedEl.id, { targetPageId: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                      >
                        <option value="">-- Select Page --</option>
                        {project?.mimicPages.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Color</label>
                    <input
                      type="color"
                      value={selectedEl.properties.buttonColor || '#3B82F6'}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonColor: e.target.value })}
                      className="w-full h-8 rounded border border-gray-200 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Text properties */}
              {selectedEl.type === 'text' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Text</label>
                    <input
                      type="text"
                      value={selectedEl.properties.text || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { text: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={selectedEl.properties.fontSize || 14}
                      onChange={(e) => updateElementProps(selectedEl.id, { fontSize: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                    />
                  </div>
                </>
              )}

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                <input
                  type="color"
                  value={selectedEl.properties.color || selectedEl.properties.stroke || '#000000'}
                  onChange={(e) => updateElementProps(selectedEl.id, selectedEl.type === 'shape' ? { stroke: e.target.value } : { color: e.target.value })}
                  className="w-full h-8 rounded border border-gray-200 cursor-pointer"
                />
              </div>

              {/* Shape fill */}
              {selectedEl.type === 'shape' && selectedEl.properties.shapeType !== 'line' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fill</label>
                  <input
                    type="color"
                    value={selectedEl.properties.fill || '#E5E7EB'}
                    onChange={(e) => updateElementProps(selectedEl.id, { fill: e.target.value })}
                    className="w-full h-8 rounded border border-gray-200 cursor-pointer"
                  />
                </div>
              )}

              {/* Animation Rules */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Animation Rules</label>
                <div className="text-[10px] text-gray-400 mb-1">e.g. "if tag &gt; 80, color = red"</div>
                {(selectedEl.properties.animationRules || []).map((rule, i) => (
                  <div key={i} className="flex gap-1 mb-1 text-[10px]">
                    <input value={rule.condition} onChange={(e) => {
                      const rules = [...(selectedEl.properties.animationRules || [])];
                      rules[i] = { ...rules[i], condition: e.target.value };
                      updateElementProps(selectedEl.id, { animationRules: rules });
                    }} placeholder="condition" className="flex-1 px-1 py-0.5 border border-gray-200 rounded text-gray-700 bg-white" />
                    <input value={rule.property} onChange={(e) => {
                      const rules = [...(selectedEl.properties.animationRules || [])];
                      rules[i] = { ...rules[i], property: e.target.value };
                      updateElementProps(selectedEl.id, { animationRules: rules });
                    }} placeholder="prop" className="w-12 px-1 py-0.5 border border-gray-200 rounded text-gray-700 bg-white" />
                    <input value={rule.value} onChange={(e) => {
                      const rules = [...(selectedEl.properties.animationRules || [])];
                      rules[i] = { ...rules[i], value: e.target.value };
                      updateElementProps(selectedEl.id, { animationRules: rules });
                    }} placeholder="value" className="w-14 px-1 py-0.5 border border-gray-200 rounded text-gray-700 bg-white" />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const rules = [...(selectedEl.properties.animationRules || []), { condition: '', property: 'color', value: '#EF4444' }];
                    updateElementProps(selectedEl.id, { animationRules: rules });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Add Rule
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-1 pt-2 border-t border-gray-100">
                <button onClick={() => rotate(selectedEl.id)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Rotate 90°">
                  <RotateCw className="w-4 h-4" />
                </button>
                <button onClick={() => { setClipboard([selectedEl]); }} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Copy">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => bringToFront(selectedEl.id)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Bring to Front">
                  <ArrowUpToLine className="w-4 h-4" />
                </button>
                <button onClick={() => sendToBack(selectedEl.id)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Send to Back">
                  <ArrowDownToLine className="w-4 h-4" />
                </button>
                <button onClick={deleteSelected} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Page Name</label>
                <input
                  type="text"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Background Color</label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-full h-8 rounded border border-gray-200 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Grid Size</label>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-700 bg-white"
                >
                  {[10, 20, 50].map((g) => (
                    <option key={g} value={g}>{g}px</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Canvas Size</label>
                <div className="text-xs text-gray-400">{canvasW} x {canvasH}</div>
              </div>
              <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
                {elements.length} element{elements.length !== 1 ? 's' : ''} on this page
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {[
              { label: 'Copy', icon: Copy, action: () => { setClipboard(elements.filter((el) => selectedIds.includes(el.id))); setContextMenu(null); } },
              { label: 'Rotate 90°', icon: RotateCw, action: () => rotate(contextMenu.elementId) },
              { label: 'Bring to Front', icon: ArrowUpToLine, action: () => bringToFront(contextMenu.elementId) },
              { label: 'Send to Back', icon: ArrowDownToLine, action: () => sendToBack(contextMenu.elementId) },
              { label: 'Delete', icon: Trash2, action: deleteSelected, danger: true },
            ].map(({ label, icon: Icon, action, danger }) => (
              <button
                key={label}
                onClick={action}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
