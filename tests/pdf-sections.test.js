// The "01" bug: the free report PDF's "REPORT MAP" page, and the badge
// above the very first section, showed a stray "01 Personal Reading" entry
// sitting above "1 Your Quick Snapshot" - two numbering styles side by
// side. The AI opens every report with its own title line and a "(DOB:
// ...)" line before the first real "1. ..." heading, and the earlier fix
// (stripLeadingBoilerplate matching only a divider or a "report...for"
// title echo) broke as soon as it hit that DOB line, leaving it and the
// "---" divider after it to fall into a leftover "Personal Reading" bucket
// that survived as a bogus first section.
//
// This is checked against Dhruv's own real report text (report
// rep_5cda5ddda4b14074, pulled from Supabase), not a synthetic
// reproduction, because the synthetic case used to verify the first fix
// never included a DOB line and so never caught this.

const assert = require('assert');
const { parseSections } = require('../src/services/pdf');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
  queue.push(() => {
    try { fn(); passed++; console.log(`  PASS  ${name}`); }
    catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
  });
}

// Verbatim ai_report text for rep_5cda5ddda4b14074 (Dhruv Gupta), pulled
// directly from Supabase. Starts with a title echo, then "(DOB: ...)", then
// a "---" divider, then thirteen "N. Heading" sections each separated by
// their own "---" divider - exactly the shape that broke the first fix.
const REAL_REPORT_TEXT = `**Numerology Report for Dhruv Gupta**
(DOB: 23 August 1994)

---

### 1. Your Quick Snapshot

Dhruv, your numerology profile reveals a vibrant and dynamic personality shaped by your numbers: Ruling Number 5, Destiny Number 9, and Name Number 9.

Your Lo Shu Grid shows a strong presence of mental and emotional energies.

---

### 2. What Your Birth Date Says About You

Your Ruling Number, which is 5, comes from your birth date and represents your core energy.

---

### 3. Your Core Strengths

- Adaptability and Versatility (Ruling Number 5): You handle change well.
- Compassion and Creativity (Destiny & Name Number 9): You have a deep sense of caring for others.

---

### 4. Your Hidden Challenges

Your Lo Shu Grid shows that some numbers are missing: 5, 6, and 7.

- 5 Missing: Even though your ruling number is 5, its absence suggests some internal conflict.
- 6 Missing: This number is about responsibility and family care.

Repeated 9s in your grid indicate a strong emphasis on compassion.

---

### 13. Next Step With Divya

Dhruv, if you found this report helpful, reach out to Divya Bajaj for a detailed consultation.

---

Dhruv, remember that numerology is a tool to help you understand yourself better, not a fixed fate.`;

test('the real report text no longer produces a stray "Personal Reading" section', () => {
  const sections = parseSections(REAL_REPORT_TEXT);
  const stray = sections.find(section => section.title === 'Personal Reading');
  assert.strictEqual(stray, undefined, 'a "Personal Reading" section survived - the 01 bug is back');
});

test('the real report text\'s first section is "1 Your Quick Snapshot", not "01" anything', () => {
  const sections = parseSections(REAL_REPORT_TEXT);
  assert.ok(sections.length > 0, 'expected at least one section');
  assert.strictEqual(sections[0].number, '1');
  assert.strictEqual(sections[0].title, 'Your Quick Snapshot');
});

test('the DOB line and the leading divider are both gone, not swept into a section body', () => {
  const sections = parseSections(REAL_REPORT_TEXT);
  const joined = sections.map(s => s.body).join('\n');
  assert.ok(!joined.includes('DOB:'), 'the "(DOB: ...)" line leaked into a section body');
});

test('no section body contains a bare "---" divider line as literal text', () => {
  const sections = parseSections(REAL_REPORT_TEXT);
  sections.forEach(section => {
    const hasBareDivider = section.body.split('\n').some(line => /^[-=*_]{3,}$/.test(line.trim()));
    assert.ok(!hasBareDivider, `section "${section.title}" still has a stray divider line in its body`);
  });
});

test('every "---"-separated section between the first and last survives with its own number', () => {
  const sections = parseSections(REAL_REPORT_TEXT);
  const numbers = sections.map(s => s.number);
  assert.deepStrictEqual(numbers, ['1', '2', '3', '4', '13']);
});

// Regression check: the shape the very first "01" fix (ee1ca7e) was tested
// against - a title echo and a divider, but no DOB line in between. Confirms
// the more general fix still handles this simpler case correctly.
const SYNTHETIC_NO_DOB_TEXT = `Numerology Report for Test User
---

1. Your Quick Snapshot

Some opening content here.

2. Second Section

More content here.`;

test('the original synthetic case (title echo + divider, no DOB line) still strips cleanly', () => {
  const sections = parseSections(SYNTHETIC_NO_DOB_TEXT);
  assert.strictEqual(sections.find(s => s.title === 'Personal Reading'), undefined);
  assert.strictEqual(sections[0].number, '1');
  assert.strictEqual(sections[0].title, 'Your Quick Snapshot');
});

// Edge case: nothing to strip at all. A report that opens directly with its
// first numbered heading (no title echo, no DOB line, no divider) must keep
// all of its content - the look-ahead must not eat real content when there
// is no boilerplate to drop.
const NO_BOILERPLATE_TEXT = `1. Your Quick Snapshot

This report opens straight with its first heading, no preamble at all.

2. Second Section

More content here.`;

test('a report with no leading boilerplate at all keeps its first heading and content intact', () => {
  const sections = parseSections(NO_BOILERPLATE_TEXT);
  assert.strictEqual(sections.length, 2);
  assert.strictEqual(sections[0].title, 'Your Quick Snapshot');
  assert.ok(sections[0].body.includes('This report opens straight with its first heading'));
});

(async () => {
  for (const run of queue) await run();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
