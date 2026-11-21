// Meals an event can serve, in the order of the day (keys as the API stores them).
// `when` groups them in the picker (เช้า / กลางวัน / เย็น); `what` is the card's name.
export const MEALS = [
  { key: 'breakfast', label: 'อาหารเช้า', when: 'เช้า', what: 'อาหารเช้า', icon: 'ti-egg-fried' },
  { key: 'break_am', label: 'เบรกเช้า', when: 'เช้า', what: 'เบรกเช้า', icon: 'ti-coffee' },
  { key: 'lunch', label: 'อาหารกลางวัน', when: 'กลางวัน', what: 'อาหารกลางวัน', icon: 'ti-bowl-chopsticks' },
  { key: 'break_pm', label: 'เบรกกลางวัน', when: 'กลางวัน', what: 'เบรกกลางวัน', icon: 'ti-cookie' },
  { key: 'dinner', label: 'อาหารเย็น', when: 'เย็น', what: 'อาหารเย็น', icon: 'ti-soup' },
  { key: 'snack_night', label: 'เบรกเย็น', when: 'เย็น', what: 'เบรกเย็น', icon: 'ti-moon' },
];

// The picker's columns: each time of day with its meals.
export const MEAL_GROUPS = MEALS.reduce((gs, m) => {
  const g = gs.find((x) => x.when === m.when);
  if (g) g.meals.push(m); else gs.push({ when: m.when, meals: [m] });
  return gs;
}, []);

// "อาหารเช้า · อาหารกลางวัน" for a list of meal keys, in the order of the day.
export const mealsText = (keys) => MEALS.filter((m) => (keys || []).includes(m.key)).map((m) => m.label).join(' · ');
