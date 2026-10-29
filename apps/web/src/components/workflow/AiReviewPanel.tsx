"use client";

import { AlertCircle, CheckCircle2, HelpCircle, Info, Sparkles, TriangleAlert, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import type { AiCheckResult, AiRecommendationKind } from "@proofloop/shared";
import { getErrorMessage } from "@/lib/errors";
import { useAiRequestReview, useAiStatus } from "@/lib/queries";
import type { RequestAction } from "@/types";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export const recommendationLabel: Record<AiRecommendationKind, string> = {
  approve: "Looks fine to approve",
  reject: "Suggests rejecting",
  needs_more_info: "Needs more information",
};

export const recommendationTone: Record<AiRecommendationKind, "success" | "danger" | "warning"> = {
  approve: "success",
  reject: "danger",
  needs_more_info: "warning",
};

const checkStyle: Record<AiCheckResult, { icon: typeof Info; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: "text-success-600", label: "Pass" },
  warn: { icon: TriangleAlert, className: "text-warning-600", label: "Warning" },
  fail: { icon: XCircle, className: "text-danger-600", label: "Fail" },
  info: { icon: Info, className: "text-navy-400", label: "Note" },
};

/**
 * "Get AI review": asks the model for a second opinion on this request. It is
 * advice only: the model cannot approve or reject, and what it says is also
 * recorded in the audit trail (tagged with model and prompt version). Hidden
 * when the server has no AI configured.
 */
export default function AiReviewPanel({
  requestId,
  history,
  open,
}: {
  requestId: string;
  history: RequestAction[];
  /** False once the request is approved or rejected: past advice stays visible, new advice can't be asked for. */
  open: boolean;
}) {
  const { data: status } = useAiStatus();
  const review = useAiRequestReview(requestId);

  let latestIndex = -1;
  history.forEach((a, i) => {
    if (a.ai) latestIndex = i;
  });
  const latest = latestIndex === -1 ? null : history[latestIndex]!;
  const ai = latest?.ai ?? null;
  const entriesSince = latestIndex === -1 ? 0 : history.length - 1 - latestIndex;

  if (!status?.enabled) return null;
  if (!open && !ai) return null;

  const run = () =>
    review.mutate(undefined, {
      onSuccess: (result) => toast.success(`AI review added to the audit trail (${result.remainingThisHour} left this hour)`),
      onError: (error) => toast.error(getErrorMessage(error, "Could not get an AI review")),
    });

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-600" />
          AI review
          <Badge tone="accent">Advice only</Badge>
        </CardTitle>
        {open && (
          <Button variant="secondary" size="sm" onClick={run} loading={review.isPending} disabled={review.isPending}>
            {ai ? "Review again" : "Get AI review"}
          </Button>
        )}
      </CardHeader>
      <CardBody className="pt-0 space-y-4 text-sm">
        <p className="text-navy-500">
          An AI model reads this request and its workflow and gives a second opinion. It can be wrong and it cannot approve
          or reject anything: you decide. Each review is recorded in the audit trail.
        </p>

        {review.isPending && <p className="text-navy-500">Reading the request…</p>}

        {ai && !review.isPending && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={recommendationTone[ai.recommendation]}>{recommendationLabel[ai.recommendation]}</Badge>
              <span className="text-xs text-navy-500">{ai.confidence} confidence</span>
            </div>

            <p className="text-navy-800 break-words">{ai.summary}</p>

            {ai.checks.length > 0 && (
              <div>
                <h4 className="font-medium text-navy-800 mb-2">Checks against the workflow</h4>
                <ul className="space-y-2">
                  {ai.checks.map((c, i) => {
                    const { icon: Icon, className, label } = checkStyle[c.result];
                    return (
                      <li key={i} className="flex gap-2">
                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${className}`} aria-label={label} />
                        <div className="min-w-0 break-words">
                          <span className="font-medium text-navy-800">{c.name}.</span>{" "}
                          <span className="text-navy-600">{c.detail}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {ai.concerns.length > 0 && (
              <div>
                <h4 className="font-medium text-navy-800 mb-2">Concerns</h4>
                <ul className="space-y-1.5">
                  {ai.concerns.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-warning-600" />
                      <span className="min-w-0 break-words text-navy-700">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ai.missingInformation.length > 0 && (
              <div>
                <h4 className="font-medium text-navy-800 mb-2">Missing information</h4>
                <ul className="space-y-1.5">
                  {ai.missingInformation.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <HelpCircle className="w-4 h-4 mt-0.5 shrink-0 text-navy-400" />
                      <span className="min-w-0 break-words text-navy-700">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-navy-700 break-words">
              <span className="font-medium text-navy-800">Why: </span>
              {ai.rationale}
            </p>

            <p className="text-xs text-navy-400 break-words">
              {ai.model} · prompt {ai.promptVersion} · asked by {ai.requestedByName} on{" "}
              {new Date(latest!.timestamp).toLocaleString()}
              {entriesSince > 0 &&
                ` · ${entriesSince} audit ${entriesSince === 1 ? "entry was" : "entries were"} added after this review`}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
