// Writes public/resume.pdf: a one-page placeholder résumé built from plain PDF operators (no dependencies).
// Replace public/resume.pdf with your real résumé; this script is only for bootstrapping the prototype.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lines = [
  ['F2', 22, 'Your Name'],
  ['F1', 12, 'Software Engineer - AI  |  Healthcare AI, NLP & LLM research'],
  ['F1', 10, 'you@example.com  |  linkedin.com/in/your-handle  |  github.com/your-handle'],
  ['F2', 14, ''],
  ['F2', 14, 'Experience'],
  ['F2', 11, 'Software Engineer - AI, Placeholder Company (Nov 2023 - Jul 2026)'],
  ['F1', 10, 'Placeholder: owned the LLM-powered document understanding pipeline end to end.'],
  ['F1', 10, 'Placeholder: cut inference cost by 40%; raised extraction accuracy from 82% to 94%.'],
  ['F2', 14, ''],
  ['F2', 14, 'Research'],
  ['F1', 10, 'Placeholder: Structured Extraction from Clinical Notes with Small Language Models (2025)'],
  ['F1', 10, 'Placeholder: Low-Resource Named Entity Recognition Across Languages (2024)'],
  ['F1', 10, 'Placeholder: When Should a Language Model Say "I Don\'t Know"? (2026, preprint)'],
  ['F2', 14, ''],
  ['F2', 14, 'Education'],
  ['F1', 10, 'Placeholder: M.Sc. in Computer Science (AI), Placeholder University (2021 - 2023)'],
  ['F1', 10, 'Placeholder: B.Sc. in Computer Science, Placeholder Institute of Technology (2017 - 2021)'],
  ['F2', 14, ''],
  ['F1', 9, 'PLACEHOLDER RESUME - replace public/resume.pdf with your own.'],
];

const escape = (text) => text.replace(/[\\()]/g, (c) => `\\${c}`);
let y = 760;
const ops = ['BT'];
for (const [font, size, text] of lines) {
  y -= size + 8;
  if (text) ops.push(`/${font} ${size} Tf 1 0 0 1 56 ${y} Tm (${escape(text)}) Tj`);
}
ops.push('ET');
const content = ops.join('\n');

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefStart = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

const out = fileURLToPath(new URL('../public/resume.pdf', import.meta.url));
writeFileSync(out, pdf);
console.log(`Wrote ${out} (${Buffer.byteLength(pdf)} bytes)`);
