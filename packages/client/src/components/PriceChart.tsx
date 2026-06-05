import { useStore } from "../store";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function PriceChart() {
  const priceHistory = useStore((s) => s.priceHistory);

  if (!priceHistory || priceHistory.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground border-b mb-4">
        Waiting for trades...
      </div>
    );
  }

  // To prevent the chart from jumping, we find the min/max or let recharts handle it with domain=['auto', 'auto']
  // We use an AreaChart to make it look nicer.
  return (
    <div className="mb-4 border-b pb-4">
      <ChartContainer config={chartConfig} className="h-48 w-full">
        <AreaChart
          data={priceHistory}
          margin={{
            left: 0,
            right: 0,
            top: 10,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-price)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-price)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value) => value}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={40}
            tickFormatter={(value) => `$${value}`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--color-price)"
            fill="url(#fillPrice)"
            strokeWidth={2}
            isAnimationActive={false} // Disable animation to make live updates look snappier
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
