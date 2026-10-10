// Two-letter avatar initials from a Thai name, ignoring the title in front
// ("นาย", "นางสาว", "ผศ.ดร.", ...).
export function initials(name) {
  const p = (name || '')
    .replace(/^(นาย|น\.ส\.|นางสาว|นาง|ผศ\.ดร\.|อ\.ดร\.|อ\.|ศ\.ดร\.)\s*/, '')
    .trim()
    .split(' ');
  return (p[0] || '').slice(0, 1) + (p[1] || '').slice(0, 1);
}
