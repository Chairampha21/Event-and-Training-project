// People listed by student ID, the number they find themselves by — used by the
// applicants list and the printed sign-in sheets so both show the same order.
// Anyone without an ID (e.g. a guest) goes last, by name.
export function bySid(people) {
  return [...people].sort((a, b) => {
    if (!a.sid !== !b.sid) return a.sid ? -1 : 1;
    return (a.sid || '').localeCompare(b.sid || '') || (a.name || '').localeCompare(b.name || '', 'th');
  });
}
