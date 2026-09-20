'use client';

// ============================================================================
// chart — the shared frame every chart in the app is drawn inside.
//
// Recharts handles the geometry; this file handles everything Recharts is
// opinionated about and shouldn't be: the axis and grid colours, the tooltip
// card, the legend, and the series colours themselves.
//
// Series colours arrive as a ChartConfig and are published as CSS custom
// properties (--color-<key>) on the container, so a <Bar fill="var(--color-movie)">
// names the ENTITY rather than a hex. That is what keeps colour attached to the
// thing it means: filter the chart down to two types and the survivors keep the
// colours they had.
// ============================================================================

import * as React from 'react';
import { Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label: string;
    color?: string;
    icon?: React.ComponentType<{ className?: string }>;
  }
>;

const ChartContext = React.createContext<ChartConfig>({});

function useChartConfig() {
  return React.useContext(ChartContext);
}

export function ChartContainer({
  config,
  className,
  style,
  children,
}: {
  config: ChartConfig;
  className?: string;
  /** Height lives here: ResponsiveContainer only fills what it is given. */
  style?: React.CSSProperties;
  /** One Recharts chart element. ResponsiveContainer accepts exactly one child. */
  children: React.ReactElement;
}) {
  const vars = React.useMemo(() => {
    const declared: Record<string, string> = {};
    for (const [key, entry] of Object.entries(config)) {
      if (entry.color) declared[`--color-${key}`] = entry.color;
    }
    return declared as React.CSSProperties;
  }, [config]);

  return (
    <ChartContext.Provider value={config}>
      <div
        data-chart
        style={{ ...vars, ...style }}
        className={cn(
          'w-full text-[11.5px]',
          // Recharts paints its own defaults into the markup. These pull the
          // furniture back to recessive and stop the focus ring from drawing a
          // box around the plot area on click.
          '[&_.recharts-cartesian-axis-tick-line]:stroke-transparent',
          '[&_.recharts-cartesian-axis-tick_text]:fill-stone-500',
          '[&_.recharts-cartesian-grid_line]:stroke-stone-800',
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-stone-700',
          '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-stone-800/50',
          '[&_.recharts-sector]:outline-hidden',
          '[&_.recharts-layer]:outline-hidden',
          '[&_.recharts-surface]:outline-hidden',
          className,
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;
export const ChartLegend = Legend;

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

/**
 * The tooltip card. Values are the only numbers on the chart that are always
 * spelled out, so the plot itself can stay clean; the swatch repeats the
 * series colour beside its name rather than colouring the name.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  hideLabel,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number | undefined, payload: TooltipEntry[]) => React.ReactNode;
  valueFormatter?: (value: number | string, key: string, entry: TooltipEntry) => React.ReactNode;
  hideLabel?: boolean;
}) {
  const config = useChartConfig();
  if (!active || !payload?.length) return null;

  const heading = labelFormatter ? labelFormatter(label, payload) : label;

  return (
    <div className="min-w-[9rem] rounded-[var(--radius-md)] bg-stone-800 px-2.5 py-2 text-stone-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)] border border-white/10">
      {hideLabel || heading === undefined || heading === '' ? null : (
        <p className="mb-1.5 text-[12px] font-semibold tracking-[-0.01em]">{heading}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, i) => {
          const key = String(entry.dataKey ?? entry.name ?? i);
          const meta = config[key];
          const Icon = meta?.icon;
          return (
            <li key={key} className="flex items-center gap-2 text-[12px]">
              {Icon ? (
                <Icon className="h-3.5 w-3.5 shrink-0 text-stone-400" />
              ) : (
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: entry.color ?? meta?.color ?? 'var(--color-stone-400)' }}
                />
              )}
              <span className="text-stone-400">{meta?.label ?? key}</span>
              <span className="ml-auto font-semibold tabular-nums text-stone-50">
                {valueFormatter && entry.value !== undefined
                  ? valueFormatter(entry.value, key, entry)
                  : entry.value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The legend. Present whenever a chart carries two or more series, because
 * identity must never rest on colour alone.
 */
export function ChartLegendContent({
  payload,
}: {
  payload?: { value?: string; dataKey?: string | number; color?: string }[];
}) {
  const config = useChartConfig();
  if (!payload?.length) return null;

  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3">
      {payload.map((entry, i) => {
        const key = String(entry.dataKey ?? entry.value ?? i);
        const meta = config[key];
        const Icon = meta?.icon;
        return (
          <li key={key} className="flex items-center gap-1.5 text-[12px] text-stone-400">
            {Icon ? (
              <Icon className="h-3.5 w-3.5" />
            ) : (
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-[3px]"
                style={{ background: entry.color ?? meta?.color ?? 'var(--color-stone-400)' }}
              />
            )}
            {meta?.label ?? key}
          </li>
        );
      })}
    </ul>
  );
}
