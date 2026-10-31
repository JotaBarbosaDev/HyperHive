const { noteExcerpt, noteLineCount, noteMatches, notePlainExcerpt } = require('../utils/note-preview');

test('limits excerpts without changing their source', () => {
  const source = '# Heading\n**bold**\n<script>alert(1)</script>\nfour\nfive';
  expect(noteExcerpt(source)).toBe('# Heading\n**bold**\n<script>alert(1)</script>\nfour\n…');
  expect(source).toContain('five');
  expect(noteExcerpt('x'.repeat(241))).toHaveLength(241);
  expect(noteExcerpt('   ')).toBe('');
});

test('creates readable plain-text card excerpts from Markdown', () => {
  expect(notePlainExcerpt('# Heading\n- **bold**\n> quote\n`code`')).toBe('Heading\n• bold\nquote\ncode');
  expect(notePlainExcerpt('one\ntwo\nthree\nfour\nfive')).toBe('one\ntwo\nthree\nfour …');
});

test('counts lines consistently across platforms and empty notes', () => {
  expect(noteLineCount('')).toBe(0);
  expect(noteLineCount('one')).toBe(1);
  expect(noteLineCount('one\r\ntwo\nthree\rfour')).toBe(4);
});

test('searches titles and full note content case insensitively', () => {
  const note = { titulo: 'Server', nota: 'First\nHidden Content' };
  expect(noteMatches(note, ' SERVER ')).toBe(true);
  expect(noteMatches(note, 'hidden content')).toBe(true);
  expect(noteMatches(note, 'missing')).toBe(false);
  expect(noteMatches(note, ' ')).toBe(true);
});
