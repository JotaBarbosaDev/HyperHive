import { Note } from "@/types/notes";

export function noteExcerpt(value: string): string {
  const lines = value.trim().split(/\r\n|\r|\n/);
  const excerpt = lines.slice(0, 4).join("\n");
  return excerpt.length > 240 ? `${excerpt.slice(0, 240)}…` : lines.length > 4 ? `${excerpt}\n…` : excerpt;
}

export function notePlainExcerpt(value: string): string {
  return noteExcerpt(value)
    .replace(/```[^\n]*/g, "")
    .replace(/^(?:#{1,3}\s+|>\s?)/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\n…$/, " …")
    .trim();
}

export function noteLineCount(value: string): number {
  return value ? value.split(/\r\n|\r|\n/).length : 0;
}

export function noteMatches(note: Note, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  return !query || `${note.titulo}\n${note.nota}`.toLocaleLowerCase().includes(query);
}
