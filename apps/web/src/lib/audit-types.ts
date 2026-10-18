export type AuditViolation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  affectedCount: number;
  selectors: string[];
};

export type AuditPage = {
  url: string;
  title: string;
  violations: AuditViolation[];
  needsReviewCount: number;
  passedRuleCount: number;
  screenshot: string | null;
};

export type AuditResult = {
  checkedAt: string;
  pages: AuditPage[];
  note: string;
};
