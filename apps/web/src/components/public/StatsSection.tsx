import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: number;
  suffix: string;
  label: string;
}

const stats: Stat[] = [
  { value: 10, suffix: '+', label: 'SVG Equipment Types' },
  { value: 33, suffix: '/11kV', label: 'Substation Layouts' },
  { value: 6, suffix: '+', label: 'Protocol Adapters' },
  { value: 100, suffix: '%', label: 'Open Source' },
];

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let current = 0;
          const step = Math.ceil(target / 30);
          const interval = setInterval(() => {
            current += step;
            if (current >= target) {
              setCount(target);
              clearInterval(interval);
            } else {
              setCount(current);
            }
          }, 40);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-4xl font-bold text-gradient">
      {count}{suffix}
    </div>
  );
}

export default function StatsSection() {
  return (
    <div className="bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              <div className="text-sm text-gray-600 mt-2">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
