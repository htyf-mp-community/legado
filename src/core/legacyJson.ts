/** Preserve Android Long IDs/masks before JSON.parse rounds integers beyond Number.MAX_SAFE_INTEGER. */
export function parseLegacyJson(input: string): unknown {
  let output = '',
    position = 0;
  while (position < input.length) {
    const char = input[position];
    if (char === '"') {
      const start = position++;
      while (position < input.length) {
        if (input[position] === '\\') position += 2;
        else if (input[position++] === '"') break;
      }
      output += input.slice(start, position);
    } else if (char === '-' || /\d/.test(char)) {
      const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
        input.slice(position),
      );
      if (!match) {
        output += char;
        position++;
        continue;
      }
      const token = match[0];
      output +=
        /^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))
          ? JSON.stringify(token)
          : token;
      position += token.length;
    } else {
      output += char;
      position++;
    }
  }
  return JSON.parse(output);
}
