/**
 * Phase 2 test: verify session-start classification, persona generation,
 * vector serialization, and API response shape.
 *
 * Run:
 * npx ts-node --project tsconfig.scripts.json scripts/test-session-start.ts
 */
import * as dotenv from 'dotenv';
import Module from 'module';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import type { SessionState } from '../types/session';

type ModuleWithResolver = typeof Module & {
  _resolveFilename: (
    request: string,
    parent: NodeModule | null | undefined,
    isMain: boolean,
    options?: unknown,
  ) => string;
};

const moduleWithResolver = Module as ModuleWithResolver;
const originalResolveFilename = moduleWithResolver._resolveFilename;
moduleWithResolver._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = resolve(process.cwd(), request.slice(2));
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const chemistryMaterial = `
Today we reviewed acid-base titration curves, buffer capacity, and how the Henderson-Hasselbalch equation predicts pH changes near the equivalence point.
We also compared strong acid versus weak acid titrations and discussed how indicator selection depends on the pH range of the steep region of the curve.
Finally, the instructor linked these ideas to laboratory error analysis and concentration calculations using molarity and stoichiometric ratios.
`;

const softwareMaterial = `
This session covered REST API design in distributed systems, including idempotent HTTP methods, pagination strategies, and versioning tradeoffs.
We compared synchronous request-response flows with event-driven architectures and examined how retries, circuit breakers, and observability improve reliability.
The final section focused on designing backend services for maintainability through clean interfaces, separation of concerns, and testable modules.
`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function startSession(
  postRoute: typeof import('../app/api/session/start/route').POST,
  material: string,
  previousSessionSummary?: string | null,
) {
  const request = new Request('http://localhost/api/session/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ material, previousSessionSummary }),
  });

  const response = await postRoute(request);
  const json = (await response.json()) as { success: boolean; data?: SessionState; error?: string };

  return { response, json };
}

function printSessionSnapshot(label: string, session: SessionState) {
  console.log(`\n${label}`);
  console.log(`- Subject: ${session.subject}`);
  console.log(`- Subtopic: ${session.subtopic}`);
  console.log(`- Confidence: ${session.confidence}`);
  console.log(`- Persona preview: ${session.persona.slice(0, 140)}${session.persona.length > 140 ? '...' : ''}`);
  console.log(`- Serialized vectors: ${session.serializedVectors.length}`);
  console.log(`- Token count: ${session.tokenCount}`);
}

async function main() {
  const { POST } = (await import('../app/api/session/start/route')) as typeof import('../app/api/session/start/route');

  const chemistryResult = await startSession(POST, chemistryMaterial, 'Previous chemistry recap');
  assert(chemistryResult.response.ok, `Chemistry request failed: ${chemistryResult.json.error ?? 'Unknown error'}`);
  assert(chemistryResult.json.success && chemistryResult.json.data, 'Chemistry response did not include session data.');

  const chemistrySession = chemistryResult.json.data;
  assert(chemistrySession.subject.length > 0, 'Chemistry subject was empty.');
  assert(chemistrySession.subtopic.length > 0, 'Chemistry subtopic was empty.');
  assert(chemistrySession.persona.length > 0, 'Chemistry persona was empty.');
  assert(chemistrySession.serializedVectors.length > 0, 'Chemistry vectors were empty.');
  assert(chemistrySession.classifierRanOnce === true, 'Chemistry classifier flag should be true.');
  assert(chemistrySession.previousSessionSummary === 'Previous chemistry recap', 'Previous session summary was not preserved.');

  printSessionSnapshot('Chemistry session', chemistrySession);

  const softwareResult = await startSession(POST, softwareMaterial);
  assert(softwareResult.response.ok, `Software request failed: ${softwareResult.json.error ?? 'Unknown error'}`);
  assert(softwareResult.json.success && softwareResult.json.data, 'Software response did not include session data.');

  const softwareSession = softwareResult.json.data;
  assert(softwareSession.subject.length > 0, 'Software subject was empty.');
  assert(softwareSession.subtopic.length > 0, 'Software subtopic was empty.');
  assert(softwareSession.persona.length > 0, 'Software persona was empty.');
  assert(softwareSession.serializedVectors.length > 0, 'Software vectors were empty.');
  assert(
    chemistrySession.subject !== softwareSession.subject || chemistrySession.subtopic !== softwareSession.subtopic,
    'Distinct materials should not produce identical classification output.',
  );

  printSessionSnapshot('Software session', softwareSession);

  const blankResult = await startSession(POST, '   ');
  assert(blankResult.response.status === 400, `Expected 400 for blank material, received ${blankResult.response.status}.`);
  assert(blankResult.json.success === false, 'Blank request should fail.');

  console.log('\nValidation checks');
  console.log('- Chemistry transcript classified with non-empty persona and vectors');
  console.log('- Software transcript classified differently from chemistry transcript');
  console.log('- Empty material rejected with HTTP 400');
  console.log('\n✓ Phase 2 session-start integration test passed.');
}

main().catch((error) => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
