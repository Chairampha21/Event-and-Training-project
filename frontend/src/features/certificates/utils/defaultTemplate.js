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

/** The template image and text layout to draw an event's certificate with. */
export function certTemplateFor(ev) {
  return ev?.certTemplate?.dataUrl
    ? { url: ev.certTemplate.dataUrl, layout: ev.certLayout, own: true }
    : { url: DEFAULT_CERT_TEMPLATE_URL, layout: DEFAULT_TEMPLATE_LAYOUT, own: false };
}
