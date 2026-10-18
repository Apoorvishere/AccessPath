export const SCAN_TARGETS = [
  {
    label: "Northstar controlled demo",
    url: "https://access-path-mu.vercel.app/demo-site",
    exampleGoal: "Find the contact form through the support page.",
  },
  {
    label: "AccessPath on GitHub",
    url: "https://github.com/Apoorvishere/AccessPath",
    exampleGoal: "Find the local setup instructions in the README.",
  },
] as const;

export function approvedScanTarget(value: unknown): (typeof SCAN_TARGETS)[number] | null {
  return SCAN_TARGETS.find(target => target.url === value) ?? null;
}
