import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type HealthResponse = {
  status: string;
  model: string;
};

type ValidationResponse = {
  user_idea: string;
  narrowed_down_idea: string;
  pros: string;
  cons: string;
  difficulty_score: string;
  competitors_list: string;
  validation_score: string;
  validation_score_reasoning: string;
};

type ApiError = {
  detail?: string;
};

const starterIdea =
  "A platform where local chefs can rent restaurant kitchens during off-hours for pop-up dining experiences.";

const savedIdeas = [
  { title: "Pop-up dining kitchens", meta: "Food marketplace" },
  { title: "AI tutor for trade schools", meta: "Edtech" },
  { title: "Micro gyms in apartments", meta: "Wellness" },
  { title: "Contractor bid assistant", meta: "Construction SaaS" }
];

const agentSteps = [
  "Reading the idea",
  "Finding the sharpest version",
  "Weighing upside and risk",
  "Checking the market map",
  "Scoring the opportunity",
  "Preparing the validation brief"
];

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
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
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [result, setResult] = useState<ValidationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    fetch("/health")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        return response.json() as Promise<HealthResponse>;
      })
      .then((data) => {
        if (!ignore) {
          setHealth(data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setHealth({ status: "offline", model: "" });
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
    }, 1700);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  const canSubmit = useMemo(() => idea.trim().length >= 10 && !isLoading, [idea, isLoading]);

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

      setResult((await response.json()) as ValidationResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Start the local API and model service, then try again.";
      setError(`Validation could not run yet. ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  const pros = splitLines(result?.pros ?? "");
  const cons = splitLines(result?.cons ?? "");
  const competitors = splitLines(result?.competitors_list ?? "");
  const isReady = health?.status === "ok";
  const statusLabel = health ? (isReady ? "ready" : "offline") : "checking";
  const statusDetail = isReady ? "local model connected" : "waiting for local service";

  return (
    <div className="min-h-screen bg-[#111318] font-mono text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0b0d12] sm:flex sm:flex-col lg:w-72">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-600 text-sm font-black text-white shadow-[0_0_32px_rgba(37,99,235,0.35)]">
                IV
              </div>
              <div>
                <p className="text-sm font-bold text-white">Idea Validator</p>
                <p className="text-xs text-zinc-500">personal workspace</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
            <button
              className="w-full rounded-md border border-blue-500/40 bg-blue-600/15 px-4 py-3 text-left text-sm font-bold text-blue-100 transition hover:border-blue-400 hover:bg-blue-600/25"
              type="button"
            >
              + new idea
            </button>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">Saved ideas</h2>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-500">soon</span>
              </div>

              <div className="space-y-2">
                {savedIdeas.map((item, index) => (
                  <button
                    className={`w-full rounded-md border px-3 py-3 text-left transition ${
                      index === 0
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                    key={item.title}
                    type="button"
                  >
                    <span className="block truncate text-sm font-bold text-zinc-100">{item.title}</span>
                    <span className="mt-1 block text-xs text-zinc-600">{item.meta}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-600">Status</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isReady ? "bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.9)]" : "bg-zinc-500"
                  }`}
                />
                <p className="truncate text-xs text-zinc-400">{statusLabel}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111318]/90 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-400">Startup idea validation</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-white md:text-3xl">
                  Enter your business idea
                </h1>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className={`h-2.5 w-2.5 rounded-full ${isReady ? "bg-blue-400" : "bg-zinc-500"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-200">{statusLabel}</p>
                  <p className="max-w-64 truncate text-xs text-zinc-500">{statusDetail}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="grid flex-1 gap-5 p-4 md:p-8 xl:grid-cols-[minmax(430px,0.9fr)_minmax(0,1.1fr)]">
            <section className="editor-grid-dark rounded-lg border border-white/10 bg-[#171a21] shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
              <form className="flex h-full min-h-[520px] flex-col" onSubmit={handleSubmit}>
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-white">Idea input</h2>
                      <p className="mt-1 text-sm text-zinc-500">Describe the concept. Keep it rough or specific.</p>
                    </div>
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                      validate
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <label className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500" htmlFor="idea">
                    Business idea
                  </label>
                  <textarea
                    className="min-h-72 flex-1 resize-none rounded-md border border-white/10 bg-[#0f1117]/90 p-4 text-[15px] leading-7 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    id="idea"
                    value={idea}
                    minLength={10}
                    maxLength={5000}
                    onChange={(event) => setIdea(event.target.value)}
                    placeholder="Example: A tool that helps solo founders validate startup ideas before building."
                  />

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-medium text-zinc-500">{idea.trim().length}/5000 characters</span>
                    <button
                      className="rounded-md bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-[0_0_32px_rgba(37,99,235,0.24)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      type="submit"
                      disabled={!canSubmit}
                    >
                      {isLoading ? "validating..." : "Run validation"}
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <section className="min-w-0 space-y-5">
              {isLoading && <AgentLoading activeStep={activeStep} />}

              {error && (
                <article className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-red-100" role="alert">
                  <p className="text-sm font-black">Could not validate</p>
                  <p className="mt-2 text-sm leading-6 text-red-200/80">{error}</p>
                </article>
              )}

              {!isLoading && !error && !result && <EmptyOutput />}

              {result && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ScoreCard label="Validation score" value={result.validation_score || "N/A"} detail="opportunity" />
                    <ScoreCard label="Difficulty" value={result.difficulty_score || "N/A"} detail="execution" />
                  </div>

                  <OutputPanel title="Refined idea">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">{result.narrowed_down_idea}</p>
                  </OutputPanel>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ResultList title="Pros" items={pros} tone="positive" />
                    <ResultList title="Cons" items={cons} tone="negative" />
                  </div>

                  <ResultList title="Competitors" items={competitors} tone="neutral" />

                  <OutputPanel title="Reasoning">
                    <p className="text-sm leading-7 text-zinc-300">{result.validation_score_reasoning}</p>
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
    <article className="overflow-hidden rounded-lg border border-blue-500/25 bg-[#171a21] shadow-[0_24px_80px_rgba(0,0,0,0.22)]" aria-live="polite">
      <div className="relative h-1 overflow-hidden bg-white/5">
        <div className="absolute inset-y-0 w-1/2 animate-shimmer bg-blue-500/90" />
      </div>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-md bg-blue-600 text-white shadow-[0_0_32px_rgba(37,99,235,0.32)]">
            <span className="h-3 w-3 animate-ping rounded-full bg-white/80" />
            <span className="absolute h-3 w-3 rounded-full bg-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">Validation running</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-white">{agentSteps[activeStep]}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              The idea is being reviewed from multiple angles. Local model runs can take a minute.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {agentSteps.map((step, index) => (
            <div className="flex items-center gap-3" key={step}>
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  index === activeStep ? "bg-blue-400" : index < activeStep ? "bg-zinc-300" : "bg-zinc-700"
                }`}
              />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full origin-left rounded-full ${
                    index === activeStep ? "animate-pulse-line bg-blue-500" : index < activeStep ? "bg-zinc-300" : ""
                  }`}
                />
              </div>
              <span className={`w-44 truncate text-xs font-bold ${index === activeStep ? "text-blue-300" : "text-zinc-600"}`}>
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
    <article className="grid min-h-[520px] place-items-center rounded-lg border border-dashed border-white/15 bg-[#171a21] p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid h-14 w-14 animate-float place-items-center rounded-md bg-blue-600 text-lg font-black text-white shadow-[0_0_36px_rgba(37,99,235,0.34)]">
          AI
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">Validation output</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Run an idea to see the score, sharper concept, upside, risks, competitors, and final reasoning.
        </p>
      </div>
    </article>
  );
}

function ScoreCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#171a21] p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <strong className="text-5xl font-black leading-none tracking-tight text-white">{value}</strong>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
          {detail}
        </span>
      </div>
    </article>
  );
}

function OutputPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-white/10 bg-[#171a21] p-5">
      <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">{title}</h2>
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
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : tone === "negative"
        ? "border-red-400/25 bg-red-400/10 text-red-300"
        : "border-blue-400/25 bg-blue-400/10 text-blue-300";

  return (
    <article className="rounded-lg border border-white/10 bg-[#171a21] p-5">
      <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">{title}</h2>
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => (
            <li className="flex gap-3 text-sm leading-6 text-zinc-300" key={item}>
              <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${toneClass}`}>
                {tone === "negative" ? "!" : "+"}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No output returned.</p>
      )}
    </article>
  );
}

export default App;
