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
  Tag,
  LayoutGrid,
  X,
  Activity,
  Zap,
  Settings, Upload,
  Bell,
  TrendingUp,
  ClipboardList,
  Clock,
  Radio,
  Compass,
  Link2,
  ScrollText,
  FastForward,
  BellOff,
  BarChart3,
  Hash,
  Gauge,
  Newspaper,
  Wrench,
  Ruler,
  Bot,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Pencil,
  Download,
} from 'lucide-react';
import * as ScadaSymbols from '@/components/scada-symbols';
import CustomComponentCreator from '@/components/CustomComponentCreator';

// ─── Symbol type → Component mapping ─────────────
// ⚠️ SKILL FILE REQUIRED BEFORE MODIFYING SYMBOL_MAP OR AI SLD LOGIC
// ~/.openclaw/workspace/skills/gridvision-sld-ai/SKILL.md
// Key rules: BusBar w:500 h:20 | normalizeType in all 3 places | Transformer always mandatory

// Normalize AI-returned type strings to exact SYMBOL_MAP keys
const FRONTEND_TYPE_MAP: Record<string, string> = {
  vcb:'VacuumCB', vacuum_cb:'VacuumCB', vacuumcb:'VacuumCB', 'vacuum cb':'VacuumCB',
  sf6cb:'SF6CB', sf6_cb:'SF6CB', 'sf6 cb':'SF6CB',
  acb:'ACB', 'air circuit breaker':'ACB',
  mccb:'MCCB', mcb:'MCB', rccb:'RCCB',
  cb:'CB', circuit_breaker:'CB', 'circuit breaker':'CB',
  isolator:'Isolator', disconnector:'Isolator', disconn:'Isolator',
  earth_switch:'EarthSwitch', earthswitch:'EarthSwitch', 'earth switch':'EarthSwitch',
  load_break_switch:'LoadBreakSwitch', lbs:'LoadBreakSwitch',
  auto_recloser:'AutoRecloser', rmu:'RingMainUnit', ring_main_unit:'RingMainUnit',
  gis:'GIS', fuse:'Fuse', contactor:'Contactor',
  transformer:'Transformer', power_transformer:'Transformer', xfmr:'Transformer',
  auto_transformer:'AutoTransformer', autotransformer:'AutoTransformer',
  instrument_transformer:'InstrumentTransformer',
  step_voltage_regulator:'StepVoltageRegulator',
  busbar:'BusBar', bus_bar:'BusBar', bus:'BusBar', busbars:'BusBar',
  double_busbar:'DoubleBusBar', doublebusbar:'DoubleBusBar',
  bus_section:'BusSection', bus_tie:'BusTie',
  ct:'CT', current_transformer:'CT', pt:'PT', vt:'PT', potential_transformer:'PT',
  meter:'Meter', energy_meter:'EnergyMeter', energymeter:'EnergyMeter',
  lightning_arrester:'LightningArrester', la:'LightningArrester', surge_arrester:'LightningArrester',
  relay:'Relay', overcurrent_relay:'OvercurrentRelay', oc_relay:'OvercurrentRelay',
  earth_fault_relay:'EarthFaultRelay', ef_relay:'EarthFaultRelay',
  differential_relay:'DifferentialRelay', distance_relay:'DistanceRelay',
  feeder:'Feeder', load:'GenericLoad', generic_load:'GenericLoad', genericload:'GenericLoad',
  resistive_load:'ResistiveLoad', inductive_load:'InductiveLoad',
  motor:'Motor', generator:'Generator', gen:'Generator',
  solar_panel:'SolarPanel', solar_inverter:'SolarInverter', solarinverter:'SolarInverter',
  wind_turbine:'WindTurbine', battery:'Battery', bess:'BESS',
  capacitor_bank:'CapacitorBank', capacitor:'CapacitorBank',
  shunt_reactor:'ShuntReactor', reactor:'ShuntReactor',
  vfd:'VFD', ups:'UPSDetail',
  cable:'Cable', overhead_line:'OverheadLine', underground_cable:'UndergroundCable',
  junction:'Junction', ground:'Ground', terminal:'Terminal',
  panel:'Panel', mcc:'MCC', plc:'PLC', hmi:'HMI',
};
function frontendNormalizeType(t: string): string {
  if (!t) return 'Feeder';
  // Already correct PascalCase key — check directly
  if (FRONTEND_TYPE_MAP[t]) return FRONTEND_TYPE_MAP[t];
  const lower = t.toLowerCase().replace(/[-\s.]/g, '_');
  return FRONTEND_TYPE_MAP[lower] || t;
}

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
  // Load Symbols
  ResistiveLoad: ScadaSymbols.ResistiveLoadSymbol,
  InductiveLoad: ScadaSymbols.InductiveLoadSymbol,
  CapacitiveLoad: ScadaSymbols.CapacitiveLoadSymbol,
  GenericLoad: ScadaSymbols.GenericLoadSymbol,
  LightingLoad: ScadaSymbols.LightingLoadSymbol,
  HeatingLoad: ScadaSymbols.HeatingLoadSymbol,
  FanLoad: ScadaSymbols.FanLoadSymbol,
  AHU: ScadaSymbols.AHUSymbol,
  Chiller: ScadaSymbols.ChillerSymbol,
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

type FooterWidgetType = 'alarm-banner' | 'trend-strip' | 'status-bar' | 'custom-text' | 'clock' | 'comm-status' | 'page-nav';

interface FooterWidget {
  id: string;
  type: FooterWidgetType;
  label: string;
  height: number;
  config?: Record<string, any>;
}

const AVAILABLE_FOOTER_WIDGETS: { type: FooterWidgetType; label: string; icon: string; desc: string; defaultHeight: number }[] = [
  { type: 'alarm-banner', label: 'Alarm Banner', icon: 'ALM', desc: 'Latest alarm + severity badges', defaultHeight: 28 },
  { type: 'trend-strip', label: 'Trend Strip', icon: 'TRD', desc: 'Mini sparklines for key tags', defaultHeight: 30 },
  { type: 'status-bar', label: 'Status Bar', icon: 'STS', desc: 'Operator, page name, time', defaultHeight: 22 },
  { type: 'custom-text', label: 'Custom Text', icon: 'TXT', desc: 'Your own text/label', defaultHeight: 20 },
  { type: 'clock', label: 'Digital Clock', icon: 'CLK', desc: 'Large digital clock display', defaultHeight: 28 },
  { type: 'comm-status', label: 'Comm Status', icon: 'COM', desc: 'Device communication status', defaultHeight: 22 },
  { type: 'page-nav', label: 'Page Navigation', icon: 'NAV', desc: 'Quick page switch buttons', defaultHeight: 24 },
];

interface PageSettings {
  header: {
    show: boolean;
    logoUrl: string;
    title: string;
    subtitle: string;
    bgColor: string;
    textColor: string;
    height: number;
  };
  footer: {
    show: boolean;
    customText: string;
    bgColor: string;
    textColor: string;
    height: number;
    widgets: FooterWidget[];
    showAlarmBanner?: boolean;
    showTrendStrip?: boolean;
    showStatusBar?: boolean;
  };
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
  pageSettings?: PageSettings;
}

interface ProjectData {
  id: string;
  name: string;
  mimicPages: { id: string; name: string; pageOrder: number; isHomePage: boolean }[];
  userRole: string;
}

// ─── Tag types ───────────────────────────────────
interface TagData {
  id: string;
  name: string;
  description?: string;
  type: 'INTERNAL' | 'SIMULATED' | 'CALCULATED' | 'EXTERNAL';
  dataType: 'BOOLEAN' | 'INTEGER' | 'FLOAT' | 'STRING';
  unit?: string;
  minValue?: number | null;
  maxValue?: number | null;
  initialValue?: string;
  currentValue?: string;
  simPattern?: string | null;
  simFrequency?: number | null;
  simAmplitude?: number | null;
  simOffset?: number | null;
  liveValue?: any;
}

// Quick tag templates per symbol type
type TagTemplate = { suffix: string; dataType: 'BOOLEAN' | 'FLOAT' | 'INTEGER' | 'STRING'; unit: string; min?: number; max?: number };
const TAG_TEMPLATES: Record<string, TagTemplate[]> = {
  // ── Switchgear ──
  CB: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'tripCount', dataType: 'INTEGER', unit: '', min: 0, max: 99999 },
    { suffix: 'lastTrip', dataType: 'STRING', unit: '' },
  ],
  VacuumCB: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'tripCount', dataType: 'INTEGER', unit: '', min: 0, max: 99999 },
    { suffix: 'vacuumIntegrity', dataType: 'BOOLEAN', unit: '' },
  ],
  SF6CB: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'sf6Pressure', dataType: 'FLOAT', unit: 'bar', min: 0, max: 10 },
    { suffix: 'tripCount', dataType: 'INTEGER', unit: '', min: 0, max: 99999 },
  ],
  ACB: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'tripCount', dataType: 'INTEGER', unit: '', min: 0, max: 99999 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
  ],
  MCCB: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
  ],
  MCB: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
  ],
  RCCB: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'leakageCurrent', dataType: 'FLOAT', unit: 'mA', min: 0, max: 300 },
  ],
  Isolator: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 1 }  /* 0=Open 1=Closed */,
  ],
  EarthSwitch: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 1 }  /* 0=Open 1=Closed */,
  ],
  Fuse: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 1 }  /* 0=Open 1=Closed */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
  ],
  Contactor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'operationCount', dataType: 'INTEGER', unit: '', min: 0, max: 999999 },
  ],
  LoadBreakSwitch: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
  ],
  AutoRecloser: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'reclosureCount', dataType: 'INTEGER', unit: '', min: 0, max: 9999 },
  ],
  Sectionalizer: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'faultCount', dataType: 'INTEGER', unit: '', min: 0, max: 9999 },
  ],
  RingMainUnit: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 36 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 630 },
  ],
  GIS: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'sf6Pressure', dataType: 'FLOAT', unit: 'bar', min: 0, max: 10 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 100 },
  ],
  // ── Transformers & Reactors ──
  Transformer: [
    { suffix: 'hvVoltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
    { suffix: 'lvVoltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 100 },
    { suffix: 'mvaRating', dataType: 'FLOAT', unit: 'MVA', min: 0, max: 500 },
    { suffix: 'tapPosition', dataType: 'INTEGER', unit: '', min: 1, max: 32 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 150 },
    { suffix: 'oilLevel', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
  ],
  AutoTransformer: [
    { suffix: 'hvVoltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
    { suffix: 'lvVoltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 100 },
    { suffix: 'tapPosition', dataType: 'INTEGER', unit: '', min: 1, max: 32 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 150 },
  ],
  ZigZagTransformer: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 150 },
  ],
  InstrumentTransformer: [
    { suffix: 'ratio', dataType: 'FLOAT', unit: '', min: 0, max: 10000 },
    { suffix: 'burden', dataType: 'FLOAT', unit: 'VA', min: 0, max: 200 },
  ],
  StepVoltageRegulator: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
    { suffix: 'tapPosition', dataType: 'INTEGER', unit: '', min: 1, max: 32 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
  ],
  ShuntReactor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 150 },
  ],
  SeriesReactor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
  ],
  SaturableReactor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
  ],
  Reactor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 150 },
  ],
  // ── Rotating Machines ──
  Generator: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 33 },
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'MW', min: 0, max: 500 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
  ],
  SyncGenerator: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 33 },
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'MW', min: 0, max: 500 },
    { suffix: 'powerFactor', dataType: 'FLOAT', unit: '', min: 0, max: 1 },
  ],
  Motor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
    { suffix: 'speed', dataType: 'FLOAT', unit: 'RPM', min: 0, max: 3600 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 200 },
  ],
  AsyncMotor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
    { suffix: 'speed', dataType: 'FLOAT', unit: 'RPM', min: 0, max: 3600 },
    { suffix: 'slip', dataType: 'FLOAT', unit: '%', min: 0, max: 10 },
  ],
  SyncMotor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
    { suffix: 'speed', dataType: 'FLOAT', unit: 'RPM', min: 0, max: 3600 },
    { suffix: 'powerFactor', dataType: 'FLOAT', unit: '', min: 0, max: 1 },
  ],
  VFD: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 0, max: 60 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
    { suffix: 'speed', dataType: 'FLOAT', unit: 'RPM', min: 0, max: 3600 },
  ],
  SoftStarter: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
  ],
  // ── Power Electronics ──
  Rectifier: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'dcVoltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 1000 },
    { suffix: 'dcCurrent', dataType: 'FLOAT', unit: 'A', min: 0, max: 500 },
  ],
  Inverter: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'acVoltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 1000 },
  ],
  UPSDetail: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'batteryLevel', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
    { suffix: 'load', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
    { suffix: 'inputVoltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
    { suffix: 'outputVoltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
  ],
  StaticTransferSwitch: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 3 }  /* 0=Open 1=Closed 2=Trip 3=FailedToOperate */,
    { suffix: 'activeSource', dataType: 'INTEGER', unit: '', min: 1, max: 2 },
  ],
  SVC: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'reactivePower', dataType: 'FLOAT', unit: 'MVAr', min: -200, max: 200 },
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
  ],
  STATCOM: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'reactivePower', dataType: 'FLOAT', unit: 'MVAr', min: -200, max: 200 },
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
  ],
  Thyristor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'firingAngle', dataType: 'FLOAT', unit: '°', min: 0, max: 180 },
  ],
  CapacitorBank: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'reactivePower', dataType: 'FLOAT', unit: 'kVAr', min: 0, max: 10000 },
    { suffix: 'steps', dataType: 'INTEGER', unit: '', min: 0, max: 12 },
  ],
  Battery: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
    { suffix: 'soc', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: -500, max: 500 },
  ],
  // ── Renewable Energy ──
  SolarPanel: [
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 500 },
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 1000 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 20 },
    { suffix: 'irradiance', dataType: 'FLOAT', unit: 'W/m²', min: 0, max: 1200 },
  ],
  SolarInverter: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 1000 },
    { suffix: 'efficiency', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
    { suffix: 'dcVoltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 1000 },
  ],
  WindTurbine: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 5000 },
    { suffix: 'windSpeed', dataType: 'FLOAT', unit: 'm/s', min: 0, max: 30 },
    { suffix: 'rotorSpeed', dataType: 'FLOAT', unit: 'RPM', min: 0, max: 30 },
  ],
  BESS: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'soc', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: -5000, max: 5000 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 60 },
  ],
  SolarString: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 1000 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 20 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 50 },
  ],
  // ── Metering ──
  CT: [
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
    { suffix: 'ratio', dataType: 'FLOAT', unit: '', min: 0, max: 10000 },
  ],
  PT: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
    { suffix: 'ratio', dataType: 'FLOAT', unit: '', min: 0, max: 10000 },
  ],
  Meter: [
    { suffix: 'value', dataType: 'FLOAT', unit: '', min: 0, max: 9999 },
  ],
  Transducer: [
    { suffix: 'input', dataType: 'FLOAT', unit: '', min: 0, max: 9999 },
    { suffix: 'output', dataType: 'FLOAT', unit: '', min: 0, max: 9999 },
  ],
  EnergyMeter: [
    { suffix: 'energy', dataType: 'FLOAT', unit: 'kWh', min: 0, max: 999999 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 10000 },
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
  ],
  PowerAnalyzer: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 10000 },
    { suffix: 'powerFactor', dataType: 'FLOAT', unit: '', min: 0, max: 1 },
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
  ],
  MaxDemandIndicator: [
    { suffix: 'maxDemand', dataType: 'FLOAT', unit: 'kW', min: 0, max: 10000 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
  ],
  FrequencyMeter: [
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
  ],
  Synchroscope: [
    { suffix: 'angleDiff', dataType: 'FLOAT', unit: '°', min: -180, max: 180 },
    { suffix: 'freqDiff', dataType: 'FLOAT', unit: 'Hz', min: -1, max: 1 },
  ],
  PowerFactorMeter: [
    { suffix: 'powerFactor', dataType: 'FLOAT', unit: '', min: 0, max: 1 },
  ],
  Ammeter: [
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
  ],
  Voltmeter: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
  ],
  Wattmeter: [
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 10000 },
  ],
  // ── Protection Relays ──
  Relay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
  ],
  OvercurrentRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'pickupCurrent', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
  ],
  EarthFaultRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'residualCurrent', dataType: 'FLOAT', unit: 'A', min: 0, max: 500 },
  ],
  DistanceRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'impedance', dataType: 'FLOAT', unit: 'Ω', min: 0, max: 100 },
  ],
  DifferentialRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'differentialCurrent', dataType: 'FLOAT', unit: 'A', min: 0, max: 1000 },
  ],
  DirectionalRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
  ],
  UnderFrequencyRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
  ],
  OverFrequencyRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
  ],
  LockoutRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'locked', dataType: 'BOOLEAN', unit: '' },
  ],
  BuchholzRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'gasLevel', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
  ],
  OvervoltageRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
  ],
  UndervoltageRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
  ],
  NegativeSequenceRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'negSeqCurrent', dataType: 'FLOAT', unit: 'A', min: 0, max: 500 },
  ],
  ThermalOverloadRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'thermalLoad', dataType: 'FLOAT', unit: '%', min: 0, max: 200 },
  ],
  ReversePowerRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tripSignal', dataType: 'BOOLEAN', unit: '' },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: -1000, max: 1000 },
  ],
  SynchCheckRelay: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'synchOk', dataType: 'BOOLEAN', unit: '' },
  ],
  // ── Bus & Connections ──
  BusBar: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
  ],
  DoubleBusBar: [
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'kV', min: 0, max: 500 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 5000 },
  ],
  BusSection: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  BusTie: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  Cable: [
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 90 },
  ],
  OverheadLine: [
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: -20, max: 80 },
  ],
  UndergroundCable: [
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 90 },
  ],
  LightningArrester: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'leakageCurrent', dataType: 'FLOAT', unit: 'mA', min: 0, max: 10 },
  ],
  Feeder: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 2000 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 10000 },
  ],
  // ── Indicators ──
  IndicatorLamp: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  AlarmHorn: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  PushButton: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  SelectorSwitch: [
    { suffix: 'position', dataType: 'INTEGER', unit: '', min: 0, max: 3 },
  ],
  LEDIndicator: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  DigitalDisplay: [
    { suffix: 'value', dataType: 'FLOAT', unit: '', min: 0, max: 9999 },
  ],
  Annunciator: [
    { suffix: 'alarm', dataType: 'BOOLEAN', unit: '' },
  ],
  // ── Infrastructure ──
  Panel: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  MCC: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
  ],
  PLC: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'commStatus', dataType: 'BOOLEAN', unit: '' },
  ],
  HMI: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  Communication: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
  ],
  Antenna: [
    { suffix: 'signalStrength', dataType: 'FLOAT', unit: 'dBm', min: -120, max: 0 },
  ],
  // ── Piping & Mechanical ──
  Valve: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'position', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
  ],
  Pump: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'flow', dataType: 'FLOAT', unit: 'm³/h', min: 0, max: 1000 },
    { suffix: 'pressure', dataType: 'FLOAT', unit: 'bar', min: 0, max: 20 },
    { suffix: 'current', dataType: 'FLOAT', unit: 'A', min: 0, max: 500 },
  ],
  Compressor: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'pressure', dataType: 'FLOAT', unit: 'bar', min: 0, max: 30 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 200 },
  ],
  Tank: [
    { suffix: 'level', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: 0, max: 200 },
    { suffix: 'pressure', dataType: 'FLOAT', unit: 'bar', min: 0, max: 20 },
  ],
  HeatExchanger: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'inletTemp', dataType: 'FLOAT', unit: '°C', min: 0, max: 300 },
    { suffix: 'outletTemp', dataType: 'FLOAT', unit: '°C', min: 0, max: 300 },
  ],
  Filter: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'differentialPressure', dataType: 'FLOAT', unit: 'bar', min: 0, max: 5 },
  ],
  FlowMeter: [
    { suffix: 'flow', dataType: 'FLOAT', unit: 'm³/h', min: 0, max: 1000 },
    { suffix: 'totalFlow', dataType: 'FLOAT', unit: 'm³', min: 0, max: 999999 },
  ],
  PressureGauge: [
    { suffix: 'pressure', dataType: 'FLOAT', unit: 'bar', min: 0, max: 100 },
  ],
  TemperatureSensor: [
    { suffix: 'temperature', dataType: 'FLOAT', unit: '°C', min: -50, max: 500 },
  ],
  LevelSensor: [
    { suffix: 'level', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
  ],
  // ── Miscellaneous ──
  DGSet: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
    { suffix: 'frequency', dataType: 'FLOAT', unit: 'Hz', min: 45, max: 55 },
    { suffix: 'power', dataType: 'FLOAT', unit: 'kW', min: 0, max: 5000 },
    { suffix: 'fuelLevel', dataType: 'FLOAT', unit: '%', min: 0, max: 100 },
  ],
  AVR: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'voltage', dataType: 'FLOAT', unit: 'V', min: 0, max: 500 },
  ],
  RTCC: [
    { suffix: 'status', dataType: 'INTEGER', unit: '', min: 0, max: 2 }  /* 0=Stopped 1=Running 2=Fault */,
    { suffix: 'tapPosition', dataType: 'INTEGER', unit: '', min: 1, max: 32 },
  ],
};

