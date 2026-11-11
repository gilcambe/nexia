const fs = require('fs');
const path = require('path');

function validatePaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    console.log('all paths valid');
    return true;
  }
  let missing = [];
  for (const p of paths) {
    const fullPath = path.resolve(process.cwd(), p);
    if (!fs.existsSync(fullPath)) {
      missing.push(p);
    }
  }
  if (missing.length > 0) {
    console.error(`Arquivos ausentes: ${missing.join(', ')}`);
    console.error('Missing paths: ' + missing.join(', '));
    console.error(`Task aborted: requested paths do not exist: ${missing.join(', ')}`);
    throw new Error(`Task aborted: requested paths do not exist: ${missing.join(', ')}`);
  }
  console.log('all paths valid');
  return true;
}

module.exports = { validatePaths };
