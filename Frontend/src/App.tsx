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
  "A platform where local chefs can rent restaurant kitchens during off-hours for pop-up dining experiences.";

const agentSteps = [
  "Analyzing startup concept...",
  "Refining niche & positioning...",
  "Evaluating risks & upside...",
  "Mapping market landscape...",
  "Calculating feasibility & opportunity scores...",
  "Formatting validation dossier..."
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
  return title.length > 54 ? `${title.slice(0, 51).trim()}...` : title;
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
    }, 1500);

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

      // Trigger beautiful premium confetti celebration!
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.65 },
        colors: ["#3b82f6", "#10b981", "#6366f1", "#f59e0b", "#ec4899"]
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
      const message = err instanceof Error ? err.message : "Start the local API and model service, then try again.";
      setError(`Validation could not run yet. ${message}`);
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
      const message = err instanceof Error ? err.message : "Could not load saved validation.";
      setError(message);
    } finally {
      setIsHistoryLoading(false);
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
    <div className="min-h-screen bg-slate-50 text-slate-700 antialiased">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200/60 bg-slate-100/90 sm:flex sm:flex-col lg:w-72">
          <div className="quiet-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-6">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-600/5 px-4 py-3 text-center text-sm font-extrabold text-blue-600 shadow-sm transition hover:bg-blue-600 hover:text-white"
              onClick={startNewIdea}
              type="button"
            >
              <span>+</span> new idea
            </button>

            <section>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Saved runs</h2>
                <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  {savedIdeas.length}
                </span>
              </div>

              {savedIdeas.length > 0 ? (
                <div className="space-y-2">
                  {savedIdeas.map((item) => (
                    <button
                      className={`w-full rounded-xl border px-3 py-3 text-left shadow-sm transition ${
                        activeHistoryId === item.id
                          ? "border-blue-200 bg-blue-50/70 text-blue-700"
                          : "border-slate-200/50 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600"
                      }`}
                      disabled={isHistoryLoading}
                      key={item.id}
                      onClick={() => void loadSavedValidation(item.id)}
                      type="button"
                    >
                      <span className="block truncate text-sm font-extrabold">{item.title}</span>
                      <span className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                        <span>Score: {item.validation_score || "-"}</span>
                        <span>/</span>
                        <span>Diff: {item.difficulty_score || "-"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-4 text-center text-xs leading-5 text-slate-400">
                  Validated ideas will appear here for easy retrieval.
                </div>
              )}
            </section>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 border-b border-slate-200/50 bg-white/80 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-base shadow-md shadow-blue-500/20">
                🚀
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Get quick insight into your ideas</p>
                <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-800 md:text-2xl">
                  Validation Engine
                </h1>
              </div>
            </div>
          </header>

          {/* Grid Layout */}
          <div className="grid flex-1 gap-6 p-4 md:p-8 xl:grid-cols-[minmax(420px,0.85fr)_minmax(0,1.15fr)]">
            {/* Input Form Column */}
            <section className="editor-grid h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">Idea Pitch</h2>
                      <p className="mt-0.5 text-sm text-slate-400">Describe the concept in plain English.</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600">
                      System is currently active
                    </span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400" htmlFor="idea">
                    Business Concept
                  </label>
                  
                  {/* Fixed Size Text Area with character limits */}
                  <textarea
                    className="h-44 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-[15px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                    id="idea"
                    value={idea}
                    minLength={10}
                    maxLength={CHARACTER_LIMIT}
                    onChange={(event) => setIdea(event.target.value)}
                    placeholder="Example: A platform where local chefs can rent restaurant kitchens during off-hours for pop-up dining experiences."
                  />

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className={`text-xs font-bold ${idea.length >= CHARACTER_LIMIT ? 'text-rose-500' : 'text-slate-400'}`}>
                      {idea.length} / {CHARACTER_LIMIT} characters
                    </span>
                    <button
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-blue-500/10 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      type="submit"
                      disabled={!canSubmit}
                    >
                      {isLoading ? "Analyzing..." : "Assess Opportunity"}
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* Results Display Column */}
            <section className="min-w-0 space-y-6">
              {isLoading && <AgentLoading activeStep={activeStep} />}

              {error && (
                <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800 shadow-sm" role="alert">
                  <p className="text-sm font-black">Connection/Model Error</p>
                  <p className="mt-2 text-sm leading-6 text-rose-600/90">{error}</p>
                </article>
              )}

              {!isLoading && !error && !result && <EmptyOutput />}

              {result && (
                <div className="space-y-6 animate-fade-in">
                  {/* Beautiful marker showing validation success */}
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm">
                    <span className="text-base">✨</span>
                    <span>Analysis generated successfully! Below is your assessed the opportunities and risks.</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ScoreCard label="Validation Grade" value={result.validation_score || "N/A"} detail="Opportunity Rating" />
                    <ScoreCard label="Execution Barrier" value={result.difficulty_score || "N/A"} detail="Difficulty Rating" />
                  </div>

                  <OutputPanel title="Refined Concept">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800 font-medium">{result.narrowed_down_idea}</p>
                  </OutputPanel>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ResultList title="Upside & Strengths (Pros)" items={pros} tone="positive" />
                    <ResultList title="Risks & Vulnerabilities (Cons)" items={cons} tone="negative" />
                  </div>

                  <ResultList title="Competitors Identified" items={competitors} tone="neutral" />

                  <OutputPanel title="Opportunity Synthesis">
                    <p className="text-sm leading-7 text-slate-800 font-medium">{result.validation_score_reasoning}</p>
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
    <article className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 shadow-sm" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.04),transparent_22rem)]" />
      <div className="relative">
        <div className="flex items-start gap-4">
          <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-base shadow-sm">
            <span className="animate-spin text-blue-500">⚙️</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-500">Pipeline running</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">{agentSteps[activeStep]}</h2>
            <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
              Ollama is evaluating the concept. Local generation models may take up to a minute.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
          {agentSteps.map((step, index) => (
            <div
              className={`flex items-center gap-3 rounded-lg px-3 py-1.5 transition ${
                index === activeStep ? "bg-blue-50/50 text-blue-700" : "text-slate-400"
              }`}
              key={step}
            >
              <span className={`text-[10px] ${index === activeStep ? "animate-pulse text-blue-500" : "text-slate-300"}`}>
                {index === activeStep ? "●" : "○"}
              </span>
              <span className={`truncate text-xs font-bold ${index === activeStep ? "text-blue-700" : "text-slate-400"}`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function EmptyOutput() {
  return (
    <article className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-slate-100 bg-slate-50 text-lg shadow-sm">
          💡
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800">Assessment Brief</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Run your startup pitch on the left to see Llama's score, refined concept description, pros, cons, and competitive mapping.
        </p>
      </div>
    </article>
  );
}

function ScoreCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const isDifficulty = label.toLowerCase().includes("difficulty") || label.toLowerCase().includes("barrier");
  const bgClass = isDifficulty ? "bg-amber-50/50 border-amber-100" : "bg-blue-50/50 border-blue-100";
  const textClass = isDifficulty ? "text-amber-700" : "text-blue-700";
  const badgeClass = isDifficulty ? "bg-amber-100/80 text-amber-800" : "bg-blue-100/80 text-blue-800";

  return (
    <article className={`rounded-2xl border ${bgClass} p-5 shadow-sm`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <strong className={`text-4xl font-extrabold leading-none tracking-tight ${textClass}`}>{value}</strong>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>
          {detail}
        </span>
      </div>
    </article>
  );
}

function OutputPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</h2>
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
  const toneClass =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "negative"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  const badgeClass =
    tone === "positive"
      ? "bg-emerald-100/80 text-emerald-800"
      : tone === "negative"
        ? "bg-rose-100/80 text-rose-800"
        : "bg-slate-100/80 text-slate-800";

  return (
    <article className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
          {items.length} points
        </span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li className="flex gap-3 text-sm leading-6 text-slate-700 font-medium" key={item}>
              <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[9px] font-extrabold ${toneClass}`}>
                {tone === "negative" ? "✕" : tone === "positive" ? "✓" : "●"}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400 italic">No points returned.</p>
      )}
    </article>
  );
}

export default App;
