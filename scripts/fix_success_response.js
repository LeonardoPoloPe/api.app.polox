const fs = require("fs");
const path = require("path");

// Read the LeadController.js file
const filePath = path.join(
  __dirname,
  "src",
  "controllers",
  "LeadController.js"
);
let content = fs.readFileSync(filePath, "utf8");

// Replace patterns: res.json(successResponse(...)) -> successResponse(res, ...)
// and remove the .json() wrapper

// Pattern 1: return res.status(201).json(successResponse(data, message))
content = content.replace(
  /return res\s*\.status\(\d+\)\s*\.json\(successResponse\(([^)]+)\)\);/g,
  "return successResponse(res, $1, 201);"
);

// Pattern 2: return res.json(successResponse(...))
content = content.replace(
  /return res\.json\(successResponse\(([^)]*)\)\);/g,
  (match, args) => {
    // If args is empty, use null as default
    if (!args.trim()) {
      return "return successResponse(res, null);";
    }
    return `return successResponse(res, ${args});`;
  }
);

// Pattern 3: res.json(successResponse(...)) without return
content = content.replace(
  /res\.json\(\s*successResponse\(([^)]*)\)\s*\);/g,
  (match, args) => {
    if (!args.trim()) {
      return "return successResponse(res, null);";
    }
    return `return successResponse(res, ${args});`;
  }
);

// Write back to file
fs.writeFileSync(filePath, content);

console.log("Fixed all successResponse calls in LeadController.js");
