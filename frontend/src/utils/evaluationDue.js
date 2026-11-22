import { todayIso } from './dateFormat';

// Mirrors the backend rule (registrations.go, EvalGraceDays): once the
// organizer opens an event's evaluation, the attendee has 7 days to do it.
// After the deadline (evalDeadline, the last day) the student can't register
// for anything new — except events everyone must attend — until it is done.

/** An evaluation still to do, with a deadline (open, not done yet). */
export function evaluationDue(r) {
  return r.status === 'attended' && !r.evaluated && !!r.evalDeadline;
}

/** Past its deadline: holds back new registrations. */
export function evaluationOverdue(r, today = todayIso()) {
  return evaluationDue(r) && today > r.evalDeadline;
}

/** The student's registrations with an overdue evaluation. */
export function overdueEvaluations(regs) {
  const today = todayIso();
  return (regs || []).filter((r) => evaluationOverdue(r, today));
}
