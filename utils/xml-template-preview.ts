// shortcut: complex XML keeps its original layout; use an XML-aware formatter if broader formatting is needed.
export function formatXmlTemplatePreview(xml: string): string {
  if (xml.includes("\n") || xml.includes("<!") || xml.includes("<?")) return xml;

  const tag = /<\/?[A-Za-z_][\w:.-]*(?:\s+[\w:.-]+\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))*\s*\/?>/g;
  const stack: { name: string; text: boolean; children: boolean }[] = [];
  let result = "";
  let end = 0;
  let previousWasTag = false;
  let roots = 0;
  for (const match of xml.matchAll(tag)) {
    const token = match[0];
    const between = xml.slice(end, match.index);
    if (between.includes("<") || (!stack.length && between.trim())) return xml;
    if (between.trim() && stack.length) stack[stack.length - 1].text = true;
    const closing = token.startsWith("</");
    const selfClosing = token.endsWith("/>");
    const name = token.match(/^<\/?([^\s/>]+)/)?.[1];
    if (!name) return xml;
    if (closing && !/^<\/[A-Za-z_][\w:.-]*\s*>$/.test(token)) return xml;
    if (closing) {
      const current = stack.pop();
      if (!current || current.name !== name || (current.text && current.children)) return xml;
    } else if (stack.length) {
      stack[stack.length - 1].children = true;
    }
    if (!closing && stack.length === 0 && ++roots > 1) return xml;
    if (previousWasTag && !between) result += `\n${"  ".repeat(stack.length)}`;
    result += between + token;
    if (!closing && !selfClosing) stack.push({ name, text: false, children: false });
    previousWasTag = true;
    end = match.index! + token.length;
  }
  const tail = xml.slice(end);
  if (stack.length || roots !== 1 || tail.trim()) return xml;
  return result + tail;
}
