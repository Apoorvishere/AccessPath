import assert from "node:assert/strict";
import test from "node:test";
import { auditUrlsFromJourney, parseJourney } from "./tinyfish";

const base = {
  outcome: "completed",
  summary: "Reached the contact page.",
  steps: [
    { title: "Home", url: "https://access-path-mu.vercel.app/demo-site", action: "Open", observation: "Support link" },
    { title: "Contact", url: "https://access-path-mu.vercel.app/demo-site/contact", action: "Follow", observation: "Contact form" },
  ],
};

test("only approved controlled-demo pages enter an audit", () => {
  const journey = parseJourney(base);
  assert.ok(journey);
  assert.deepEqual(auditUrlsFromJourney(journey), base.steps.map(step => step.url));
  assert.equal(parseJourney({ ...base, steps: [{ ...base.steps[0], url: "https://example.com/" }] }), null);
  assert.equal(parseJourney({ ...base, steps: [{ ...base.steps[0], url: "https://access-path-mu.vercel.app/demo-site?token=x" }] }), null);
  assert.equal(parseJourney({ ...base, steps: [{ ...base.steps[0], url: "https://access-path-mu.vercel.app.evil.test/demo-site" }] }), null);
});

test("uncompleted journeys never produce paid audit targets", () => {
  const journey = parseJourney({ ...base, outcome: "blocked" });
  assert.ok(journey);
  assert.deepEqual(auditUrlsFromJourney(journey), []);
});
