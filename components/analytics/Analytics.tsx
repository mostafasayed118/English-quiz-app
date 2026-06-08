"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Button } from "@/components/ui/Button";
import { useQuizStore } from "@/lib/store";
import { getAllQuestions, getAllCategories } from "@/lib/questions";
import { computeAggregate } from "@/lib/stats";
import { formatDuration, formatPercent } from "@/lib/utils";
import { Clock, Target, TrendingUp, AlertTriangle, RefreshCw, Database, BookOpen, BarChart3, PieChart as PieIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import bankStats from "@/data/bank_stats.json";
import { StatCard } from "@/components/dashboard/StatCard";

const PIE_COLORS = ["#10b981", "#f43f5e", "#f59e0b", "#6366f1", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

/* -------------------------------------------------------------------------- */
/*  Category-accuracy chart helpers                                            */
/* -------------------------------------------------------------------------- */

/** Single source of truth for bar fill color. Matches the Focus Areas panel. */
function barColorForAccuracy(accuracy: number): string {
  if (accuracy >= 70) return "#10b981"; // success-500
  if (accuracy >= 40) return "#f59e0b"; // amber-500
  return "#f43f5e"; // danger-500
}

/**
 * Custom Y-axis tick — renders the category name on top and a smaller
 * "n attempts" line below it, for richer at-a-glance reading.
 */
function RichYAxisTick(
  props: {
    x?: number;
    y?: number;
    payload?: { value: string; index: number };
  } & { categories: string[]; attempts: number[] },
) {
  const { x = 0, y = 0, payload, categories, attempts } = props;
  if (!payload) return null;
  const idx = categories.indexOf(payload.value);
  const n = idx >= 0 ? attempts[idx] : 0;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={-6}
        textAnchor="end"
        fontSize={12}
        fontWeight={600}
        className="fill-slate-700 dark:fill-slate-200"
      >
        {payload.value}
      </text>
      <text
        x={0}
        y={10}
        textAnchor="end"
        fontSize={10}
        className="fill-slate-400 dark:fill-slate-500"
      >
        {n} {n === 1 ? "attempt" : "attempts"}
      </text>
    </g>
  );
}

/**
 * In-bar end label that prints the accuracy % right after the bar.
 * Positioned by recharts' render-prop (x/y/width/height supplied).
 */
function RichBarLabel(
  props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    value?: number;
    index?: number;
    categories: number[];
  },
) {
  const { x = 0, y = 0, width = 0, height = 0, value, index, categories } = props;
  const acc = value ?? (typeof index === "number" ? categories[index] : 0);
  return (
    <g>
      <text
        x={x + width + 8}
        y={y + height / 2}
        dy="0.35em"
        textAnchor="start"
        fontSize={12}
        fontWeight={700}
        className="fill-slate-700 dark:fill-slate-100"
      >
        {acc}%
      </text>
    </g>
  );
}

/**
 * Glassmorphic dark tooltip styled to match the rest of the app.
 * Renders the category, attempts, and accuracy with a small inline bar.
 */