function formatLabel(suffix: string): string {
  return suffix.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

// Searchable autocomplete tag binding field
function TagBindingField({ label, boundTag, availableTags, onBind, onUnbind }: {
  label: string;
  boundTag: string;
  availableTags: TagData[];
  onBind: (tagName: string) => void;
  onUnbind: () => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = availableTags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (boundTag) {
    return (
      <div className="mb-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
        <div className="flex items-center gap-1 px-2 py-1 text-xs border border-blue-200 rounded bg-blue-50">
          <span className="text-blue-700 truncate flex-1">{boundTag}</span>
          <button onClick={onUnbind} className="text-red-400 hover:text-red-600 shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 relative" ref={ref}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search tags..."
        className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-32 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg">
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => { onBind(t.name); setSearch(''); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 text-xs text-gray-900 hover:bg-blue-100 hover:text-blue-900 flex items-center justify-between"
            >
              <span className="truncate">{t.name}</span>
              <span className="text-gray-500 ml-1 shrink-0">{t.unit || t.dataType}</span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && search && (
        <div className="absolute z-50 left-0 right-0 mt-1 px-2 py-1 bg-white border border-gray-200 rounded shadow-lg text-xs text-gray-600">
          No matching tags
        </div>
      )}
    </div>
  );
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
    name: 'Electrical Loads',
    symbols: [
      { type: 'GenericLoad', label: 'Generic Load', w: 60, h: 60 },
      { type: 'ResistiveLoad', label: 'Resistive Load', w: 60, h: 60 },
      { type: 'InductiveLoad', label: 'Inductive Load', w: 60, h: 60 },
      { type: 'CapacitiveLoad', label: 'Capacitive Load', w: 60, h: 60 },
      { type: 'LightingLoad', label: 'Lighting Load', w: 60, h: 60 },
      { type: 'HeatingLoad', label: 'Heating Load', w: 60, h: 60 },
      { type: 'FanLoad', label: 'Fan / Blower', w: 60, h: 60 },
      { type: 'AHU', label: 'AHU', w: 80, h: 60 },
      { type: 'Chiller', label: 'Chiller', w: 80, h: 60 },
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
    name: 'Banners & Displays',
    symbols: [
      { type: 'alarm-banner', label: 'Alarm Banner', w: 400, h: 35 },
      { type: 'alarm-list', label: 'Alarm List', w: 300, h: 150 },
      { type: 'trend-banner', label: 'Trend Strip', w: 400, h: 60 },
      { type: 'status-banner', label: 'Status Banner', w: 400, h: 30 },
      { type: 'clock-display', label: 'Digital Clock', w: 180, h: 50 },
      { type: 'value-display', label: 'Value Display', w: 120, h: 50 },
      { type: 'bar-graph', label: 'Bar Graph', w: 60, h: 120 },
      { type: 'gauge-display', label: 'Gauge', w: 100, h: 100 },
      { type: 'comm-status-bar', label: 'Comm Status', w: 300, h: 30 },
      { type: 'event-ticker', label: 'Event Ticker', w: 400, h: 28 },
    ],
  },
  {
    name: 'Navigation',
    symbols: [
      { type: 'page-link', label: 'Page Link', w: 120, h: 40 },
      { type: 'page-change-button', label: 'Page Change Btn', w: 140, h: 45 },
      { type: 'back-button', label: 'Back Button', w: 100, h: 40 },
      { type: 'home-button', label: 'Home Button', w: 100, h: 40 },
      { type: 'popup-page', label: 'Popup Page', w: 120, h: 40 },
    ],
  },
  {
    name: 'Scripting & Actions',
    symbols: [
      { type: 'action-button', label: 'Action Button', w: 140, h: 45 },
      { type: 'script-runner', label: 'Script Runner', w: 140, h: 45 },
      { type: 'formula-display', label: 'Formula Display', w: 160, h: 50 },
      { type: 'sequence-trigger', label: 'Sequence Trigger', w: 140, h: 45 },
      { type: 'conditional-display', label: 'Conditional Display', w: 160, h: 50 },
    ],
  },
  {
    name: '3D Skeuomorphic Controls',
    symbols: [
      { type: '3d-push-button', label: '3D Push Button', w: 100, h: 50 },
      { type: '3d-toggle-switch', label: '3D Toggle Switch', w: 100, h: 45 },
      { type: '3d-emergency-stop', label: '3D E-Stop', w: 80, h: 80 },
      { type: '3d-indicator-lamp', label: '3D Indicator Lamp', w: 50, h: 50 },
      { type: '3d-rocker-switch', label: '3D Rocker Switch', w: 70, h: 50 },
      { type: '3d-rotary-selector', label: '3D Rotary Selector', w: 70, h: 70 },
    ],
  },
];

let nextId = 1;
function genId() { return `el-${Date.now()}-${nextId++}`; }

export default function MimicEditor() {
  const { projectId, pageId } = useParams<{ projectId: string; pageId?: string }>();
  const navigate = useNavigate();

  // ── AI Chat state ──────────────────────────────────────────────────────────
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user'|'ai'; text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  // ───────────────────────────────────────────────────────────────────────────

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
  const [gridSize, setGridSize] = useState(5);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [pageName, setPageName] = useState('');
  const [history, setHistory] = useState<MimicElement[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elStartX: number; elStartY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: string; startX: number; startY: number; startW: number; startH: number; startEX: number; startEY: number } | null>(null);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<string[]>(['Custom', 'Electrical Loads', ...SYMBOL_CATEGORIES.map((c) => c.name)]);
  const [customComponents, setCustomComponents] = useState<any[]>([]);
  const [showComponentCreator, setShowComponentCreator] = useState(false);
  const [editingComponent, setEditingComponent] = useState<any>(null);
  const [drawingLine, setDrawingLine] = useState<{ points: { x: number; y: number }[] } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const [clipboard, setClipboard] = useState<MimicElement[]>([]);
  const [tool, setTool] = useState<'select' | 'text' | 'rect' | 'circle' | 'line'>('select');
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ elementId: string; point: string } | null>(null);
  const [drawingBus, setDrawingBus] = useState<null | 'active' | { x: number; y: number }>(null);
  const [busPreviewEnd, setBusPreviewEnd] = useState<{ x: number; y: number } | null>(null);
  const [pageSettings, setPageSettings] = useState<PageSettings>({
    header: { show: true, logoUrl: '', title: '', subtitle: '', bgColor: '#0F172A', textColor: '#FFFFFF', height: 50 },
    footer: { show: true, customText: '', bgColor: '#0F172A', textColor: '#FFFFFF', height: 60, widgets: [{ id: 'w1', type: 'alarm-banner' as FooterWidgetType, label: 'Alarm Banner', height: 28 }, { id: 'w2', type: 'status-bar' as FooterWidgetType, label: 'Status Bar', height: 22 }] },
  });
  const [rightTab, setRightTab] = useState<'properties' | 'pageSettings' | 'headerFooter'>('properties');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showScriptRef, setShowScriptRef] = useState(false);
  const [scriptRefSearch, setScriptRefSearch] = useState('');

  // Tags panel state
  const [leftTab, setLeftTab] = useState<'components' | 'tags'>('components');
  const [tags, setTags] = useState<TagData[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [tagForm, setTagForm] = useState({
    name: '', type: 'INTERNAL' as 'INTERNAL' | 'SIMULATED',
    dataType: 'FLOAT' as 'BOOLEAN' | 'INTEGER' | 'FLOAT' | 'STRING',
    unit: '', minValue: '', maxValue: '', simPattern: 'rand', simFrequency: '1', simAmplitude: '10', simOffset: '0',
  });
  const [tagBindingDropdown, setTagBindingDropdown] = useState(false);
  const [tagBindingSearch, setTagBindingSearch] = useState('');
  const [targetTagDropdown, setTargetTagDropdown] = useState(false);
  const [targetTagSearch, setTargetTagSearch] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Save current projectId to localStorage for sidebar navigation
  useEffect(() => {
    if (projectId) localStorage.setItem('gridvision-last-project', projectId);
  }, [projectId]);

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
      const els = (data.elements || []).map((el: any) => ({
        ...el,
        type: el.type || el.elementType || 'Feeder',
        zIndex: el.zIndex ?? 0,
        width: el.width ?? 80,
        height: el.height ?? 80,
        properties: {
          tagBindings: {},
          label: el.label || el.properties?.label || '',
          ...( el.properties || {}),
        },
      })) as MimicElement[];
      setElements(els);
      setConnections((data.connections || []).filter((c: any) => Array.isArray(c.points) && c.points.length >= 2) as MimicConnection[]);
      setGridSize(data.gridSize || 5);
      setBgColor(data.backgroundColor || '#FFFFFF');
      setPageName(data.name || '');
      const defaultPageSettings = {
        header: { show: true, logoUrl: '', title: '', subtitle: '', bgColor: '#0F172A', textColor: '#FFFFFF', height: 50 },
        footer: { show: true, customText: '', bgColor: '#0F172A', textColor: '#FFFFFF', height: 60, widgets: [{ id: 'w1', type: 'alarm-banner' as FooterWidgetType, label: 'Alarm Banner', height: 28 }, { id: 'w2', type: 'status-bar' as FooterWidgetType, label: 'Status Bar', height: 22 }] },
      };
      const ps = data.pageSettings || {};
      setPageSettings({
        header: { ...defaultPageSettings.header, ...(ps.header || {}) },
        footer: { ...defaultPageSettings.footer, ...(ps.footer || {}) },
      });
      setHistory([els]);
      setHistoryIdx(0);
    });
  }, [projectId, activePageId]);

  // Element update helpers (must be before callbacks that reference them)
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

  // Load tags (scoped to project)
  const loadTags = useCallback(() => {
    if (!projectId) return;
    api.get('/tags', { params: { projectId } }).then(({ data }) => setTags(data)).catch(() => {});
  }, [projectId]);

  useEffect(() => { loadTags(); }, [loadTags]);

  // Load custom components
  const loadCustomComponents = useCallback(() => {
    if (!projectId) return;
    api.get('/custom-components', { params: { projectId } }).then(({ data }) => setCustomComponents(data)).catch(() => {});
  }, [projectId]);
  useEffect(() => { loadCustomComponents(); }, [loadCustomComponents]);

  const deleteCustomComponent = useCallback(async (id: string) => {
    if (!confirm('Delete this custom component?')) return;
    try {
      await api.delete(`/custom-components/${id}`);
      loadCustomComponents();
    } catch (err) {
      console.error('Delete component error:', err);
    }
  }, [loadCustomComponents]);

  // Create tag (scoped to project)
  const createTag = useCallback(async (tagData: {
    name: string; type: string; dataType: string; unit?: string;
    minValue?: number | null; maxValue?: number | null;
    simPattern?: string; simFrequency?: number; simAmplitude?: number; simOffset?: number;
  }) => {
    if (!projectId) return false;
    try {
      await api.post('/tags', {
        name: tagData.name,
        type: tagData.type,
        dataType: tagData.dataType,
        unit: tagData.unit || undefined,
        minValue: tagData.minValue ?? undefined,
        maxValue: tagData.maxValue ?? undefined,
        projectId,
        ...(tagData.type === 'SIMULATED' ? {
          simPattern: tagData.simPattern || 'rand',
          simFrequency: tagData.simFrequency || 1,
          simAmplitude: tagData.simAmplitude || 10,
          simOffset: tagData.simOffset || 0,
        } : {}),
      });
      loadTags();
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.details?.[0]?.message || err?.response?.data?.error || 'Failed to create tag';
      alert(msg);
      return false;
    }
  }, [loadTags, projectId]);

  // Delete tag
  const deleteTag = useCallback(async (id: string) => {
    try {
      await api.delete(`/tags/${id}`);
      loadTags();
    } catch {}
  }, [loadTags]);

  const updateTagProps = useCallback(async (tag: TagData) => {
    try {
      await api.put(`/tags/${tag.id}`, {
        name: tag.name,
        description: tag.description || undefined,
        type: tag.type,
        dataType: tag.dataType,
        unit: tag.unit || undefined,
        minValue: tag.minValue ?? null,
        maxValue: tag.maxValue ?? null,
        simPattern: tag.simPattern || null,
        simFrequency: tag.simFrequency || null,
        simAmplitude: tag.simAmplitude || null,
        simOffset: tag.simOffset || null,
      });
      loadTags();
      setEditingTag(null);
    } catch (err) { console.error('Failed to update tag:', err); }
  }, [loadTags]);

  // Quick create from template and bind to tagBindings map
  const quickCreateAndBind = useCallback(async (prefix: string, template: TagTemplate, elementId: string) => {
    const tagName = `${prefix}.${template.suffix}`;
    const existing = tags.find(t => t.name === tagName);
    if (!existing) {
      const ok = await createTag({
        name: tagName,
        type: 'SIMULATED',
        dataType: template.dataType,
        unit: template.unit,
        minValue: template.min ?? null,
        maxValue: template.max ?? null,
        simPattern: 'rand',
        simFrequency: 1,
        simAmplitude: template.max ? (template.max - (template.min || 0)) / 2 : 10,
        simOffset: template.max ? ((template.max + (template.min || 0)) / 2) : 0,
      });
      if (!ok) return;
    }
    const el = elements.find(e => e.id === elementId);
    const newBindings = { ...(el?.properties.tagBindings || {}), [template.suffix]: tagName };
    updateElementProps(elementId, { tagBindings: newBindings });
  }, [createTag, updateElementProps, tags, elements]);

  // Quick bind all: create all tags for a symbol and bind them
  const quickBindAll = useCallback(async (elementId: string) => {
    const el = elements.find(e => e.id === elementId);
    if (!el || !(el.type in TAG_TEMPLATES)) return;
    const prefix = (el.properties.label || el.type).replace(/\s+/g, '');
    const newBindings = { ...(el.properties.tagBindings || {}) };
    for (const tmpl of TAG_TEMPLATES[el.type]) {
      const tagName = `${prefix}.${tmpl.suffix}`;
      const existing = tags.find(t => t.name === tagName);
      if (!existing) {
        const ok = await createTag({
          name: tagName,
          type: 'SIMULATED',
          dataType: tmpl.dataType,
          unit: tmpl.unit,
          minValue: tmpl.min ?? null,
          maxValue: tmpl.max ?? null,
          simPattern: 'rand',
          simFrequency: 1,
          simAmplitude: tmpl.max ? (tmpl.max - (tmpl.min || 0)) / 2 : 10,
          simOffset: tmpl.max ? ((tmpl.max + (tmpl.min || 0)) / 2) : 0,
        });
        if (!ok) continue;
      }
      newBindings[tmpl.suffix] = tagName;
    }
    updateElementProps(elementId, { tagBindings: newBindings });
  }, [createTag, updateElementProps, tags, elements]);

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
        pageSettings,
      });
    } finally {
      setSaving(false);
    }
  }, [projectId, activePageId, pageName, elements, connections, gridSize, bgColor, pageSettings]);

  // ── AI Chat: send message, apply changes + auto-create & bind tags ────────
  const sendAiChat = useCallback(async () => {
    const msg = aiInput.trim();
    if (!msg || aiLoading) return;
    setAiMessages(prev => [...prev, { role: 'user', text: msg }]);
    setAiInput('');
    setAiLoading(true);
    try {
      const prevElementIds = new Set(elements.map(e => e.id));

      const { data } = await api.post('/sld/chat', {
        elements,
        connections,
        message: msg,
        projectName: project?.name || 'SLD',
      });

      // Push undo history before applying
      pushHistory(elements);

      // ── Auto-create tags for newly added elements ──────────────────────
      const newElements: typeof elements = data.elements;
      const addedElements = newElements.filter((e: any) => !prevElementIds.has(e.id));
      let tagsBound = 0;

      for (const el of addedElements) {
        // Normalise type to match TAG_TEMPLATES keys (e.g. "circuit_breaker" → "VacuumCB")
        const typeMap: Record<string, string> = {
          circuit_breaker: 'VacuumCB',
          vcb: 'VacuumCB',
          breaker: 'VacuumCB',
          transformer: 'Transformer',
          avr: 'StepVoltageRegulator',
          busbar: 'Busbar',
          bus: 'Busbar',
          generator: 'Generator',
          motor: 'Motor',
          load: 'GenericLoad',
          solar: 'SolarInverter',
          capacitor: 'CapacitorBank',
          ct: 'CT',
          pt: 'VT',
          arrester: 'SurgeArrester',
          isolator: 'Isolator',
          fuse: 'Fuse',
        };
        const resolvedType = typeMap[el.type?.toLowerCase()] || el.type;
        const templates = TAG_TEMPLATES[resolvedType] || TAG_TEMPLATES[el.type] || [];
        if (!templates.length) continue;

        const prefix = (el.properties?.label || el.type).replace(/[^a-zA-Z0-9_]/g, '_');
        const newBindings: Record<string, string> = { ...(el.properties?.tagBindings || {}) };

        for (const tmpl of templates) {
          const tagName = `${prefix}.${tmpl.suffix}`;
          const existing = tags.find(t => t.name === tagName);
          if (!existing && projectId) {
            try {
              await api.post('/tags', {
                name: tagName,
                type: 'SIMULATED',
                dataType: tmpl.dataType,
                unit: tmpl.unit || undefined,
                minValue: tmpl.min ?? undefined,
                maxValue: tmpl.max ?? undefined,
                projectId,
                simPattern: 'rand',
                simFrequency: 1,
                simAmplitude: tmpl.max ? (tmpl.max - (tmpl.min || 0)) / 2 : 10,
                simOffset: tmpl.max ? ((tmpl.max + (tmpl.min || 0)) / 2) : 0,
              });
            } catch { continue; }
          }
          newBindings[tmpl.suffix] = tagName;
          tagsBound++;
        }
        // Patch the element in newElements with the bound tags
        const idx = newElements.findIndex((e: any) => e.id === el.id);
        if (idx >= 0) {
          newElements[idx] = { ...newElements[idx], properties: { ...newElements[idx].properties, tagBindings: newBindings } };
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      setElements(newElements.map((el: any) => {
        const resolvedType = frontendNormalizeType(el.type || '');
        return {
          ...el,
          type: resolvedType,
          zIndex: el.zIndex ?? 1,
          width:  (el.width  && el.width  > 0) ? el.width  : (resolvedType === 'BusBar' || resolvedType === 'DoubleBusBar' ? 500 : 60),
          height: (el.height && el.height > 0) ? el.height : (resolvedType === 'BusBar' ? 20 : resolvedType === 'DoubleBusBar' ? 30 : 60),
          rotation: el.rotation ?? 0,
          properties: { tagBindings: {}, showLabel: true, label: el.label || '', ...(el.properties || {}) },
        };
      }));
      setConnections((data.connections || []).filter((c: any) => Array.isArray(c.points) && c.points.length >= 2));
      loadTags(); // Refresh tag list

      const tagNote = tagsBound > 0 ? ` Auto-created & bound ${tagsBound} tags for ${addedElements.length} new element(s).` : '';
      setAiMessages(prev => [...prev, { role: 'ai', text: (data.explanation || 'Changes applied.') + tagNote }]);

      // Auto-save
      if (projectId && activePageId) {
        await api.put(`/projects/${projectId}/pages/${activePageId}`, {
          name: pageName, elements: newElements, connections: (data.connections || []).filter((c: any) => Array.isArray(c.points) && c.points.length >= 2),
          gridSize, backgroundColor: bgColor, pageSettings,
        }).catch(() => {});
      }
    } catch (err: any) {
      setAiMessages(prev => [...prev, { role: 'ai', text: `Error: ${err?.response?.data?.error || err.message || 'Failed'}` }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [aiInput, aiLoading, elements, connections, project, projectId, activePageId, pageName, gridSize, bgColor, pageSettings, pushHistory, tags, loadTags]);
  // ─────────────────────────────────────────────────────────────────────────

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
        setDrawingBus(null);
        setBusPreviewEnd(null);
        setShowScriptRef(false);
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setShowScriptRef(prev => !prev);
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

  // Drop from palette or tag panel
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    // Handle tag drag-to-bind
    const tagName = e.dataTransfer.getData('application/tag');
    if (tagName) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const mx = (e.clientX - svgRect.left - pan.x) / zoom;
      const my = (e.clientY - svgRect.top - pan.y) / zoom;
      // Find element under drop point
      const target = elements.find((el) =>
        mx >= el.x && mx <= el.x + el.width && my >= el.y && my <= el.y + el.height,
      );
      if (target) {
        if (target.type.startsWith('ctrl-')) {
          updateElementProps(target.id, { targetTag: tagName });
        } else {
          updateElementProps(target.id, { tagBinding: tagName });
        }
        setSelectedIds([target.id]);
      }
      return;
    }

    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const parsed = JSON.parse(data);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const x = snap((e.clientX - svgRect.left - pan.x) / zoom);
    const y = snap((e.clientY - svgRect.top - pan.y) / zoom);

    // BusBar: enter line drawing mode instead of placing immediately
    if (parsed.type === 'BusBar') {
      setDrawingBus('active');
      setSelectedIds([]);
      return;
    }

    // Handle custom component drop
    if (parsed.type === 'custom-component') {
      const newEl: MimicElement = {
        id: genId(),
        type: 'custom-component',
        x, y,
        width: parsed.w || 80,
        height: parsed.h || 60,
        rotation: 0,
        zIndex: elements.length,
        properties: {
          label: parsed.label || parsed.name || 'Custom',
          customComponentId: parsed.customComponentId,
          svgCode: parsed.svgCode,
          name: parsed.name,
        },
      };
      const newEls = [...elements, newEl];
      setElements(newEls);
      pushHistory(newEls);
      setSelectedIds([newEl.id]);
      return;
    }

    const isNav = ['page-link', 'back-button', 'home-button', 'page-change-button', 'popup-page'].includes(parsed.type);
    const isCtrl = parsed.type.startsWith('ctrl-');
    const isScript = ['action-button', 'script-runner', 'formula-display', 'sequence-trigger', 'conditional-display'].includes(parsed.type);
    const isBanner = ['alarm-banner', 'alarm-list', 'trend-banner', 'status-banner', 'clock-display', 'value-display', 'bar-graph', 'gauge-display', 'comm-status-bar', 'event-ticker'].includes(parsed.type);
    const is3D = parsed.type.startsWith('3d-');
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
        ...(isNav ? { buttonText: parsed.label, buttonColor: '#3B82F6', targetPageId: '', buttonStyle: 'solid' } : {}),
        ...(isCtrl ? {
          targetTag: '',
          controlAction: parsed.type === 'ctrl-toggle-button' ? 'toggle' : 'setValue',
          controlValue: '',
          buttonText: parsed.label,
          buttonColor: parsed.type === 'ctrl-push-button' ? '#EF4444' : parsed.type === 'ctrl-toggle-button' ? '#10B981' : '#3B82F6',
          controlScript: '',
        } : {}),
        ...(isBanner ? {
          bgColor: '#0F172A',
          textColor: '#22D3EE',
          unit: parsed.type === 'value-display' ? 'kV' : '',
        } : {}),
        ...(isScript ? {
          buttonText: parsed.label,
          buttonColor: parsed.type === 'action-button' ? '#7C3AED' : parsed.type === 'script-runner' ? '#0891B2' : parsed.type === 'sequence-trigger' ? '#DC2626' : '#3B82F6',
          script: parsed.type === 'formula-display' ? '// Formula: use tag names directly\n// Example:\n// Voltage_HV * Current_R * 1.732 / 1000' :
                  parsed.type === 'conditional-display' ? '// Condition → Display\n// IF CB_Status == 1 THEN "CLOSED"\n// IF CB_Status == 0 THEN "OPEN"\n// ELSE "UNKNOWN"' :
                  parsed.type === 'sequence-trigger' ? '// One step per line:\n// CB_Status = 0\n// WAIT(1000)\n// Isolator_A = 0\n// WAIT(1000)\n// Earth_Switch = 1' :
                  '// Simple syntax:\n// TagName = value     (set a tag)\n// WAIT(1000)          (delay 1 sec)\n// IF TagName > 100    (condition)\n//   Alarm = 1\n// END',
          scriptLanguage: 'javascript',
          executeOn: parsed.type === 'formula-display' ? 'continuous' : parsed.type === 'conditional-display' ? 'continuous' : 'click',
          resultDisplay: parsed.type === 'formula-display' || parsed.type === 'conditional-display' ? 'value' : 'none',
        } : {}),
        ...(is3D ? {
          targetTag: '',
          buttonText: parsed.label,
          buttonColor: parsed.type === '3d-emergency-stop' ? '#DC2626' : parsed.type === '3d-indicator-lamp' ? '#22C55E' : '#6B7280',
          controlAction: parsed.type === '3d-toggle-switch' || parsed.type === '3d-rocker-switch' ? 'toggle' : parsed.type === '3d-rotary-selector' ? 'cycle' : 'setValue',
          controlValue: '',
          lampColor: 'green',
          selectorPosition: 0,
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

    // BusBar line drawing mode
    if (drawingBus !== null) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const cx = snap((e.clientX - svgRect.left - pan.x) / zoom);
      const cy = snap((e.clientY - svgRect.top - pan.y) / zoom);

      if (drawingBus === 'active') {
        // First click: set start point
        setDrawingBus({ x: cx, y: cy });
      } else {
        // Second click: create bus bar
        let endX = cx;
        let endY = cy;
        // Snap to axis — choose the dominant direction
        const dx = Math.abs(endX - drawingBus.x);
        const dy = Math.abs(endY - drawingBus.y);
        if (dx <= dy) {
          // More vertical movement → snap to vertical (lock X)
          endX = drawingBus.x;
        } else {
          // More horizontal movement → snap to horizontal (lock Y)
          endY = drawingBus.y;
        }

        const x1 = drawingBus.x, y1 = drawingBus.y;
        const x2 = endX, y2 = endY;
        const newEl: MimicElement = {
          id: genId(),
          type: 'BusBar',
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.max(Math.abs(x2 - x1), 10),
          height: Math.max(Math.abs(y2 - y1), 10),
          rotation: 0,
          zIndex: elements.length,
          properties: {
            label: 'Bus Bar',
            relX1: x1 - Math.min(x1, x2),
            relY1: y1 - Math.min(y1, y2),
            relX2: x2 - Math.min(x1, x2),
            relY2: y2 - Math.min(y1, y2),
            busWidth: 6,
            color: '#333333',
          },
        };
        const newEls = [...elements, newEl];
        setElements(newEls);
        pushHistory(newEls);
        setSelectedIds([newEl.id]);
        setDrawingBus(null);
        setBusPreviewEnd(null);
      }
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
  }, [tool, elements, pan, zoom, snap, pushHistory, drawingBus]);

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

  // Bus drawing preview tracking
  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (typeof drawingBus === 'object' && drawingBus !== null) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      let mx = snap((e.clientX - svgRect.left - pan.x) / zoom);
      let my = snap((e.clientY - svgRect.top - pan.y) / zoom);
      // Snap to dominant axis
      const dxP = Math.abs(mx - drawingBus.x);
      const dyP = Math.abs(my - drawingBus.y);
      if (dxP <= dyP) { mx = drawingBus.x; } else { my = drawingBus.y; }
      setBusPreviewEnd({ x: mx, y: my });
    }
  }, [drawingBus, pan, zoom, snap]);

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
        ) : el.type.startsWith('3d-') ? (
          <g>
            <foreignObject width={el.width} height={el.height}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {el.type === '3d-push-button' && (
                  <div style={{
                    width: '90%', height: '75%', borderRadius: 6,
                    background: `linear-gradient(180deg, ${el.properties.buttonColor || '#6B7280'}, ${el.properties.buttonColor ? el.properties.buttonColor + 'CC' : '#4B5563'})`,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.4), 0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
                    border: '1px solid #333',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', userSelect: 'none' as any,
                    transition: 'all 0.1s ease',
                    color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'sans-serif',
                  }}>
                    {el.properties.buttonText || el.properties.label || 'PUSH'}
                  </div>
                )}
                {el.type === '3d-toggle-switch' && (
                  <div style={{
                    width: '85%', height: '65%', borderRadius: 20,
                    background: 'linear-gradient(180deg, #1f2937, #111827)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid #444',
                    display: 'flex', alignItems: 'center', padding: '0 4px',
                    position: 'relative' as any,
                  }}>
                    <div style={{
                      width: '45%', height: '80%', borderRadius: 16,
                      background: 'linear-gradient(180deg, #9ca3af, #6b7280)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                      transition: 'margin-left 0.2s ease',
                      marginLeft: '0%',
                    }} />
                    <span style={{ position: 'absolute' as any, right: 8, color: '#9ca3af', fontSize: 8, fontWeight: 'bold' }}>OFF</span>
                  </div>
                )}
                {el.type === '3d-emergency-stop' && (
                  <div style={{
                    width: '90%', height: '90%', borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #ef4444, #991b1b, #7f1d1d)',
                    boxShadow: '0 6px 12px rgba(0,0,0,0.5), 0 3px 0 #a3a3a3, inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.15)',
                    border: '3px solid #a3a3a3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}>
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                      {el.properties.buttonText || 'E-STOP'}
                    </span>
                  </div>
                )}
                {el.type === '3d-indicator-lamp' && (
                  <div style={{
                    width: '85%', height: '85%', borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${
                      el.properties.lampColor === 'red' ? '#fca5a5, #ef4444, #991b1b' :
                      el.properties.lampColor === 'amber' ? '#fcd34d, #f59e0b, #b45309' :
                      el.properties.lampColor === 'blue' ? '#93c5fd, #3b82f6, #1e40af' :
                      '#86efac, #22c55e, #166534'
                    })`,
                    boxShadow: `0 0 8px ${
                      el.properties.lampColor === 'red' ? 'rgba(239,68,68,0.5)' :
                      el.properties.lampColor === 'amber' ? 'rgba(245,158,11,0.5)' :
                      el.properties.lampColor === 'blue' ? 'rgba(59,130,246,0.5)' :
                      'rgba(34,197,94,0.5)'
                    }, inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)`,
                    border: '2px solid #555',
                  }} />
                )}
                {el.type === '3d-rocker-switch' && (
                  <div style={{
                    width: '80%', height: '70%', borderRadius: 4,
                    background: 'linear-gradient(180deg, #374151, #1f2937)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid #555',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    perspective: '100px',
                  }}>
                    <div style={{
                      width: '70%', height: '70%', borderRadius: 3,
                      background: 'linear-gradient(0deg, #9ca3af, #d1d5db)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
                      transform: 'rotateX(15deg)',
                      transition: 'transform 0.15s ease',
                    }} />
                  </div>
                )}
                {el.type === '3d-rotary-selector' && (
                  <div style={{
                    width: '85%', height: '85%', borderRadius: '50%',
                    background: 'linear-gradient(145deg, #4b5563, #374151)',
                    boxShadow: '0 3px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                    border: '2px solid #555',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative' as any,
                  }}>
                    <div style={{
                      width: 4, height: '35%',
                      background: '#d1d5db',
                      borderRadius: 2,
                      position: 'absolute' as any, top: '10%',
                      boxShadow: '0 0 2px rgba(0,0,0,0.5)',
                    }} />
                    <span style={{ color: '#9ca3af', fontSize: 7, position: 'absolute' as any, bottom: 4, fontWeight: 'bold' }}>
                      {el.properties.selectorPosition || '0'}
                    </span>
                  </div>
                )}
              </div>
            </foreignObject>
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
        ) : ['page-link', 'back-button', 'home-button', 'page-change-button', 'popup-page'].includes(el.type) ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.buttonColor || '#3B82F6'} stroke="#1E40AF" strokeWidth={1.5} rx={6} />
            {el.type === 'page-change-button' && (
              <rect x={el.width - 28} y={4} width={24} height={el.height - 8} rx={3} fill="rgba(255,255,255,0.2)" />
            )}
            {el.type === 'page-change-button' && (
              <text x={el.width - 16} y={el.height / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="#FFFFFF">▶</text>
            )}
            {el.type === 'popup-page' && (
              <text x={el.width - 16} y={el.height / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="#FFFFFF">⧉</text>
            )}
            <text x={el.type === 'page-change-button' || el.type === 'popup-page' ? (el.width - 28) / 2 : el.width / 2} y={el.height / 2 + 1} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="#FFFFFF" fontFamily="sans-serif" fontWeight="600">
              {el.properties.buttonText || el.properties.label || el.type}
            </text>
          </g>
        ) : ['action-button', 'script-runner', 'sequence-trigger'].includes(el.type) ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.buttonColor || '#7C3AED'} stroke={el.type === 'sequence-trigger' ? '#991B1B' : '#5B21B6'} strokeWidth={1.5} rx={6} />
            {/* Script icon */}
            <text x={10} y={el.height / 2 + 1} dominantBaseline="central" fontSize={14} fill="rgba(255,255,255,0.7)">
              {el.type === 'action-button' ? 'ZAP' : el.type === 'script-runner' ? 'SCR' : 'SEQ'}
            </text>
            <text x={28} y={el.height / 2 + 1} dominantBaseline="central" fontSize={11} fill="#FFFFFF" fontFamily="sans-serif" fontWeight="600">
              {el.properties.buttonText || el.properties.label}
            </text>
            {el.properties.script && el.properties.script.length > 30 && (
              <rect x={el.width - 20} y={4} width={16} height={16} rx={8} fill="rgba(255,255,255,0.25)" />
            )}
          </g>
        ) : ['formula-display', 'conditional-display'].includes(el.type) ? (
          <g>
            <rect width={el.width} height={el.height} fill="#1E293B" stroke="#475569" strokeWidth={1} rx={4} />
            <text x={6} y={14} fontSize={9} fill="#94A3B8" fontFamily="monospace">{el.type === 'formula-display' ? 'ƒ(x)' : 'if/else'}</text>
            <text x={el.width / 2} y={el.height / 2 + 6} textAnchor="middle" dominantBaseline="central" fontSize={16} fill="#22D3EE" fontFamily="monospace" fontWeight="bold">
              {el.properties.resultDisplay === 'value' ? '---' : el.properties.buttonText || '---'}
            </text>
          </g>
        ) : el.type === 'alarm-banner' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#1E293B'} rx={4} stroke="#334155" strokeWidth={1} />
            <rect x={0} y={0} width={el.width} height={el.height} rx={4} fill="rgba(239,68,68,0.1)" />
            <text x={10} y={el.height / 2 + 4} fontSize={11} fill="#EF4444" fontWeight="bold">ALT</text>
            <text x={26} y={el.height / 2 + 4} fontSize={10} fill="#FCA5A5">LATEST ALARM:</text>
            <text x={128} y={el.height / 2 + 4} fontSize={10} fill="#94A3B8" fontStyle="italic">No active alarms</text>
            <g transform={`translate(${el.width - 220}, ${(el.height - 16) / 2})`}>
              <rect x={0} y={0} width={36} height={16} rx={3} fill="#DC2626" /><text x={18} y={12} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">EMG:0</text>
              <rect x={40} y={0} width={36} height={16} rx={3} fill="#F97316" /><text x={58} y={12} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">URG:0</text>
              <rect x={80} y={0} width={36} height={16} rx={3} fill="#EAB308" /><text x={98} y={12} textAnchor="middle" fill="black" fontSize={8} fontWeight="bold">NRM:0</text>
              <rect x={120} y={0} width={36} height={16} rx={3} fill="#3B82F6" /><text x={138} y={12} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">INF:0</text>
              <rect x={162} y={0} width={50} height={16} rx={3} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} /><text x={187} y={12} textAnchor="middle" fill="#94A3B8" fontSize={8}>MUTE 0</text>
            </g>
          </g>
        ) : el.type === 'alarm-list' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#0F172A'} rx={4} stroke="#334155" strokeWidth={1} />
            <text x={10} y={18} fontSize={11} fill="#F8FAFC" fontWeight="bold">Active Alarms</text>
            <line x1={0} y1={24} x2={el.width} y2={24} stroke="#334155" strokeWidth={1} />
            {[0,1,2,3].map(i => (
              <g key={i}>
                <rect x={4} y={28 + i * 28} width={el.width - 8} height={24} rx={2} fill={i === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.03)'} />
                <circle cx={14} cy={40 + i * 28} r={4} fill={i === 0 ? '#EF4444' : i === 1 ? '#F97316' : '#3B82F6'} />
                <text x={24} y={43 + i * 28} fontSize={9} fill="#CBD5E1">{i === 0 ? 'HIGH TEMP TR1 — 92°C' : i === 1 ? 'CB5 Trip Count — 312' : i === 2 ? 'Low Voltage Bus 2' : 'Comm Fail RTU-3'}</text>
                <text x={el.width - 10} y={43 + i * 28} textAnchor="end" fontSize={8} fill="#64748B">{i === 0 ? '2m ago' : i === 1 ? '15m' : i === 2 ? '1h' : '3h'}</text>
              </g>
            ))}
          </g>
        ) : el.type === 'trend-banner' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#0F172A'} rx={4} stroke="#334155" strokeWidth={1} />
            <text x={8} y={14} fontSize={9} fill="#64748B">TREND</text>
            {/* Fake sparkline */}
            <polyline points={Array.from({length: 40}, (_, i) => `${10 + i * (el.width - 20) / 40},${el.height / 2 + Math.sin(i * 0.5) * (el.height / 4) + (Math.random() - 0.5) * 5}`).join(' ')} fill="none" stroke="#22D3EE" strokeWidth={1.5} />
            <polyline points={Array.from({length: 40}, (_, i) => `${10 + i * (el.width - 20) / 40},${el.height / 2 + Math.cos(i * 0.4) * (el.height / 5) + 5}`).join(' ')} fill="none" stroke="#A78BFA" strokeWidth={1.5} />
            <text x={el.width - 8} y={el.height / 2 - 8} textAnchor="end" fontSize={9} fill="#22D3EE">11.2 kV</text>
            <text x={el.width - 8} y={el.height / 2 + 12} textAnchor="end" fontSize={9} fill="#A78BFA">245 A</text>
          </g>
        ) : el.type === 'status-banner' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#1E293B'} rx={4} stroke="#334155" strokeWidth={1} />
            <circle cx={12} cy={el.height / 2} r={4} fill="#22C55E" />
            <text x={22} y={el.height / 2 + 4} fontSize={10} fill="#E2E8F0">{el.properties.label || 'System Online'}</text>
            <text x={el.width / 2} y={el.height / 2 + 4} textAnchor="middle" fontSize={10} fill="#64748B">{el.properties.customText || 'All devices connected'}</text>
            <text x={el.width - 8} y={el.height / 2 + 4} textAnchor="end" fontSize={9} fill="#64748B" fontFamily="monospace">{new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'})}</text>
          </g>
        ) : el.type === 'clock-display' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#0F172A'} rx={6} stroke="#334155" strokeWidth={1} />
            <text x={el.width / 2} y={el.height / 2 + 8} textAnchor="middle" fontSize={24} fill={el.properties.textColor || '#22D3EE'} fontFamily="monospace" fontWeight="bold">
              {new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}
            </text>
            <text x={el.width / 2} y={el.height - 6} textAnchor="middle" fontSize={8} fill="#64748B">
              {new Date().toLocaleDateString('en-US', {weekday:'short',day:'2-digit',month:'short'})}
            </text>
          </g>
        ) : el.type === 'value-display' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#0F172A'} rx={4} stroke="#334155" strokeWidth={1} />
            <text x={el.width / 2} y={16} textAnchor="middle" fontSize={9} fill="#64748B">{el.properties.label || 'Tag Name'}</text>
            <text x={el.width / 2} y={el.height / 2 + 8} textAnchor="middle" fontSize={20} fill={el.properties.textColor || '#22D3EE'} fontFamily="monospace" fontWeight="bold">---</text>
            <text x={el.width / 2} y={el.height - 4} textAnchor="middle" fontSize={8} fill="#475569">{el.properties.unit || 'unit'}</text>
          </g>
        ) : el.type === 'bar-graph' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#0F172A'} rx={4} stroke="#334155" strokeWidth={1} />
            <rect x={el.width * 0.2} y={el.height * 0.3} width={el.width * 0.6} height={el.height * 0.6} fill="#1E293B" stroke="#334155" strokeWidth={0.5} rx={2} />
            <rect x={el.width * 0.2} y={el.height * 0.5} width={el.width * 0.6} height={el.height * 0.4} fill="#22C55E" rx={2} />
            <text x={el.width / 2} y={14} textAnchor="middle" fontSize={8} fill="#94A3B8">{el.properties.label || 'Load'}</text>
            <text x={el.width / 2} y={el.height * 0.5 - 2} textAnchor="middle" fontSize={10} fill="#F8FAFC" fontWeight="bold">67%</text>
          </g>
        ) : el.type === 'gauge-display' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#0F172A'} rx={6} stroke="#334155" strokeWidth={1} />
            <circle cx={el.width / 2} cy={el.height * 0.5} r={Math.min(el.width, el.height) * 0.35} fill="none" stroke="#334155" strokeWidth={6} />
            <circle cx={el.width / 2} cy={el.height * 0.5} r={Math.min(el.width, el.height) * 0.35} fill="none" stroke="#22D3EE" strokeWidth={6} strokeDasharray={`${Math.min(el.width, el.height) * 0.35 * 2 * 3.14 * 0.67} ${Math.min(el.width, el.height) * 0.35 * 2 * 3.14}`} strokeLinecap="round" transform={`rotate(-90 ${el.width / 2} ${el.height * 0.5})`} />
            <text x={el.width / 2} y={el.height * 0.5 + 5} textAnchor="middle" fontSize={14} fill="#F8FAFC" fontWeight="bold" fontFamily="monospace">67%</text>
            <text x={el.width / 2} y={el.height - 8} textAnchor="middle" fontSize={8} fill="#64748B">{el.properties.label || 'Load'}</text>
          </g>
        ) : el.type === 'comm-status-bar' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#1E293B'} rx={4} stroke="#334155" strokeWidth={1} />
            <text x={8} y={el.height / 2 + 4} fontSize={10} fill="#64748B">COM</text>
            {['RTU-1', 'RTU-2', 'RTU-3', 'PLC-1'].map((dev, i) => (
              <g key={i}>
                <circle cx={55 + i * 65} cy={el.height / 2} r={4} fill={i === 2 ? '#EF4444' : '#22C55E'} />
                <text x={63 + i * 65} y={el.height / 2 + 4} fontSize={9} fill="#CBD5E1">{dev}</text>
              </g>
            ))}
            <text x={el.width - 8} y={el.height / 2 + 4} textAnchor="end" fontSize={8} fill="#475569">Latency: 12ms</text>
          </g>
        ) : el.type === 'event-ticker' ? (
          <g>
            <rect width={el.width} height={el.height} fill={el.properties.bgColor || '#0F172A'} rx={3} stroke="#334155" strokeWidth={1} />
            <text x={8} y={el.height / 2 + 4} fontSize={9} fill="#3B82F6" fontWeight="bold">EVENT:</text>
            <text x={55} y={el.height / 2 + 4} fontSize={9} fill="#CBD5E1">CB5 tripped on overcurrent • TR1 tap changed to pos 4 • Bus 2 voltage restored</text>
          </g>
        ) : el.type === 'BusBar' && el.properties.relX1 !== undefined ? (
          <g>
            <line
              x1={el.properties.relX1}
              y1={el.properties.relY1}
              x2={el.properties.relX2}
              y2={el.properties.relY2}
              stroke={el.properties.color || '#333'}
              strokeWidth={el.properties.busWidth || 6}
              strokeLinecap="round"
            />
            <circle cx={el.properties.relX1} cy={el.properties.relY1} r={4} fill={el.properties.color || '#333'} stroke="#fff" strokeWidth={1.5} />
            <circle cx={el.properties.relX2} cy={el.properties.relY2} r={4} fill={el.properties.color || '#333'} stroke="#fff" strokeWidth={1.5} />
          </g>
        ) : el.type === 'custom-component' && el.properties.svgCode ? (
          <foreignObject width={el.width} height={el.height}>
            <div style={{ width: el.width, height: el.height, pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: el.properties.svgCode }} />
          </foreignObject>
        ) : SYMBOL_MAP[el.type] ? (
          <foreignObject width={el.width} height={el.height}>
            <div style={{ width: el.width, height: el.height, pointerEvents: 'none' }}>
              {React.createElement(SYMBOL_MAP[el.type], {
                width: el.width,
                height: el.height,
                ...(el.type === 'Transformer' ? {
                  hvLabel: el.properties.tagBindings?.hvVoltage ? `${el.properties.tagBindings.hvVoltage}` : el.properties.hvRating || undefined,
                  lvLabel: el.properties.tagBindings?.lvVoltage ? `${el.properties.tagBindings.lvVoltage}` : el.properties.lvRating || undefined,
                  mvaLabel: el.properties.tagBindings?.mvaRating ? `${el.properties.tagBindings.mvaRating}` : el.properties.mvaRating || undefined,
                } : {}),
              })}
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

        {/* Tag binding indicator */}
        {(() => {
          const bindingsCount = el.properties.tagBindings ? Object.keys(el.properties.tagBindings).length : 0;
          const hasLegacyBinding = el.properties.tagBinding || el.properties.targetTag;
          if (!bindingsCount && !hasLegacyBinding) return null;
          const label = bindingsCount > 0 ? `${bindingsCount} tag${bindingsCount > 1 ? 's' : ''}` : (el.properties.tagBinding || el.properties.targetTag || '');
          return (
            <g>
              <rect x={el.width - 14} y={-6} width={16} height={12} rx={3} fill="#3B82F6" opacity={0.9} />
              <text x={el.width - 6} y={3} textAnchor="middle" fontSize={8} fill="white" fontFamily="sans-serif">{bindingsCount || 'T'}</text>
              {hoveredElementId === el.id && (
                <g>
                  <rect x={el.width + 6} y={-10} width={Math.max(label.length * 5.5 + 12, 60)} height={16} rx={4} fill="#1E293B" opacity={0.9} />
                  <text x={el.width + 12} y={1} fontSize={9} fill="#93C5FD" fontFamily="monospace">{label}</text>
                </g>
              )}
            </g>
          );
        })()}

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
          className="text-sm border border-gray-200 rounded px-2 py-1 text-gray-900 bg-white"
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
        {/* Left Panel - Component Palette / Tags */}
        <div className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-gray-200 shrink-0">
            <button
              onClick={() => setLeftTab('components')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
                leftTab === 'components' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Components
            </button>
            <button
              onClick={() => setLeftTab('tags')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${
                leftTab === 'tags' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> Tags
              {tags.length > 0 && <span className="text-[9px] bg-gray-200 text-gray-600 rounded-full px-1.5">{tags.length}</span>}
            </button>
          </div>

          {leftTab === 'components' ? (
            <>
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
                {/* Custom Components Section */}
                {(() => {
                  const customExpanded = expandedCats.includes('Custom');
                  const filteredCustom = customComponents.filter((c: any) =>
                    c.name.toLowerCase().includes(paletteSearch.toLowerCase())
                  );
                  if (paletteSearch && filteredCustom.length === 0) return null;
                  return (
                    <div className="mb-1">
                      <button
                        onClick={() => setExpandedCats((prev) => customExpanded ? prev.filter((c) => c !== 'Custom') : [...prev, 'Custom'])}
                        className="flex items-center gap-1 w-full text-left px-2 py-1.5 text-xs font-semibold text-cyan-400 uppercase tracking-wider hover:bg-gray-50 rounded"
                      >
                        {customExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        Custom
                      </button>
                      {customExpanded && (
                        <div className="px-1">
                          <div className="flex gap-1 mb-1">
                            <button
                              onClick={() => { setEditingComponent(null); setShowComponentCreator(true); }}
                              className="flex items-center gap-1 flex-1 px-2 py-1.5 text-xs text-cyan-400 hover:bg-cyan-50 rounded border border-dashed border-cyan-300 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Create
                            </button>
                            <button
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.svg,image/svg+xml';
                                input.onchange = async (evt) => {
                                  const file = (evt.target as HTMLInputElement).files?.[0];
                                  if (!file) return;
                                  const svgText = await file.text();
                                  const name = file.name.replace('.svg', '');
                                  // Extract viewBox dimensions
                                  const vbMatch = svgText.match(/viewBox="[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)"/);
                                  const wMatch = svgText.match(/width="([\d.]+)"/);
                                  const hMatch = svgText.match(/height="([\d.]+)"/);
                                  const w = vbMatch ? parseFloat(vbMatch[1]) : wMatch ? parseFloat(wMatch[1]) : 80;
                                  const h = vbMatch ? parseFloat(vbMatch[2]) : hMatch ? parseFloat(hMatch[1]) : 60;
                                  try {
                                    await api.post('/custom-components', {
                                      projectId,
                                      name,
                                      category: 'Custom',
                                      svgCode: svgText,
                                      width: Math.min(w, 200),
                                      height: Math.min(h, 200),
                                    });
                                    loadCustomComponents();
                                  } catch (err) { console.error('Import SVG failed:', err); }
                                };
                                input.click();
                              }}
                              className="flex items-center gap-1 flex-1 px-2 py-1.5 text-xs text-cyan-400 hover:bg-cyan-50 rounded border border-dashed border-cyan-300 transition-colors"
                            >
                              <Upload className="w-3 h-3" /> Load SVG
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {(paletteSearch ? filteredCustom : customComponents).map((comp: any) => (
                              <div
                                key={comp.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', JSON.stringify({
                                    type: 'custom-component',
                                    customComponentId: comp.id,
                                    svgCode: comp.svgCode,
                                    name: comp.name,
                                    label: comp.name,
                                    w: comp.width,
                                    h: comp.height,
                                  }));
                                }}
                                className="group relative flex flex-col items-center p-2 rounded border border-gray-100 bg-gray-50 hover:bg-cyan-50 hover:border-cyan-200 cursor-grab text-center transition-colors"
                              >
                                <div className="w-10 h-10 flex items-center justify-center mb-1">
                                  {comp.thumbnail || comp.svgCode ? (
                                    <div className="w-10 h-10" dangerouslySetInnerHTML={{ __html: comp.thumbnail || comp.svgCode }} />
                                  ) : (
                                    <div className="w-8 h-8 bg-cyan-100 rounded flex items-center justify-center">
                                      <span className="text-[8px] text-cyan-600">SVG</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-600 leading-tight">{comp.name}</span>
                                {/* Edit/Delete buttons on hover */}
                                <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingComponent(comp); setShowComponentCreator(true); }}
                                    className="w-4 h-4 bg-white rounded shadow text-[8px] hover:bg-blue-50"
                                    title="Edit"
                                  ><Pencil className="w-3 h-3" /></button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteCustomComponent(comp.id); }}
                                    className="w-4 h-4 bg-white rounded shadow text-[8px] hover:bg-red-50"
                                    title="Delete"
                                  ><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                                {['page-link', 'back-button', 'home-button', 'page-change-button', 'popup-page'].includes(sym.type) ? (
                                  <div className="w-8 h-6 bg-blue-500 rounded flex items-center justify-center">
                                    {sym.type === 'page-link' ? <Link className="w-3 h-3 text-white" /> : sym.type === 'back-button' ? <ArrowLeft className="w-3 h-3 text-white" /> : sym.type === 'page-change-button' ? <span className="text-white text-[10px]">▶</span> : sym.type === 'popup-page' ? <span className="text-white text-[10px]">⧉</span> : <Home className="w-3 h-3 text-white" />}
                                  </div>
                                ) : ['alarm-banner', 'alarm-list', 'trend-banner', 'status-banner', 'clock-display', 'value-display', 'bar-graph', 'gauge-display', 'comm-status-bar', 'event-ticker'].includes(sym.type) ? (
                                  <div className="w-9 h-7 bg-slate-800 rounded flex items-center justify-center border border-slate-600">
                                    <span className="text-[10px]">{
                                      sym.type === 'alarm-banner' ? 'ALM' : sym.type === 'alarm-list' ? 'STS' :
                                      sym.type === 'trend-banner' ? 'TRD' : sym.type === 'status-banner' ? 'BAR' :
                                      sym.type === 'clock-display' ? 'CLK' : sym.type === 'value-display' ? 'NUM' :
                                      sym.type === 'bar-graph' ? 'BAR' : sym.type === 'gauge-display' ? 'GAU' :
                                      sym.type === 'comm-status-bar' ? 'COM' : 'WDG'
                                    }</span>
                                  </div>
                                ) : ['action-button', 'script-runner', 'formula-display', 'sequence-trigger', 'conditional-display'].includes(sym.type) ? (
                                  <div className={`w-8 h-6 rounded flex items-center justify-center ${sym.type === 'action-button' ? 'bg-purple-600' : sym.type === 'script-runner' ? 'bg-cyan-600' : sym.type === 'sequence-trigger' ? 'bg-red-600' : 'bg-slate-800'}`}>
                                    <span className="text-white text-[10px]">{sym.type === 'action-button' ? 'ZAP' : sym.type === 'script-runner' ? 'SCR' : sym.type === 'formula-display' ? 'ƒ' : sym.type === 'sequence-trigger' ? 'SEQ' : '?='}</span>
                                  </div>
                                ) : sym.type.startsWith('3d-') ? (
                                  <div style={{
                                    width: 32, height: 32, borderRadius: sym.type === '3d-emergency-stop' ? '50%' : sym.type === '3d-indicator-lamp' ? '50%' : sym.type === '3d-rotary-selector' ? '50%' : 4,
                                    background: sym.type === '3d-emergency-stop' ? 'radial-gradient(circle at 35% 35%, #ef4444, #991b1b)' :
                                               sym.type === '3d-indicator-lamp' ? 'radial-gradient(circle at 35% 35%, #4ade80, #166534)' :
                                               'linear-gradient(180deg, #6b7280, #374151)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                                    border: sym.type === '3d-emergency-stop' ? '2px solid #a3a3a3' : '1px solid #555',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>
                                    <span style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>
                                      {sym.type === '3d-push-button' ? 'BTN' : sym.type === '3d-toggle-switch' ? 'TGL' : sym.type === '3d-emergency-stop' ? 'STP' : sym.type === '3d-indicator-lamp' ? 'LMP' : sym.type === '3d-rocker-switch' ? 'RCK' : 'ROT'}
                                    </span>
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
            </>
          ) : (
            <>
              {/* Tags panel */}
              <div className="p-2 border-b border-gray-100 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => setShowTagForm(!showTagForm)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Quick Create Tag
                </button>
              </div>

              {/* Tag Edit Panel */}
              {editingTag && (
                <div className="p-2 border-b border-gray-200 bg-yellow-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Edit Tag: {editingTag.name}</span>
                    <button onClick={() => setEditingTag(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                  </div>
                  <input
                    type="text"
                    placeholder="Name"
                    value={editingTag.name}
                    onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={editingTag.description || ''}
                    onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <select
                      value={editingTag.type}
                      onChange={(e) => setEditingTag({ ...editingTag, type: e.target.value as any })}
                      className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                    >
                      <option value="INTERNAL">Internal</option>
                      <option value="SIMULATED">Simulated</option>
                      <option value="CALCULATED">Calculated</option>
                      <option value="EXTERNAL">External</option>
                    </select>
                    <select
                      value={editingTag.dataType}
                      onChange={(e) => setEditingTag({ ...editingTag, dataType: e.target.value as any })}
                      className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                    >
                      <option value="BOOLEAN">Boolean</option>
                      <option value="FLOAT">Float</option>
                      <option value="INTEGER">Integer</option>
                      <option value="STRING">String</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <input type="text" placeholder="Unit" value={editingTag.unit || ''} onChange={(e) => setEditingTag({ ...editingTag, unit: e.target.value })} className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white" />
                    <input type="number" placeholder="Min" value={editingTag.minValue ?? ''} onChange={(e) => setEditingTag({ ...editingTag, minValue: e.target.value ? parseFloat(e.target.value) : null })} className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white" />
                    <input type="number" placeholder="Max" value={editingTag.maxValue ?? ''} onChange={(e) => setEditingTag({ ...editingTag, maxValue: e.target.value ? parseFloat(e.target.value) : null })} className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  {(editingTag.type === 'SIMULATED') && (
                    <div className="grid grid-cols-2 gap-1">
                      <select value={editingTag.simPattern || 'rand'} onChange={(e) => setEditingTag({ ...editingTag, simPattern: e.target.value })} className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white">
                        <option value="rand">rand(min,max)</option>
                        <option value="sine">Sine Wave</option>
                        <option value="random">Random</option>
                        <option value="ramp">Ramp</option>
                        <option value="square">Square</option>
                      </select>
                      <input type="number" placeholder="Frequency" value={editingTag.simFrequency ?? ''} onChange={(e) => setEditingTag({ ...editingTag, simFrequency: e.target.value ? parseFloat(e.target.value) : null })} className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>
                  )}
                  <button
                    onClick={() => updateTagProps(editingTag)}
                    className="w-full px-2 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              )}

              {/* Inline tag creation form */}
              {showTagForm && (
                <div className="p-2 border-b border-gray-200 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">New Tag</span>
                    <button onClick={() => setShowTagForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                  </div>
                  <input
                    type="text"
                    placeholder="Name (e.g. SUB1.voltage)"
                    value={tagForm.name}
                    onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <select
                      value={tagForm.type}
                      onChange={(e) => setTagForm({ ...tagForm, type: e.target.value as 'INTERNAL' | 'SIMULATED' })}
                      className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                    >
                      <option value="INTERNAL">Internal</option>
                      <option value="SIMULATED">Simulated</option>
                    </select>
                    <select
                      value={tagForm.dataType}
                      onChange={(e) => setTagForm({ ...tagForm, dataType: e.target.value as any })}
                      className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                    >
                      <option value="BOOLEAN">Boolean</option>
                      <option value="FLOAT">Float</option>
                      <option value="INTEGER">Integer</option>
                      <option value="STRING">String</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="text"
                      placeholder="Unit"
                      value={tagForm.unit}
                      onChange={(e) => setTagForm({ ...tagForm, unit: e.target.value })}
                      className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Min"
                      value={tagForm.minValue}
                      onChange={(e) => setTagForm({ ...tagForm, minValue: e.target.value })}
                      className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={tagForm.maxValue}
                      onChange={(e) => setTagForm({ ...tagForm, maxValue: e.target.value })}
                      className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                    />
                  </div>
                  {tagForm.type === 'SIMULATED' && (
                    <div className="grid grid-cols-2 gap-1">
                      <select
                        value={tagForm.simPattern}
                        onChange={(e) => setTagForm({ ...tagForm, simPattern: e.target.value })}
                        className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                      >
                        <option value="rand">rand(min,max)</option>
                        <option value="sine">Sine Wave</option>
                        <option value="random">Random ±</option>
                        <option value="ramp">Ramp</option>
                        <option value="square">Square</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Freq"
                        value={tagForm.simFrequency}
                        onChange={(e) => setTagForm({ ...tagForm, simFrequency: e.target.value })}
                        className="px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                      />
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      if (!tagForm.name.trim()) return;
                      const ok = await createTag({
                        name: tagForm.name.trim(),
                        type: tagForm.type,
                        dataType: tagForm.dataType,
                        unit: tagForm.unit || undefined,
                        minValue: tagForm.minValue ? Number(tagForm.minValue) : null,
                        maxValue: tagForm.maxValue ? Number(tagForm.maxValue) : null,
                        simPattern: tagForm.simPattern,
                        simFrequency: Number(tagForm.simFrequency) || 1,
                        simAmplitude: Number(tagForm.simAmplitude) || 10,
                        simOffset: Number(tagForm.simOffset) || 0,
                      });
                      if (ok) {
                        setTagForm({ name: '', type: 'INTERNAL', dataType: 'FLOAT', unit: '', minValue: '', maxValue: '', simPattern: 'rand', simFrequency: '1', simAmplitude: '10', simOffset: '0' });
                        setShowTagForm(false);
                      }
                    }}
                    className="w-full px-2 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Create Tag
                  </button>
                </div>
              )}

              {/* Tags list */}
              <div className="flex-1 overflow-y-auto">
                {tags
                  .filter((t) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                  .map((tag) => (
                    <div
                      key={tag.id}
                      className="px-2 py-1.5 border-b border-gray-50 hover:bg-blue-50 cursor-pointer group transition-colors"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/tag', tag.name);
                        e.dataTransfer.effectAllowed = 'link';
                      }}
                      onClick={() => {
                        if (selectedEl) {
                          if (selectedEl.type.startsWith('ctrl-')) {
                            updateElementProps(selectedEl.id, { targetTag: tag.name });
                          } else {
                            updateElementProps(selectedEl.id, { tagBinding: tag.name });
                          }
                        }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {tag.type === 'SIMULATED' ? (
                          <Activity className="w-3 h-3 text-purple-500 shrink-0" />
                        ) : (
                          <Tag className="w-3 h-3 text-blue-500 shrink-0" />
                        )}
                        <span className="text-[10px] font-mono text-gray-700 truncate flex-1">{tag.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingTag({...tag}); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 transition-opacity"
                          title="Edit tag"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTag(tag.id); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Delete tag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 ml-4.5">
                        <span className="text-[9px] text-gray-400">{tag.dataType}</span>
                        {tag.unit && <span className="text-[9px] text-gray-400">({tag.unit})</span>}
                        {tag.liveValue !== undefined && tag.liveValue !== null && (
                          <span className="text-[9px] font-mono text-blue-600 ml-auto">{String(tag.liveValue)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                {tags.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-600">
                    No tags yet. Create one above or go to Tags page.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Center - SVG Canvas */}
        <div
          className="flex-1 overflow-auto relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <svg
            ref={svgRef}
            style={{
              background: '#E5E7EB',
              cursor: drawingBus !== null ? 'crosshair' : undefined,
              minWidth: `${Math.max(canvasW * zoom + pan.x + 200, 100)}px`,
              minHeight: `${Math.max(canvasH * zoom + pan.y + 200, 100)}px`,
              width: '100%',
              height: '100%',
            }}
            onMouseDown={handleSvgMouseDown}
            onClick={handleCanvasClick}
            onMouseMove={handleSvgMouseMove}
            onWheel={handleWheel}
            onContextMenu={(e) => {
              e.preventDefault();
              if (drawingBus !== null) {
                setDrawingBus(null);
                setBusPreviewEnd(null);
                setTool('select');
              }
            }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Canvas background */}
              <rect x={0} y={0} width={canvasW} height={canvasH} fill={bgColor} stroke="#CBD5E1" strokeWidth={1} />

              {/* === HEADER (inside canvas) === */}
              {pageSettings.header.show && (() => {
                const hH = pageSettings.header.height || 50;
                const hBg = pageSettings.header.bgColor || '#0F172A';
                const hTx = pageSettings.header.textColor || '#FFFFFF';
                return (
                  <g className="mimic-header">
                    <rect x={0} y={0} width={canvasW} height={hH} fill={hBg} />
                    {/* Logo placeholder */}
                    {pageSettings.header.logoUrl ? (
                      <image href={pageSettings.header.logoUrl} x={10} y={5} height={hH - 10} preserveAspectRatio="xMidYMid meet" />
                    ) : (
                      <g>
                        <rect x={10} y={8} width={hH - 16} height={hH - 16} rx={4} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="4,2" />
                        <text x={10 + (hH - 16) / 2} y={hH / 2 + 4} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={10}>Logo</text>
                      </g>
                    )}
                    {/* Title */}
                    <text x={canvasW / 2} y={pageSettings.header.subtitle ? hH / 2 - 4 : hH / 2 + 5} textAnchor="middle" fill={hTx} fontSize={16} fontWeight="bold">
                      {pageSettings.header.title || pageName || 'Page Title'}
                    </text>
                    {pageSettings.header.subtitle && (
                      <text x={canvasW / 2} y={hH / 2 + 12} textAnchor="middle" fill={hTx} fontSize={11} opacity={0.75}>
                        {pageSettings.header.subtitle}
                      </text>
                    )}
                    {/* Date/Time */}
                    <text x={canvasW - 15} y={hH / 2 - 2} textAnchor="end" fill={hTx} fontSize={11}>
                      {new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </text>
                    <text x={canvasW - 15} y={hH / 2 + 14} textAnchor="end" fill={hTx} fontSize={13} fontWeight="600">
                      {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </text>
                    {/* Bottom border line */}
                    <line x1={0} y1={hH} x2={canvasW} y2={hH} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                  </g>
                );
              })()}

              {/* === FOOTER (widget-based, inside canvas) === */}
              {pageSettings.footer.show && (() => {
                const widgets = pageSettings.footer.widgets || [];
                const totalH = widgets.reduce((sum, w) => sum + (w.height || 24), 0) + 4;
                const fBg = pageSettings.footer.bgColor || '#0F172A';
                const fTx = pageSettings.footer.textColor || '#FFFFFF';
                const fY = canvasH - Math.max(totalH, pageSettings.footer.height || 60);
                let yOff = fY + 2;
                return (
                  <g className="mimic-footer">
                    <rect x={0} y={fY} width={canvasW} height={canvasH - fY} fill={fBg} />
                    <line x1={0} y1={fY} x2={canvasW} y2={fY} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                    {widgets.map((w) => {
                      const wy = yOff;
                      yOff += w.height || 24;
                      switch (w.type) {
                        case 'alarm-banner':
                          return (
                            <g key={w.id}>
                              <rect x={0} y={wy} width={canvasW} height={w.height} fill="rgba(239,68,68,0.12)" />
                              <text x={12} y={wy + w.height / 2 + 4} fill="#EF4444" fontSize={11} fontWeight="bold">ALT</text>
                              <text x={28} y={wy + w.height / 2 + 4} fill="#FCA5A5" fontSize={10}>LATEST ALARM:</text>
                              <text x={130} y={wy + w.height / 2 + 4} fill={fTx} fontSize={10} fontStyle="italic" opacity={0.6}>No active alarms</text>
                              <g transform={`translate(${canvasW - 280}, ${wy + (w.height - 18) / 2})`}>
                                <rect x={0} y={0} width={38} height={16} rx={3} fill="#DC2626" /><text x={19} y={12} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">EMG: 0</text>
                                <rect x={42} y={0} width={38} height={16} rx={3} fill="#F97316" /><text x={61} y={12} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">URG: 0</text>
                                <rect x={84} y={0} width={38} height={16} rx={3} fill="#EAB308" /><text x={103} y={12} textAnchor="middle" fill="black" fontSize={8} fontWeight="bold">NRM: 0</text>
                                <rect x={126} y={0} width={38} height={16} rx={3} fill="#3B82F6" /><text x={145} y={12} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">INF: 0</text>
                                <rect x={170} y={0} width={70} height={16} rx={3} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth={0.5} /><text x={205} y={12} textAnchor="middle" fill={fTx} fontSize={8}>MUTE 0 unack</text>
                              </g>
                            </g>
                          );
                        case 'trend-strip':
                          return (
                            <g key={w.id}>
                              <rect x={0} y={wy} width={canvasW} height={w.height} fill="rgba(255,255,255,0.04)" />
                              <text x={canvasW / 2} y={wy + w.height / 2 + 4} textAnchor="middle" fill={fTx} fontSize={9} opacity={0.4}>TRD Trend Strip - bind tags in Page Settings</text>
                            </g>
                          );
                        case 'status-bar':
                          return (
                            <g key={w.id}>
                              <text x={12} y={wy + w.height / 2 + 4} fill={fTx} fontSize={10} opacity={0.6}>{pageName || 'Overview'} • Operator: Admin</text>
                              <text x={canvasW / 2} y={wy + w.height / 2 + 4} textAnchor="middle" fill={fTx} fontSize={10} opacity={0.4}>GridVision SCADA</text>
                              <text x={canvasW - 12} y={wy + w.height / 2 + 4} textAnchor="end" fill={fTx} fontSize={10} opacity={0.6}>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</text>
                            </g>
                          );
                        case 'custom-text':
                          return (
                            <g key={w.id}>
                              <text x={canvasW / 2} y={wy + w.height / 2 + 4} textAnchor="middle" fill={fTx} fontSize={11}>{w.config?.text || pageSettings.footer.customText || 'Custom text...'}</text>
                            </g>
                          );
                        case 'clock':
                          return (
                            <g key={w.id}>
                              <text x={canvasW / 2} y={wy + w.height / 2 + 6} textAnchor="middle" fill={fTx} fontSize={18} fontWeight="bold" fontFamily="monospace">
                                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </text>
                              <text x={canvasW / 2 + 110} y={wy + w.height / 2 + 6} textAnchor="start" fill={fTx} fontSize={9} opacity={0.5}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
                              </text>
                            </g>
                          );
                        case 'comm-status':
                          return (
                            <g key={w.id}>
                              <circle cx={16} cy={wy + w.height / 2} r={4} fill="#22C55E" />
                              <text x={26} y={wy + w.height / 2 + 4} fill={fTx} fontSize={10}>All devices online</text>
                              <circle cx={canvasW / 2 - 20} cy={wy + w.height / 2} r={4} fill="#22C55E" />
                              <text x={canvasW / 2 - 10} y={wy + w.height / 2 + 4} fill={fTx} fontSize={10}>Server connected</text>
                              <text x={canvasW - 12} y={wy + w.height / 2 + 4} textAnchor="end" fill={fTx} fontSize={9} opacity={0.5}>COM Latency: 12ms</text>
                            </g>
                          );
                        case 'page-nav':
                          return (
                            <g key={w.id}>
                              <text x={12} y={wy + w.height / 2 + 4} fill={fTx} fontSize={10} opacity={0.6}>NAV Pages:</text>
                              <text x={70} y={wy + w.height / 2 + 4} fill={fTx} fontSize={10} fontWeight="bold" textDecoration="underline">{pageName || 'Page 1'}</text>
                            </g>
                          );
                        default:
                          return null;
                      }
                    })}
                  </g>
                );
              })()}

              {/* Grid */}
              {showGrid && (
                <g opacity={0.3}>
                  {/* Major grid lines every 50px */}
                  {Array.from({ length: Math.ceil(canvasW / 50) + 1 }, (_, i) => (
                    <line key={`mv${i}`} x1={i * 50} y1={0} x2={i * 50} y2={canvasH} stroke="#C0C8D0" strokeWidth={0.6} />
                  ))}
                  {Array.from({ length: Math.ceil(canvasH / 50) + 1 }, (_, i) => (
                    <line key={`mh${i}`} x1={0} y1={i * 50} x2={canvasW} y2={i * 50} stroke="#C0C8D0" strokeWidth={0.6} />
                  ))}
                  {/* Minor grid at 10px intervals (skip 50px lines already drawn) */}
                  {Array.from({ length: Math.ceil(canvasW / 10) + 1 }, (_, i) => {
                    const x = i * 10;
                    if (x % 50 === 0) return null;
                    return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={canvasH} stroke="#EAEEF2" strokeWidth={0.3} />;
                  })}
                  {Array.from({ length: Math.ceil(canvasH / 10) + 1 }, (_, i) => {
                    const y = i * 10;
                    if (y % 50 === 0) return null;
                    return <line key={`h${i}`} x1={0} y1={y} x2={canvasW} y2={y} stroke="#EAEEF2" strokeWidth={0.3} />;
                  })}
                </g>
              )}

              {/* Connections */}
              {connections.filter(conn => Array.isArray(conn.points) && conn.points.length >= 2).map((conn) => (
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

              {/* Bus bar drawing preview */}
              {typeof drawingBus === 'object' && drawingBus !== null && busPreviewEnd && (
                <>
                  <line
                    x1={drawingBus.x} y1={drawingBus.y}
                    x2={busPreviewEnd.x} y2={busPreviewEnd.y}
                    stroke="#333"
                    strokeWidth={6}
                    strokeLinecap="round"
                    opacity={0.5}
                    strokeDasharray="8 4"
                  />
                  <circle cx={drawingBus.x} cy={drawingBus.y} r={5} fill="#3B82F6" stroke="#fff" strokeWidth={2} />
                </>
              )}
            </g>

            {/* Bus drawing mode indicator */}
            {drawingBus !== null && (
              <text x={12} y={24} fontSize={13} fill="#3B82F6" fontFamily="sans-serif" fontWeight="600">
                {typeof drawingBus === 'object' ? 'Click to set end point (ESC to cancel)' : 'Click to set start point (ESC to cancel)'}
              </text>
            )}
          </svg>
        </div>

        {/* Right Panel - Properties */}
        <div className="w-64 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
          {/* Tabs - ALWAYS visible */}
          <div className="flex border-b border-gray-200 shrink-0">
            <button
              onClick={() => setRightTab('properties')}
              className={`flex-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                rightTab === 'properties' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {selectedEl ? 'Props' : 'Page'}
            </button>
            <button
              onClick={() => setRightTab('pageSettings')}
              className={`flex-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                rightTab === 'pageSettings' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {selectedEl ? 'Cmp Set' : 'Settings'}
            </button>
            <button
              onClick={() => setRightTab('headerFooter')}
              className={`flex-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                rightTab === 'headerFooter' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              H/F
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">

          {rightTab === 'properties' && selectedEl ? (
            <div className="p-3 space-y-3">
              <div className="text-xs text-gray-400 font-mono">{selectedEl.type} - {selectedEl.id.slice(0, 8)}</div>

              {/* Position */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400">X</span>
                    <input type="number" value={selectedEl.x} onChange={(e) => updateElement(selectedEl.id, { x: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">Y</span>
                    <input type="number" value={selectedEl.y} onChange={(e) => updateElement(selectedEl.id, { y: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400">W</span>
                    <input type="number" value={selectedEl.width} onChange={(e) => updateElement(selectedEl.id, { width: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">H</span>
                    <input type="number" value={selectedEl.height} onChange={(e) => updateElement(selectedEl.id, { height: Number(e.target.value) })} className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Rotation</label>
                <select
                  value={selectedEl.rotation}
                  onChange={(e) => updateElement(selectedEl.id, { rotation: Number(e.target.value) })}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
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
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
                />
              </div>

              {/* Tag Bindings — per-property binding for all symbol types */}
              {selectedEl.type in TAG_TEMPLATES && (
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tag Bindings</h4>
                  {TAG_TEMPLATES[selectedEl.type].map((tmpl) => {
                    const boundTag = selectedEl.properties.tagBindings?.[tmpl.suffix] || '';
                    const filteredTags = tags.filter((t) => {
                      if (tmpl.dataType === 'BOOLEAN') return t.dataType === 'BOOLEAN';
                      if (tmpl.dataType === 'FLOAT' || tmpl.dataType === 'INTEGER') return t.dataType === 'FLOAT' || t.dataType === 'INTEGER';
                      return true;
                    });
                    return (
                      <TagBindingField
                        key={tmpl.suffix}
                        label={`${formatLabel(tmpl.suffix)}${tmpl.unit ? ` (${tmpl.unit})` : ''}`}
                        boundTag={boundTag}
                        availableTags={filteredTags}
                        onBind={(tagName) => {
                          const newBindings = { ...(selectedEl.properties.tagBindings || {}), [tmpl.suffix]: tagName };
                          updateElementProps(selectedEl.id, { tagBindings: newBindings });
                        }}
                        onUnbind={() => {
                          const newBindings = { ...(selectedEl.properties.tagBindings || {}) };
                          delete newBindings[tmpl.suffix];
                          updateElementProps(selectedEl.id, { tagBindings: Object.keys(newBindings).length > 0 ? newBindings : undefined });
                        }}
                      />
                    );
                  })}
                  <button
                    onClick={() => quickBindAll(selectedEl.id)}
                    className="w-full mt-2 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Auto-Create &amp; Bind All Tags
                  </button>
                </div>
              )}

              {/* Tag binding — for types NOT in TAG_TEMPLATES */}
              {!(selectedEl.type in TAG_TEMPLATES) && (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tag Binding</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tagBindingDropdown ? tagBindingSearch : (selectedEl.properties.tagBinding || '')}
                      onChange={(e) => {
                        setTagBindingSearch(e.target.value);
                        if (!tagBindingDropdown) setTagBindingDropdown(true);
                        updateElementProps(selectedEl.id, { tagBinding: e.target.value });
                      }}
                      onFocus={() => { setTagBindingDropdown(true); setTagBindingSearch(selectedEl.properties.tagBinding || ''); }}
                      placeholder="Search or type tag name..."
                      className="w-full px-2 py-1 pr-7 text-sm border border-gray-200 rounded text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {selectedEl.properties.tagBinding && (
                      <button
                        onClick={() => { updateElementProps(selectedEl.id, { tagBinding: '' }); setTagBindingSearch(''); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {tagBindingDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                      {tags
                        .filter((t) => t.name.toLowerCase().includes(tagBindingSearch.toLowerCase()))
                        .slice(0, 20)
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              updateElementProps(selectedEl.id, { tagBinding: t.name });
                              setTagBindingDropdown(false);
                              setTagBindingSearch('');
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs text-gray-900 hover:bg-blue-100 flex items-center gap-1.5 border-b border-gray-50"
                          >
                            <span className="font-mono text-gray-700 truncate flex-1">{t.name}</span>
                            <span className="text-[9px] text-gray-400">{t.dataType}</span>
                            {t.unit && <span className="text-[9px] text-gray-400">{t.unit}</span>}
                          </button>
                        ))}
                      {tags.filter((t) => t.name.toLowerCase().includes(tagBindingSearch.toLowerCase())).length === 0 && (
                        <div className="px-2 py-2 text-[10px] text-gray-400 text-center">No matching tags</div>
                      )}
                      <button
                        onClick={() => { setShowTagForm(true); setLeftTab('tags'); setTagBindingDropdown(false); }}
                        className="w-full text-left px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1 border-t border-gray-100"
                      >
                        <Plus className="w-3 h-3" /> Create New Tag
                      </button>
                    </div>
                  )}
                  {tagBindingDropdown && <div className="fixed inset-0 z-40" onClick={() => setTagBindingDropdown(false)} />}
                </div>
              )}

              {/* BusBar properties */}
              {selectedEl.type === 'BusBar' && selectedEl.properties.relX1 !== undefined && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Bus Width</label>
                    <input
                      type="range"
                      min={2}
                      max={20}
                      value={selectedEl.properties.busWidth || 6}
                      onChange={(e) => updateElementProps(selectedEl.id, { busWidth: Number(e.target.value) })}
                      className="w-full"
                    />
                    <span className="text-[10px] text-gray-400">{selectedEl.properties.busWidth || 6}px</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Bus Color</label>
                    <input
                      type="color"
                      value={selectedEl.properties.color || '#333333'}
                      onChange={(e) => updateElementProps(selectedEl.id, { color: e.target.value })}
                      className="w-full h-8 rounded border border-gray-200 cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Conditional Color — available for ALL component types */}
              {(
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Conditional Color</label>
                  <div className="text-[10px] text-gray-400 mb-1">Change color based on tag value</div>
                  {(selectedEl.properties.colorRules || []).map((rule: any, i: number) => (
                    <div key={i} className="mb-2 p-2 bg-gray-50 rounded border border-gray-100">
                      <div className="flex gap-1 mb-1">
                        <select
                          value={rule.condition}
                          onChange={(e) => {
                            const rules = [...(selectedEl.properties.colorRules || [])];
                            rules[i] = { ...rules[i], condition: e.target.value };
                            updateElementProps(selectedEl.id, { colorRules: rules });
                          }}
                          className="w-14 px-1 py-0.5 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                        >
                          <option value="==">==</option>
                          <option value="!=">!=</option>
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value=">=">&gt;=</option>
                          <option value="<=">&lt;=</option>
                        </select>
                        <input
                          value={rule.value}
                          onChange={(e) => {
                            const rules = [...(selectedEl.properties.colorRules || [])];
                            rules[i] = { ...rules[i], value: e.target.value };
                            updateElementProps(selectedEl.id, { colorRules: rules });
                          }}
                          placeholder="value"
                          className="flex-1 px-1 py-0.5 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                        />
                      </div>
                      <div className="flex gap-1 items-center">
                        <input
                          type="color"
                          value={rule.color || '#22c55e'}
                          onChange={(e) => {
                            const rules = [...(selectedEl.properties.colorRules || [])];
                            rules[i] = { ...rules[i], color: e.target.value };
                            updateElementProps(selectedEl.id, { colorRules: rules });
                          }}
                          className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
                        />
                        <input
                          value={rule.label || ''}
                          onChange={(e) => {
                            const rules = [...(selectedEl.properties.colorRules || [])];
                            rules[i] = { ...rules[i], label: e.target.value };
                            updateElementProps(selectedEl.id, { colorRules: rules });
                          }}
                          placeholder="Label"
                          className="flex-1 px-1 py-0.5 text-[10px] border border-gray-200 rounded text-gray-900 bg-white"
                        />
                        <button
                          onClick={() => {
                            const rules = (selectedEl.properties.colorRules || []).filter((_: any, j: number) => j !== i);
                            updateElementProps(selectedEl.id, { colorRules: rules });
                          }}
                          className="text-red-400 hover:text-red-600 text-xs px-1"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const rules = [...(selectedEl.properties.colorRules || []), { condition: '==', value: '1', color: '#22c55e', label: 'Energized' }];
                      updateElementProps(selectedEl.id, { colorRules: rules });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    + Add Color Rule
                  </button>
                </div>
              )}

              {/* Control element properties */}
              {selectedEl.type.startsWith('ctrl-') && (
                <>
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Target Tag</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={targetTagDropdown ? targetTagSearch : (selectedEl.properties.targetTag || '')}
                        onChange={(e) => {
                          setTargetTagSearch(e.target.value);
                          if (!targetTagDropdown) setTargetTagDropdown(true);
                          updateElementProps(selectedEl.id, { targetTag: e.target.value });
                        }}
                        onFocus={() => { setTargetTagDropdown(true); setTargetTagSearch(selectedEl.properties.targetTag || ''); }}
                        placeholder="Search or type tag name..."
                        className="w-full px-2 py-1 pr-7 text-sm border border-gray-200 rounded text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      {selectedEl.properties.targetTag && (
                        <button
                          onClick={() => { updateElementProps(selectedEl.id, { targetTag: '' }); setTargetTagSearch(''); }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {targetTagDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {tags
                          .filter((t) => t.name.toLowerCase().includes(targetTagSearch.toLowerCase()))
                          .slice(0, 20)
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                updateElementProps(selectedEl.id, { targetTag: t.name });
                                setTargetTagDropdown(false);
                                setTargetTagSearch('');
                              }}
                              className="w-full text-left px-2 py-1.5 text-xs text-gray-900 hover:bg-blue-100 flex items-center gap-1.5 border-b border-gray-50"
                            >
                              <span className="font-mono text-gray-700 truncate flex-1">{t.name}</span>
                              <span className="text-[9px] text-gray-400">{t.dataType}</span>
                            </button>
                          ))}
                        {tags.filter((t) => t.name.toLowerCase().includes(targetTagSearch.toLowerCase())).length === 0 && (
                          <div className="px-2 py-2 text-[10px] text-gray-400 text-center">No matching tags</div>
                        )}
                        <button
                          onClick={() => { setShowTagForm(true); setLeftTab('tags'); setTargetTagDropdown(false); }}
                          className="w-full text-left px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-1 border-t border-gray-100"
                        >
                          <Plus className="w-3 h-3" /> Create New Tag
                        </button>
                      </div>
                    )}
                    {targetTagDropdown && <div className="fixed inset-0 z-40" onClick={() => setTargetTagDropdown(false)} />}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
                    <select
                      value={selectedEl.properties.controlAction || 'setValue'}
                      onChange={(e) => updateElementProps(selectedEl.id, { controlAction: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
                    >
                      <option value="setValue">Set Value</option>
                      <option value="toggle">Toggle</option>
                      <option value="increment">Increment</option>
                      <option value="pagegoto">Page Goto</option>
                      <option value="page_back">Page Back</option>
                      <option value="page_home">Page Home</option>
                      <option value="script">Script</option>
                    </select>
                  </div>
                  {selectedEl.properties.controlAction !== 'script' && selectedEl.properties.controlAction !== 'toggle' && selectedEl.properties.controlAction !== 'page_back' && selectedEl.properties.controlAction !== 'page_home' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{selectedEl.properties.controlAction === 'pagegoto' ? 'Page Name' : 'Value to Set'}</label>
                      <input
                        type="text"
                        value={selectedEl.properties.controlValue || ''}
                        onChange={(e) => updateElementProps(selectedEl.id, { controlValue: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
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
                        placeholder='pagegoto("Page 2"); // or page_back(); page_home();'
                        className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded text-gray-900 bg-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Text</label>
                    <input
                      type="text"
                      value={selectedEl.properties.buttonText || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonText: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
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

              {/* Banner & Display properties */}
              {['alarm-banner', 'alarm-list', 'trend-banner', 'status-banner', 'clock-display', 'value-display', 'bar-graph', 'gauge-display', 'comm-status-bar', 'event-ticker'].includes(selectedEl.type) && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                    <input type="text" value={selectedEl.properties.label || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { label: e.target.value })}
                      placeholder="Display label..."
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">BG Color</label>
                      <div className="flex gap-1">
                        <input type="color" value={selectedEl.properties.bgColor || '#0F172A'}
                          onChange={(e) => updateElementProps(selectedEl.id, { bgColor: e.target.value })}
                          className="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
                        <input type="text" value={selectedEl.properties.bgColor || '#0F172A'}
                          onChange={(e) => updateElementProps(selectedEl.id, { bgColor: e.target.value })}
                          className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Text Color</label>
                      <div className="flex gap-1">
                        <input type="color" value={selectedEl.properties.textColor || '#22D3EE'}
                          onChange={(e) => updateElementProps(selectedEl.id, { textColor: e.target.value })}
                          className="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
                        <input type="text" value={selectedEl.properties.textColor || '#22D3EE'}
                          onChange={(e) => updateElementProps(selectedEl.id, { textColor: e.target.value })}
                          className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white font-mono" />
                      </div>
                    </div>
                  </div>
                  {['value-display', 'bar-graph', 'gauge-display'].includes(selectedEl.type) && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tag Binding</label>
                        <input type="text" value={selectedEl.properties.tagBinding || ''}
                          onChange={(e) => updateElementProps(selectedEl.id, { tagBinding: e.target.value })}
                          placeholder="e.g. Voltage_HV"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                          <input type="text" value={selectedEl.properties.unit || ''}
                            onChange={(e) => updateElementProps(selectedEl.id, { unit: e.target.value })}
                            placeholder="kV, A, MW..."
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Decimals</label>
                          <input type="number" min={0} max={6} value={selectedEl.properties.decimals ?? 1}
                            onChange={(e) => updateElementProps(selectedEl.id, { decimals: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                        </div>
                      </div>
                      {['bar-graph', 'gauge-display'].includes(selectedEl.type) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Min Value</label>
                            <input type="number" value={selectedEl.properties.minValue ?? 0}
                              onChange={(e) => updateElementProps(selectedEl.id, { minValue: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Max Value</label>
                            <input type="number" value={selectedEl.properties.maxValue ?? 100}
                              onChange={(e) => updateElementProps(selectedEl.id, { maxValue: parseFloat(e.target.value) || 100 })}
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {['status-banner', 'comm-status-bar', 'event-ticker'].includes(selectedEl.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Custom Text</label>
                      <input type="text" value={selectedEl.properties.customText || ''}
                        onChange={(e) => updateElementProps(selectedEl.id, { customText: e.target.value })}
                        placeholder="Custom status text..."
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>
                  )}
                  {selectedEl.type === 'trend-banner' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tag 1 (Pen 1)</label>
                        <input type="text" value={selectedEl.properties.tag1 || ''}
                          onChange={(e) => updateElementProps(selectedEl.id, { tag1: e.target.value })}
                          placeholder="e.g. Voltage_HV"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tag 2 (Pen 2)</label>
                        <input type="text" value={selectedEl.properties.tag2 || ''}
                          onChange={(e) => updateElementProps(selectedEl.id, { tag2: e.target.value })}
                          placeholder="e.g. Current_R"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tag 3 (Pen 3)</label>
                        <input type="text" value={selectedEl.properties.tag3 || ''}
                          onChange={(e) => updateElementProps(selectedEl.id, { tag3: e.target.value })}
                          placeholder="e.g. Power_kW"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tag 4 (Pen 4)</label>
                        <input type="text" value={selectedEl.properties.tag4 || ''}
                          onChange={(e) => updateElementProps(selectedEl.id, { tag4: e.target.value })}
                          placeholder="e.g. Temp_C"
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Pen 1 Color</label>
                          <input type="color" value={selectedEl.properties.pen1Color || '#22D3EE'}
                            onChange={(e) => updateElementProps(selectedEl.id, { pen1Color: e.target.value })}
                            className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Pen 2 Color</label>
                          <input type="color" value={selectedEl.properties.pen2Color || '#A78BFA'}
                            onChange={(e) => updateElementProps(selectedEl.id, { pen2Color: e.target.value })}
                            className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Pen 3 Color</label>
                          <input type="color" value={selectedEl.properties.pen3Color || '#4ADE80'}
                            onChange={(e) => updateElementProps(selectedEl.id, { pen3Color: e.target.value })}
                            className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Pen 4 Color</label>
                          <input type="color" value={selectedEl.properties.pen4Color || '#FB923C'}
                            onChange={(e) => updateElementProps(selectedEl.id, { pen4Color: e.target.value })}
                            className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Navigation properties */}
              {['page-link', 'back-button', 'home-button', 'page-change-button', 'popup-page'].includes(selectedEl.type) && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Text</label>
                    <input type="text" value={selectedEl.properties.buttonText || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonText: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  {['page-link', 'page-change-button', 'popup-page'].includes(selectedEl.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Target Page</label>
                      <select value={selectedEl.properties.targetPageId || ''}
                        onChange={(e) => updateElementProps(selectedEl.id, { targetPageId: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white">
                        <option value="">-- Select Page --</option>
                        {project?.mimicPages.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Color</label>
                    <input type="color" value={selectedEl.properties.buttonColor || '#3B82F6'}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonColor: e.target.value })}
                      className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                  </div>
                </>
              )}


              {/* 3D Button Properties */}
              {selectedEl.type.startsWith('3d-') && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Text</label>
                    <input type="text" value={selectedEl.properties.buttonText || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonText: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Color</label>
                    <input type="color" value={selectedEl.properties.buttonColor || '#6B7280'}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonColor: e.target.value })}
                      className="w-full h-8 rounded border border-gray-200 cursor-pointer" />
                  </div>
                  {!['3d-indicator-lamp'].includes(selectedEl.type) && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tag Binding</label>
                        <input type="text" value={selectedEl.properties.tagBinding || ''}
                          onChange={(e) => updateElementProps(selectedEl.id, { tagBinding: e.target.value })}
                          placeholder="e.g. PUMP_01_STATUS"
                          className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded text-gray-900 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
                        <select value={selectedEl.properties.controlAction || 'setValue'}
                          onChange={(e) => updateElementProps(selectedEl.id, { controlAction: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white">
                          <option value="setValue">Set Value</option>
                          <option value="toggle">Toggle</option>
                          <option value="momentary">Momentary (hold ON)</option>
                          <option value="increment">Increment</option>
                          <option value="script">Run Script</option>
                        </select>
                      </div>
                      {selectedEl.properties.controlAction === 'setValue' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Value to Set</label>
                          <input type="text" value={selectedEl.properties.controlValue || ''}
                            onChange={(e) => updateElementProps(selectedEl.id, { controlValue: e.target.value })}
                            placeholder="e.g. 1"
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                        </div>
                      )}
                      {selectedEl.properties.controlAction === 'increment' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Increment By</label>
                          <input type="number" value={selectedEl.properties.incrementBy || 1}
                            onChange={(e) => updateElementProps(selectedEl.id, { incrementBy: parseFloat(e.target.value) || 1 })}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                        </div>
                      )}
                      {selectedEl.properties.controlAction === 'script' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Script (JS)</label>
                          <textarea value={selectedEl.properties.controlScript || ''}
                            onChange={(e) => updateElementProps(selectedEl.id, { controlScript: e.target.value })}
                            rows={4}
                            placeholder="// e.g. PUMP_01=1; WAIT(500); PUMP_02=1;"
                            className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded text-gray-900 bg-white" />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Scripting & Action properties */}
              {['action-button', 'script-runner', 'formula-display', 'sequence-trigger', 'conditional-display'].includes(selectedEl.type) && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button Text / Label</label>
                    <input type="text" value={selectedEl.properties.buttonText || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonText: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Button / BG Color</label>
                    <input type="color" value={selectedEl.properties.buttonColor || '#7C3AED'}
                      onChange={(e) => updateElementProps(selectedEl.id, { buttonColor: e.target.value })}
                      className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Execute On</label>
                    <select value={selectedEl.properties.executeOn || 'click'}
                      onChange={(e) => updateElementProps(selectedEl.id, { executeOn: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white">
                      <option value="click">On Click</option>
                      <option value="continuous">Continuous (live)</option>
                      <option value="interval">Every N seconds</option>
                      <option value="tagChange">On Tag Change</option>
                    </select>
                  </div>
                  {selectedEl.properties.executeOn === 'interval' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Interval (sec)</label>
                      <input type="number" min={1} max={3600} value={selectedEl.properties.intervalSec || 5}
                        onChange={(e) => updateElementProps(selectedEl.id, { intervalSec: parseInt(e.target.value) || 5 })}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>
                  )}
                  {selectedEl.properties.executeOn === 'tagChange' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Watch Tag</label>
                      <input type="text" value={selectedEl.properties.watchTag || ''}
                        onChange={(e) => updateElementProps(selectedEl.id, { watchTag: e.target.value })}
                        placeholder="e.g. CB_Status"
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>
                  )}
                  {/* AI Script Generator */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-2">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm"><Bot className="w-4 h-4 inline" /></span>
                      <span className="text-xs font-semibold text-purple-700">AI Script Generator</span>
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && aiPrompt.trim() && !aiGenerating) {
                            e.preventDefault();
                            (async () => {
                              setAiGenerating(true);
                              try {
                                const res = await fetch('/api/ai/generate-script', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                                  body: JSON.stringify({ prompt: aiPrompt, elementType: selectedEl.type, existingScript: selectedEl.properties.script || '' }),
                                });
                                const data = await res.json();
                                if (data.script) {
                                  updateElementProps(selectedEl.id, { script: data.script });
                                  setAiPrompt('');
                                }
                              } catch (err) { console.error('AI generation failed:', err); }
                              setAiGenerating(false);
                            })();
                          }
                        }}
                        placeholder="Describe what the button should do..."
                        className="flex-1 px-2 py-1.5 text-xs border border-purple-200 rounded bg-white text-gray-900 placeholder-gray-400 focus:ring-1 focus:ring-purple-400 focus:outline-none"
                        disabled={aiGenerating}
                      />
                      <button
                        onClick={async () => {
                          if (!aiPrompt.trim() || aiGenerating) return;
                          setAiGenerating(true);
                          try {
                            const res = await fetch('/api/ai/generate-script', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                              body: JSON.stringify({ prompt: aiPrompt, elementType: selectedEl.type, existingScript: selectedEl.properties.script || '' }),
                            });
                            const data = await res.json();
                            if (data.script) {
                              updateElementProps(selectedEl.id, { script: data.script });
                              setAiPrompt('');
                            }
                          } catch (err) { console.error('AI generation failed:', err); }
                          setAiGenerating(false);
                        }}
                        disabled={!aiPrompt.trim() || aiGenerating}
                        className="px-2.5 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {aiGenerating ? '...' : 'Generate'}
                      </button>
                    </div>
                    <div className="text-[9px] text-purple-400 mt-1">
                      Try: "Open CB, wait 2 sec, then open isolator" or "Calculate 3-phase power from voltage and current"
                    </div>
                  </div>

                  {/* Script Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-500">Script / Formula</label>
                      <button onClick={() => setShowScriptRef(true)} className="text-[9px] text-purple-600 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 cursor-pointer" title="Open Script Reference (F1)">
                        Reference (F1)
                      </button>
                    </div>
                    <textarea
                      value={selectedEl.properties.script || ''}
                      onChange={(e) => updateElementProps(selectedEl.id, { script: e.target.value })}
                      placeholder={'CB_Status = 0\nWAIT(1000)\nIsolator_A = 0\nWAIT(1000)\nEarth_Switch = 1'}
                      rows={8}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-gray-200 rounded text-gray-900 bg-gray-50 leading-relaxed"
                      style={{ resize: 'vertical', minHeight: '120px' }}
                    />
                    <div className="text-[9px] text-gray-400 mt-1 space-y-0.5">
                      <div><b>TagName = value</b> — set a tag</div>
                      <div><b>WAIT(ms)</b> — delay (1000 = 1 sec)</div>
                      <div><b>IF tag {'>'} value</b> — condition</div>
                      <div><b>CHECK tag == value</b> — verify before proceeding</div>
                      <div><b>// comment</b> — ignored line</div>
                    </div>
                  </div>
                  {['formula-display', 'conditional-display'].includes(selectedEl.type) && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Result Display</label>
                      <select value={selectedEl.properties.resultDisplay || 'value'}
                        onChange={(e) => updateElementProps(selectedEl.id, { resultDisplay: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white">
                        <option value="value">Show calculated value</option>
                        <option value="label">Show custom label</option>
                        <option value="color">Change element color</option>
                        <option value="none">No display (action only)</option>
                      </select>
                    </div>
                  )}
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
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Font Size</label>
                    <input
                      type="number"
                      value={selectedEl.properties.fontSize || 14}
                      onChange={(e) => updateElementProps(selectedEl.id, { fontSize: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
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
                    }} placeholder="condition" className="flex-1 px-1 py-0.5 border border-gray-200 rounded text-gray-900 bg-white" />
                    <input value={rule.property} onChange={(e) => {
                      const rules = [...(selectedEl.properties.animationRules || [])];
                      rules[i] = { ...rules[i], property: e.target.value };
                      updateElementProps(selectedEl.id, { animationRules: rules });
                    }} placeholder="prop" className="w-12 px-1 py-0.5 border border-gray-200 rounded text-gray-900 bg-white" />
                    <input value={rule.value} onChange={(e) => {
                      const rules = [...(selectedEl.properties.animationRules || [])];
                      rules[i] = { ...rules[i], value: e.target.value };
                      updateElementProps(selectedEl.id, { animationRules: rules });
                    }} placeholder="value" className="w-14 px-1 py-0.5 border border-gray-200 rounded text-gray-900 bg-white" />
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
          ) : rightTab === 'properties' && !selectedEl ? (
            <div className="p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Page Name</label>
                <input
                  type="text"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
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
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded text-gray-900 bg-white"
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
          ) : rightTab === 'pageSettings' && selectedEl ? (
            <div className="p-3 space-y-3">
              {/* ===== COMPONENT SETTINGS ===== */}
              <div className="text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 pb-2 mb-2">
                Component Settings
              </div>
              {/* Color Rules */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Conditional Color</span>
                  <button
                    onClick={() => {
                      const el = elements.find(e => e.id === selectedEl);
                      if (!el) return;
                      const rules = el.colorRules || [];
                      updateElement(selectedEl, { colorRules: [...rules, { operator: '==', value: '', color: '#22c55e' }] });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >+ Add Rule</button>
                </div>
                {(() => {
                  const el = elements.find(e => e.id === selectedEl);
                  const rules = el?.colorRules || [];
                  if (rules.length === 0) return <div className="text-xs text-gray-400">No color rules. Click + Add Rule.</div>;
                  return rules.map((rule: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1 mb-1">
                      <select
                        value={rule.operator}
                        onChange={(e) => {
                          const el = elements.find(el => el.id === selectedEl);
                          const updated = [...(el?.colorRules || [])];
                          updated[idx] = { ...updated[idx], operator: e.target.value };
                          updateElement(selectedEl, { colorRules: updated });
                        }}
                        className="px-1 py-0.5 text-xs border border-gray-200 rounded bg-white"
                      >
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                      </select>
                      <input
                        type="text"
                        value={rule.value}
                        onChange={(e) => {
                          const el = elements.find(el => el.id === selectedEl);
                          const updated = [...(el?.colorRules || [])];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          updateElement(selectedEl, { colorRules: updated });
                        }}
                        placeholder="val"
                        className="w-12 px-1 py-0.5 text-xs border border-gray-200 rounded bg-white"
                      />
                      <input
                        type="color"
                        value={rule.color || '#22c55e'}
                        onChange={(e) => {
                          const el = elements.find(el => el.id === selectedEl);
                          const updated = [...(el?.colorRules || [])];
                          updated[idx] = { ...updated[idx], color: e.target.value };
                          updateElement(selectedEl, { colorRules: updated });
                        }}
                        className="w-8 h-6 rounded border border-gray-200 cursor-pointer"
                      />
                      <button
                        onClick={() => {
                          const el = elements.find(el => el.id === selectedEl);
                          const updated = (el?.colorRules || []).filter((_: any, i: number) => i !== idx);
                          updateElement(selectedEl, { colorRules: updated });
                        }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >x</button>
                    </div>
                  ));
                })()}
              </div>
              {/* State / Multi-state */}
              <div className="border-t border-gray-100 pt-2">
                <div className="text-xs font-medium text-gray-600 mb-1">State Tag Binding</div>
                <div className="text-[9px] text-gray-400 mb-1">Bind a tag to switch component symbol state (e.g. open/closed contact)</div>
                <input
                  type="text"
                  value={elements.find(e => e.id === selectedEl)?.stateTag || ''}
                  onChange={(e) => updateElement(selectedEl, { stateTag: e.target.value })}
                  placeholder="e.g. 1:CB1.status"
                  className="w-full px-2 py-0.5 text-xs border border-gray-200 rounded bg-white"
                />
                <div className="mt-1">
                  <div className="text-[9px] text-gray-400 mb-0.5">State 0 label (e.g. Closed)</div>
                  <input
                    type="text"
                    value={elements.find(e => e.id === selectedEl)?.state0Label || 'Closed'}
                    onChange={(e) => updateElement(selectedEl, { state0Label: e.target.value })}
                    className="w-full px-2 py-0.5 text-xs border border-gray-200 rounded bg-white"
                  />
                </div>
                <div className="mt-1">
                  <div className="text-[9px] text-gray-400 mb-0.5">State 1 label (e.g. Open)</div>
                  <input
                    type="text"
                    value={elements.find(e => e.id === selectedEl)?.state1Label || 'Open'}
                    onChange={(e) => updateElement(selectedEl, { state1Label: e.target.value })}
                    className="w-full px-2 py-0.5 text-xs border border-gray-200 rounded bg-white"
                  />
                </div>
              </div>
              {/* Visibility Condition */}
              <div className="border-t border-gray-100 pt-2">
                <div className="text-xs font-medium text-gray-600 mb-1">Visibility Condition</div>
                <div className="text-[9px] text-gray-400 mb-1">Hide this component when condition is true</div>
                <input
                  type="text"
                  value={elements.find(e => e.id === selectedEl)?.hideWhen || ''}
                  onChange={(e) => updateElement(selectedEl, { hideWhen: e.target.value })}
                  placeholder="e.g. tag == 0"
                  className="w-full px-2 py-0.5 text-xs border border-gray-200 rounded bg-white"
                />
              </div>
            </div>
          ) : rightTab === 'pageSettings' ? (
            <div className="p-3 space-y-3">
              {/* ===== HEADER SETTINGS ===== */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase">Header Bar</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={pageSettings.header.show}
                    onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, show: e.target.checked } }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs text-gray-500">Show</span>
                </label>
              </div>
              {pageSettings.header.show && (
                <div className="space-y-2 pl-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Logo URL</label>
                    <input type="text" value={pageSettings.header.logoUrl}
                      onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, logoUrl: e.target.value } }))}
                      placeholder="https://example.com/logo.png"
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                    <div className="text-[9px] text-gray-400 mt-0.5">Paste any image URL for logo (left side)</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                    <input type="text" value={pageSettings.header.title}
                      onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, title: e.target.value } }))}
                      placeholder="e.g. 132kV Substation Overview"
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subtitle</label>
                    <input type="text" value={pageSettings.header.subtitle || ''}
                      onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, subtitle: e.target.value } }))}
                      placeholder="e.g. MSEDCL Smart Distribution"
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">BG Color</label>
                      <input type="color" value={pageSettings.header.bgColor}
                        onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, bgColor: e.target.value } }))}
                        className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Text Color</label>
                      <input type="color" value={pageSettings.header.textColor || '#FFFFFF'}
                        onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, textColor: e.target.value } }))}
                        className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Height (px)</label>
                    <input type="number" min={30} max={100} value={pageSettings.header.height || 50}
                      onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, height: parseInt(e.target.value) || 50 } }))}
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3" />

              {/* ===== FOOTER SETTINGS (Widget-based) ===== */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase">Footer Bar</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={pageSettings.footer.show}
                    onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, show: e.target.checked } }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs text-gray-500">Show</span>
                </label>
              </div>
              {pageSettings.footer.show && (
                <div className="space-y-2 pl-1">
                  {/* Active Widgets (reorderable) */}
                  <div className="text-[10px] font-medium text-gray-500 uppercase">Active Widgets</div>
                  <div className="space-y-1">
                    {(pageSettings.footer.widgets || []).map((w, idx) => (
                      <div key={w.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                        <div className="flex flex-col gap-0.5">
                          <button
                            disabled={idx === 0}
                            onClick={() => {
                              const ws = [...(pageSettings.footer.widgets || [])];
                              [ws[idx - 1], ws[idx]] = [ws[idx], ws[idx - 1]];
                              setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } }));
                            }}
                            className="text-[8px] text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none">▲</button>
                          <button
                            disabled={idx === (pageSettings.footer.widgets || []).length - 1}
                            onClick={() => {
                              const ws = [...(pageSettings.footer.widgets || [])];
                              [ws[idx], ws[idx + 1]] = [ws[idx + 1], ws[idx]];
                              setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } }));
                            }}
                            className="text-[8px] text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none">▼</button>
                        </div>
                        <span className="text-xs flex-1">{AVAILABLE_FOOTER_WIDGETS.find(a => a.type === w.type)?.icon} {w.label}</span>
                        <input type="number" min={16} max={60} value={w.height}
                          onChange={(e) => {
                            const ws = [...(pageSettings.footer.widgets || [])];
                            ws[idx] = { ...ws[idx], height: parseInt(e.target.value) || 24 };
                            setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } }));
                          }}
                          className="w-10 px-1 py-0 text-[10px] border border-gray-200 rounded text-gray-900 bg-white text-center" title="Height (px)" />
                        <button onClick={() => {
                          const ws = (pageSettings.footer.widgets || []).filter((_, i) => i !== idx);
                          setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } }));
                        }} className="text-red-400 hover:text-red-600 text-xs ml-1" title="Remove">✕</button>
                      </div>
                    ))}
                    {(pageSettings.footer.widgets || []).length === 0 && (
                      <div className="text-[10px] text-gray-400 italic text-center py-2">No widgets — add from below</div>
                    )}
                  </div>

                  {/* Available Widgets */}
                  <div className="text-[10px] font-medium text-gray-500 uppercase mt-2">Available Widgets</div>
                  <div className="space-y-1">
                    {AVAILABLE_FOOTER_WIDGETS.filter(aw => !(pageSettings.footer.widgets || []).some(w => w.type === aw.type)).map(aw => (
                      <button key={aw.type} onClick={() => {
                        const newWidget: FooterWidget = { id: `w_${Date.now()}`, type: aw.type, label: aw.label, height: aw.defaultHeight };
                        setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: [...(s.footer.widgets || []), newWidget] } }));
                      }} className="w-full flex items-center gap-2 px-2 py-1.5 text-left bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded transition-colors">
                        <span className="text-sm">{aw.icon}</span>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-gray-700">{aw.label}</div>
                          <div className="text-[9px] text-gray-400">{aw.desc}</div>
                        </div>
                        <span className="text-green-500 text-xs">+ Add</span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-2" />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Custom Text</label>
                    <input type="text" value={pageSettings.footer.customText}
                      onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, customText: e.target.value } }))}
                      placeholder="e.g. MSEDCL Nagpur Division"
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">BG Color</label>
                      <input type="color" value={pageSettings.footer.bgColor}
                        onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, bgColor: e.target.value } }))}
                        className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Text Color</label>
                      <input type="color" value={pageSettings.footer.textColor || '#FFFFFF'}
                        onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, textColor: e.target.value } }))}
                        className="w-full h-7 rounded border border-gray-200 cursor-pointer" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : rightTab === 'headerFooter' ? (
            <div className="p-3 space-y-3">
              <div className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1.5 rounded">Header & Footer</div>

              {/* HEADER */}
              <div className="border border-gray-200 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Header Bar</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={pageSettings.header.show}
                      onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, show: e.target.checked } }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-[10px] text-gray-500">{pageSettings.header.show ? 'ON' : 'OFF'}</span>
                  </label>
                </div>
                {pageSettings.header.show && (
                  <div className="space-y-2 border-t border-gray-100 pt-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Logo URL</label>
                      <input type="text" value={pageSettings.header.logoUrl}
                        onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, logoUrl: e.target.value } }))}
                        placeholder="https://your-logo.png"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Title</label>
                      <input type="text" value={pageSettings.header.title}
                        onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, title: e.target.value } }))}
                        placeholder="132kV Substation Overview"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Subtitle</label>
                      <input type="text" value={pageSettings.header.subtitle || ''}
                        onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, subtitle: e.target.value } }))}
                        placeholder="MSEDCL Nagpur Division"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">BG Color</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={pageSettings.header.bgColor}
                            onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, bgColor: e.target.value } }))}
                            className="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
                          <input type="text" value={pageSettings.header.bgColor}
                            onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, bgColor: e.target.value } }))}
                            className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white font-mono" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Text Color</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={pageSettings.header.textColor || '#FFFFFF'}
                            onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, textColor: e.target.value } }))}
                            className="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
                          <input type="text" value={pageSettings.header.textColor || '#FFFFFF'}
                            onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, textColor: e.target.value } }))}
                            className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white font-mono" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Height (px)</label>
                      <input type="range" min={30} max={100} value={pageSettings.header.height || 50}
                        onChange={(e) => setPageSettings(s => ({ ...s, header: { ...s.header, height: parseInt(e.target.value) } }))}
                        className="w-full" />
                      <div className="text-[9px] text-gray-400 text-right">{pageSettings.header.height || 50}px</div>
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div className="border border-gray-200 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Footer Bar</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={pageSettings.footer.show}
                      onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, show: e.target.checked } }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-[10px] text-gray-500">{pageSettings.footer.show ? 'ON' : 'OFF'}</span>
                  </label>
                </div>
                {pageSettings.footer.show && (
                  <div className="space-y-2 border-t border-gray-100 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">BG Color</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={pageSettings.footer.bgColor}
                            onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, bgColor: e.target.value } }))}
                            className="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
                          <input type="text" value={pageSettings.footer.bgColor}
                            onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, bgColor: e.target.value } }))}
                            className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white font-mono" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Text Color</label>
                        <div className="flex items-center gap-1">
                          <input type="color" value={pageSettings.footer.textColor || '#FFFFFF'}
                            onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, textColor: e.target.value } }))}
                            className="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
                          <input type="text" value={pageSettings.footer.textColor || '#FFFFFF'}
                            onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, textColor: e.target.value } }))}
                            className="flex-1 px-1 py-1 text-[10px] border border-gray-200 rounded text-gray-900 bg-white font-mono" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Custom Text</label>
                      <input type="text" value={pageSettings.footer.customText}
                        onChange={(e) => setPageSettings(s => ({ ...s, footer: { ...s.footer, customText: e.target.value } }))}
                        placeholder="MSEDCL Nagpur Division"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded text-gray-900 bg-white" />
                    </div>

                    {/* Widgets */}
                    <div className="text-[10px] font-semibold text-gray-600 mt-1">Footer Widgets</div>
                    <div className="space-y-1">
                      {(pageSettings.footer.widgets || []).map((w, idx) => (
                        <div key={w.id} className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                          <div className="flex flex-col gap-0.5">
                            <button disabled={idx === 0}
                              onClick={() => { const ws = [...(pageSettings.footer.widgets || [])]; [ws[idx - 1], ws[idx]] = [ws[idx], ws[idx - 1]]; setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } })); }}
                              className="text-[8px] text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none">▲</button>
                            <button disabled={idx === (pageSettings.footer.widgets || []).length - 1}
                              onClick={() => { const ws = [...(pageSettings.footer.widgets || [])]; [ws[idx], ws[idx + 1]] = [ws[idx + 1], ws[idx]]; setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } })); }}
                              className="text-[8px] text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none">▼</button>
                          </div>
                          <span className="text-xs flex-1">{AVAILABLE_FOOTER_WIDGETS.find(a => a.type === w.type)?.icon} {w.label}</span>
                          <input type="number" min={16} max={60} value={w.height}
                            onChange={(e) => { const ws = [...(pageSettings.footer.widgets || [])]; ws[idx] = { ...ws[idx], height: parseInt(e.target.value) || 24 }; setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } })); }}
                            className="w-10 px-1 py-0 text-[10px] border border-gray-200 rounded text-gray-900 bg-white text-center" title="Height" />
                          <button onClick={() => { const ws = (pageSettings.footer.widgets || []).filter((_, i) => i !== idx); setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: ws } })); }}
                            className="text-red-400 hover:text-red-600 text-xs" title="Remove">✕</button>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] font-semibold text-gray-500 mt-1">+ Add Widget</div>
                    <div className="space-y-1">
                      {AVAILABLE_FOOTER_WIDGETS.filter(aw => !(pageSettings.footer.widgets || []).some(w => w.type === aw.type)).map(aw => (
                        <button key={aw.type} onClick={() => {
                          const nw: FooterWidget = { id: `w_${Date.now()}`, type: aw.type, label: aw.label, height: aw.defaultHeight };
                          setPageSettings(s => ({ ...s, footer: { ...s.footer, widgets: [...(s.footer.widgets || []), nw] } }));
                        }} className="w-full flex items-center gap-2 px-2 py-1 text-left bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded transition-colors">
                          <span className="text-xs">{aw.icon}</span>
                          <div className="flex-1">
                            <div className="text-[10px] font-medium text-gray-700">{aw.label}</div>
                            <div className="text-[8px] text-gray-400">{aw.desc}</div>
                          </div>
                          <span className="text-green-500 text-[10px]">+</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {/* Script Reference Popup (F1) */}
      {showScriptRef && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowScriptRef(false)} />
          <div className="fixed inset-10 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl"><BookOpen className="w-6 h-6" /></span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Script & Formula Reference</h2>
                  <p className="text-xs text-gray-500">Press F1 to toggle • ESC to close</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={scriptRefSearch}
                  onChange={(e) => setScriptRefSearch(e.target.value)}
                  placeholder="Search functions, syntax..."
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-purple-400 focus:outline-none text-gray-900 bg-white"
                  autoFocus
                />
                <button onClick={() => setShowScriptRef(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const q = scriptRefSearch.toLowerCase();
                const SECTIONS = [
                  {
                    title: 'Basic Operations',
                    items: [
                      { syntax: 'TagName = value', desc: 'Set a tag to a value', example: 'CB_Status = 0\nVoltage_SP = 11.5\nAlarm_Text = "High Temp"', tags: 'set assign write value' },
                      { syntax: 'WAIT(milliseconds)', desc: 'Pause execution (1000 = 1 second)', example: 'WAIT(1000)    // 1 second\nWAIT(500)     // half second\nWAIT(5000)    // 5 seconds', tags: 'delay pause wait sleep timer' },
                      { syntax: 'CHECK TagName == value', desc: 'Verify a tag value before proceeding. Aborts sequence if check fails.', example: 'CB_Status = 0\nWAIT(1000)\nCHECK CB_Status == 0\nIsolator = 0', tags: 'check verify assert confirm validate' },
                      { syntax: '// comment text', desc: 'Add a comment (ignored during execution)', example: '// Shutdown sequence\n// Author: Operator A\nCB_Status = 0', tags: 'comment note remark' },
                    ],
                  },
                  {
                    title: 'Conditional Logic',
                    items: [
                      { syntax: 'IF TagName > value\n  ...\nEND', desc: 'Execute block only if condition is true', example: 'IF Temperature > 85\n  Cooling_Fan = 1\n  Alarm_OverTemp = 1\nEND', tags: 'if condition compare greater less' },
                      { syntax: 'IF TagName == value\n  ...\nELSE\n  ...\nEND', desc: 'If-else branching', example: 'IF CB_Status == 1\n  Indicator_Green = 1\n  Indicator_Red = 0\nELSE\n  Indicator_Green = 0\n  Indicator_Red = 1\nEND', tags: 'if else branch toggle condition' },
                      { syntax: 'Comparison operators', desc: '== (equal), != (not equal), > (greater), < (less), >= (≥), <= (≤)', example: 'IF Voltage_HV > 110\nIF Temperature != 0\nIF Load_MW >= 15\nIF Frequency < 49.5', tags: 'compare equal greater less operators' },
                    ],
                  },
                  {
                    title: 'Math & Formulas',
                    items: [
                      { syntax: 'Result = A + B - C * D / E', desc: 'Basic arithmetic on tag values', example: 'Total_Load = Feeder1_Load + Feeder2_Load + Feeder3_Load\nLoss_Percent = Losses / Total_Load * 100', tags: 'math add subtract multiply divide arithmetic' },
                      { syntax: '3-Phase Power', desc: 'P = √3 × V × I × PF / 1000', example: 'Power_kW = Voltage_HV * Current_R * 1.732 * Power_Factor / 1000', tags: 'power three phase voltage current calculation formula' },
                      { syntax: 'Apparent Power (kVA)', desc: 'S = √3 × V × I / 1000', example: 'Apparent_kVA = Voltage_HV * Current_R * 1.732 / 1000', tags: 'apparent power kva formula' },
                      { syntax: 'Reactive Power (kVAR)', desc: 'Q = √(S² - P²)', example: 'Reactive_kVAR = sqrt(Apparent_kVA * Apparent_kVA - Power_kW * Power_kW)', tags: 'reactive power kvar formula' },
                      { syntax: 'Power Factor', desc: 'PF = P / S', example: 'PF = Power_kW / Apparent_kVA', tags: 'power factor pf formula' },
                      { syntax: 'Efficiency', desc: 'η = Output / Input × 100', example: 'Efficiency = Output_Power / Input_Power * 100', tags: 'efficiency formula percentage' },
                      { syntax: 'Transformer Loading %', desc: 'Loading = Load / Rating × 100', example: 'TR1_Loading = TR1_Load_MVA / TR1_Rating_MVA * 100', tags: 'transformer loading percentage formula' },
                      { syntax: 'Math functions', desc: 'sqrt(), abs(), min(), max(), round(), pow()', example: 'RMS = sqrt(V1*V1 + V2*V2 + V3*V3)\nPeak = max(Load_A, Load_B, Load_C)\nRounded = round(Temperature * 10) / 10', tags: 'sqrt square root absolute min max round power math function' },
                    ],
                  },
                  {
                    title: 'Common Sequences',
                    items: [
                      { syntax: 'Breaker Trip Sequence', desc: 'Standard CB open sequence with verification', example: 'CB_Status = 0\nWAIT(1000)\nCHECK CB_Status == 0\nTrip_Counter = Trip_Counter + 1', tags: 'breaker trip open cb sequence' },
                      { syntax: 'Breaker Close Sequence', desc: 'Standard CB close with interlock check', example: '// Check interlocks first\nCHECK Isolator_A == 1\nCHECK Earth_Switch == 0\nCB_Status = 1\nWAIT(500)\nCHECK CB_Status == 1', tags: 'breaker close cb interlock sequence' },
                      { syntax: 'Shutdown Sequence', desc: 'Step-by-step shutdown with delays', example: '// Emergency Shutdown\nGenerator_CB = 0\nWAIT(1000)\nBus_Tie = 0\nWAIT(1000)\nIncomer_CB = 0\nWAIT(1000)\nAll_Isolators = 0\nWAIT(1000)\nEarth_Switch = 1', tags: 'shutdown emergency sequence stop' },
                      { syntax: 'Startup Sequence', desc: 'Step-by-step startup with checks', example: '// Startup Sequence\nCHECK Earth_Switch == 0\nIncomer_CB = 1\nWAIT(2000)\nCHECK Voltage_Bus > 10\nBus_Tie = 1\nWAIT(1000)\nFeeder1_CB = 1\nWAIT(500)\nFeeder2_CB = 1', tags: 'startup energize power on sequence' },
                      { syntax: 'Load Transfer', desc: 'Transfer load between sources', example: '// Transfer load from Source A to B\nSource_B_CB = 1\nWAIT(2000)\nCHECK Source_B_Voltage > 10\nSource_A_CB = 0\nWAIT(1000)\nCHECK Source_A_CB == 0\nTransfer_Complete = 1', tags: 'load transfer switch source changeover' },
                      { syntax: 'Tap Changer', desc: 'Transformer tap change operation', example: '// Raise tap position\nIF TR1_Voltage < 10.8\n  TR1_Tap_Raise = 1\n  WAIT(3000)\n  TR1_Tap_Raise = 0\nEND', tags: 'tap changer transformer voltage regulation oltc' },
                    ],
                  },
                  {
                    title: 'Display & Conditional',
                    items: [
                      { syntax: 'Formula Display', desc: 'Show calculated value (continuous mode)', example: '// Shows live calculated result\nVoltage_HV * Current_R * 1.732 / 1000', tags: 'formula display live value calculate' },
                      { syntax: 'Conditional Display', desc: 'Show different text based on tag value', example: 'IF CB_Status == 1 THEN "CLOSED"\nIF CB_Status == 0 THEN "OPEN"\nELSE "UNKNOWN"', tags: 'conditional display text status indicator' },
                      { syntax: 'Color based on value', desc: 'Change element color (Result Display = color)', example: 'IF Temperature > 85 THEN "#FF0000"\nIF Temperature > 70 THEN "#FFA500"\nELSE "#00FF00"', tags: 'color conditional red green amber status' },
                    ],
                  },
                  {
                    title: 'Electrical Formulas',
                    items: [
                      { syntax: "Ohm's Law", desc: 'V = I × R', example: 'Voltage = Current * Resistance', tags: 'ohm law voltage current resistance' },
                      { syntax: 'Line Loss', desc: 'P_loss = I² × R', example: 'Line_Loss = Current * Current * Resistance_Ohm / 1000', tags: 'line loss power i2r' },
                      { syntax: 'Voltage Drop', desc: 'Vd = I × (R×cosφ + X×sinφ) × L', example: 'V_Drop = Current * (R_per_km * PF + X_per_km * 0.6) * Length_km', tags: 'voltage drop cable line' },
                      { syntax: 'Short Circuit (MVA)', desc: 'MVAsc = kV² / Z', example: 'SC_MVA = Voltage_kV * Voltage_kV / Impedance', tags: 'short circuit fault mva impedance' },
                      { syntax: 'Capacitor Bank (kVAR)', desc: 'Q = V² × 2π × f × C', example: 'Cap_kVAR = Voltage * Voltage * 2 * 3.14159 * 50 * Capacitance / 1000000', tags: 'capacitor bank kvar reactive compensation' },
                      { syntax: 'Transformer Impedance', desc: 'Z = Vsc% × (kV²/MVA)', example: 'Z_ohm = Vsc_percent / 100 * (Voltage_kV * Voltage_kV / Rating_MVA)', tags: 'transformer impedance z percent' },
                      { syntax: 'Energy (kWh)', desc: 'E = P × t', example: 'Energy_kWh = Power_kW * Hours\nDaily_Energy = Avg_Load * 24', tags: 'energy kwh consumption units' },
                      { syntax: 'Frequency from RPM', desc: 'f = (N × P) / 120', example: 'Frequency = RPM * Poles / 120', tags: 'frequency rpm poles generator speed' },
                    ],
                  },
                  {
                    title: 'Timing & Triggers',
                    items: [
                      { syntax: 'Execute On: click', desc: 'Runs when user clicks the button', example: '// Button click → Trip breaker\nCB_Status = 0', tags: 'click button trigger manual' },
                      { syntax: 'Execute On: continuous', desc: 'Runs every render cycle (for live formulas)', example: '// Continuously calculate and display\nPower_kW * 24 / 1000', tags: 'continuous live auto formula' },
                      { syntax: 'Execute On: interval', desc: 'Runs every N seconds (set in properties)', example: '// Every 5 seconds, check temperature\nIF Temperature > 90\n  Alarm = 1\nEND', tags: 'interval timer periodic repeat' },
                      { syntax: 'Execute On: tagChange', desc: 'Runs when a specific tag value changes', example: '// When CB_Status changes:\nIF CB_Status == 0\n  Trip_Alarm = 1\n  WAIT(5000)\n  Trip_Alarm = 0\nEND', tags: 'tag change event trigger watch' },
                    ],
                  },
                ];

                return SECTIONS.map(section => {
                  const filtered = section.items.filter(item =>
                    !q || item.syntax.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.tags.includes(q)
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <div key={section.title} className="mb-6">
                      <h3 className="text-sm font-bold text-gray-800 mb-3 sticky top-0 bg-white py-1">{section.title}</h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {filtered.map((item, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:border-purple-300 hover:bg-purple-50/30 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <code className="text-xs font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">{item.syntax}</code>
                                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                              </div>
                              {selectedEl && ['action-button', 'script-runner', 'formula-display', 'sequence-trigger', 'conditional-display'].includes(selectedEl.type) && (
                                <button
                                  onClick={() => {
                                    const current = selectedEl.properties.script || '';
                                    const insert = item.example.split('\n')[0];
                                    updateElementProps(selectedEl.id, { script: current ? current + '\n' + insert : insert });
                                  }}
                                  className="text-[10px] px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 whitespace-nowrap shrink-0"
                                  title="Insert into script"
                                >
                                  + Insert
                                </button>
                              )}
                            </div>
                            <pre className="mt-2 text-[11px] font-mono bg-gray-900 text-green-400 p-2 rounded overflow-x-auto whitespace-pre leading-relaxed">{item.example}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }).filter(Boolean);
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">F1</kbd> Toggle reference •
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono ml-1">ESC</kbd> Close •
                Click <span className="text-purple-600 font-medium">+ Insert</span> to paste into script
              </div>
              <a href="/docs/GridVision-User-Guide.html" target="_blank" className="text-xs text-blue-600 hover:underline">View User Guide</a>
            </div>
          </div>
        </>
      )}

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

      {/* Custom Component Creator Dialog */}
      {showComponentCreator && projectId && (
        <CustomComponentCreator
          projectId={projectId}
          onClose={() => { setShowComponentCreator(false); setEditingComponent(null); }}
          onSaved={loadCustomComponents}
          editComponent={editingComponent}
        />
      )}

      {/* ── AI SLD Chat Panel ─────────────────────────────────────────────── */}
      {/* Floating toggle button */}
      <button
        onClick={() => setAiChatOpen(v => !v)}
        title="AI Chat — edit this SLD using natural language"
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl text-sm font-semibold transition-all
          ${aiChatOpen
            ? 'bg-purple-600 text-white'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:scale-105'}`}
      >
        <Sparkles className="w-4 h-4" />
        {aiChatOpen ? 'Close AI Chat' : 'AI Edit'}
      </button>

      {/* Chat Panel */}
      {aiChatOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl border border-purple-200 flex flex-col overflow-hidden"
          style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Bot className="w-5 h-5" />
              <div>
                <div className="text-sm font-bold">AI SLD Editor</div>
                <div className="text-xs text-purple-200">{elements.length} elements · {tags.length} tags</div>
              </div>
            </div>
            <button onClick={() => setAiChatOpen(false)} className="text-white/70 hover:text-white text-lg leading-none">×</button>
          </div>

          {/* Suggested prompts (shown when empty) */}
          {aiMessages.length === 0 && (
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Add a new VCB feeder called NTPC-3',
                  'Add a transformer called TR-3 (10MVA)',
                  'Rename BCJ to BCJ-NEW',
                  'Remove the SPARE bay',
                  'Add a solar feeder after FBC',
                  'Change busbar voltage to 33kV',
                ].map(s => (
                  <button key={s} onClick={() => setAiInput(s)}
                    className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full hover:bg-purple-100 transition-colors border border-purple-200">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {aiMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed
                  ${m.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm flex items-start gap-1.5'}`}>
                  {m.role === 'ai' && <Sparkles className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" />}
                  {m.text}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                  </div>
                  <span className="text-xs text-gray-400">AI is editing your SLD...</span>
                </div>
              </div>
            )}
            <div ref={aiChatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <div className="flex gap-2">
              <input
                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 bg-white"
                placeholder="Describe what to change..."
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiChat(); } }}
                disabled={aiLoading}
              />
              <button
                onClick={sendAiChat}
                disabled={!aiInput.trim() || aiLoading}
                className="px-3 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">Changes auto-saved. Ctrl+Z to undo.</p>
          </div>
        </div>
      )}
      {/* ── End AI SLD Chat Panel ─────────────────────────────────────────── */}
    </div>
  );
}
