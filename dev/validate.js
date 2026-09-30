/*
 * Checks the limits the Shopify uploader enforces but `theme check` does not:
 * schema label/unit lengths, range steps, defaults, template references and
 * Liquid strings holding braces (which the real parser rejects).
 *
 * Usage: node dev/validate.js   (also runs with `npm run check`)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const problems = [];
const report = (where, message) => problems.push(`${where}: ${message}`);

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const list = (dir, extension) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(extension)).map((f) => `${dir}/${f}`) : []);

function checkSettings(settings, where) {
  (settings || []).forEach((setting) => {
    (setting.options || []).forEach((option) => {
      if ((option.label || '').length > 50) report(where, `"${setting.id}" option label > 50 chars: ${option.label}`);
    });
    if ((setting.unit || '').length > 3) report(where, `"${setting.id}" unit > 3 chars: ${setting.unit}`);
    if (setting.type === 'range') {
      const steps = (setting.max - setting.min) / setting.step;
      if (steps > 101) report(where, `"${setting.id}" range has more than 101 steps`);
      if (setting.default < setting.min || setting.default > setting.max || (setting.default - setting.min) % setting.step) report(where, `"${setting.id}" default does not fit min/max/step`);
    }
    if (setting.type === 'select' && setting.default !== undefined && !(setting.options || []).some((o) => o.value === setting.default)) report(where, `"${setting.id}" default is not one of the options`);
  });
  const ids = (settings || []).map((s) => s.id).filter(Boolean);
  if (ids.length !== new Set(ids).size) report(where, 'duplicated setting ids');
}

const schemas = {};
list('sections', '.liquid').forEach((file) => {
  const source = read(file);
  const match = source.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!match) return;
  let schema;
  try {
    schema = JSON.parse(match[1]);
  } catch (error) {
    report(file, `schema is not valid JSON (${error.message})`);
    return;
  }
  schemas[path.basename(file, '.liquid')] = schema;
  if ((schema.name || '').length > 25) report(file, `section name > 25 chars: ${schema.name}`);
  if ((schema.max_blocks || 0) > 50) report(file, 'max_blocks > 50');
  checkSettings(schema.settings, file);
  (schema.blocks || []).forEach((block) => {
    if ((block.name || '').length > 25) report(file, `block name > 25 chars: ${block.name}`);
    checkSettings(block.settings, `${file} [${block.type}]`);
  });
  (schema.presets || []).forEach((preset) => {
    if ((preset.name || '').length > 25) report(file, `preset name > 25 chars: ${preset.name}`);
  });
});

JSON.parse(read('config/settings_schema.json')).forEach((group) => checkSettings(group.settings, `config/settings_schema.json [${group.name}]`));

// Templates and section groups must point to existing sections, settings and blocks
[...list('templates', '.json'), ...list('sections', '.json')].forEach((file) => {
  const data = JSON.parse(read(file));
  Object.entries(data.sections || {}).forEach(([key, section]) => {
    const schema = schemas[section.type];
    if (!schema) {
      report(file, `section "${key}" uses type "${section.type}", which has no section file`);
      return;
    }
    const known = new Set((schema.settings || []).map((s) => s.id));
    Object.keys(section.settings || {}).forEach((id) => !known.has(id) && report(file, `"${key}" has unknown setting "${id}"`));
    Object.values(section.blocks || {}).forEach((block) => {
      const def = (schema.blocks || []).find((b) => b.type === block.type);
      if (!def) return report(file, `"${key}" has unknown block type "${block.type}"`);
      const blockIds = new Set((def.settings || []).map((s) => s.id));
      Object.keys(block.settings || {}).forEach((id) => !blockIds.has(id) && report(file, `"${key}" block "${block.type}" has unknown setting "${id}"`));
    });
  });
});

// Liquid: a string literal with a brace inside a tag or output breaks the real parser
[...list('sections', '.liquid'), ...list('snippets', '.liquid'), ...list('layout', '.liquid')].forEach((file) => {
  const source = read(file).replace(/\{%-?\s*(comment|schema|javascript|stylesheet|style)\b[\s\S]*?\{%-?\s*end\1\s*-?%\}/g, '');
  const tags = source.match(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g) || [];
  tags.forEach((tag) => {
    const inner = tag.slice(2, -2);
    if (/'[^']*[{}][^']*'|"[^"]*[{}][^"]*"/.test(inner)) report(file, `string with a brace inside a Liquid tag: ${tag.slice(0, 80).replace(/\s+/g, ' ')}`);
  });
});

if (problems.length) {
  console.error(`\n  ${problems.length} problema(s) que a Shopify recusaria:\n`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  console.error('');
  process.exit(1);
}
console.log('\n  Validação de esquemas, modelos e Liquid: sem problemas.\n');
