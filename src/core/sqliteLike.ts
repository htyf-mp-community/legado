/** SQLite's default LIKE: ASCII folding, % / _ wildcards, no implicit ESCAPE. */
export function sqliteLike(value: string, pattern: string): boolean {
  // SQLite LIKE treats NUL as the end of either operand, including bound values.
  const characters = (input: string) => Array.from(input.split('\0', 1)[0].replace(/[A-Z]/g, char => char.toLowerCase()));
  const text = characters(value), tokens = characters(pattern);
  let inputIndex = 0, patternIndex = 0, star = -1, retry = 0;
  while (inputIndex < text.length) {
    if (tokens[patternIndex] === '%') {
      star = patternIndex++;
      retry = inputIndex;
    } else if (tokens[patternIndex] === '_' || tokens[patternIndex] === text[inputIndex]) {
      inputIndex++;
      patternIndex++;
    } else if (star >= 0) {
      patternIndex = star + 1;
      inputIndex = ++retry;
    } else return false;
  }
  while (tokens[patternIndex] === '%') patternIndex++;
  return patternIndex === tokens.length;
}
