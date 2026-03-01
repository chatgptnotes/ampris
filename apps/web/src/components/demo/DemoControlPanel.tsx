import { useSimulationContext } from './DemoSimulationContext';
import { Settings2, ToggleLeft, ToggleRight } from 'lucide-react';

export default function DemoControlPanel() {
  const { selectedEquipment, cbStates, isolatorStates, measurements, toggleCB, toggleIsolator } =
    useSimulationContext();

  if (!selectedEquipment) {
    return (
      <div className="w-72 bg-white border-l border-gray-200 p-4 flex flex-col items-center justify-center text-gray-400">
        <Settings2 className="w-8 h-8 mb-2" />
        <p className="text-sm text-center">Click an equipment item on the SLD to view details</p>
      </div>
    );
  }

  const isCB = selectedEquipment.endsWith('_CB');
  const isIsolator = selectedEquipment.endsWith('_ISO');
  const state = isCB
    ? cbStates[selectedEquipment]
    : isIsolator
      ? (isolatorStates[selectedEquipment] ? 'CLOSED' : 'OPEN')
      : 'N/A';

  // Find related measurements
  const relatedMeasurements: { label: string; value: string }[] = [];
  const prefix = selectedEquipment.replace(/_CB$|_ISO$|_ES$/, '');
  Object.entries(measurements).forEach(([key, val]) => {
    if (key.startsWith(prefix) || key.includes(prefix)) {
      relatedMeasurements.push({ label: key, value: val.toFixed(2) });
    }
  });

  return (
    <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto">
      <h3 className="font-semibold text-gray-900 text-sm mb-1">Equipment Details</h3>
      <div className="text-xs text-gray-500 mb-4 font-mono">{selectedEquipment}</div>

      <div className="space-y-3">
        {/* State */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">State</div>
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-semibold ${
                state === 'CLOSED' ? 'text-red-600' : state === 'TRIPPED' ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {state}
            </span>
            {(isCB || isIsolator) && (
              <button
                onClick={() => isCB ? toggleCB(selectedEquipment) : toggleIsolator(selectedEquipment)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                {state === 'CLOSED' ? (
                  <><ToggleRight className="w-4 h-4" /> Open</>
                ) : (
                  <><ToggleLeft className="w-4 h-4" /> Close</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Related measurements */}
        {relatedMeasurements.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-2">Live Readings</div>
            <div className="space-y-1">
              {relatedMeasurements.map((m) => (
                <div key={m.label} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5">
                  <span className="text-xs text-gray-600 font-mono">{m.label}</span>
                  <span className="text-xs font-semibold text-gray-900">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="pt-3 border-t border-gray-200">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            This is a simulated demo. Click circuit breakers on the SLD to toggle their state.
            Measurements update every 2 seconds. Random feeder trips occur every ~15 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
