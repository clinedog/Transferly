const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const skillsRoot = path.join(root, '.cline', 'skills');
const codexBridge = path.join(root, '.codex', 'skills');

function fail(message) {
  console.error(`ERROR ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(skillsRoot) || !fs.statSync(skillsRoot).isDirectory()) {
  fail('canonical .cline/skills directory is missing');
  process.exit(1);
}

if (!fs.existsSync(codexBridge) || !fs.lstatSync(codexBridge).isSymbolicLink()) {
  fail('.codex/skills must be a symbolic-link compatibility bridge');
} else if (fs.realpathSync(codexBridge) !== fs.realpathSync(skillsRoot)) {
  fail('.codex/skills does not resolve to .cline/skills');
}

const skillDirs = fs.readdirSync(skillsRoot).filter((name) => {
  const directory = path.join(skillsRoot, name);
  return fs.statSync(directory).isDirectory() && fs.existsSync(path.join(directory, 'SKILL.md'));
});

for (const directoryName of skillDirs.sort()) {
  const skillPath = path.join(skillsRoot, directoryName, 'SKILL.md');
  const contents = fs.readFileSync(skillPath, 'utf8');
  const frontmatter = contents.match(/^---\s*\n([\s\S]*?)\n---/);
  const name = frontmatter?.[1].match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim();
  const description = frontmatter?.[1].match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim();

  if (!frontmatter || name !== directoryName || !description || description.length > 1024) {
    fail(`${skillPath} has invalid Cline metadata`);
    continue;
  }

  console.log(`OK ${directoryName}`);
}

if (skillDirs.length === 0) fail('no skills found');
if (!process.exitCode) console.log(`Validated ${skillDirs.length} shared skills`);
