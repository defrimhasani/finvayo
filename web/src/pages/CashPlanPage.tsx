import { useEffect, useState } from "react";
import { api } from "../api";
import {
  daysBetween,
  fail,
  type Financials,
  type Overview,
  PageHeader,
  UpcomingLedger,
} from "../appData";
import { AppShell } from "../components/AppShell";
import { Card } from "../components/ui/card";
import { money } from "../utils";

function chartPaths(overview: Overview) {
  const values = [
    ...overview.points.map((p) => p.balanceMinor),
    overview.protectedMinor,
    0,
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.12, 100);
  const chartMin = min - pad;
  const chartMax = max + pad;
  const range = chartMax - chartMin || 1;
  const x = (date: string) =>
    (daysBetween(date, overview.horizonStart) / 90) * 900;
  const y = (value: number) => 250 - ((value - chartMin) / range) * 250;
  let line = `M0 ${y(overview.currentCashMinor).toFixed(1)}`;
  for (const p of overview.points.slice(1))
    line += ` H${x(p.date).toFixed(1)} V${y(p.balanceMinor).toFixed(1)}`;
  line += " H900";
  let reserve = `M0 ${y(overview.points[0]?.protectedMinor ?? overview.protectedMinor).toFixed(1)}`;
  for (const p of overview.points.slice(1))
    reserve += ` H${x(p.date).toFixed(1)} V${y(p.protectedMinor).toFixed(1)}`;
  return {
    line,
    area: `${line} V250 H0 Z`,
    reserve: `${reserve} H900`,
    ticks: [
      chartMax,
      chartMax - range / 3,
      chartMax - (2 * range) / 3,
      chartMin,
    ],
  };
}
export default function CashPlanPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api<Financials>("/api/financials")
      .then((r) => {
        setOverview(r.overview);
        setCurrency(r.currency || "USD");
      })
      .catch((e) => setMessage(fail(e, "Unable to load cash plan.")));
  }, []);
  const chart = overview ? chartPaths(overview) : null;
  const shortMoney = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value / 100);
  return (
    <AppShell activePage="cash-plan">
      <main
        className="min-h-screen w-full px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] min-[761px]:px-6 min-[761px]:pt-8 min-[761px]:pb-20 min-[1200px]:px-8"
        id="app-main"
      >
        <PageHeader kicker="Forecast" title="Cash plan" />
        <Card className="mt-5 p-[clamp(1.5rem,3vw,2.5rem)] max-[520px]:shadow-[3px_3px_0_rgba(23,24,21,0.12)]">
          <div className="flex flex-col items-start justify-between gap-4 min-[521px]:flex-row min-[521px]:items-center">
            <div>
              <p className="mb-2 font-mono text-[0.7rem] leading-[1.35] tracking-[0.08em] text-[#3f665e] uppercase">
                Cash outlook
              </p>
              <h2 className="m-0 text-[1.4rem] tracking-[-0.045em]">
                The next 90 days
              </h2>
            </div>
            <div className="flex gap-5 text-[0.62rem] text-muted-foreground">
              <span>
                <i className="mr-1.5 inline-block w-5 border-t-2 border-[#175f57] align-middle" />
                Projected cash
              </span>
              <span>
                <i className="mr-1.5 inline-block w-5 border-t border-dashed border-[#ae7350] align-middle" />
                Protected level
              </span>
            </div>
          </div>
          {overview && chart ? (
            <>
              <div
                className="mt-8 grid h-[280px] grid-cols-[45px_1fr] min-[521px]:h-[310px]"
                role="img"
                aria-label={`Projected cash reaches a low of ${money(overview.lowestBalanceMinor, currency)}.`}
              >
                <div className="flex flex-col justify-between pb-7 font-mono text-[0.57rem] text-[#858c87] tabular-nums">
                  {chart.ticks.map((tick, i) => (
                    <span key={i}>{shortMoney(tick)}</span>
                  ))}
                </div>
                <div className="relative border-y border-[#e5e1d8] bg-[linear-gradient(#e5e1d8_1px,transparent_1px)] bg-[length:100%_33.333%]">
                  <svg
                    className="absolute top-0 left-0 h-[250px] w-full"
                    viewBox="0 0 900 250"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path className="fill-[#175f5714]" d={chart.area} />
                    <path
                      className="fill-none stroke-[#175f57] [stroke-width:2.5] [vector-effect:non-scaling-stroke]"
                      d={chart.line}
                    />
                    <path
                      className="fill-none stroke-[#ae7350] [stroke-dasharray:7_5] [stroke-width:1.5] [vector-effect:non-scaling-stroke]"
                      d={chart.reserve}
                    />
                  </svg>
                  <div className="absolute bottom-2 flex w-full justify-between font-mono text-[0.57rem] text-[#858c87] tabular-nums">
                    <span>Today</span>
                    <span>30 days</span>
                    <span>60 days</span>
                    <span>90 days</span>
                  </div>
                </div>
              </div>
              <p className="mt-6 mb-0 flex items-start gap-3 text-[0.72rem] min-[521px]:items-center">
                <span className="grid size-[26px] shrink-0 place-items-center rounded-full border font-mono text-[0.55rem]">
                  01
                </span>
                Your lowest projected balance is{" "}
                <strong>
                  {money(overview.lowestBalanceMinor, currency)}{" "}
                  {overview.limitingDate.startsWith("in ")
                    ? overview.limitingDate
                    : `on ${overview.limitingDate}`}
                </strong>
                , {money(Math.abs(overview.lowestHeadroomMinor), currency)}{" "}
                {overview.lowestHeadroomMinor >= 0 ? "above" : "below"} your
                protected level.
              </p>
            </>
          ) : (
            <p className="mt-6 mb-0 flex items-start gap-3 text-[0.72rem] min-[521px]:items-center">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full border font-mono text-[0.55rem]">
                01
              </span>
              {message ||
                "Add a confirmed balance to start your 90-day projection."}
            </p>
          )}
        </Card>
        <section className="mt-5">
          <UpcomingLedger overview={overview} currency={currency} />
        </section>
      </main>
    </AppShell>
  );
}
