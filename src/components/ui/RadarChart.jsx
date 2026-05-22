// components/ui/RadarChart.jsx
// Four-axis radar chart for analysis breakdown using recharts.

import {
  Radar,
  RadarChart as RC,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { useI18n } from '../../hooks/useI18n.js';

const BRAND = '#1e3a5f';

function clamp(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function RadarChart({ breakdown }) {
  const { t } = useI18n();

  const data = [
    { axis: t('score.skills'), value: clamp(breakdown?.skills) },
    { axis: t('score.experience'), value: clamp(breakdown?.experience) },
    { axis: t('score.keywords'), value: clamp(breakdown?.keywords) },
    { axis: t('score.education'), value: clamp(breakdown?.education) }
  ];

  return (
    <div className="card">
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RC data={data} outerRadius="75%">
            <PolarGrid stroke="#cbd5e1" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: '#475569', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickCount={5}
              axisLine={false}
            />
            <Radar
              name="score"
              dataKey="value"
              stroke={BRAND}
              fill={BRAND}
              fillOpacity={0.3}
              strokeWidth={2}
              isAnimationActive
            />
          </RC>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
