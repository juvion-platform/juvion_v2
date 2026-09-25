import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { buildOpenApiDocument, stableStringify } from './document';

const out = resolve(__dirname, '../../../../../mobile/api/openapi.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, stableStringify(buildOpenApiDocument()) + '\n');
console.log(`wrote ${out}`);
