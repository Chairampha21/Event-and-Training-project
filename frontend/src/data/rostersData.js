// Applicant roster name pool + roster builder for organizer check-in (UC-13/14).
// kept in sync with INITIAL_USERS in eventsData.js (all students except
// the demo self-account) so the same names appear consistently across
// the Users page, the roster/check-in modal, and Blacklist.
export const NAME_POOL = [
  ['นายธีรภัทร วิชัยกุล', '670710002'],
  ['น.ส. พันธิตา แก้วสุข', '680710003'],
  ['นายธนวัฒน์ ทองอำนวย', '660710004'],
  ['น.ส. วรรณวิภา ชัยมี', '670710005'],
  ['นายจักรพล พิพัฒน์สุวรรณ', '660710006'],
  ['นายอนุชา ควงตี', '680710007'],
  ['น.ส. กชกร เจริญสุข', '680710008'],
  ['นายวรพจน์ ตั้งเจริญดี', '660710009'],
  ['น.ส. สิริกานต์ พรหมนันทร์', '670710010'],
  ['นายจัยวัฒน์ พุ่มมาศ', '660710011'],
];

// deterministic roster generator so results stay stable across renders/reloads
export function buildInitialRosters(events) {
  const rosters = {};
  events.forEach((ev) => {
    if (!ev.listed) return;
    const n = Math.min(ev.reg, 8);
    const arr = [];
    for (let i = 0; i < n; i++) {
      const p = NAME_POOL[i % NAME_POOL.length];
      arr.push({ name: p[0], sid: p[1], in: ev.stage >= 2 && i % 3 !== 0 });
    }
    rosters[ev.id] = arr;
  });
  return rosters;
}
