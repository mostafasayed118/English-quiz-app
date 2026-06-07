# English Quiz App

A production-ready, gamified English MCQ practice application built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Zustand, and Recharts.

## Features

- **Smart Dashboard** — overview of total, solved, remaining, correct, incorrect questions with donut/ring progress charts.
- **Adaptive Quiz Engine** — one question at a time, instant visual feedback, explanations, navigation.
- **Hide Solved / Bookmark** — global toggle and per-question bookmarks, all persisted in `localStorage` via Zustand.
- **Category Filter** — sidebar / dropdown filter by category (Grammar, Vocabulary, Tenses, etc.).
- **Results & Analytics** — accuracy, time spent, per-category accuracy, weak-area breakdown.
- **Light & Dark Mode** — with system preference detection and smooth transition.
- **Responsive** — mobile, tablet, desktop, with full keyboard navigation and ARIA labels.

## Tech Stack

| Layer | Library |
| --- | --- |
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS 3 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| State | Zustand (with `persist` middleware → `localStorage`) |
| Fonts | Inter via `next/font` |

## Setup

```bash
cd english-quiz-app
npm install
npm run dev
```

The app runs at `http://localhost:3000`. Open it in your browser and start quizzing.

## Project Structure

```
english-quiz-app/
├── app/
│   ├── layout.tsx          # Root layout, fonts, theme provider
│   ├── page.tsx            # Home / Dashboard
│   ├── quiz/
│   │   └── page.tsx        # Quiz session page
│   ├── analytics/
│   │   └── page.tsx        # Results & charts
│   ├── globals.css         # Tailwind directives + base styles
│   └── providers.tsx       # Theme + persisted store hydration
├── components/
│   ├── ui/                 # Button, Card, Modal, Toggle, ProgressRing, etc.
│   ├── dashboard/          # Dashboard widgets
│   ├── quiz/               # QuestionCard, QuizEngine, OptionButton
│   ├── analytics/          # StatsChart, CategoryBreakdown
│   └── shared/             # Navbar, Sidebar, ThemeToggle
├── data/
│   └── questions.json      # 2,262 MCQs loaded at build time
├── lib/
│   ├── store.ts            # Zustand store with localStorage persist
│   ├── types.ts            # Question, Attempt, Stats types
│   ├── questions.ts        # Server-side loader + filter utilities
│   ├── stats.ts            # Pure stats computation helpers
│   └── utils.ts            # cn(), formatters, classNames helper
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
├── tsconfig.json
└── package.json
```

## Data Schema

Each entry in `data/questions.json` follows:

```ts
type Question = {
  id: number;
  category: string;
  question: string;
  options: [string, string, string, string]; // 4 options
  correctAnswer: string;
  explanation: string;
};
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | Lint with `next lint` |

## Replacing the Question Bank

Drop your own JSON file at `data/questions.json` (same shape) and restart the dev server. The app loads it on the server and ships only the IDs you need at runtime.

## License

MIT
