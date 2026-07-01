const fs = require("fs");
const path = require("path");

const content = fs.readFileSync(path.join(__dirname, "../app/payroll/_components/payroll-dashboard-client.tsx"), "utf8");

// Simple stateful scan for braces and brackets outside strings/regex/comments
let index = 0;
const stack = [];
let line = 1;
let col = 1;

while (index < content.length) {
  const char = content[index];
  
  if (char === "\n") {
    line++;
    col = 1;
  } else {
    col++;
  }

  // Handle comments
  if (char === "/" && content[index + 1] === "/") {
    while (index < content.length && content[index] !== "\n") {
      index++;
    }
    line++;
    col = 1;
    continue;
  }
  if (char === "/" && content[index + 1] === "*") {
    index += 2;
    while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
      if (content[index] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      index++;
    }
    index += 2;
    continue;
  }

  // Handle strings (single/double quotes and backticks)
  if (char === "\"" || char === "\x27" || char === "`") {
    const quote = char;
    index++;
    while (index < content.length && content[index] !== quote) {
      if (content[index] === "\\") index++; // skip escaped
      if (content[index] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      index++;
    }
    index++;
    continue;
  }

  if (char === "{" || char === "(" || char === "[") {
    stack.push({ char, line, col });
  } else if (char === "}" || char === ")" || char === "]") {
    if (stack.length === 0) {
      console.log(`Extra closing char "${char}" at line ${line}, col ${col}`);
    } else {
      const last = stack.pop();
      const match = (last.char === "{" && char === "}") || 
                    (last.char === "(" && char === ")") || 
                    (last.char === "[" && char === "]");
      if (!match) {
        console.log(`Mismatch: opened "${last.char}" at line ${last.line}, col ${last.col} but closed with "${char}" at line ${line}, col ${col}`);
      }
    }
  }
  index++;
}

if (stack.length > 0) {
  console.log(`Unclosed symbols:`);
  stack.forEach(s => {
    console.log(`  "${s.char}" opened at line ${s.line}, col ${s.col}`);
  });
} else {
  console.log("All braces, brackets, and parentheses are balanced!");
}
