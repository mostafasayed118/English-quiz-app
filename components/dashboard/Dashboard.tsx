"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, ListTodo, PieChart as PieIcon } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { StatCard } from "./StatCard";
import { ResetProgressButton } from "./ResetProgressButton";
import { CategoryFilter } from "./CategoryFilter";
import { useQuizStore } from "@/lib/store";
import { computeAggregate } from "@/lib/stats";
import {
  filterQuestions,
  getAllQuestions,
  getAllCategories,
} from "@/lib/questions";
import { formatPercent } from "@/lib/utils";

const PIE_COLORS = [
  "#10b981", // success
  "#f43f5e", // danger
  "#f59e0b", // amber
  "#6366f1", // primary
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#a855f7",
];

export function Dashboard() {
  const attempts = useQuizStore((s) => s.attempts);
  const bookmarks = useQuizStore((s) => s.bookmarks);
  const selectedCategories = useQuizStore((s) => s.selectedCategories);
  const hideSolved = useQuizStore((s) => s.hideSolved);

  const totalQuestions = getAllQuestions().length;
  const categories = getAllCategories();

  // The full filtered pool — used to scope the dashboard to the user's
  // current filter selection. When filter is "all" this equals every question.
  const filteredPool = useMemo(
    () => filterQuestions(selectedCategories, hideSolved, attempts, bookmarks),
    [selectedCategories, hideSolved, attempts, bookmarks],
  );

  // Recompute aggregate stats from the filtered pool + ALL attempts (so we
  // can still credit correct/incorrect answers that were answered while the
  // user was on a different filter).
  const stats = useMemo(() => {
    const allowedIds = new Set(filteredPool.map((q) => q.id));
    const scopedAttempts: Record<number, (typeof attempts)[number]> = {};
    for (const [id, a] of Object.entries(attempts)) {
      if (allowedIds.has(Number(id))) scopedAttempts[Number(id)] = a;
    }
    return computeAggregate(filteredPool.length, scopedAttempts);
  }, [filteredPool, attempts]);

  // Also keep a global "all questions" version for the "Solved" hint.
  const globalStats = useMemo(
    () => computeAggregate(totalQuestions, attempts),
    [attempts, totalQuestions],
  );

  const isFiltered = selectedCategories !== "all" || hideSolved;

  // Data for the "by category solved" bar chart (top 9 categories that are
  // visible under the current filter).
  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of Object.values(attempts)) {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    const visibleCats = new Set(filteredPool.map((q) => q.category));
    return categories
      .filter((cat) => visibleCats.has(cat))
      .map((cat) => ({ category: cat, solved: counts.get(cat) ?? 0 }))
      .sort((a, b) => b.solved - a.solved)
      .slice(0, 9);
  }, [attempts, categories, filteredPool]);

  const pieData = [
    { name: "Correct", value: stats.correct, color: "#10b981" },
    { name: "Incorrect", value: stats.incorrect, color: "#f43f5e" },
    { name: "Remaining", value: stats.remaining, color: "#cbd5e1" },
  ].filter((d) => d.value > 0);

  const accuracy = formatPercent(stats.accuracy);

  return (
    <div className="space-y-6">
      {/* Hero / quick start */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white shadow-soft">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(at 20% 20%, rgba(255,255,255,.4) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(255,255,255,.2) 0px, transparent 50%)",
            }}
          />
          <div className="relative p-6 md:p-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-100">
                Welcome back
                {isFiltered && (
                  <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/20 text-white/90 normal-case font-medium">
                    Filtered
                  </span>
                )}
              </p>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold leading-tight">
                {stats.solved === 0
                  ? "Ready to start your first quiz?"
                  : `You've solved ${stats.solved.toLocaleString()} ${
                      isFiltered ? "filtered " : ""
                    }questions so far.`}
              </h1>
              <p className="mt-2 text-sm text-primary-100/90 max-w-md">
                {stats.remaining > 0
                  ? `${stats.remaining.toLocaleString()} questions remain${
                      isFiltered ? " in this filter" : ""
                    }. Practice 10, 20, or 50 in one session.`
                  : isFiltered
                    ? "Every question in the current filter has been answered. Tweak the filter to keep practicing."
                    : "You've answered every question in the bank. Reset progress to start over."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="/quiz?size=10"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow hover:shadow-glow transition-shadow"
                >
                  Start 10-Question Quiz
                </a>
                <a
                  href="/quiz?size=25"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  25 Questions
                </a>
                <a
                  href="/quiz?size=50"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  50 Questions
                </a>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <ProgressRing
                value={stats.total > 0 ? stats.solved / stats.total : 0}
                size={140}
                strokeWidth={12}
                color="stroke-white"
                displayValue={`${stats.solved.toLocaleString()}`}
                label={`of ${stats.total.toLocaleString()}${
                  isFiltered ? " (filtered)" : ""
                }`}
                className="[&_div]:text-white"
              />
            </div>
          </div>
        </div>

        {/* Accuracy ring */}
        <Card>
          <CardBody className="flex flex-col items-center justify-center text-center">
            <ProgressRing
              value={stats.accuracy}
              size={160}
              strokeWidth={14}
              color={
                stats.accuracy >= 0.8
                  ? "stroke-success-500"
                  : stats.accuracy >= 0.5
                    ? "stroke-amber-500"
                    : "stroke-danger-500"
              }
              displayValue={accuracy}
              label="Accuracy"
            />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 max-w-[18rem]">
              {stats.solved === 0
                ? "Answer your first question to see your accuracy here."
                : stats.accuracy >= 0.8
                  ? "Excellent! You're mastering this material."
                  : stats.accuracy >= 0.5
                    ? "Good progress. Focus on weak categories to improve."
                    : "Keep going — review explanations to strengthen weak spots."}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={isFiltered ? "In Filter" : "Total Questions"}
          value={stats.total.toLocaleString()}
          icon={<ListTodo className="w-4 h-4" />}
          tone="primary"
          hint={
            isFiltered
              ? `${totalQuestions.toLocaleString()} in the full bank`
              : undefined
          }
        />
        <StatCard
          label="Solved"
          value={stats.solved.toLocaleString()}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="success"
          hint={
            isFiltered
              ? `${globalStats.solved.toLocaleString()} solved overall`
              : `${stats.remaining.toLocaleString()} remaining`
          }
        />
        <StatCard
          label="Correct"
          value={stats.correct.toLocaleString()}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="success"
        />
        <StatCard
          label="Incorrect"
          value={stats.incorrect.toLocaleString()}
          icon={<PieIcon className="w-4 h-4" />}
          tone="danger"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Solved by category</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Distribution of your solved questions across topics.
            </p>
          </CardHeader>
          <CardBody>
            {stats.solved === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                No data yet — answer a few questions to populate this chart.
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <defs>
                      {categoryData.map((_, i) => (
                        <linearGradient
                          key={i}
                          id={`dash-bar-grad-${i}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={PIE_COLORS[i % PIE_COLORS.length]}
                            stopOpacity={1}
                          />
                          <stop
                            offset="100%"
                            stopColor={PIE_COLORS[i % PIE_COLORS.length]}
                            stopOpacity={0.55}
                          />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-800"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="category"
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      className="text-slate-500 dark:text-slate-400"
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "currentColor" }}
                      className="text-slate-500 dark:text-slate-400"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(99,102,241,0.3)",
                        borderRadius: 12,
                        color: "white",
                        fontSize: 12,
                        padding: "8px 12px",
                      }}
                      itemStyle={{ color: "white" }}
                      cursor={{ fill: "rgba(99,102,241,0.08)" }}
                      formatter={(value: number) => [
                        value.toLocaleString(),
                        "Solved",
                      ]}
                    />
                    <Bar
                      dataKey="solved"
                      radius={[6, 6, 0, 0]}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {categoryData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={`url(#dash-bar-grad-${i})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Answer breakdown</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Correct vs incorrect vs remaining.
            </p>
          </CardHeader>
          <CardBody>
            {stats.solved === 0 ? (
              <div className="h-72 flex items-center justify-center text-sm text-slate-400">
                No data yet.
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {pieData.map((entry, i) => (
                        <linearGradient
                          key={i}
                          id={`pie-grad-${i}`}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={92}
                      paddingAngle={3}
                      stroke="#fff"
                      strokeWidth={2}
                      dataKey="value"
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={`url(#pie-grad-${i})`} />
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
                      itemStyle={{ color: "white" }}
                      formatter={(value: number, name: string) => [
                        value.toLocaleString(),
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{
                        fontSize: 12,
                        paddingTop: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Filters + actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CategoryFilter />
        </div>
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Manage progress
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Reset everything to start fresh. There&apos;s no cloud sync —
              this lives in your browser.
            </p>
            <ResetProgressButton />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
