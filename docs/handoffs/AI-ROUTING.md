# AI Routing and Secure Credentials Handoff

## Delivery identity

- Branch: `wave-0-baseline`
- Implementation commit: `e815b56` (`feat: add secure AI provider routing`)
- Scope: AI providers, task routing, structured artifacts, secure credentials, AI IPC, frontend API/model contracts, and mock-only tests.
- Isolation: AI providers are disabled by default. Provider failures are returned through AI commands and do not participate in scanning, editing, synchronization, trash, deterministic source scoring, central mapping, or file deletion.

## Provider interface

The unified Rust interface is `src-tauri/src/ai/provider.rs`:

```rust
#[async_trait]
pub trait AiProvider: Send + Sync {
    fn id(&self) -> &str;
    async fn test_connection(&self, model: &str) -> Result<ModelInfo, AiError>;
    async fn generate(&self, request: AiRequest) -> Result<AiResponse, AiError>;
}
```

Implementations:

- `MiniMaxProvider`: OpenAI-compatible MiniMax `v1/chat/completions`; JSON contract is stated in the prompt, then enforced locally.
- `OpenAiResponsesProvider`: OpenAI `v1/responses`; structured output uses `text.format.type = json_schema`, `strict = true`, and the same schema is enforced locally.

Provider ID, provider type, display name, base URL, default model, timeout, retry count, concurrency, enabled state, secret reference, and masked tail are configuration data. Task model, provider, prompt version, responsibility, and enabled state are route data. Defaults live only in `src-tauri/src/ai/defaults.rs`; business logic does not duplicate model constants.

Provider calls support bounded retry, whole-response timeout, cancellation tokens, a provider-wide semaphore, and local provider semaphores. Retried conditions are bounded to retryable network, rate-limit, and provider failures. Connection results distinguish `credential_missing`, `authentication_failed`, `network_error`, `rate_limited`, `quota_exceeded`, `model_not_found`, and `timeout`.

## Default task routes

| Task | Provider | Model | Prompt version | Responsibility |
| --- | --- | --- | --- | --- |
| `extract_usage` | MiniMax | `MiniMax-M3` | `usage/v1` | 用法要点提取 |
| `suggest_tags` | MiniMax | `MiniMax-M3` | `tags/v1` | 标签候选 |
| `extract_origin_candidate` | MiniMax | `MiniMax-M3` | `origin-candidate/v1` | 来源候选（仅供本地规则验证） |
| `classify` | MiniMax | `MiniMax-M3` | `classification/v1` | 信息分类 |
| `final_summary` | OpenAI | `gpt-5.6` | `summary/v1` | 最终摘要与内容提炼 |
| `explain_conflict` | OpenAI | `gpt-5.6` | `conflict/v1` | 冲突解释 |
| `refine_usage` | OpenAI | `gpt-5.6` | `refine-usage/v1` | 最终使用建议 |

MiniMax output can only produce an origin candidate. The prompt and responsibility explicitly require local deterministic verification and never assign or raise source confidence.

## Structured output, cache, and provenance

Every task has a versioned prompt and JSON Schema in `src-tauri/src/ai/prompts.rs`. Responses are parsed and validated locally for required fields, types, arrays, enums, properties, and `additionalProperties`. An invalid structure triggers exactly one repair request; a second invalid response fails without another paid call.

The canonical input hash includes task input plus the current instance content hash. A cache hit requires matching task, provider, configured/requested model, prompt version, responsibility, and input hash. Saving a provider or task route marks affected artifacts stale. Each artifact records provider, actual returned model ID, configured model display name, responsibility, prompt version, time, token usage, status, subject, and input hash. Each call log records safe status, latency, token usage, error code, and a redacted error summary.

## Database migration

Migration `ai_routing_v3` advances the schema to version 3 after the central-library version 2 migration. It creates and indexes:

- `ai_provider_configs`: non-secret provider configuration plus `secret_ref` and `secret_tail` only.
- `ai_task_routes`: configurable provider/model/prompt/responsibility per task.
- `ai_artifacts`: cached structured result and full provenance.
- `ai_call_logs`: redacted operational telemetry and token usage.

The migration is idempotent, transactional, seeds both disabled providers and all default routes, and never lowers a database with a newer `user_version`.

## IPC interfaces

Required commands:

