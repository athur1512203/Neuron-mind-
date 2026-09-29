# Knowledge foundation (MVP)

## Existing architecture and coupling

The application uses React/Vite and an Express/TypeScript API backed by Prisma and
PostgreSQL. JWT middleware sets `request.userId`. Ownership follows
`User -> Subject -> Neuron`; `MarkdownNote.neuronId` is unique (one optional note),
while `Document.neuronId` permits multiple attachments. `NeuronConnection` connects
neurons within a subject; it does not define a parent/child hierarchy.

Neuron text consists of `name`, `textContent`, nullable `note`, `keyPoints`,
`memoryMethod`, and `application`. Legacy `Neuron.note` and `MarkdownNote.content`
are distinct persisted fields; both remain available, without merging or deduplication.

Markdown routes call the existing markdown service after authentication. Its save,
validation, upsert and editor behavior are unchanged. Document routes use
`documentService -> StorageProvider -> Local/R2`, with metadata in PostgreSQL.
Upload, download and delete behavior are unchanged.

Global Search currently queries Neuron text, MarkdownNote content and Document
metadata directly in `search.controller.ts`. It ranks exact/prefix/substring title
matches, then content matches, with recency tie-breaking. Search mapping is coupled
to these Prisma models, but its snippets and result IDs are a working UI contract.
There was no general knowledge abstraction. A future consumer that reused the
markdown service directly would inherit a source-specific dependency.

## Decision and scope

Add a read-only runtime boundary over existing persistence. Do not add a table,
migration, ingestion system or endpoint: service-level tests exercise the current
use case without introducing a speculative HTTP surface. Keep Global Search
parallel to this boundary because its bounded snippets/ranking and document metadata
matching differ from full knowledge context. No search/UI implementation changes.

```text
Neuron text -> NeuronKnowledgeProvider -----+
                                           +-> KnowledgeSource
Markdown -> MarkdownKnowledgeProvider -----+         |
                                              KnowledgeService
                                                     |
                                              KnowledgeContext
                                                     |
                                          future Neuro consumer
```

## Contract

The authoritative types live in `src/knowledge/types.ts`:

```ts
type KnowledgeSourceType = "NEURON" | "MARKDOWN" | "DOCUMENT";

interface KnowledgeProvenance {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  neuronId: string;
  subjectId: string;
}

interface KnowledgeSource {
  type: KnowledgeSourceType;
  sourceId: string;
  neuronId: string;
  subjectId: string;
  title: string;
  content: string | null;
  updatedAt: string;
  provenance: KnowledgeProvenance;
}

interface KnowledgeContext {
  neuronId: string;
  subjectId: string;
  sources: KnowledgeSource[];
}

interface KnowledgeScope {
  neuronId: string;
  userId: string; // verified server auth only; not a public request DTO
}

interface KnowledgeSourceProvider {
  readonly type: KnowledgeSourceType;
  getSources(scope: KnowledgeScope): Promise<KnowledgeSource[]>;
}
```

`updatedAt` is the source row's ISO timestamp, not a context version/cache key.
Markdown title is derived from its neuron; renaming that neuron does not change
the note timestamp. Identity is the pair `(type, sourceId)`. `content: null` means
text is unavailable; `content: ""` means a source with empty text. Both enabled
providers return strings. `DOCUMENT` is reserved and never emitted in this MVP.
No generic metadata bag is provided; future provenance fields should be explicitly
typed and allowlisted (for example optional page, section or safe public URL).

Neuron title comes from `name`. Its nonblank text fields become labeled sections,
in order: Text, Note, Key points, Memory method, Application. Whitespace-only
fields and null notes do not produce headings. Markdown content is returned verbatim,
including whitespace and an empty string. A missing MarkdownNote emits no source.

## Service and ownership

`src/services/knowledge.service.ts` composes the two providers. Consumers call
`knowledgeService.getKnowledgeContext(scope)` or
`knowledgeService.getKnowledgeSourcesForNeuron(scope)` without querying Prisma
or importing a MarkdownNote model. Provider order determines source order (Neuron,
then Markdown). Errors propagate; the service does not silently return partial data.

For a future authenticated controller, construct the scope explicitly:

```ts
const context = await knowledgeService.getKnowledgeContext({
  neuronId: routeParam(request, "neuronId"),
  userId: request.userId,
});
```