function RichTooltip({
  active,
  payload,
  categories,
}: TooltipProps<number, string> & {
  categories: { category: string; accuracy: number; total: number }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const idx = typeof p.payload?.index === "number" ? p.payload.index : -1;
  const data = idx >= 0 ? categories[idx] : null;
  if (!data) return null;
  const tone =
    data.accuracy >= 70 ? "text-success-400" : data.accuracy >= 40 ? "text-amber-400" : "text-danger-400";
  return (
    <div
      className={cn(
        "rounded-xl border shadow-xl backdrop-blur-md",
        "bg-slate-900/95 border-slate-700/60",
        "px-3.5 py-2.5 min-w-[180px]",
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {data.category}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold", tone)}>{data.accuracy}%</span>
        <span className="text-xs text-slate-400">accuracy</span>
      </div>
      <div className="mt-1.5 text-[11px] text-slate-300">
        {data.total} {data.total === 1 ? "attempt" : "attempts"}
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-slate-700/60 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${data.accuracy}%`,
            background: barColorForAccuracy(data.accuracy),
          }}
        />
      </div>
    </div>
  );
}

/**
 * Tooltip for the daily-accuracy line chart. Renders the date, accuracy,
 * and number of attempts on that day.
 */
function RichLineTooltip({
  active,
  payload,
  data,
}: TooltipProps<number, string> & {
  data: { day: string; accuracy: number; total: number }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const idx = typeof p.payload?.index === "number" ? p.payload.index : -1;
  const d = idx >= 0 ? data[idx] : null;
  if (!d) return null;
  return (
    <div
      className={cn(
        "rounded-xl border shadow-xl backdrop-blur-md",
        "bg-slate-900/95 border-slate-700/60",
        "px-3.5 py-2.5 min-w-[150px]",
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {d.day}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-primary-400">{d.accuracy}%</span>
        <span className="text-xs text-slate-400">accuracy</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-300">
        {d.total} {d.total === 1 ? "attempt" : "attempts"}
      </div>
    </div>
  );
}
import Link from "next/link";

const COLORS = [
  "#10b981",
  "#f43f5e",
  "#f59e0b",
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#a855f7",
];

export function Analytics() {
  const attempts = useQuizStore((s) => s.attempts);
  const lastSession = useQuizStore((s) => s.lastSessionResults);
  const totalQuestions = getAllQuestions().length;
  const stats = useMemo(
    () => computeAggregate(totalQuestions, attempts),
    [attempts, totalQuestions],
  );

  // Trend over time: bucket attempts by day, compute accuracy per day.
  const trend = useMemo(() => {
    const buckets = new Map<string, { correct: number; total: number }>();
    for (const a of Object.values(attempts)) {
      const day = a.lastAnsweredAt.slice(0, 10);
      const cur = buckets.get(day) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (a.outcome === "correct") cur.correct += 1;
      buckets.set(day, cur);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day: day.slice(5), // MM-DD
        accuracy: Math.round((v.correct / v.total) * 100),
        total: v.total,
      }));
  }, [attempts]);

  // Per-category accuracy.
  const categories = getAllCategories();
  const categoryAccuracy = stats.byCategory.map((c) => ({
    category: c.category,
    accuracy: Math.round(c.accuracy * 100),
    total: c.total,
  }));

  // Weakest categories (lowest accuracy, at least 3 attempts).
  const weak = [...stats.byCategory]
    .filter((c) => c.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  const hasData = stats.solved > 0;

  // Tab state: "progress" | "bank"
  const [activeTab, setActiveTab] = useState<"progress" | "bank">("progress");

  // Bank stats data
  const bankCats = Object.entries(bankStats.categories).map(([name, value]) => ({ name, value }));
  const bankTotal = bankStats.total_unique_questions;
  const bankAnswerDist = Object.entries(bankStats.options_distribution).map(([letter, count]) => ({
    letter,
    count,
    pct: Math.round((count / Math.max(bankTotal, 1)) * 100),
  }));

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("progress")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            activeTab === "progress"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <TrendingUp className="w-4 h-4 inline mr-1.5" />
          My Progress
        </button>
        <button
          onClick={() => setActiveTab("bank")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            activeTab === "bank"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Database className="w-4 h-4 inline mr-1.5" />
          Question Bank
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  TAB: My Progress                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "progress" && (
        <>
      {/* Hero / empty state */}
      {!hasData && !lastSession && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="inline-flex p-3 rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              No data yet
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Answer a few questions and your analytics will populate here.
              Take a quick 10-question quiz to get started.
            </p>
            <div className="mt-5">
              <Link href="/quiz?size=10">
                <Button>
                  <RefreshCw className="w-4 h-4" />
                  Take a 10-Question Quiz
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Last session summary */}
      {lastSession && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Last session</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {lastSession.totalAnswered} questions, {formatDuration(lastSession.durationSec)} spent.
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                  {formatPercent(
                    lastSession.totalAnswered > 0
                      ? lastSession.correct / lastSession.totalAnswered
                      : 0,
                  )}
                </div>
                <div className="text-xs text-slate-500">accuracy</div>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat
                label="Answered"
                value={lastSession.totalAnswered.toString()}
                icon={<Target className="w-4 h-4" />}
                tone="primary"
              />
              <MiniStat
                label="Correct"
                value={lastSession.correct.toString()}
                icon={<TrendingUp className="w-4 h-4" />}
                tone="success"
              />
              <MiniStat
                label="Time"
                value={formatDuration(lastSession.durationSec)}
                icon={<Clock className="w-4 h-4" />}
                tone="amber"
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Aggregate stats */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardBody className="flex flex-col items-center justify-center text-center">
              <ProgressRing
                value={stats.accuracy}
                size={150}
                strokeWidth={12}
                color={
                  stats.accuracy >= 0.8
                    ? "stroke-success-500"
                    : stats.accuracy >= 0.5
                      ? "stroke-amber-500"
                      : "stroke-danger-500"
                }
                displayValue={formatPercent(stats.accuracy)}
                label="Overall accuracy"
              />
              <div className="mt-4 grid grid-cols-3 gap-2 w-full text-center">
                <SmallStat label="Solved" value={stats.solved.toString()} />
                <SmallStat
                  label="Correct"
                  value={stats.correct.toString()}
                  tone="success"
                />
                <SmallStat
                  label="Wrong"
                  value={stats.incorrect.toString()}
                  tone="danger"
                />
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Accuracy over time</CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Daily accuracy (%) across your last attempts.
              </p>
            </CardHeader>
            <CardBody>
              {trend.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-slate-400">
                  No data yet.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        className="text-slate-500 dark:text-slate-400"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        className="text-slate-500 dark:text-slate-400"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                        width={40}
                      />
                      <Tooltip
                        cursor={{ stroke: "#6366f1", strokeWidth: 1, strokeDasharray: "3 3" }}
                        content={
                          <RichLineTooltip
                            data={trend.map((t) => ({
                              day: t.day,
                              accuracy: t.accuracy,
                              total: t.total,
                            }))}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#6366f1"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 7, fill: "#6366f1", stroke: "#fff", strokeWidth: 3 }}
                        animationDuration={900}
                        animationEasing="ease-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Category accuracy */}
      {hasData && categoryAccuracy.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Accuracy by category</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Bar length = accuracy %. Color encodes the same scale as the Focus
                  Areas panel below — green ≥ 70%, amber ≥ 40%, red &lt; 40%.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-success-500" />
                  <span className="text-slate-600 dark:text-slate-300">≥ 70%</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span className="text-slate-600 dark:text-slate-300">40–69%</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-danger-500" />
                  <span className="text-slate-600 dark:text-slate-300">&lt; 40%</span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="pt-2">
            <div
              className="w-full"
              style={{ height: Math.max(280, categoryAccuracy.length * 44 + 32) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryAccuracy}
                  layout="vertical"
                  margin={{ top: 8, right: 56, left: 8, bottom: 8 }}
                  barCategoryGap={6}
                >
                  <defs>
                    {/* Subtle horizontal gradient so each bar feels physical */}
                    {categoryAccuracy.map((c, i) => (
                      <linearGradient
                        key={i}
                        id={`bar-grad-${i}`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor={barColorForAccuracy(c.accuracy)} stopOpacity={0.85} />
                        <stop offset="100%" stopColor={barColorForAccuracy(c.accuracy)} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    className="text-slate-500 dark:text-slate-400"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={150}
                    tick={
                      <RichYAxisTick
                        categories={categoryAccuracy.map((c) => c.category)}
                        attempts={categoryAccuracy.map((c) => c.total)}
                      />
                    }
                    className="text-slate-600 dark:text-slate-300"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(99,102,241,0.08)" }}
                    content={
                      <RichTooltip
                        categories={categoryAccuracy.map((c) => ({
                          category: c.category,
                          accuracy: c.accuracy,
                          total: c.total,
                        }))}
                      />
                    }
                  />
                  <Bar
                    dataKey="accuracy"
                    radius={[0, 8, 8, 0]}
                    animationDuration={800}
                    animationEasing="ease-out"
                    label={
                      <RichBarLabel
                        categories={categoryAccuracy.map((c) => c.accuracy)}
                      />
                    }
                  >
                    {categoryAccuracy.map((c, i) => (
                      <Cell
                        key={i}
                        fill={`url(#bar-grad-${i})`}
                        stroke={barColorForAccuracy(c.accuracy)}
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Weak categories */}
      {weak.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <CardTitle>Focus areas</CardTitle>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your weakest categories. Drill these to lift your overall score.
            </p>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {weak.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {c.category}
                    </span>
                    <span className="text-xs text-slate-500">
                      {c.correct}/{c.total} ({formatPercent(c.accuracy)})
                    </span>
                  </div>
                  <ProgressBar
                    value={c.accuracy}
                    color={
                      c.accuracy >= 0.7
                        ? "bg-success-500"
                        : c.accuracy >= 0.4
                          ? "bg-amber-500"
                          : "bg-danger-500"
                    }
                  />
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Link href="/quiz?size=10">
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4" />
                  Practice weak categories
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/*  TAB: Question Bank                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "bank" && (
        <>
          {/* Hero stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Questions"
              value={bankTotal.toLocaleString()}
              icon={<BookOpen className="w-4 h-4" />}
              tone="primary"
            />
            <StatCard
              label="Parsed"
              value={bankStats.total_parsed.toLocaleString()}
              icon={<Database className="w-4 h-4" />}
              tone="neutral"
              hint="from all source files"
            />
            <StatCard
              label="Duplicates Removed"
              value={bankStats.duplicates_removed.toLocaleString()}
              icon={<AlertTriangle className="w-4 h-4" />}
              tone="amber"
            />
            <StatCard
              label="Categories"
              value={Object.keys(bankStats.categories).length.toString()}
              icon={<BarChart3 className="w-4 h-4" />}
              tone="success"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category distribution pie */}
            <Card>
              <CardHeader>
                <CardTitle>Questions by Category</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Distribution of unique questions across topics.
                </p>
              </CardHeader>
              <CardBody>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        {bankCats.map((_, i) => (
                          <linearGradient key={i} id={`bank-pie-${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={1} />
                            <stop offset="100%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={bankCats}
                        cx="50%"
                        cy="45%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                        dataKey="value"
                        animationDuration={800}
                      >
                        {bankCats.map((_, i) => (
                          <Cell key={i} fill={`url(#bank-pie-${i})`} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15,23,42,0.95)",
                          border: "1px solid rgba(99,102,241,0.3)",
                          borderRadius: 12,
                          color: "white",
                          fontSize: 12,
                          padding: "8px 12px",
                        }}
                        formatter={(value: number, name: string) => [`${value.toLocaleString()} questions`, name]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, color: "currentColor" }}
                        formatter={(value: string) => (
                          <span className="text-slate-700 dark:text-slate-300">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>

            {/* Answer distribution bar */}
            <Card>
              <CardHeader>
                <CardTitle>Answer Distribution</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  How many questions have each letter as the correct answer.
                </p>
              </CardHeader>
              <CardBody>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bankAnswerDist} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <defs>
                        {bankAnswerDist.map((_, i) => (
                          <linearGradient key={i} id={`ans-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={1} />
                            <stop offset="100%" stopColor={PIE_COLORS[i % PIE_COLORS.length]} stopOpacity={0.55} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                      <XAxis dataKey="letter" tick={{ fontSize: 13, fill: "currentColor", fontWeight: 700 }} className="text-slate-500 dark:text-slate-400" axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-500 dark:text-slate-400" axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15,23,42,0.95)",
                          border: "1px solid rgba(99,102,241,0.3)",
                          borderRadius: 12,
                          color: "white",
                          fontSize: 12,
                          padding: "8px 12px",
                        }}
                        formatter={(value: number) => [`${value.toLocaleString()} questions`, ""]}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} animationDuration={800}>
                        {bankAnswerDist.map((_, i) => (
                          <Cell key={i} fill={`url(#ans-bar-${i})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Category breakdown list */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Full list of categories with question counts.
              </p>
            </CardHeader>
            <CardBody className="p-4">
              <div className="space-y-1">
                {bankCats
                  .sort((a, b) => b.value - a.value)
                  .map((cat, i) => {
                    const pct = Math.round((cat.value / bankTotal) * 100);
                    return (
                      <div
                        key={cat.name}
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-default"
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0 transition-transform duration-150 group-hover:scale-125"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                          {cat.name}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums min-w-[2ch] text-right">
                          {cat.value}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 w-12 text-right tabular-nums transition-colors">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Generated: {bankStats.generated_at}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {bankTotal.toLocaleString()} total
                </span>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "primary" | "success" | "danger" | "amber" | "neutral";
}) {
  const colors = {
    primary: "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300",
    success:
      "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300",
    danger:
      "bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    neutral:
      "bg-slate-50 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  }[tone];

  return (
    <div className={`rounded-xl p-3 ${colors}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const colorClass = {
    neutral: "text-slate-900 dark:text-slate-100",
    success: "text-success-600 dark:text-success-400",
    danger: "text-danger-600 dark:text-danger-400",
  }[tone];
  return (
    <div>
      <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