- `ai_provider_list()`
- `ai_provider_save({ input })`
- `ai_provider_test({ providerId })`
- `ai_task_route_list()`
- `ai_task_route_save({ input })`
- `ai_artifact_generate({ input })`
- `ai_artifact_list({ input? })`

Additional cancellation command:

- `ai_artifact_cancel({ cancellationId })`

Rust command definitions are in `src-tauri/src/commands/ai.rs`. Typed frontend wrappers are in `src/features/ai-settings/api/aiApi.ts`; shared camelCase request/result types are exported from `src/features/ai-settings/model/index.ts`.

## Secret Store and outbound safety

`CredentialStore` has system and in-memory implementations. The system implementation uses the native backend selected at compile time:

- Windows: Credential Manager (`keyring` `windows-native`).
- macOS: Keychain (`apple-native`).
- Linux: Secret Service (`sync-secret-service` with Rust crypto).

Persistent references use `os://<provider-id>`. Process-only references use `process://<provider-id>` and disappear when the app process ends. If Linux Secret Service is unavailable, persistent save/read returns `credential_store_unavailable`; it never falls back to a file, SQLite, settings JSON, or plaintext. The user may explicitly choose process-only mode. API key values are zeroized when provider objects are dropped.

Before a request, recursive JSON scanning blocks API keys, Bearer tokens, private-key PEM blocks, JWTs, common vendor credential formats, credential assignments, secret-named fields, and values matching the current environment. Provider error bodies and call-log summaries pass through the same redactor. SQLite stores only the opaque reference and the last four-character masked tail.

## Mock Provider usage

All automated provider tests use the loopback `MockProviderServer` in `src-tauri/tests/ai_integration.rs`; no test reaches a paid endpoint. Loopback HTTP is accepted only for mock/testing, while normal remote provider URLs require HTTPS.

Run the contracts with:

```powershell
cd src-tauri
cargo test --test ai_integration
```

The suite covers OpenAI Responses payloads, MiniMax payloads, actual model/token provenance, bounded retry, exactly-one schema repair, cache hits and prompt invalidation, cancellation, timeout classification, missing credentials before network use, redacted database logs, process-only secrets, and the Windows Credential Manager contract with an isolated fake value that is deleted after the test.

## Verification result

Verified on Windows, 2026-07-15:

- `cargo fmt --check`: passed.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `cargo test`: passed; 50 unit tests, 9 AI integration tests, and all existing integration suites passed; one existing performance benchmark remained intentionally ignored.
- `npm run typecheck`: passed.
- `npm run test`: passed; 39 files, 237 passed, 2 existing conditional skips.
- `npm run build`: passed.
- Mock Provider contract tests: 9 passed, zero real provider calls.
- Secret Store contracts: memory, process-only, and Windows Credential Manager passed.
- Log redaction scan: passed; no repository log files containing secrets were present, and the persisted-error redaction integration test passed.

## Known platform limits

- Windows native storage was exercised on this machine. macOS Keychain and Linux Secret Service compile-time backends are implemented but require CI or hardware on those operating systems for native runtime verification.
- Headless Linux installations commonly have no unlocked Secret Service session. In that case only explicit process-only credentials work; no persistent plaintext fallback exists.
- MiniMax's chat compatibility endpoint does not provide the OpenAI Responses `text.format` JSON Schema facility, so MiniMax relies on a schema-constrained prompt plus the identical local validator and one-repair limit.
- Cancellation stops local waiting and retry work. An HTTP request already accepted by a remote provider may still finish remotely and may be billed by that provider.

## UI integration

No visual UI is included. A settings screen should import `aiApi` and types from `src/features/ai-settings`, then:

1. Call `listProviders()` and `listTaskRoutes()` for initial state.
2. Submit API keys only through `saveProvider()`, choosing `persistent`, `temporary`, `unchanged`, or `remove`. Never retain the key in frontend state after the save resolves; display `secretTail` only.
3. Use `testProvider()` and render the returned structured error code/action without exposing raw response bodies.
4. Save model/provider/base URL/runtime controls with `saveProvider()` and task responsibility/model/prompt routing with `saveTaskRoute()`.
5. Supply a unique `cancellationId` to `generateArtifact()` and pass the same value to `cancelArtifact()` when the user cancels.
6. Treat AI failures as optional enrichment failures. Continue inventory, editing, synchronization, and trash flows independently.

API contract references used during implementation: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create), [OpenAI GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), and [MiniMax text chat](https://platform.minimax.io/docs/api-reference/text-chat-openai).
