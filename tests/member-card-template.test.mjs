import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const templateUrl = new URL('../public/cards/card-template.svg', import.meta.url);
const template = await readFile(templateUrl, 'utf8');

test('member card template uses CR80 300 DPI pixel dimensions', () => {
  assert.match(template, /width="1011"/);
  assert.match(template, /height="638"/);
  assert.match(template, /viewBox="0 0 1011 638"/);
});

test('member card template contains every dynamic placeholder', () => {
  const placeholders = [
    '{{LOGO}}',
    '{{QR}}',
    '{{NAME}}',
    '{{NAME_FONT_SIZE}}',
    '{{CARD_NUMBER}}',
    '{{STATUS}}',
    '{{STATUS_COLOR}}',
    '{{ISSUED}}',
  ];

  for (const placeholder of placeholders) {
    assert.ok(template.includes(placeholder), `Missing placeholder: ${placeholder}`);
  }
});

test('member card template contains the official Czech card labels', () => {
  assert.match(template, /ČLENSKÝ PRŮKAZ/);
  assert.match(template, /JMÉNO A PŘÍJMENÍ/);
  assert.match(template, /ČLENSKÉ ID/);
  assert.match(template, /OVĚŘENÍ ČLENSTVÍ/);
});
