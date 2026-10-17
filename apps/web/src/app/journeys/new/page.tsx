"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { JourneyResult, JourneyRun } from "@/lib/journey-types";
import styles from "./page.module.css";

type ViewState = "idle" | "submitting" | "running" | "complete" | "error";

export default function NewJourneyPage() {
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [result, setResult] = useState<JourneyResult | null>(null);
  const [error, setError] = useState("");
  const busy = viewState === "submitting" || viewState === "running";

  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;

    async function poll() {
      if (stopped) return;
      checks += 1;
      try {
        const response = await fetch(`/api/journeys/${encodeURIComponent(runId!)}`, {
          headers: { "x-accesspath-demo-code": accessCode },
          cache: "no-store",
        });
        const data: JourneyRun & { error?: string } = await response.json();
        if (stopped) return;
        if (!response.ok) throw new Error(data.error || "Could not refresh this journey.");
        if (data.status === "COMPLETED") {
          if (!data.result) throw new Error(data.error || "No journey was returned.");
          setResult(data.result);
          setViewState("complete");
          setRunId(null);
          return;
        }
        if (data.status === "FAILED" || data.status === "CANCELLED") {
          throw new Error(data.error || "The journey could not be completed.");
        }
        if (checks >= 45) throw new Error("The journey is taking longer than expected. Try again after checking the TinyFish dashboard.");
        timer = setTimeout(poll, 3000);
      } catch (cause) {
        if (stopped) return;
        setError(cause instanceof Error ? cause.message : "Something went wrong.");
        setViewState("error");
        setRunId(null);
      }
    }

    void poll();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [runId, accessCode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setResult(null);
    setRunId(null);
    setViewState("submitting");

    try {
      const response = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-accesspath-demo-code": accessCode },
        body: JSON.stringify({ url: url.trim(), goal: goal.trim() }),
      });
      const data: { runId?: string; error?: string } = await response.json();
      if (!response.ok || !data.runId) throw new Error(data.error || "The journey could not be started.");
      setViewState("running");
      setRunId(data.runId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setViewState("error");
    }
  }

  function reset() {
    setRunId(null);
    setResult(null);
    setError("");
    setViewState("idle");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="AccessPath home">
          <span className={styles.mark} aria-hidden="true">
            <svg viewBox="0 0 36 36" fill="none">
              <path d="M7 28V9h10c7 0 12 4 12 10s-5 9-11 9H7Z" stroke="currentColor" strokeWidth="2.4" />
              <path d="M13 22h7M13 16h7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          <span>accesspath<span className={styles.period}>.</span></span>
        </a>
        <span className={styles.headerLabel}>JOURNEY STUDIO / PRIVATE PREVIEW</span>
        <a className={styles.backLink} href="/">Back to home <span aria-hidden="true">↗</span></a>
      </header>

      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="journey-title">
          <div className={styles.eyebrow}><span className={styles.eyebrowLine} /> FIELD NOTE 001 / DISCOVERY</div>
          <h1 id="journey-title">Start with<br />a <em>real goal.</em></h1>
          <p className={styles.lead}>Give AccessPath a public website and a task a visitor needs to complete. TinyFish will follow the route and return the pages it actually visited.</p>
          <div className={styles.progress} aria-label="Workflow stage one of three">
            <span className={styles.progressActive}>01 <b>DISCOVER</b></span>
            <span>02 <b>AUDIT</b></span>
            <span>03 <b>REPORT</b></span>
          </div>
          <p className={styles.scope}>This first stage records the journey. Accessibility findings and screenshots will follow in the audit stage.</p>
        </section>

        <section className={styles.workspace} aria-label="Create a journey">
          <div className={styles.workspaceTop}><span>NEW JOURNEY / 001</span><span className={styles.liveBadge}><i /> TINYFISH LIVE ROUTE</span></div>
          <form onSubmit={submit} className={styles.form}>
            <div className={styles.formIntro}>
              <span className={styles.formIndex}>INPUT / 01</span>
              <h2>Describe the path to explore.</h2>
              <p>Use an approved public demo site. The agent will inspect the journey without submitting forms or changing data.</p>
            </div>

            <label className={styles.field}>
              <span>PUBLIC WEBSITE URL <small>01</small></span>
              <input type="url" required maxLength={2048} placeholder="https://your-demo-site.com" value={url} onChange={(event) => setUrl(event.target.value)} disabled={busy} autoComplete="url" />
              <small>Start with https:// and use a site approved for this preview.</small>
            </label>

            <label className={styles.field}>
              <span>VISITOR GOAL <small>02</small></span>
              <textarea required minLength={12} maxLength={180} rows={3} placeholder="Find the contact form and understand how to reach the team." value={goal} onChange={(event) => setGoal(event.target.value)} disabled={busy} />
              <small>Describe one task in plain language. 12–180 characters.</small>
            </label>

            <label className={styles.field}>
              <span>PREVIEW ACCESS CODE <small>03</small></span>
              <input type="password" required placeholder="Enter the team preview code" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} disabled={busy} autoComplete="off" />
              <small>This private preview limits live API usage.</small>
            </label>

            <button className={styles.submit} type="submit" disabled={busy}>
              <span>{busy ? "Exploring the journey…" : "Explore this journey"}</span><span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className={styles.result} aria-live="polite" aria-atomic="true">
            <div className={styles.resultHead}><span>JOURNEY OUTPUT</span><span>{viewState === "complete" ? "READY" : viewState === "running" ? "IN PROGRESS" : "AWAITING INPUT"}</span></div>
            {viewState === "idle" && <p className={styles.empty}>Your live route will appear here after the agent finishes.</p>}
            {viewState === "submitting" && <p className={styles.pending}>Connecting to TinyFish…</p>}
            {viewState === "running" && <p className={styles.pending}>TinyFish is following the visitor goal. This can take a minute or two.</p>}
            {viewState === "error" && <div className={styles.error} role="alert"><strong>Journey paused.</strong><p>{error}</p><button type="button" onClick={reset}>Try again →</button></div>}
            {viewState === "complete" && result && (
              <div className={styles.complete}>
                <div className={styles.resultSummary}><span>{result.outcome.replace("_", " ").toUpperCase()}</span><p>{result.summary}</p></div>
                {result.scopeNote && <p className={styles.scopeWarning}>{result.scopeNote}</p>}
                <ol className={styles.steps}>
                  {result.steps.map((step, index) => (
                    <li key={`${index}-${step.url}`}>
                      <span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{step.title}</strong><small>{step.url}</small><p>{step.action}</p><p className={styles.observation}>{step.observation}</p></div>
                    </li>
                  ))}
                </ol>
                <p className={styles.resultNote}>Live journey discovery only. No accessibility audit has been run yet.</p>
                <button className={styles.another} type="button" onClick={reset}>Explore another journey ↗</button>
              </div>
            )}
          </div>
          <div className={styles.workspaceFoot}><span>ACCESSPATH / JOURNEY DISCOVERY</span><span>PRIVATE DEMO BUILD</span></div>
        </section>
      </div>
    </main>
  );
}
