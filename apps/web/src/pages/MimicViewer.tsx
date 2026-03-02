import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { useRealtimeStore } from '@/stores/realtimeStore';
import {
  Maximize,
  Minimize,
  Pencil,
  ChevronLeft,
  Users,
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
  width: number;
  height: number;
  backgroundColor: string;
  elements: MimicElement[];
  connections: MimicConnection[];
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
  const values = useRealtimeStore((s) => s.values);

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
    });
  }, [projectId, activePageId]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Evaluate animation rules
  const getAnimatedStyle = (el: MimicElement): Record<string, string> => {
    const style: Record<string, string> = {};
    if (!el.properties.animationRules || !el.properties.tagBinding) return style;
    const tagValue = values[el.properties.tagBinding];
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
    const tagValue = values[el.properties.tagBinding];
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

  // Handle control element clicks
  const handleControlClick = useCallback(async (el: MimicElement) => {
    const tag = el.properties.targetTag;
    if (!tag) return;
    const action = el.properties.controlAction || 'setValue';
    try {
      if (action === 'toggle') {
        const currentVal = values[tag];
        const current = currentVal !== undefined ? currentVal : false;
        const newVal = !(current === true || current === 'true' || current === 1 || current === '1');
        await api.post('/tags/by-name/set-value', { tagName: tag, value: newVal });
      } else if (action === 'increment') {
        const currentVal = values[tag];
        const current = typeof currentVal === 'number' ? currentVal : parseFloat(String(currentVal)) || 0;
        const inc = parseFloat(el.properties.controlValue || '1') || 1;
        await api.post('/tags/by-name/set-value', { tagName: tag, value: current + inc });
      } else if (action === 'script') {
        await api.post('/tags/execute-script', { code: el.properties.controlScript || '' });
      } else {
        // setValue
        const v = el.properties.controlValue;
        const numV = Number(v);
        await api.post('/tags/by-name/set-value', { tagName: tag, value: isNaN(numV) ? v : numV });
      }
    } catch (err) {
      console.error('Control action failed:', err);
    }
  }, [values]);

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

  const renderElement = (el: MimicElement) => {
    try {
    const animated = getAnimatedStyle(el);
    const tagKey = el.properties?.tagBinding || el.properties?.targetTag;
    const tagValue = tagKey ? values[tagKey] : undefined;
    const isNav = ['page-link', 'back-button', 'home-button'].includes(el.type);
    const isCtrl = el.type.startsWith('ctrl-');
    const conditionalColor = resolveConditionalColor(el);

    return (
      <g
        key={el.id}
        transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}, ${el.width / 2}, ${el.height / 2})`}
        onClick={(e) => {
          e.stopPropagation();
          if (isCtrl) {
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
            fill={animated.color || el.properties.color || '#000'}
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
              fill={animated.fill || el.properties.fill || '#E5E7EB'}
              stroke={animated.stroke || el.properties.stroke || '#6B7280'}
              strokeWidth={el.properties.strokeWidth || 2}
            />
          ) : el.properties.shapeType === 'line' ? (
            <line
              x1={0} y1={0} x2={el.width} y2={el.height}
              stroke={animated.stroke || el.properties.stroke || '#374151'}
              strokeWidth={el.properties.strokeWidth || 2}
            />
          ) : (
            <rect
              width={el.width}
              height={el.height}
              fill={animated.fill || el.properties.fill || '#E5E7EB'}
              stroke={animated.stroke || el.properties.stroke || '#6B7280'}
              strokeWidth={el.properties.strokeWidth || 2}
              rx={4}
            />
          )
        ) : el.type === 'value-display' ? (
          <g>
            <rect width={el.width} height={el.height} fill="#F0F9FF" stroke="#3B82F6" strokeWidth={1} rx={4} />
            <text x={el.width / 2} y={el.height / 2 + 5} textAnchor="middle" fontSize={12} fill="#1E40AF" fontFamily="monospace">
              {tagValue !== undefined ? String(tagValue) : '---'}
            </text>
          </g>
        ) : isCtrl ? (
          <g>
            <rect
              width={el.width}
              height={el.height}
              fill={el.properties.buttonColor || '#3B82F6'}
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
        ) : SYMBOL_MAP[el.type] ? (
          <g>
            <foreignObject width={el.width} height={el.height}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: el.width, height: el.height }}>
                {React.createElement(SYMBOL_MAP[el.type], {
                  width: el.width,
                  height: el.height,
                  ...(conditionalColor ? { color: conditionalColor } : {}),
                  ...(el.type === 'Transformer' ? {
                    hvLabel: el.properties.tagBindings?.hvVoltage
                      ? `${values[el.properties.tagBindings.hvVoltage] ?? '...'} kV`
                      : el.properties.hvTag
                        ? `${values[el.properties.hvTag] ?? '...'} kV`
                        : el.properties.hvRating || undefined,
                    lvLabel: el.properties.tagBindings?.lvVoltage
                      ? `${values[el.properties.tagBindings.lvVoltage] ?? '...'} kV`
                      : el.properties.lvTag
                        ? `${values[el.properties.lvTag] ?? '...'} kV`
                        : el.properties.lvRating || undefined,
                    mvaLabel: el.properties.tagBindings?.mvaRating
                      ? `${values[el.properties.tagBindings.mvaRating] ?? '...'} MVA`
                      : el.properties.mvaTag
                        ? `${values[el.properties.mvaTag] ?? '...'} MVA`
                        : el.properties.mvaRating || undefined,
                  } : {}),
                })}
              </div>
            </foreignObject>
            {/* Tag value overlay */}
            {tagValue !== undefined && el.properties.tagBinding && (
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
    <div className="flex flex-col h-full bg-gray-100">
      {/* Top Bar */}
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

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {page ? (
          <svg
            viewBox={(() => {
              const els = (page.elements as MimicElement[]) || [];
              if (els.length === 0) return `0 0 ${page.width} ${page.height}`;
              const PAD = 80;
              const minX = Math.max(0, Math.min(...els.map(e => e.x)) - PAD);
              const minY = Math.max(0, Math.min(...els.map(e => e.y)) - PAD);
              const maxX = Math.min(page.width, Math.max(...els.map(e => e.x + e.width)) + PAD);
              const maxY = Math.min(page.height, Math.max(...els.map(e => e.y + e.height)) + PAD);
              return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
            })()}
            className="max-w-full max-h-full shadow-lg rounded-lg"
            style={{ background: page.backgroundColor || '#FFFFFF' }}
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
                    {values[selectedEquipment.properties.tagBinding] !== undefined
                      ? String(values[selectedEquipment.properties.tagBinding])
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
                      {values[tagName as string] !== undefined ? String(values[tagName as string]) : '---'}
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
