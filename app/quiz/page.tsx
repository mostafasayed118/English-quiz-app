import { Suspense } from "react";
import { QuizEngine } from "@/components/quiz/QuizEngine";

export default function QuizPage() {
  return (
    <Suspense fallback={null}>
      <QuizEngine />
    </Suspense>
  );
}
