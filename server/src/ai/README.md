# Stateless AI chat

`POST /api/ai/chat` requires the existing Bearer JWT and a JSON body containing
only `{ "message": "..." }` (1–8,000 trimmed characters). Success returns
`{ "answer": "..." }`. Existing error middleware formats controlled API errors.

Set `OPENAI_API_KEY` and `OPENAI_MODEL` in the server environment. Both are required;
the chat request fails before any provider or Search call when either is missing.
There is no implicit model default. Other backend routes can run without AI
configuration, consistent with the existing optional AI provider scaffolding.
Never put these settings in Vite/frontend configuration.

The manager uses the official OpenAI Node SDK Responses API with `store: false`.
It carries response message, reasoning and function-call items in memory only for
this HTTP request, and returns tool output using the corresponding `call_id`.
No conversation or message rows are created. The old local/mock provider resolver
and disabled single-shot OpenAI stub are unchanged and are not used by this route.

The sole tool, `search_memory`, maps to SearchPlan through a strict server-side
Zod validator. Its schema uses optional `space`/`neuron` ID or query scopes,
`requests` with per-request NEURON/MARKDOWN sources, and bounded `options`.
The advertised JSON schema uses non-strict provider mode to retain SearchPlan's
optional fields; server-side validation rejects unknown fields including userId.
JWT `request.userId` is injected after parsing, and SearchCore still validates the
plan and enforces database ownership. Scope-only calls return existing candidate
IDs; names are retained where available in content results.

Limits: four tool rounds, one call per round, three requests per tool call,
three Spaces, ten Neurons, ten results per request (default five). A fifth model
request has tools disabled and asks for an answer from existing evidence.
Provider calls have a 20-second timeout, zero automatic retries and a 2,000-token
output limit. There is no additional whole-request/database deadline or per-user
rate limiter in this V1 integration.

Compaction uses an allowlist, deduplicates chunks within each result, and budgets
the serialized JSON including escapes and provenance: 6,000 characters per tool
result and at most 24,000 over the request. Truncation is signaled; empty results
mean no evidence, not proof that a fact is false. Scope IDs, source IDs/types,
names where available, headings and content are retained. Storage fields and
redundant source lists are omitted.

Malformed tools and Search errors become safe tool error codes so the model can
recover within the same bounds. Provider errors, timeouts, incomplete responses
and loop violations become controlled HTTP errors. Diagnostics log only fixed
event/error codes and round numbers, never prompts, memory, keys or raw errors.

No Documents, graph traversal, embeddings, persistence, frontend changes or write
tools are added. SearchCore's existing ranking/candidate limits still apply.

Validation (from repository root):

```sh
node node_modules/typescript/bin/tsc -p server/tsconfig.json
node --test server/tests/ai-chat.test.cjs server/tests/search-core.test.cjs server/tests/search.test.cjs server/tests/search-debug.test.cjs
```

Tests mock Responses and database access; no paid API calls are made.
API reference: https://developers.openai.com/api/docs/guides/function-calling
