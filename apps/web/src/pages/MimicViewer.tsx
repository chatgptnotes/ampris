import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useRealtimeStore } from '@/stores/realtimeStore';
import { useAuthStore } from '@/stores/authStore';
import {
  Maximize,
  Minimize,
  Pencil,
  ChevronLeft,
  Users,
  Tags,
} from 'lucide-react';
import * as ScadaSymbols from '@/components/scada-symbols';
import { FACEPLATE_MAP, CBFaceplate, TransformerFaceplate, GeneratorFaceplate, MotorFaceplate, MeterFaceplate, GenericFaceplate } from '@/components/faceplates';

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

interface PageSettings {
  header: {
    show: boolean;
    logoUrl: string;
    title: string;
    subtitle?: string;
    bgColor: string;
    textColor?: string;
    height?: number;
  };
  footer: {
    show: boolean;
    customText: string;
    bgColor: string;
    textColor?: string;
    height?: number;
    showAlarmBanner?: boolean;
    showTrendStrip?: boolean;
    showStatusBar?: boolean;
  };
}

interface PageData {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  elements: MimicElement[];
  connections: MimicConnection[];
  pageSettings?: PageSettings;
}

interface ProjectData {
  id: string;
  name: string;
  mimicPages: { id: string; name: string; pageOrder: number; isHomePage: boolean }[];
  userRole: string;
}

