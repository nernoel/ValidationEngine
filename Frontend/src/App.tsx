import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";

type ValidationResponse = {
  id?: string | null;
  title?: string | null;
  user_idea: string;
  narrowed_down_idea: string;
  pros: string;
  cons: string;
  difficulty_score: string;
  competitors_list: string;
  validation_score: string;
  validation_score_reasoning: string;
  created_at?: string | null;
};

type ApiError = {
  detail?: string;
};

type ValidationSummary = {
  id: string;
  title: string;
  user_idea: string;
  validation_score: string;
  difficulty_score: string;
  created_at: string;
};

const starterIdea =
  "A platform where users can review books from authors and swipe left or right on recommended books";

const agentSteps = [
  "✨ Generating response...",
  "✨ Creating pros and cons...",
  "✨ Refining the business angle...",
  "✨ Mapping competitor context...",
  "✨ Scoring validation signals...",
  "✨ Polishing the final brief..."
];

const CHARACTER_LIMIT = 1000;

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function makeTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  return title.length > 40 ? `${title.slice(0, 38).trim()}...` : title;
}

function parseScoreToPercentage(value: string | undefined | null): number {
  if (!value) return 0;
  const match = value.match(/\d+/);
  if (!match) {
    // Basic letter grade fallback mapping
    const normalized = value.toUpperCase().trim();
    if (normalized.startsWith("A")) return 92;
    if (normalized.startsWith("B")) return 75;
    if (normalized.startsWith("C")) return 55;
    if (normalized.startsWith("D")) return 35;
    return 50;
  }
  const num = parseInt(match[0], 10);
  if (num <= 10) return num * 10; // Map 1-10 scores to percentage
  return Math.min(num, 100);
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiError;
    return data.detail || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function App() {
  const [idea, setIdea] = useState(starterIdea);
  const [result, setResult] = useState<ValidationResponse | null>(null);
  const [savedIdeas, setSavedIdeas] = useState<ValidationSummary[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [deletingIdeaId, setDeletingIdeaId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch("/api/validations")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        return response.json() as Promise<ValidationSummary[]>;
      })
      .then((data) => {
        if (!ignore) {
          setSavedIdeas(data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSavedIdeas([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setActiveStep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % agentSteps.length);
    }, 1800);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  const canSubmit = useMemo(() => {
    const trimmed = idea.trim();
    return trimmed.length >= 10 && trimmed.length <= CHARACTER_LIMIT && !isLoading;
  }, [idea, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ user_idea: idea.trim() })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as ValidationResponse;
      setResult(data);

      confetti({
        particleCount: 80,
        spread: 50,
        origin: { y: 0.75 },
        colors: ["#2563eb", "#3b82f6", "#1e3a8a", "#a1a1aa"]
      });

      if (data.id && data.created_at) {
        setActiveHistoryId(data.id);
        setSavedIdeas((current) => [
          {
            id: data.id as string,
            title: data.title || makeTitle(data.user_idea),
            user_idea: data.user_idea,
            validation_score: data.validation_score,
            difficulty_score: data.difficulty_score,
            created_at: data.created_at as string
          },
          ...current.filter((item) => item.id !== data.id)
        ]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error occured try again.";
      setError(`Analysis stopped. ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSavedValidation(validationId: string) {
    setError("");
    setIsHistoryLoading(true);
    setActiveHistoryId(validationId);

    try {
      const response = await fetch(`/api/validations/${validationId}`);
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as ValidationResponse;
      setResult(data);
      setIdea(data.user_idea);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not retrieve records.";
      setError(message);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function deleteSavedValidation(validationId: string) {
    setError("");
    setDeletingIdeaId(validationId);

    try {
      const response = await fetch(`/api/validations/${validationId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setSavedIdeas((current) => current.filter((item) => item.id !== validationId));

      if (activeHistoryId === validationId) {
        setActiveHistoryId(null);
        setResult(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete record.";
      setError(`Delete failed. ${message}`);
    } finally {
      setDeletingIdeaId(null);
    }
  }

  function startNewIdea() {
    setIdea("");
    setResult(null);
    setError("");
    setActiveHistoryId(null);
  }

  const pros = splitLines(result?.pros ?? "");
  const cons = splitLines(result?.cons ?? "");
  const competitors = splitLines(result?.competitors_list ?? "");

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-zinc-950 antialiased font-sans selection:bg-fuchsia-200/70">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_8%,rgba(59,130,246,0.30),transparent_30%),radial-gradient(circle_at_74%_4%,rgba(168,85,247,0.28),transparent_32%),radial-gradient(circle_at_92%_72%,rgba(251,146,60,0.24),transparent_30%),radial-gradient(circle_at_18%_86%,rgba(16,185,129,0.22),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f8fafc_32%,#dbeafe_62%,#f5f3ff_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.86),transparent)] animate-ambient-gradient" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <div className="pointer-events-none fixed left-[34%] top-16 -z-10 h-40 w-40 rounded-full bg-blue-400/20 blur-3xl animate-soft-orbit" />
      <div className="pointer-events-none fixed bottom-12 right-16 -z-10 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl animate-soft-orbit" />
      <div className="flex min-h-screen">
        {/* Modern Sidebar Panel */}
        <aside className="hidden w-72 shrink-0 border-r border-white/70 bg-white/70 shadow-[inset_-1px_0_0_rgba(24,24,27,0.08)] backdrop-blur-2xl sm:flex sm:flex-col lg:w-80">
          <div className="flex flex-col h-full px-5 py-6 justify-between">
            <div className="space-y-6">
              <button
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-900 bg-gradient-to-r from-zinc-950 via-slate-900 to-blue-950 px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(37,99,235,0.28)] active:scale-[0.99]"
                onClick={startNewIdea}
                type="button"
              >
                <span className="text-zinc-300 font-medium text-base leading-none">+</span> New Assessment
              </button>

              <section>
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">Previous ideas</h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                    {savedIdeas.length}
                  </span>
                </div>

                {savedIdeas.length > 0 ? (
                  <div className="space-y-1 max-h-[62vh] overflow-y-auto pr-1 quiet-scrollbar">
                    {savedIdeas.map((item) => (
                      <div
                        className={`group flex items-start gap-1 rounded-lg px-2 py-2 transition ${
                          activeHistoryId === item.id
                            ? "bg-white text-zinc-950 shadow-md ring-1 ring-zinc-300"
                            : "text-zinc-700 hover:bg-white/90 hover:text-zinc-950"
                        }`}
                        key={item.id}
                      >
                        <button
                          className="min-w-0 flex-1 text-left text-sm"
                          disabled={isHistoryLoading || deletingIdeaId === item.id}
                          onClick={() => void loadSavedValidation(item.id)}
                          type="button"
                        >
                          <span className={`block truncate ${activeHistoryId === item.id ? "font-semibold" : ""}`}>{item.title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-600 font-medium group-hover:text-zinc-700">
                            <span>Idx: {item.validation_score || "—"}</span>
                            <span className="text-zinc-400">•</span>
                            <span>Fric: {item.difficulty_score || "—"}</span>
                          </span>
                        </button>
                        <button
                          aria-label={`Delete ${item.title}`}
                          className="mt-0.5 rounded-md px-2 py-1 text-sm text-zinc-500 opacity-0 transition hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={deletingIdeaId === item.id}
                          onClick={() => void deleteSavedValidation(item.id)}
                          type="button"
                        >
                          {deletingIdeaId === item.id ? "…" : "×"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-center text-xs leading-relaxed text-zinc-600">
                    Past idea validations will show up here
                  </div>
                )}
              </section>
            </div>

            <div className="text-[11px] text-zinc-600 font-mono px-1">
              Validation Engine // active
            </div>
          </div>
        </aside>

        {/* Primary Analytical Canvas */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Engine Header */}
          <header className="sticky top-0 z-10 border-b border-white/70 bg-white/70 px-6 py-4 shadow-sm backdrop-blur-2xl md:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-fuchsia-50 text-sm font-bold text-blue-700 shadow-sm">
                  ✨
                </div>
                <div>
                  <h1 className="text-base font-extrabold tracking-tight text-zinc-950">
                    Idea validation engine
                  </h1>
                  <p className="text-xs font-medium text-zinc-600">AI business signal workspace</p>
                </div>
              </div>
            </div>
          </header>

          {/* Core Workspace Interface Grid */}
          <div className="grid flex-1 gap-8 p-6 md:p-8 lg:grid-cols-[420px_1fr]">
            {/* Business Idea Input Console */}
            <section className="h-fit space-y-4">
              <div className="rounded-2xl border border-white/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(37,99,235,0.13)] backdrop-blur-xl">
                <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                  <div>
                    <h2 className="text-sm font-bold tracking-wider text-zinc-900 uppercase">Idea to be validated</h2>
                    <p className="mt-1 text-sm text-zinc-600 leading-relaxed">Submit your idea or business concept for analysis.</p>
                  </div>

                  <div className="flex flex-col">
                    <textarea
                      className="h-52 w-full resize-none rounded-xl border border-zinc-300 bg-white p-4 text-sm leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      id="idea"
                      value={idea}
                      minLength={10}
                      maxLength={CHARACTER_LIMIT}
                      onChange={(event) => setIdea(event.target.value)}
                      placeholder="Describe your market mechanism, user base, or product value proposition..."
                    />

                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs font-mono ${idea.length >= CHARACTER_LIMIT ? 'text-red-600 font-bold' : 'text-zinc-600'}`}>
                        {idea.length} / {CHARACTER_LIMIT}
                      </span>
                      <button
                        className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(24,24,27,0.2)] transition hover:-translate-y-0.5 hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                        type="submit"
                        disabled={!canSubmit}
                      >
                        {isLoading ? "Working..." : "Run Assessment"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            {/* Structured Feedback Data Stream */}
            <section className="min-w-0 space-y-6">
              {isLoading && <AgentLoading activeStep={activeStep} />}

              {error && (
                <article className="rounded-2xl border border-red-200/60 bg-red-50/70 p-4 text-red-900 shadow-sm backdrop-blur-xl" role="alert">
                  <p className="text-xs font-bold">An error occured please try again later</p>
                  <p className="mt-1 text-xs text-red-700/90 leading-relaxed">{error}</p>
                </article>
              )}

              {!isLoading && !error && !result && <EmptyOutput />}

              {result && (
                <div className="space-y-6 animate-[fadeIn_0.35s_ease-out]">

                  {/* Dynamic Progress/Bar Performance Metrics Grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ScoreCard label="Market Validation Score" value={result.validation_score || "—"} detail="Aggregated Feasibility & Viability" />
                    <ScoreCard label="Execution Barrier Friction" value={result.difficulty_score || "—"} detail="Operational Complexity Vector" />
                  </div>

                  <OutputPanel title="Refined Value Proposition">
                    <p className="text-sm leading-relaxed text-zinc-800 font-medium">{result.narrowed_down_idea}</p>
                  </OutputPanel>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ResultList title="Growth Catalysts (Pros)" items={pros} tone="positive" />
                    <ResultList title="Inertia & Structural Risk (Cons)" items={cons} tone="negative" />
                  </div>

                  <ResultList title="Mapped Competitors & Composites" items={competitors} tone="neutral" />

                  <OutputPanel title="Synthesis Realignment Intelligence">
                    <p className="text-sm leading-relaxed text-zinc-800 font-normal whitespace-pre-line">{result.validation_score_reasoning}</p>
                  </OutputPanel>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function AgentLoading({ activeStep }: { activeStep: number }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-zinc-300/80 bg-white/85 p-6 shadow-[0_28px_90px_rgba(24,24,27,0.12)] backdrop-blur-xl" aria-live="polite">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent animate-gradient-sweep" />
      <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-zinc-300/30 blur-3xl animate-soft-orbit" />
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/90 bg-gradient-to-br from-white via-zinc-100 to-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_44px_rgba(24,24,27,0.12)]">
          <span className="absolute -right-1 -top-1 text-sm animate-sparkle-pop select-none">✨</span>
          <span className="text-xl animate-breathe select-none">✦</span>
          <span className="absolute inset-0 rounded-2xl border border-zinc-950/10 animate-ping [animation-duration:2s]" />
        </div>

        <div className="h-6 overflow-hidden">
          <h2 key={activeStep} className="bg-gradient-to-r from-zinc-950 via-blue-600 to-amber-600 bg-[length:220%_100%] bg-clip-text text-sm font-bold tracking-tight text-transparent animate-gradient-text">
            {agentSteps[activeStep]}
          </h2>
        </div>
        <p className="mt-1 text-xs text-zinc-600 max-w-xs leading-relaxed">
          The model is turning your concept into a practical business brief.
        </p>
      </div>

      <div className="mt-2 pt-4 border-t border-zinc-100 space-y-2">
        {agentSteps.map((step, index) => {
          const isActive = index === activeStep;
          const isPassed = index < activeStep;
          return (
            <div
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-all duration-300 ${
                isActive ? "border border-zinc-200/80 bg-white shadow-sm" : "border border-transparent"
              }`}
              key={step}
            >
              <div className="flex items-center gap-3 truncate">
                <div className="relative flex items-center justify-center w-2 h-2">
                  {isActive ? (
                    <span className="absolute h-1.5 w-1.5 rounded-full bg-zinc-950 animate-pulse" />
                  ) : (
                    <span className={`h-1 w-1 rounded-full ${isPassed ? "bg-zinc-900" : "bg-zinc-200"}`} />
                  )}
                </div>
                <span className={`text-xs font-medium transition-colors truncate ${isActive ? "text-zinc-950 font-semibold" : isPassed ? "text-zinc-700" : "text-zinc-500"}`}>
                  {step}
                </span>
              </div>
              {isPassed && <span className="text-xs text-emerald-600 font-bold">✓</span>}
              {isActive && <span className="text-[10px] font-mono text-blue-600 animate-pulse">Running</span>}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function EmptyOutput() {
  return (
    <article className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(24,24,27,0.08)] backdrop-blur-xl">
      <div className="max-w-xs">
        <div className="mx-auto mb-3 text-base text-amber-600 font-mono animate-breathe">◇</div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Output for validated idea will be here</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Provide your idea  inside the text box to generate structured pros, cons, and analysis score of your idea.
        </p>
      </div>
    </article>
  );
}

function ScoreCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const percentage = parseScoreToPercentage(value);

  return (
    <article className="rounded-2xl border border-zinc-300/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(24,24,27,0.09)] backdrop-blur-xl flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-baseline">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">{label}</p>
          <strong className="text-lg font-bold tracking-tight text-blue-700 font-mono">{value}</strong>
        </div>

        {/* Animated Bar Segment */}
        <div className="mt-3.5 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden relative">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out animate-[slideRight_1.2s_ease-out]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="mt-4 text-xs font-medium text-zinc-600 block border-t border-zinc-200 pt-2">
        {detail}
      </span>
    </article>
  );
}

function OutputPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-zinc-300/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(24,24,27,0.09)] backdrop-blur-xl">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-600">{title}</h2>
      {children}
    </article>
  );
}

function ResultList({
  title,
  items,
  tone
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <article className="rounded-2xl border border-zinc-300/70 bg-white/85 p-5 shadow-[0_18px_60px_rgba(24,24,27,0.09)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600">{title}</h2>
        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-300/70">
          {items.length} Data Points
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li className="flex gap-2.5 text-sm leading-relaxed text-zinc-700" key={item}>
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "positive" ? "bg-emerald-600" : tone === "negative" ? "bg-amber-600" : "bg-blue-600"
              }`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500 italic">No structured indicators parsed.</p>
      )}
    </article>
  );
}

export default App;