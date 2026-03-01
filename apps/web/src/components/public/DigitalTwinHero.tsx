export default function DigitalTwinHero() {
  return (
    <div className="relative w-full max-w-xl">
      {/* Glow backdrop */}
      <div className="absolute -inset-6 bg-blue-400/10 rounded-3xl blur-3xl" />

      {/* Main card — crop the garbled top of the AI-generated image */}
      <div className="relative bg-white/[0.07] backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-hidden" style={{ marginTop: '-12%' }}>
          <img
            src="/images/digital-twin-infographic.png"
            alt="GridVision SCADA Digital Twin — 33/11kV distribution substation infographic"
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
}