Never forward a body/query object as scope. The service is an internal boundary;
it does not verify JWTs itself. It reuses `requireOwnedNeuron` so nonexistent and
foreign neurons both produce `404 NEURON_NOT_FOUND`. This helper currently loads
the neuron's image/audio relations as well; they are not copied into context.
Every provider also filters its own database query by authenticated ownership:
`Neuron.subject.userId` or `MarkdownNote.neuron.subject.userId`. Direct provider
calls return no sources for foreign/missing records. Missing/blank/non-string auth
or neuron IDs fail before Prisma can omit an undefined filter.

Providers select only required fields and construct DTOs explicitly, never spread
database rows. Owner identity, storage keys/paths, credentials, JWTs and internal
metadata are not returned. This is metadata exclusion, not redaction of text the
user deliberately writes into their own note. Knowledge code does not query
Document, import StorageProvider or read binary objects.

## Graph and future adapters

The context is anchored to a selected neuron and its database-derived subject.
Each source carries its own neuron/subject provenance, so notes retain their graph
association. This MVP reads only the selected neuron: no neighbor query/traversal.
Later, context assembly can resolve a bounded set of owned connected neurons,
call the same providers for each, and add optional graph relationship information.
The existing source array/contract remains usable; consumers need not learn about
the original Prisma models. Graph expansion must enforce ownership for every node
and introduce explicit node/content budgets before broad traversal is enabled.

For PDF, add a Document provider plus a PDF extraction adapter in a later task.
The provider resolves attachment ownership, obtains extracted text from the future
ingestion boundary and maps it to this DTO, with optional page provenance.
Register it in the service composition; Neuro continues consuming KnowledgeContext.
Extraction/persistence/caching decisions belong to that later task, and should not
turn each knowledge read into an unbounded download/extraction. Current attachments
remain metadata-only in existing search, completely absent from knowledge context.

For XLSX/CSV/database/API data, introduce a parallel `StructuredSource` and structured
query boundary when needed. Preserve tables/types/rows rather than converting them
into a huge text blob. Neuro may compose both retrieval results and structured query
results. This task implements no StructuredSource contract, parser, query engine,
embedding, vector database, AI calls, queue, worker or connector.

## Changed files

New:

- `src/knowledge/types.ts`: DTOs, provider contract, fail-closed scope validation.
- `src/knowledge/providers.ts`: Neuron and Markdown database adapters.
- `src/services/knowledge.service.ts`: ownership gate and provider composition.
- `tests/knowledge.test.cjs`: normalization, ownership and isolation tests.
- `tests/search.test.cjs`: authenticated HTTP search regression coverage.
- `KNOWLEDGE_ARCHITECTURE.md`: architecture and extension guide.

Modified: `README.md` links this guide. No existing runtime code, schema, migrations,
dependencies, frontend files or editor/storage/search flows changed.

## Validation and limitations

- Prisma generate: passed (existing schema, no migration).
- Backend TypeScript compilation: passed as part of `npm.cmd test`'s build step.
- Backend tests: final `node --test tests/*.test.cjs` passed, **40/40** tests.
  Initial new-test mocks needed the existing assignment/restore pattern because
  Prisma delegate proxies are incompatible with `t.mock.method`.
- Existing Markdown HTTP tests: passed (save/load/update/empty/auth/isolation).
- Existing Document tests: passed (real temporary local storage, mocked Prisma,
  mocked R2 command contract, upload/download/delete and failure handling).
- Knowledge tests: normalization/provenance, missing/empty notes, empty neuron text,
  selected-neuron context, cross-user denial at service/provider level, invalid
  scope, DTO allowlist, no document/storage calls, provider error propagation.
- Search HTTP tests: ranking/recency/snippets/opening IDs, all neuron text fields,
  document metadata queries, empty/unmatched queries, limits, auth and forged userId.
- Frontend `npm.cmd run typecheck`: passed.
- Frontend `npm.cmd run build`: passed. The sandbox initially denied esbuild access
  while resolving the Vite configuration; the approved run outside the sandbox passed.
- `git diff --check`: passed.

Database-backed behavior is tested with Prisma mocks, not a live PostgreSQL instance.
R2 uses a mocked client; there was no external storage access. Browser keyboard and
opening interactions were inspected but not exercised end-to-end; their source code
and API response shape remain unchanged. Existing document failure tests intentionally
log simulated errors while passing.

Future work only when required: live database integration coverage, bounded graph
expansion, a real consumer/API, document ingestion/extraction, optional provenance
locators and parallel structured queries. No remaining MVP implementation TODO.
No commit, push or deployment was performed.
