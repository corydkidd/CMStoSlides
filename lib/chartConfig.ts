export const chartColors = {
  // Primary - always cyan first
  primary: '#00D9FF',

  // Categorical palette (ordered by visual distinction)
  categorical: [
    '#00D9FF',  // Cyan (primary) - always first
    '#10B981',  // Emerald
    '#F59E0B',  // Amber
    '#8B5CF6',  // Violet
    '#EC4899',  // Pink
    '#3B82F6',  // Blue
    '#EF4444',  // Red
    '#6B7280',  // Gray (last resort)
  ],

  // Semantic colors for specific meanings
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280',

  // For benefit ratings or similar scales
  scale: {
    best: '#10B981',      // Emerald
    good: '#00D9FF',      // Cyan
    moderate: '#F59E0B',  // Amber
    poor: '#94A3B8',      // Gray
    worst: '#EF4444',     // Red
  },
};

// Theme-aware chart configuration
export function getChartTheme(isDark: boolean) {
  return {
    background: isDark ? '#1a2332' : '#ffffff',
    text: isDark ? '#94a3b8' : '#64748b',
    textSecondary: isDark ? '#64748b' : '#94a3b8',
    grid: isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9',

    tooltip: {
      background: isDark ? '#1f2937' : '#ffffff',
      border: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
      text: isDark ? '#f1f5f9' : '#0f172a',
    },
  };
}

// Recharts tooltip style
export function getTooltipStyle(isDark: boolean) {
  const theme = getChartTheme(isDark);
  return {
    contentStyle: {
      background: theme.tooltip.background,
      border: `1px solid ${theme.tooltip.border}`,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      padding: '12px',
    },
    labelStyle: {
      color: theme.tooltip.text,
      fontWeight: 600,
      marginBottom: '4px',
    },
    itemStyle: {
      color: theme.tooltip.text,
      fontSize: '12px',
    },
  };
}
