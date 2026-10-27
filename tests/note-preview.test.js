const { noteExcerpt, noteMatches } = require('../utils/note-preview');

test('limits excerpts without changing their source', () => {
  const source = '# Heading\n**bold**\n<script>alert(1)</script>\nfour\nfive';
  expect(noteExcerpt(source)).toBe('# Heading\n**bold**\n<script>alert(1)</script>\nfour\n…');
  expect(source).toContain('five');
  expect(noteExcerpt('x'.repeat(241))).toHaveLength(241);
  expect(noteExcerpt('   ')).toBe('');
});

test('searches titles and full note content case insensitively', () => {
  const note = { titulo: 'Server', nota: 'First\nHidden Content' };
  expect(noteMatches(note, ' SERVER ')).toBe(true);
  expect(noteMatches(note, 'hidden content')).toBe(true);
  expect(noteMatches(note, 'missing')).toBe(false);
  expect(noteMatches(note, ' ')).toBe(true);
});
