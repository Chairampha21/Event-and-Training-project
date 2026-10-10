// Minimal .xlsx writer — no external dependency. Unlike the CSV export it can
// put several sheets in one file, merge cells and draw borders, which is what
// a printable form (e.g. a sign-in sheet, one sheet per day) needs.
//
// A sheet is { name, cols: [width, ...], rows: [{ height?, cells: [cell, ...] }], merges: ['A1:F1', ...] }
// and a cell is null (empty), or { v: string | number, s: style } where style
// is one of the STYLE keys below. A styled cell with no value ({ s }) still
// draws its border — needed under a merged header.

export const STYLE = { plain: 0, title: 1, subtitle: 2, head: 3, center: 4, left: 5 };

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Tahoma"/></font>
<font><b/><sz val="11"/><name val="Tahoma"/></font>
<font><b/><sz val="14"/><name val="Tahoma"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8EAF6"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 0 -> A, 25 -> Z, 26 -> AA
export function colName(index) {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

// Excel refuses sheet names longer than 31 characters or containing \ / ? * [ ] :
const sheetName = (name) => String(name).replace(/[\\/?*[\]:]/g, '-').slice(0, 31);

function sheetXml(sheet) {
  const cols = (sheet.cols || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = sheet.rows.map((row, r) => {
    const cells = row.cells.map((cell, c) => {
      if (!cell) return '';
      const ref = `${colName(c)}${r + 1}`;
      const style = cell.s ? ` s="${cell.s}"` : '';
      if (cell.v === undefined || cell.v === null || cell.v === '') return `<c r="${ref}"${style}/>`;
      if (typeof cell.v === 'number') return `<c r="${ref}"${style}><v>${cell.v}</v></c>`;
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.v)}</t></is></c>`;
    }).join('');
    const height = row.height ? ` ht="${row.height}" customHeight="1"` : '';
    return `<row r="${r + 1}"${height}>${cells}</row>`;
  }).join('');
  const merges = (sheet.merges || []).length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<cols>${cols}</cols>
<sheetData>${rows}</sheetData>
${merges}
<printOptions horizontalCentered="1"/>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Packs files into a ZIP archive without compressing them ("stored") — an
// .xlsx file is a ZIP of XML files, and these are small. A file is
// { name, content } for text or { name, data } for bytes (e.g. an image,
// which is compressed already).
export function zip(files) {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const name = encoder.encode(f.name);
    const data = f.data || encoder.encode(f.content);
    return { name, data, crc: crc32(data) };
  });
  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  const DOS_DATE = 0x21; // 1980-01-01, the earliest a ZIP can say
  let pos = 0;
  entries.forEach((e) => {
    e.offset = pos;
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 0x0800, true); // names are UTF-8
    view.setUint16(pos + 8, 0, true); // stored
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, DOS_DATE, true);
    view.setUint32(pos + 14, e.crc, true);
    view.setUint32(pos + 18, e.data.length, true);
    view.setUint32(pos + 22, e.data.length, true);
    view.setUint16(pos + 26, e.name.length, true);
    view.setUint16(pos + 28, 0, true);
    out.set(e.name, pos + 30);
    out.set(e.data, pos + 30 + e.name.length);
    pos += 30 + e.name.length + e.data.length;
  });
  const centralStart = pos;
  entries.forEach((e) => {
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true);
    view.setUint16(pos + 6, 20, true);
    view.setUint16(pos + 8, 0x0800, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, 0, true);
    view.setUint16(pos + 14, DOS_DATE, true);
    view.setUint32(pos + 16, e.crc, true);
    view.setUint32(pos + 20, e.data.length, true);
    view.setUint32(pos + 24, e.data.length, true);
    view.setUint16(pos + 28, e.name.length, true);
    view.setUint32(pos + 42, e.offset, true);
    out.set(e.name, pos + 46);
    pos += 46 + e.name.length;
  });
  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 8, entries.length, true);
  view.setUint16(pos + 10, entries.length, true);
  view.setUint32(pos + 12, centralSize, true);
  view.setUint32(pos + 16, centralStart, true);
  return out;
}

/** Builds the bytes of an .xlsx workbook from `sheets` (see the top of this file). */
export function buildXlsx(sheets) {
  const NS = 'http://schemas.openxmlformats.org';
  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${NS}/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS}/package/2006/relationships">
<Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${xmlEscape(sheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS}/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: 'xl/styles.xml', content: STYLES_XML },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, content: sheetXml(s) })),
  ];
  return zip(files);
}

/** Downloads `sheets` as an Excel workbook. */
export function downloadXlsx(filename, sheets) {
  const blob = new Blob([buildXlsx(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
