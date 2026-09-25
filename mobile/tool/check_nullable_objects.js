#!/usr/bin/env node
// mobile/tool/check_nullable_objects.js — guard run by gen_api.sh before generating.
//
// The dart-dio generator cannot parse an object-or-null field (OpenAPI 3.1
// `type: ["object", "null"]`, or anyOf/oneOf of null and an object): the generated
// `fromJson` casts it to a Map unconditionally and throws on `null` at runtime. The
// regenerated client is self-consistent, so CI's drift check cannot catch a new one.
// Every such field must be parsed via raw Dio in lib/core/repos (R57/R61) and then
// listed below. Usage: node tool/check_nullable_objects.js api/openapi.json
'use strict';
const fs = require('fs');

// "<path> <field>": the six fields already parsed via raw Dio.
const ALLOWED = new Set([
  '/config minAppVersion',
  '/config supportContact',
  '/institutions/{code} minAppVersion',
  '/me student',
  '/me faculty',
  '/me institution.supportContact',
]);

const spec = JSON.parse(fs.readFileSync(process.argv[2] || 'api/openapi.json', 'utf8'));

function resolve(node) {
  let n = node;
  const seen = new Set();
  while (n && typeof n.$ref === 'string') {
    if (seen.has(n.$ref)) return {};
    seen.add(n.$ref);
    n = n.$ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((o, k) => (o ? o[k.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined), spec);
  }
  return n || {};
}

function isObjectSchema(s) {
  const r = resolve(s);
  return r.type === 'object' || (Array.isArray(r.type) && r.type.includes('object')) || r.properties !== undefined;
}

function isObjectOrNull(s) {
  const r = resolve(s);
  if (Array.isArray(r.type) && r.type.includes('object') && r.type.includes('null')) return true;
  for (const k of ['anyOf', 'oneOf']) {
    const alts = r[k];
    if (
      Array.isArray(alts) &&
      alts.some((a) => resolve(a).type === 'null') &&
      alts.some((a) => resolve(a).type !== 'null' && isObjectSchema(a))
    ) {
      return true;
    }
  }
  return false;
}

function walk(schema, field, report, stack) {
  const r = resolve(schema);
  if (stack.has(r)) return;
  stack.add(r);
  for (const [name, prop] of Object.entries(r.properties || {})) {
    const path = field ? `${field}.${name}` : name;
    if (isObjectOrNull(prop)) report(path);
    walk(prop, path, report, stack);
  }
  if (r.items) walk(r.items, field ? `${field}[]` : '[]', report, stack);
  if (r.additionalProperties && typeof r.additionalProperties === 'object') {
    walk(r.additionalProperties, field ? `${field}{}` : '{}', report, stack);
  }
  for (const k of ['allOf', 'anyOf', 'oneOf']) for (const alt of r[k] || []) walk(alt, field, report, stack);
  stack.delete(r);
}

const found = new Set();
for (const [path, item] of Object.entries(spec.paths || {})) {
  for (const op of Object.values(item)) {
    if (!op || typeof op !== 'object' || !op.responses) continue;
    for (const response of Object.values(op.responses)) {
      for (const media of Object.values(resolve(response).content || {})) {
        if (media.schema) walk(media.schema, '', (f) => found.add(`${path} ${f}`), new Set());
      }
    }
  }
}

const unexpected = [...found].filter((f) => !ALLOWED.has(f)).sort();
if (unexpected.length > 0) {
  console.error('api/openapi.json has object-or-null response fields the generated client cannot parse:');
  for (const f of unexpected) console.error(`  ${f}`);
  console.error(
    'The generated fromJson throws on null for these. Parse each one via raw Dio in lib/core/repos (R57/R61),\n' +
      'then add it to ALLOWED in tool/check_nullable_objects.js.',
  );
  process.exit(1);
}
console.log(`object-or-null check passed (${found.size} known field(s), all parsed via raw Dio)`);
