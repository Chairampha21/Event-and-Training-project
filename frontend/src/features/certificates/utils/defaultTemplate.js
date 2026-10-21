import { DEFAULT_LAYOUT } from './certLayout';

// The department's main certificate template, used for every event that has
// not uploaded one of its own. The file lives in public/images/certificates.
// The address is absolute because the print window opens on a blank page,
// where a relative path would not resolve.
export const DEFAULT_CERT_TEMPLATE_URL = `${window.location.origin}${process.env.PUBLIC_URL || ''}/images/certificates/default-template.jpg`;

// Text placement that fits that template: its university seal fills the top
// centre down to about 17% and the gold and teal bands rise from the bottom,
// so the heading starts lower and the signature sits higher than the defaults.
export const DEFAULT_TEMPLATE_LAYOUT = { ...DEFAULT_LAYOUT, titleTop: 19, bodyTop: 33, signBottom: 15 };

/**
 * The department's main template: the one an admin set (`defaults` from
 * useEvents().certDefaults), or the one built into the site.
 */
export function mainTemplate(defaults) {
  return defaults?.template?.dataUrl
    ? { url: defaults.template.dataUrl, layout: defaults.layout, own: false }
    : { url: DEFAULT_CERT_TEMPLATE_URL, layout: defaults?.layoutSet ? defaults.layout : DEFAULT_TEMPLATE_LAYOUT, own: false };
}

/**
 * The template image and text layout to draw an event's certificate with.
 * Pass `cert` (an issued certificate, with its default_template_id) and
 * `cache` (useEvents().certTemplateCache) to draw it on the main template that
 * was current when it was issued, not today's.
 */
export function certTemplateFor(ev, defaults, cert, cache) {
  if (ev?.certTemplate?.dataUrl) return { url: ev.certTemplate.dataUrl, layout: ev.certLayout, own: true };
  const main = mainOnIssue(defaults, cert, cache);
  // An event on the main template may fit the text its own way.
  return ev?.certLayoutSet ? { ...main, layout: ev.certLayout } : main;
}

function mainOnIssue(defaults, cert, cache) {
  if (!cert) return mainTemplate(defaults);
  const id = cert.default_template_id ?? null;
  if (id === null) return mainTemplate(defaults?.template ? null : defaults); // issued on the built-in template
  if (cache?.[id]) return { ...cache[id], own: false };
  return mainTemplate(defaults?.templateId === id ? defaults : null); // still loading
}