export default function MimicViewer() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [page, setPage] = useState<PageData | null>(null);
  const [activePageId, setActivePageId] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<MimicElement | null>(null);
  const [faceplates, setFaceplates] = useState<{ element: MimicElement; x: number; y: number; pinned: boolean }[]>([]);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const values = useRealtimeStore((s) => s.values);
  const user = useAuthStore((s) => s.user);
  const [showTagValues, setShowTagValues] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pageSettings, setPageSettings] = useState<PageSettings>({
    header: { show: true, logoUrl: '/gridvision-logo.jpg', title: 'GridVision SCADA', subtitle: '', bgColor: '#1E293B', textColor: '#FFFFFF', height: 50 },
    footer: { show: true, customText: 'GridVision SCADA', bgColor: '#1E293B', textColor: '#FFFFFF', showAlarmBanner: true, showStatusBar: true },
  });
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  // Rolling history buffer for sparklines: tag -> last 60 {v,t} entries
  const tagHistoryRef = useRef<Record<string, { v: number; t: number }[]>>({});

  // Save current projectId to localStorage for sidebar navigation
  useEffect(() => {
    if (projectId) localStorage.setItem('gridvision-last-project', projectId);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setProject(data);
      const home = data.mimicPages?.find((p: any) => p.isHomePage) || data.mimicPages?.[0];
      if (home) setActivePageId(home.id);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !activePageId) return;
    api.get(`/projects/${projectId}/pages/${activePageId}`).then(({ data }) => {
      setPage(data);
      if (data.pageSettings) {
        setPageSettings(prev => ({
          header: { ...prev.header, ...data.pageSettings.header },
          footer: { ...prev.footer, ...data.pageSettings.footer },
        }));
      }
    });
  }, [projectId, activePageId]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      fullscreenRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Sync fullscreen state with browser
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Live datetime clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Client-side tag simulator — fetches ALL project tags and simulates values
  useEffect(() => {
    if (!projectId) return;
    const store = useRealtimeStore.getState();
    let tagDefs: Record<string, any> = {};
    let allTagNames = new Set<string>();
    let started = false;

    // 1. Fetch ALL tags for this project
    api.get(`/tags?projectId=${projectId}`).then(({ data }) => {
      if (Array.isArray(data)) {
        data.forEach((t: any) => { 
          tagDefs[t.name] = t; 
          allTagNames.add(t.name);
        });
      }
    }).catch(() => {
      // Server not available — will use element bindings only
    }).finally(() => {
      // 2. Also collect tag names from page elements (in case tags aren't in DB)
      if (page) {
        (page.elements as MimicElement[]).forEach(el => {
          if (el.properties.tagBinding) allTagNames.add(el.properties.tagBinding);
          if (el.properties.targetTag) allTagNames.add(el.properties.targetTag);
          if (el.properties.tag1) allTagNames.add(el.properties.tag1);
          if (el.properties.tag2) allTagNames.add(el.properties.tag2);
          if (el.properties.watchTag) allTagNames.add(el.properties.watchTag);
          const bindings = el.properties.tagBindings as Record<string, string> | undefined;
          if (bindings) Object.values(bindings).forEach(t => { if (t) allTagNames.add(t); });
        });
      }
      started = true;
    });

    // 3. Simulate values every second
    const simTimer = setInterval(() => {
      if (!started || allTagNames.size === 0) return;
      const t = Date.now() / 1000;

      allTagNames.forEach(tagName => {
        const def = tagDefs[tagName];
        let value: number;
        
        if (def) {
          const min = def.minValue ?? 0;
          const max = def.maxValue ?? 100;
          const amp = def.simAmplitude ?? (max - min) / 2;
          const offset = def.simOffset ?? (min + max) / 2;
          const freq = def.simFrequency ?? 0.1;
          const pattern = def.simPattern || 'rand';

          if (pattern === 'rand' || pattern === 'random') {
            // For rand: generate smoothly varying random within range
            const prev = store.getValue(tagName);
            const prevVal = prev && typeof (prev as any).value === 'number' ? (prev as any).value : (min + max) / 2;
            const step = (max - min) * 0.05; // 5% of range per tick
            value = prevVal + (Math.random() - 0.5) * 2 * step;
            value = Math.max(min, Math.min(max, value));
          } else if (pattern === 'sine') {
            value = offset + amp * Math.sin(2 * Math.PI * freq * t);
          } else if (pattern === 'ramp') {
            value = min + ((t * freq * (max - min)) % (max - min));
          } else if (pattern === 'square') {
            value = Math.sin(2 * Math.PI * freq * t) >= 0 ? max : min;
          } else {
            value = offset + amp * Math.sin(2 * Math.PI * freq * t);
          }
          value = Math.round(value * 100) / 100;
        } else {
          // No definition — random walk 0-100
          const prev = store.getValue(tagName);
          const prevVal = prev && typeof (prev as any).value === 'number' ? (prev as any).value : 50;
          value = Math.max(0, Math.min(100, prevVal + (Math.random() - 0.5) * 10));
          value = Math.round(value * 100) / 100;
        }

        store.updateValue({ tag: tagName, value, timestamp: new Date().toISOString(), quality: 'GOOD' } as any);
      });
    }, 1000);

    return () => clearInterval(simTimer);
  }, [projectId, page]);

  // Evaluate animation rules
  const getAnimatedStyle = (el: MimicElement): Record<string, string> => {
    const style: Record<string, string> = {};
    if (!el.properties.animationRules || !el.properties.tagBinding) return style;
    const tagValue = tv(el.properties.tagBinding);
    if (tagValue === undefined) return style;
    const numValue = typeof tagValue === 'number' ? tagValue : parseFloat(String(tagValue));
    for (const rule of el.properties.animationRules) {
      try {
        const match = rule.condition.match(/^(>|<|>=|<=|==|!=)\s*(.+)$/);
        if (!match) continue;
        const [, op, threshold] = match;
        const thr = parseFloat(threshold);
        let result = false;
        if (op === '>' && numValue > thr) result = true;
        if (op === '<' && numValue < thr) result = true;
        if (op === '>=' && numValue >= thr) result = true;
        if (op === '<=' && numValue <= thr) result = true;
        if (op === '==' && numValue === thr) result = true;
        if (op === '!=' && numValue !== thr) result = true;
        if (result) {
          style[rule.property] = rule.value;
        }
      } catch {
        // ignore invalid rules
      }
    }
    return style;
  };

  // Resolve conditional color based on tag value and color rules
  const resolveConditionalColor = (el: MimicElement): string | undefined => {
    if (!el.properties.tagBinding || !el.properties.colorRules?.length) return undefined;
    const tagValue = tv(el.properties.tagBinding);
    if (tagValue === undefined) return undefined;

    for (const rule of el.properties.colorRules) {
      const v = isNaN(Number(rule.value)) ? rule.value : Number(rule.value);
      const tv = isNaN(Number(tagValue)) ? tagValue : Number(tagValue);
      let match = false;
      switch (rule.condition) {
        case '==': match = tv == v; break;
        case '!=': match = tv != v; break;
        case '>': match = tv > v; break;
        case '<': match = tv < v; break;
        case '>=': match = tv >= v; break;
        case '<=': match = tv <= v; break;
      }
      if (match) return rule.color;
    }
    return undefined;
  };

  // SBO state
  const [sboConfigs, setSboConfigs] = useState<Record<string, any>>({});
  const [sboSelected, setSboSelected] = useState<Record<string, { value: any; timeout: number; startedAt: number }>>({});

  // Load SBO configs
  useEffect(() => {
    if (!projectId) return;
    api.get('/sbo/configs', { params: { projectId } }).then(({ data }) => {
      const map: Record<string, any> = {};
      for (const c of data) { if (c.enabled) map[c.tagName] = c; }
      setSboConfigs(map);
    }).catch(() => {});
  }, [projectId]);

  // SBO countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSboSelected(prev => {
        const next = { ...prev };
        let changed = false;
        for (const tag of Object.keys(next)) {
          const elapsed = (Date.now() - next[tag].startedAt) / 1000;
          if (elapsed >= next[tag].timeout) {
            delete next[tag];
            changed = true;
            api.post('/sbo/cancel', { tagName: tag }).catch(() => {});
          }
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const handleSBOOperate = useCallback(async (tag: string) => {
    try {
      await api.post('/sbo/operate', { tagName: tag });
      setSboSelected(prev => { const next = { ...prev }; delete next[tag]; return next; });
    } catch (err) { console.error('SBO operate failed:', err); }
  }, []);

  const handleSBOCancel = useCallback(async (tag: string) => {
    try {
      await api.post('/sbo/cancel', { tagName: tag });
      setSboSelected(prev => { const next = { ...prev }; delete next[tag]; return next; });
    } catch (err) { console.error('SBO cancel failed:', err); }
  }, []);

  // Collect tag history for sparklines
  useEffect(() => {
    const now = Date.now();
    Object.entries(values).forEach(([tag, data]: [string, any]) => {
      const v = typeof data?.value === 'number' ? data.value : parseFloat(String(data?.value ?? ''));
      if (isNaN(v)) return;
      const hist = tagHistoryRef.current[tag] || [];
      const last = hist[hist.length - 1];
      if (!last || last.v !== v || now - last.t > 5000) {
        tagHistoryRef.current[tag] = [...hist, { v, t: now }].slice(-60);
      }
    });
  }, [values]);

  // Non-passive wheel listener for zoom-only (prevents page scroll)
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewZoom(z => Math.max(0.1, Math.min(10, z * delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Handle control element clicks
  const handleControlClick = useCallback(async (el: MimicElement) => {
    const tag = el.properties.targetTag;
    const action = el.properties.controlAction || 'setValue';
    // Navigation/script actions don't need a tag binding
    const noTagNeeded = ['script', 'pagegoto', 'page_back', 'page_home'].includes(action);
    if (!tag && !noTagNeeded) return;

    // Check if SBO is enabled for this tag
    if (sboConfigs[tag] && !sboSelected[tag]) {
      // SBO: first click = SELECT
      let pendingValue: any;
      if (action === 'toggle') {
        const currentVal = tv(tag);
        const current = currentVal !== undefined ? currentVal : false;
        pendingValue = !(current === true || current === 'true' || current === 1 || current === '1');
      } else if (action === 'increment') {
        const currentVal = tv(tag);
        const current = typeof currentVal === 'number' ? currentVal : parseFloat(String(currentVal)) || 0;
        pendingValue = current + (parseFloat(el.properties.controlValue || '1') || 1);
      } else {
        const v = el.properties.controlValue;
        const numV = Number(v);
        pendingValue = isNaN(numV) ? v : numV;
      }
      try {
        const { data } = await api.post('/sbo/select', { tagName: tag, value: pendingValue, projectId });
        if (data.success) {
          setSboSelected(prev => ({
            ...prev,
            [tag]: { value: pendingValue, timeout: sboConfigs[tag].selectTimeout || 30, startedAt: Date.now() },
          }));
        }
      } catch (err) { console.error('SBO select failed:', err); }
      return;
    }

    // If SBO selected, the operate/cancel buttons handle it, not another click
    if (sboSelected[tag]) return;

    try {
      if (action === 'toggle') {
        const currentVal = tv(tag);
        const current = currentVal !== undefined ? currentVal : false;
        const newVal = !(current === true || current === 'true' || current === 1 || current === '1');
        await api.post('/tags/by-name/set-value', { tagName: tag, value: newVal });
      } else if (action === 'increment') {
        const currentVal = tv(tag);
        const current = typeof currentVal === 'number' ? currentVal : parseFloat(String(currentVal)) || 0;
        const inc = parseFloat(el.properties.controlValue || '1') || 1;
        await api.post('/tags/by-name/set-value', { tagName: tag, value: current + inc });
      } else if (action === 'script') {
        // Provide pagegoto and page_back functions in script context
        const scriptCode = el.properties.controlScript || '';
        if (scriptCode.includes('pagegoto') || scriptCode.includes('page_back')) {
          // Execute locally with page navigation functions
          const pagegoto = (pageName: string) => {
            const targetPage = project?.mimicPages?.find((p: any) => p.name === pageName || p.id === pageName);
            if (targetPage) setActivePageId(targetPage.id);
            else console.warn('Page not found:', pageName);
          };
          const page_back = () => {
            const pages = project?.mimicPages || [];
            const currentIndex = pages.findIndex((p: any) => p.id === activePageId);
            if (currentIndex > 0) setActivePageId(pages[currentIndex - 1].id);
            else if (pages.length > 0) setActivePageId(pages[0].id);
          };
          const page_home = () => {
            const home = project?.mimicPages?.find((p: any) => p.isHomePage) || project?.mimicPages?.[0];
            if (home) setActivePageId(home.id);
          };
          try { new Function('pagegoto', 'page_back', 'page_home', scriptCode)(pagegoto, page_back, page_home); }
          catch (e) { console.error('Script error:', e); }
        } else {
          await api.post('/tags/execute-script', { code: scriptCode });
        }
      } else if (action === 'pagegoto') {
        const targetPageName = el.properties.controlValue || '';
        const targetPage = project?.mimicPages?.find((p: any) => p.name === targetPageName || p.id === targetPageName);
        if (targetPage) setActivePageId(targetPage.id);
        else console.warn('Page not found:', targetPageName);
      } else if (action === 'page_back') {
        const pages = project?.mimicPages || [];
        const currentIndex = pages.findIndex((p: any) => p.id === activePageId);
        if (currentIndex > 0) setActivePageId(pages[currentIndex - 1].id);
        else if (pages.length > 0) setActivePageId(pages[0].id);
      } else if (action === 'page_home') {
        const home = project?.mimicPages?.find((p: any) => p.isHomePage) || project?.mimicPages?.[0];
        if (home) setActivePageId(home.id);
      } else {
        // setValue
        const v = el.properties.controlValue;
        const numV = Number(v);
        await api.post('/tags/by-name/set-value', { tagName: tag, value: isNaN(numV) ? v : numV });
      }
    } catch (err) {
      console.error('Control action failed:', err);
    }
  }, [values, sboConfigs, sboSelected, projectId]);

  const handleNavClick = useCallback((el: MimicElement) => {
    if (el.type === 'page-link' && el.properties.targetPageId) {
      setActivePageId(el.properties.targetPageId);
    } else if (el.type === 'back-button') {
      window.history.back();
    } else if (el.type === 'home-button') {
      const home = project?.mimicPages?.find((p) => p.isHomePage) || project?.mimicPages?.[0];
      if (home) setActivePageId(home.id);
    }
  }, [project]);

  // Helper: extract numeric/string value from RealTimeValue object
  const tv = (tagName: string | undefined): any => {
    if (!tagName) return undefined;
    const raw = values[tagName];
    if (raw && typeof raw === 'object' && 'value' in raw) return (raw as any).value;
    return raw;
  };

  const renderElement = (el: MimicElement) => {
    try {
    const animated = getAnimatedStyle(el);
    const tagKey = el.properties?.tagBinding || el.properties?.targetTag;
    const tagRaw = tagKey ? values[tagKey] : undefined;
    const tagValue = tagRaw && typeof tagRaw === 'object' && 'value' in tagRaw ? (tagRaw as any).value : tagRaw;
    const isNav = ['page-link', 'back-button', 'home-button'].includes(el.type);
    const isCtrl = el.type.startsWith('ctrl-');
    const is3D = el.type.startsWith('3d-');
    const conditionalColor = resolveConditionalColor(el);

    return (
      <g
        key={el.id}
        transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}, ${el.width / 2}, ${el.height / 2})`}
        onClick={(e) => {
          e.stopPropagation();
          if (isCtrl || is3D) {
            handleControlClick(el);
          } else if (isNav) {
            handleNavClick(el);
          } else if (el.type !== 'text' && el.type !== 'shape') {
            setSelectedEquipment(el);
          }
        }}
        style={{ cursor: isNav || isCtrl || (el.type !== 'text' && el.type !== 'shape') ? 'pointer' : 'default' }}
      >
        {el.type === 'text' ? (
          <text
            x={0}
            y={el.properties.fontSize || 14}
            fontSize={el.properties.fontSize || 14}
            fill={conditionalColor || animated.color || el.properties.color || '#000'}
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
              fill={conditionalColor || animated.fill || el.properties.fill || '#E5E7EB'}
              stroke={conditionalColor || animated.stroke || el.properties.stroke || '#6B7280'}
              strokeWidth={el.properties.strokeWidth || 2}
            />
          ) : el.properties.shapeType === 'line' ? (
            <line
              x1={0} y1={0} x2={el.width} y2={el.height}
              stroke={conditionalColor || animated.stroke || el.properties.stroke || '#374151'}
              strokeWidth={el.properties.strokeWidth || 2}
            />
          ) : (
            <rect
              width={el.width}
              height={el.height}
              fill={conditionalColor || animated.fill || el.properties.fill || '#E5E7EB'}
              stroke={conditionalColor || animated.stroke || el.properties.stroke || '#6B7280'}
              strokeWidth={el.properties.strokeWidth || 2}
              rx={4}
            />
          )
        ) : el.type === 'trend-banner' ? (() => {
          const tag = el.properties.tagBinding || el.properties.targetTag || '';
          const hist = tagHistoryRef.current[tag] || [];
          const label = el.properties.label || tag || 'Trend';
          const curVal = tag ? tv(tag) : undefined;
          const bg = el.properties.bgColor || '#0f172a';
          const lc = el.properties.lineColor || '#22d3ee';
          const w = el.width, h = el.height;
          const px = 8, py = 6, lh = 14;
          const cw = w - px * 2, ch = h - py * 2 - lh;
          let path = '', pathFill = '', minV = 0, maxV = 1;
          if (hist.length >= 2) {
            const vals = hist.map((p: {v:number;t:number}) => p.v);
            minV = Math.min(...vals); maxV = Math.max(...vals);
            const rng = maxV - minV || 1;
            const pts = hist.map((p: {v:number;t:number}, i: number) => {
              const x = px + (i / (hist.length - 1)) * cw;
              const y = py + lh + ch - ((p.v - minV) / rng) * ch;
              return { x, y };
            });
            path = pts.map((p: {x:number;y:number}, i: number) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
            const last = pts[pts.length - 1];
            pathFill = path + ' L' + (px + cw).toFixed(1) + ',' + (py + lh + ch).toFixed(1) + ' L' + px + ',' + (py + lh + ch).toFixed(1) + ' Z';
          }
          return (
            <g>
              <rect width={w} height={h} fill={bg} rx={4} opacity={0.95} />
              {[0.25, 0.5, 0.75].map((f: number) => (
                <line key={f} x1={px} y1={py + lh + ch * (1 - f)} x2={w - px} y2={py + lh + ch * (1 - f)} stroke="rgba(255,255,255,0.07)" strokeWidth={0.5} />
              ))}
              {hist.length >= 2 && <path d={pathFill} fill={lc + '22'} />}
              {hist.length >= 2 && <path d={path} fill="none" stroke={lc} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
              {hist.length < 2 && (
                <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)" fontFamily="monospace">
                  {tag ? 'Waiting for data...' : 'No tag bound'}
                </text>
              )}
              <text x={px} y={py + 10} fontSize={9} fill="rgba(255,255,255,0.55)" fontFamily="monospace" fontWeight="bold">{label}</text>
              {curVal !== undefined && (
                <text x={w - px} y={py + 10} textAnchor="end" fontSize={9} fill={lc} fontFamily="monospace" fontWeight="bold">
                  {typeof curVal === 'number' ? (curVal as number).toFixed(2) : String(curVal)}
                </text>
              )}
              {hist.length >= 2 && (
                <text x={px} y={h - 2} fontSize={7} fill="rgba(255,255,255,0.3)" fontFamily="monospace">{minV.toFixed(1)}</text>
              )}
              {hist.length >= 2 && (
                <text x={w - px} y={h - 2} textAnchor="end" fontSize={7} fill="rgba(255,255,255,0.3)" fontFamily="monospace">{maxV.toFixed(1)}</text>
              )}
            </g>
          );
        })()
        : el.type === 'value-display' ? (
          <g>
            <rect width={el.width} height={el.height} fill="#F0F9FF" stroke="#3B82F6" strokeWidth={1} rx={4} />
            <text x={el.width / 2} y={el.height / 2 + 5} textAnchor="middle" fontSize={12} fill="#1E40AF" fontFamily="monospace">
              {tagValue !== undefined ? String(tagValue) : '---'}
            </text>
          </g>
        ) : is3D ? (
          <g>
            <foreignObject width={el.width} height={el.height}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {el.type === '3d-push-button' && (
                  <div
                    onMouseDown={(e) => { const t = e.currentTarget; t.style.transform = 'translateY(2px)'; t.style.boxShadow = '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)'; }}
                    onMouseUp={(e) => { e.stopPropagation(); const t = e.currentTarget; t.style.transform = ''; t.style.boxShadow = ''; handleControlClick(el); }}
                    onMouseLeave={(e) => { const t = e.currentTarget; t.style.transform = ''; t.style.boxShadow = ''; }}
                    style={{
                      width: '90%', height: '75%', borderRadius: 6,
                      background: `linear-gradient(180deg, ${conditionalColor || el.properties.buttonColor || '#6B7280'}, ${(conditionalColor || el.properties.buttonColor) ? (conditionalColor || el.properties.buttonColor) + 'CC' : '#4B5563'})`,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.4), 0 2px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
                      border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', userSelect: 'none' as any, transition: 'all 0.1s ease',
                      color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'sans-serif',
                    }}>
                    {el.properties.buttonText || el.properties.label || 'PUSH'}
                  </div>
                )}
                {el.type === '3d-toggle-switch' && (
                  <div onClick={(e) => { e.stopPropagation(); handleControlClick(el); }} style={{
                    width: '85%', height: '65%', borderRadius: 20,
                    background: tv(el.properties.targetTag) ? 'linear-gradient(180deg, #065f46, #064e3b)' : 'linear-gradient(180deg, #1f2937, #111827)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid #444', display: 'flex', alignItems: 'center', padding: '0 4px',
                    position: 'relative' as any, cursor: 'pointer', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: '45%', height: '80%', borderRadius: 16,
                      background: tv(el.properties.targetTag) ? 'linear-gradient(180deg, #34d399, #10b981)' : 'linear-gradient(180deg, #9ca3af, #6b7280)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                      transition: 'margin-left 0.2s ease',
                      marginLeft: tv(el.properties.targetTag) ? '50%' : '0%',
                    }} />
                    <span style={{ position: 'absolute' as any, right: tv(el.properties.targetTag) ? undefined : 8, left: tv(el.properties.targetTag) ? 8 : undefined, color: '#9ca3af', fontSize: 8, fontWeight: 'bold' }}>
                      {tv(el.properties.targetTag) ? 'ON' : 'OFF'}
                    </span>
                  </div>
                )}
                {el.type === '3d-emergency-stop' && (
                  <div
                    onMouseDown={(e) => { const t = e.currentTarget; t.style.transform = 'translateY(4px)'; t.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.3)'; }}
                    onMouseUp={(e) => { const t = e.currentTarget; t.style.transform = ''; t.style.boxShadow = ''; handleControlClick(el); }}
                    onMouseLeave={(e) => { const t = e.currentTarget; t.style.transform = ''; t.style.boxShadow = ''; }}
                    style={{
                      width: '90%', height: '90%', borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 35%, #ef4444, #991b1b, #7f1d1d)',
                      boxShadow: '0 6px 12px rgba(0,0,0,0.5), 0 3px 0 #a3a3a3, inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.15)',
                      border: '3px solid #a3a3a3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.1s ease',
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
                      (el.properties.lampColor === 'red' || (el.properties.targetTag && tv(el.properties.targetTag))) ? '#fca5a5, #ef4444, #991b1b' :
                      el.properties.lampColor === 'amber' ? '#fcd34d, #f59e0b, #b45309' :
                      el.properties.lampColor === 'blue' ? '#93c5fd, #3b82f6, #1e40af' :
                      '#86efac, #22c55e, #166534'
                    })`,
                    boxShadow: `0 0 12px ${
                      (el.properties.lampColor === 'red' || (el.properties.targetTag && tv(el.properties.targetTag))) ? 'rgba(239,68,68,0.6)' :
                      el.properties.lampColor === 'amber' ? 'rgba(245,158,11,0.6)' :
                      el.properties.lampColor === 'blue' ? 'rgba(59,130,246,0.6)' :
                      'rgba(34,197,94,0.6)'
                    }, inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)`,
                    border: '2px solid #555', transition: 'all 0.3s',
                  }} />
                )}
                {el.type === '3d-rocker-switch' && (
                  <div onClick={(e) => { e.stopPropagation(); handleControlClick(el); }} style={{
                    width: '80%', height: '70%', borderRadius: 4,
                    background: 'linear-gradient(180deg, #374151, #1f2937)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1)',
                    border: '1px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}>
                    <div style={{
                      width: '70%', height: '70%', borderRadius: 3,
                      background: tv(el.properties.targetTag) ? 'linear-gradient(180deg, #d1d5db, #9ca3af)' : 'linear-gradient(0deg, #9ca3af, #d1d5db)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
                      transform: tv(el.properties.targetTag) ? 'perspective(100px) rotateX(-15deg)' : 'perspective(100px) rotateX(15deg)',
                      transition: 'all 0.15s ease',
                    }} />
                  </div>
                )}
                {el.type === '3d-rotary-selector' && (
                  <div onClick={(e) => { e.stopPropagation(); handleControlClick(el); }} style={{
                    width: '85%', height: '85%', borderRadius: '50%',
                    background: 'linear-gradient(145deg, #4b5563, #374151)',
                    boxShadow: '0 3px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                    border: '2px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative' as any, cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 4, height: '35%', background: '#d1d5db', borderRadius: 2,
                      position: 'absolute' as any, top: '10%',
                      transform: `rotate(${(parseInt(String(el.properties.selectorPosition || tv(el.properties.targetTag) || 0)) % 3) * 120 - 120}deg)`,
                      transformOrigin: 'bottom center',
                      boxShadow: '0 0 2px rgba(0,0,0,0.5)', transition: 'transform 0.2s',
                    }} />
                    <span style={{ color: '#9ca3af', fontSize: 7, position: 'absolute' as any, bottom: 4, fontWeight: 'bold' }}>
                      {['OFF', 'LOCAL', 'REMOTE'][parseInt(String(el.properties.selectorPosition || tv(el.properties.targetTag) || 0)) % 3]}
                    </span>
                  </div>
                )}
              </div>
            </foreignObject>
          </g>
        ) : isCtrl ? (
          <g>
            <rect
              width={el.width}
              height={el.height}
              fill={conditionalColor || el.properties.buttonColor || '#3B82F6'}
              stroke="#1E3A5F"
              strokeWidth={1.5}
              rx={6}
              className="hover:opacity-80 transition-opacity"
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
                <text x={(el.width - 36) / 2 + 4} y={el.height / 2 + 4} textAnchor="middle" fontSize={10} fill="#6B7280" fontFamily="monospace">
                  {tagValue !== undefined ? String(tagValue) : '0.00'}
                </text>
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
                {el.properties.buttonText || el.properties.label || 'Button'}
              </text>
            )}
          </g>
        ) : isNav ? (
          <g>
            <rect
              width={el.width}
              height={el.height}
              fill={conditionalColor || el.properties.buttonColor || '#3B82F6'}
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
        ) : el.type === 'BusBar' && el.properties.relX1 !== undefined ? (
          <g>
            <line
              x1={el.properties.relX1}
              y1={el.properties.relY1}
              x2={el.properties.relX2}
              y2={el.properties.relY2}
              stroke={conditionalColor || el.properties.color || '#333'}
              strokeWidth={el.properties.busWidth || 6}
              strokeLinecap="round"
            />
            <circle cx={el.properties.relX1} cy={el.properties.relY1} r={4} fill={conditionalColor || el.properties.color || '#333'} stroke="#fff" strokeWidth={1.5} />
            <circle cx={el.properties.relX2} cy={el.properties.relY2} r={4} fill={conditionalColor || el.properties.color || '#333'} stroke="#fff" strokeWidth={1.5} />
            {tagValue !== undefined && el.properties.tagBinding && (
              <text
                x={(el.properties.relX1 + el.properties.relX2) / 2}
                y={Math.min(el.properties.relY1, el.properties.relY2) - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#2563EB"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {String(tagValue)}
              </text>
            )}
          </g>
        ) : el.type === 'custom-component' && el.properties.svgCode ? (
          <foreignObject width={el.width} height={el.height}>
            <div style={{ width: el.width, height: el.height }} dangerouslySetInnerHTML={{ __html: el.properties.svgCode }} />
          </foreignObject>
        ) : SYMBOL_MAP[el.type] ? (
          <g>
            <foreignObject width={el.width} height={el.height}>
              <div style={{ width: el.width, height: el.height }}>
                {React.createElement(SYMBOL_MAP[el.type], {
                  width: el.width,
                  height: el.height,
                  // Resolve state from tag binding for switchgear symbols
                  ...((() => {
                    const stateTag = el.properties.tagBindings?.state || el.properties.tagBinding;
                    if (!stateTag) return el.properties.state ? { state: el.properties.state } : {};
                    const val = tv(stateTag);
                    if (val === undefined || val === null) return el.properties.state ? { state: el.properties.state } : {};
                    // Map tag values to states
                    const v = String(val).toUpperCase();
                    if (['OPEN', 'CLOSED', 'TRIPPED', 'ON', 'OFF', 'RUNNING', 'STOPPED', 'FAULT', 'ENERGIZED', 'DE-ENERGIZED'].includes(v)) return { state: v };
                    // Numeric: 0=OPEN, 1=CLOSED, 2=TRIPPED
                    const n = Number(val);
                    if (n === 0) return { state: 'OPEN' };
                    if (n === 1) return { state: 'CLOSED' };
                    if (n === 2) return { state: 'TRIPPED' };
                    return { state: v };
                  })()),
                  ...(conditionalColor ? { color: conditionalColor } : {}),
                  ...(el.properties.label ? { label: el.properties.label } : {}),
                  ...(el.properties.rotation ? { rotation: el.properties.rotation } : {}),
                  ...(el.type === 'Transformer' ? {
                    hvLabel: el.properties.tagBindings?.hvVoltage
                      ? `${tv(el.properties.tagBindings?.hvVoltage) ?? '...'} kV`
                      : el.properties.hvTag
                        ? `${tv(el.properties.hvTag) ?? '...'} kV`
                        : el.properties.hvRating || undefined,
                    lvLabel: el.properties.tagBindings?.lvVoltage
                      ? `${tv(el.properties.tagBindings?.lvVoltage) ?? '...'} kV`
                      : el.properties.lvTag
                        ? `${tv(el.properties.lvTag) ?? '...'} kV`
                        : el.properties.lvRating || undefined,
                    mvaLabel: el.properties.tagBindings?.mvaRating
                      ? `${tv(el.properties.tagBindings?.mvaRating) ?? '...'} MVA`
                      : el.properties.mvaTag
                        ? `${tv(el.properties.mvaTag) ?? '...'} MVA`
                        : el.properties.mvaRating || undefined,
                  } : {}),
                })}
              </div>
            </foreignObject>
            {/* Tag value overlay (pill) - shown when tag values labels are off */}
            {tagValue !== undefined && el.properties.tagBinding && !showTagValues && (
              <g>
                <rect
                  x={el.width / 2 - Math.max(String(tagValue).length * 4 + 8, 24) / 2}
                  y={-16}
                  width={Math.max(String(tagValue).length * 4 + 8, 24)}
                  height={14}
                  rx={3}
                  fill="#1E293B"
                  opacity={0.85}
                />
                <text
                  x={el.width / 2}
                  y={-6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#60A5FA"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {String(tagValue)}
                </text>
              </g>
            )}
            {/* Live tag value labels on symbols */}
            {showTagValues && (() => {
              const bindings = el.properties.tagBindings;
              const isXfmr = ['Transformer', 'AutoTransformer', 'ZigZagTransformer'].includes(el.type);
              if (isXfmr && bindings) {
                const hvVal = bindings.hvVoltage ? tv(bindings.hvVoltage as string) : undefined;
                const lvVal = bindings.lvVoltage ? tv(bindings.lvVoltage as string) : undefined;
                return (
                  <g>
                    {hvVal !== undefined && (
                      <text x={el.width / 2} y={-4} textAnchor="middle" fontSize={10} fill="#1E40AF" fontFamily="monospace">{`HV: ${hvVal}`}</text>
                    )}
                    {lvVal !== undefined && (
                      <text x={el.width / 2} y={el.height + 12} textAnchor="middle" fontSize={10} fill="#1E40AF" fontFamily="monospace">{`LV: ${lvVal}`}</text>
                    )}
                  </g>
                );
              }
              if (bindings && Object.keys(bindings).length > 0) {
                return (
                  <g>
                    {Object.entries(bindings).map(([suffix, tagName], i) => {
                      const val = tv(tagName as string);
                      if (val === undefined) return null;
                      return (
                        <text key={suffix} x={el.width / 2} y={el.height + 12 + i * 12} textAnchor="middle" fontSize={10} fill="#1E40AF" fontFamily="monospace">
                          {`${suffix}: ${val}`}
                        </text>
                      );
                    })}
                  </g>
                );
              }
              if (tagValue !== undefined && el.properties.tagBinding) {
                return (
                  <text x={el.width / 2} y={el.height + 12} textAnchor="middle" fontSize={10} fill="#1E40AF" fontFamily="monospace">
                    {String(tagValue)}
                  </text>
                );
              }
              return null;
            })()}
          </g>
        ) : (
          <g>
            <rect
              width={el.width}
              height={el.height}
              fill={animated.fill || '#F8FAFC'}
              stroke={animated.stroke || animated.color || '#94A3B8'}
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
            {el.properties.label && (
              <text x={el.width / 2} y={el.height + 14} textAnchor="middle" fontSize={10} fill="#64748B" fontFamily="sans-serif">
                {el.properties.label}
              </text>
            )}
            {tagValue !== undefined && (
              <text x={el.width / 2} y={-6} textAnchor="middle" fontSize={9} fill="#2563EB" fontFamily="monospace" fontWeight="bold">
                {String(tagValue)}
              </text>
            )}
          </g>
        )}
      </g>
    );
    } catch (err) {
      console.error('Error rendering element:', el.id, el.type, err);
      return (
        <g key={el.id} transform={`translate(${el.x}, ${el.y})`}>
          <rect width={el.width} height={el.height} fill="#FEE2E2" stroke="#EF4444" strokeWidth={1} rx={4} />
          <text x={el.width/2} y={el.height/2} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="#EF4444">Error</text>
        </g>
      );
    }
  };

  const canEdit = project && ['OWNER', 'ADMIN'].includes(project.userRole);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div ref={fullscreenRef} className={`flex flex-col h-full ${isFullscreen ? 'bg-black' : 'bg-gray-100'}`}>
      {/* Top Bar - hidden in fullscreen */}
      {!isFullscreen && (
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => navigate('/app/projects')} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-gray-700">{project?.name}</span>

        {/* Page tabs */}
        <div className="flex gap-1 ml-4">
          {project?.mimicPages.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePageId(p.id)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activePageId === p.id
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {canEdit && (
          <button
            onClick={() => navigate(`/app/projects/${projectId}/edit/${activePageId}`)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
        )}
        <button
          onClick={() => navigate(`/app/projects/${projectId}/members`)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
        >
          <Users className="w-4 h-4" /> Members
        </button>
        <button onClick={toggleFullscreen} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
      )}

      {/* Header Bar */}
      {pageSettings.header.show && (
        <div
          className="flex items-center px-4 shrink-0"
          style={{ height: pageSettings.header.height || 50, background: pageSettings.header.bgColor || '#0F172A', color: pageSettings.header.textColor || '#FFFFFF' }}
        >
          {pageSettings.header.logoUrl ? (
            <img src={pageSettings.header.logoUrl} className="h-8 mr-3 object-contain" alt="logo" />
          ) : (
            <div className="w-10 h-8 border border-dashed border-white/30 rounded flex items-center justify-center mr-3">
              <span className="text-[9px] opacity-40">Logo</span>
            </div>
          )}
          <div className="flex-1 text-center">
            <div className="font-semibold text-sm">{pageSettings.header.title || page?.name || ''}</div>
            {pageSettings.header.subtitle && <div className="text-xs opacity-75">{pageSettings.header.subtitle}</div>}
          </div>
          <div className="text-xs font-mono text-right">
            <div>{currentTime.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div className="font-semibold">{currentTime.toLocaleTimeString()}</div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasContainerRef}
        className="flex-1 overflow-auto relative"

        onMouseDown={(e) => {
          if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - viewPan.x, y: e.clientY - viewPan.y });
          }
        }}
        onMouseMove={(e) => {
          if (isPanning) {
            setViewPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
          }
        }}
        onMouseUp={() => setIsPanning(false)}
        onMouseLeave={() => setIsPanning(false)}
      >
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 border border-gray-200 rounded-lg shadow px-2 py-1">
          {isFullscreen && (
            <>
              <button onClick={toggleFullscreen} className="px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
                Exit Fullscreen
              </button>
              <div className="w-px h-4 bg-gray-300" />
            </>
          )}
          <button
            onClick={() => setShowTagValues(v => !v)}
            className={`px-1.5 py-0.5 rounded ${showTagValues ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'}`}
            title="Show/Hide Tag Values"
          >
            <Tags className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <button onClick={() => setViewZoom(z => Math.min(10, z * 1.2))} className="px-2 py-0.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded">+</button>
          <span className="text-xs text-gray-500 min-w-[40px] text-center">{Math.round(viewZoom * 100)}%</span>
          <button onClick={() => setViewZoom(z => Math.max(0.1, z / 1.2))} className="px-2 py-0.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded">−</button>
          <button onClick={() => { setViewZoom(1); setViewPan({ x: 0, y: 0 }); }} className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 rounded ml-1">Reset</button>
        </div>
        {/* Floating Tag Values Panel */}
        {showTagValues && Object.keys(values).length > 0 && (
          <div className="absolute top-14 left-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-xl p-2 max-h-[50vh] overflow-y-auto min-w-[180px]">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 px-1">Live Tag Values</div>
            {Object.entries(values).map(([tag, data]) => (
              <div key={tag} className="flex items-center justify-between gap-3 px-1 py-0.5 hover:bg-slate-800 rounded">
                <span className="text-[11px] text-slate-300 truncate">{tag}</span>
                <span className="text-[11px] font-mono font-bold text-cyan-400">{typeof (data as any)?.value === 'number' ? (data as any).value.toFixed(2) : String((data as any)?.value ?? '---')}</span>
              </div>
            ))}
          </div>
        )}
        {page ? (
          <svg
            viewBox={`0 0 ${page.width} ${page.height}`}
            width={page.width * viewZoom}
            height={page.height * viewZoom}
            className="shadow-lg rounded-lg"
            style={{
              background: page.backgroundColor || '#FFFFFF',
              transform: `translate(${viewPan.x}px, ${viewPan.y}px)`,
              cursor: isPanning ? 'grabbing' : 'default',
            }}
            onClick={() => setSelectedEquipment(null)}
          >
            {/* Connections */}
            {(page.connections as MimicConnection[]).map((conn) => (
              <polyline
                key={conn.id}
                points={conn.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={conn.color || '#374151'}
                strokeWidth={conn.thickness || 2}
              />
            ))}

            {/* Elements */}
            {[...(page.elements as MimicElement[])]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map(renderElement)}
          </svg>
        ) : (
          <div className="text-gray-400">Loading...</div>
        )}
      </div>

      {/* Footer Bar */}
      {pageSettings.footer.show && (
        <div style={{ background: pageSettings.footer.bgColor || '#0F172A', color: pageSettings.footer.textColor || '#FFFFFF' }} className="shrink-0">
          {/* Alarm Banner */}
          {pageSettings.footer.showAlarmBanner && (
            <div className="flex items-center gap-3 px-4 py-1" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <span className="text-xs font-bold text-red-400">LATEST ALARM:</span>
              <span className="text-xs italic opacity-60">No active alarms</span>
              <span className="flex-1" />
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">EMG: 0</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white">URG: 0</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 text-black">NRM: 0</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">INF: 0</span>
              <span className="px-2 py-0.5 rounded text-[10px] border border-white/20">MUTE 0 unack</span>
            </div>
          )}
          {/* Status Bar */}
          {pageSettings.footer.showStatusBar && (
            <div className="flex items-center px-4 py-1">
              <div className="text-xs opacity-75">{user?.name || 'Operator'} • {user?.role || 'Admin'}</div>
              <div className="flex-1 text-center text-xs opacity-60">{pageSettings.footer.customText || 'GridVision SCADA'}</div>
              <div className="text-xs opacity-75">{page?.name} • {currentTime.toLocaleTimeString()}</div>
            </div>
          )}
        </div>
      )}

      {/* Equipment popup */}
      {selectedEquipment && (
        <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-72 z-10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-900">{selectedEquipment.properties.label || selectedEquipment.type}</h4>
            <button onClick={() => setSelectedEquipment(null)} className="text-gray-400 hover:text-gray-600 text-xs">Close</button>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-medium text-gray-700">{selectedEquipment.type}</span>
            </div>
            {selectedEquipment.properties.tagBinding && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tag</span>
                  <span className="font-mono text-gray-700">{selectedEquipment.properties.tagBinding}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Value</span>
                  <span className="font-mono font-bold text-blue-600">
                    {tv(selectedEquipment.properties.tagBinding) !== undefined
                      ? String(tv(selectedEquipment.properties.tagBinding))
                      : '---'}
                  </span>
                </div>
              </>
            )}
            {selectedEquipment.properties.tagBindings && Object.keys(selectedEquipment.properties.tagBindings).length > 0 && (
              <>
                <div className="border-t border-gray-100 pt-1 mt-1">
                  <span className="text-gray-500 font-semibold">Tag Bindings</span>
                </div>
                {Object.entries(selectedEquipment.properties.tagBindings).map(([suffix, tagName]) => (
                  <div key={suffix} className="flex justify-between">
                    <span className="text-gray-500">{suffix.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase())}</span>
                    <span className="font-mono font-bold text-blue-600">
                      {tv(tagName as string) !== undefined ? String(tv(tagName as string)) : '---'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
