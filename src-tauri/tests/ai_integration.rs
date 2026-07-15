use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde_json::json;
use skill_studio_pro_lib::ai::model::{
    AiErrorCode, AiProviderSaveInput, AiRequest, AiTaskRouteSaveInput, AiTaskType,
    ArtifactGenerateInput, ArtifactListInput, ProviderType, SecretMode,
};
use skill_studio_pro_lib::ai::provider::AiProvider;
use skill_studio_pro_lib::ai::{defaults, minimax::MiniMaxProvider, prompts, service};
#[cfg(target_os = "windows")]
use skill_studio_pro_lib::credentials::SystemCredentialStore;
use skill_studio_pro_lib::credentials::{
    CredentialManager, CredentialStore, MemoryCredentialStore,
};
use skill_studio_pro_lib::db;

#[derive(Clone)]
struct MockResponse {
    status: u16,
    body: String,
    delay_ms: u64,
}

impl MockResponse {
    fn json(status: u16, body: serde_json::Value) -> Self {
        Self {
            status,
            body: body.to_string(),
            delay_ms: 0,
        }
    }

    fn delayed(status: u16, body: serde_json::Value, delay_ms: u64) -> Self {
        Self {
            status,
            body: body.to_string(),
            delay_ms,
        }
    }
}

struct MockProviderServer {
    base_url: String,
    requests: Arc<Mutex<Vec<String>>>,
}

impl MockProviderServer {
    fn start(responses: Vec<MockResponse>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").expect("应绑定本地 Mock Server");
        let address = listener.local_addr().unwrap();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let captured = requests.clone();
        thread::spawn(move || {
            for response in responses {
                let (mut stream, _) = listener.accept().expect("应接收 Mock 请求");
                let request = read_http_request(&mut stream);
                captured.lock().unwrap().push(request);
                if response.delay_ms > 0 {
                    thread::sleep(Duration::from_millis(response.delay_ms));
                }
                let reason = match response.status {
                    200 => "OK",
                    429 => "Too Many Requests",
                    500 => "Internal Server Error",
                    _ => "Error",
                };
                let wire = format!(
                    "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    response.status,
                    reason,
                    response.body.len(),
                    response.body
                );
                let _ = stream.write_all(wire.as_bytes());
            }
        });
        Self {
            base_url: format!("http://{address}"),
            requests,
        }
    }
}

fn read_http_request(stream: &mut TcpStream) -> String {
    stream
        .set_read_timeout(Some(Duration::from_millis(100)))
        .unwrap();
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 4096];
    loop {
        let count = stream.read(&mut buffer).unwrap_or(0);
        if count == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..count]);
        let text = String::from_utf8_lossy(&bytes);
        if let Some(header_end) = text.find("\r\n\r\n") {
            let content_length = text[..header_end]
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse::<usize>().ok())
                        .flatten()
                })
                .unwrap_or(0);
            if bytes.len() >= header_end + 4 + content_length {
                break;
            }
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

fn temporary_credentials() -> CredentialManager {
    CredentialManager::new(Arc::new(MemoryCredentialStore::default()))
}

#[test]
fn ai_migration_seeds_configurable_default_routes() {
    let temp = tempfile::tempdir().unwrap();
    let conn = db::init_db_at_path(temp.path()).unwrap();
    assert_eq!(
        db::get_schema_version(&conn).unwrap(),
        db::CURRENT_SCHEMA_VERSION
    );
    for table in [
        "ai_provider_configs",
        "ai_task_routes",
        "ai_artifacts",
        "ai_call_logs",
    ] {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                rusqlite::params![table],
                |row| row.get(0),
            )
            .unwrap();
        assert!(exists, "缺少表 {table}");
    }
    let routes = service::task_route_list(&conn).unwrap();
    assert_eq!(
        routes
            .iter()
            .find(|route| route.task_type == AiTaskType::ExtractUsage)
            .unwrap()
            .provider_id,
        defaults::MINIMAX_PROVIDER_ID
    );
    let summary = routes
        .iter()
        .find(|route| route.task_type == AiTaskType::FinalSummary)
        .unwrap();
    assert_eq!(summary.provider_id, defaults::OPENAI_PROVIDER_ID);
    assert_eq!(summary.model_id, "gpt-5.6");
}

#[tokio::test]
async fn openai_mock_contract_repairs_once_then_hits_cache() {
    let server = MockProviderServer::start(vec![
        MockResponse::json(200, json!({"id": "gpt-5.6", "display_name": "GPT-5.6"})),
        MockResponse::json(
            200,
            json!({
                "id":"resp_invalid", "model":"gpt-5.6-sol",
                "output":[{"content":[{"type":"output_text","text":"not-json"}]}],
                "usage":{"input_tokens":8,"output_tokens":2}
            }),
        ),
        MockResponse::json(
            200,
            json!({
                "id":"resp_valid", "model":"gpt-5.6-sol",
                "output":[{"content":[{"type":"output_text","text":"{\"oneLineSummary\":\"Demo\",\"details\":\"Refined\"}"}]}],
                "usage":{"input_tokens":10,"output_tokens":6}
            }),
        ),
    ]);
    let temp = tempfile::tempdir().unwrap();
    let conn = db::init_db_at_path(temp.path()).unwrap();
    conn.execute(
        "INSERT INTO skills (id, name, slug) VALUES ('skill-ai', 'AI Test', 'ai-test')",
        [],
    )
    .unwrap();
    let credentials = temporary_credentials();
    service::provider_save(
        &conn,
        &AiProviderSaveInput {
            provider_id: "openai".to_string(),
            provider_type: ProviderType::OpenaiResponses,
            display_name: "OpenAI".to_string(),
            base_url: server.base_url.clone(),
            default_model: "gpt-5.6".to_string(),
            enabled: true,
            timeout_ms: 2_000,
            max_concurrency: 2,
            retry_count: 0,
            api_key: Some("fictional-openai-test-key".to_string()),
            secret_mode: SecretMode::Temporary,
        },
        &credentials,
    )
    .unwrap();
    drop(conn);

    let db_path = temp.path().join("metadata.db");
    let tested = service::provider_test_at_path(&db_path, "openai", &credentials)
        .await
        .unwrap();
    assert_eq!(tested.model.unwrap().model_id, "gpt-5.6");

    let input = ArtifactGenerateInput {
        task_type: AiTaskType::FinalSummary,
        skill_id: Some("skill-ai".to_string()),
        instance_id: None,
        input: json!({"content": "A safe local description"}),
        force: false,
        cancellation_id: Some("repair-test".to_string()),
    };
    let first = service::artifact_generate_at_path(&db_path, &input, &credentials)
        .await
        .unwrap_or_else(|error| {
            panic!(
                "生成失败: {error:?}; Mock 已收到 {} 个请求",
                server.requests.lock().unwrap().len()
            )
        });
    assert_eq!(first.model_id, "gpt-5.6-sol");
    assert_eq!(first.content["oneLineSummary"], "Demo");
    assert_eq!(first.input_tokens, Some(10));
    let cached = service::artifact_generate_at_path(&db_path, &input, &credentials)
        .await
        .unwrap();
    assert_eq!(cached.id, first.id);

    let requests = server.requests.lock().unwrap();
    assert_eq!(requests.len(), 3, "连接测试 + 初次生成 + 一次修复");
    assert!(requests[1].contains("\"name\":\"final_summary\""));
    assert!(requests[2].contains("上一次输出未通过本地校验"));
    drop(requests);

    let conn = rusqlite::Connection::open(&db_path).unwrap();
    service::task_route_save(
        &conn,
        &AiTaskRouteSaveInput {
            task_type: AiTaskType::FinalSummary,
            provider_id: "openai".to_string(),
            model_id: "gpt-5.6".to_string(),
            prompt_version: "summary/v2".to_string(),
            responsibility: "最终摘要与内容提炼".to_string(),
            enabled: true,
        },
    )
    .unwrap();
    let artifacts = service::artifact_list(
        &conn,
        &ArtifactListInput {
            skill_id: Some("skill-ai".to_string()),
            include_stale: Some(true),
            ..ArtifactListInput::default()
        },
    )
    .unwrap();
    assert!(
        artifacts[0].stale_at.is_some(),
        "提示词版本变化必须使缓存过期"
    );
    drop(conn);

    let bytes = std::fs::read(&db_path).unwrap();
    let database = String::from_utf8_lossy(&bytes);
    assert!(!database.contains("fictional-openai-test-key"));
}

#[tokio::test]
async fn minimax_mock_contract_retries_and_reports_actual_usage() {
    let server = MockProviderServer::start(vec![
        MockResponse::json(200, json!({"data": [{"id": "MiniMax-M3"}]})),
        MockResponse::json(500, json!({"error": {"message": "temporary"}})),
        MockResponse::json(
            200,
            json!({
                "id":"mm-response", "model":"MiniMax-M3",
                "choices":[{"message":{"content":"{\"tags\":[\"docs\",\"automation\"]}"}}],
                "usage":{"prompt_tokens":11,"completion_tokens":5},
                "base_resp":{"status_code":0,"status_msg":""}
            }),
        ),
    ]);
    let provider =
        MiniMaxProvider::new("minimax", &server.base_url, "fictional-mm-key", 1, 1).unwrap();
    let model = provider.test_connection("MiniMax-M3").await.unwrap();
    assert_eq!(model.model_id, "MiniMax-M3");
    let definition = prompts::definition(AiTaskType::SuggestTags, "tags/v1").unwrap();
    let response = provider
        .generate(AiRequest {
            task_type: AiTaskType::SuggestTags,
            model: "MiniMax-M3".to_string(),
            prompt_version: "tags/v1".to_string(),
            input: json!({"content": "safe"}),
            schema_name: definition.schema_name.to_string(),
            schema: definition.schema,
            timeout_ms: 2_000,
            cancellation: tokio_util::sync::CancellationToken::new(),
            repair_feedback: None,
        })
        .await
        .unwrap();
    assert_eq!(response.input_tokens, Some(11));
    assert_eq!(response.content["tags"][1], "automation");
    assert_eq!(server.requests.lock().unwrap().len(), 3);
}

#[tokio::test]
async fn provider_cancellation_stops_waiting_for_mock_response() {
    let server = MockProviderServer::start(vec![MockResponse::delayed(
        200,
        json!({
            "id":"late", "model":"MiniMax-M3",
            "choices":[{"message":{"content":"{\"tags\":[]}"}}],
            "usage":{}, "base_resp":{"status_code":0}
        }),
        1_000,
    )]);
    let provider =
        MiniMaxProvider::new("minimax", &server.base_url, "fictional-mm-key", 1, 0).unwrap();
    let definition = prompts::definition(AiTaskType::SuggestTags, "tags/v1").unwrap();
    let cancellation = tokio_util::sync::CancellationToken::new();
    let request = AiRequest {
        task_type: AiTaskType::SuggestTags,
        model: "MiniMax-M3".to_string(),
        prompt_version: "tags/v1".to_string(),
        input: json!({"content": "safe"}),
        schema_name: definition.schema_name.to_string(),
        schema: definition.schema,
        timeout_ms: 5_000,
        cancellation: cancellation.clone(),
        repair_feedback: None,
    };
    let task = tokio::spawn(async move { provider.generate(request).await });
    tokio::time::sleep(Duration::from_millis(50)).await;
    cancellation.cancel();
    let error = task.await.unwrap().unwrap_err();
    assert_eq!(error.code, AiErrorCode::Cancelled);
}

#[tokio::test]
async fn provider_timeout_is_classified_without_real_network() {
    let server = MockProviderServer::start(vec![MockResponse::delayed(
        200,
        json!({
            "id":"late", "model":"MiniMax-M3",
            "choices":[{"message":{"content":"{\"tags\":[]}"}}],
            "usage":{}, "base_resp":{"status_code":0}
        }),
        500,
    )]);
    let provider =
        MiniMaxProvider::new("minimax", &server.base_url, "fictional-mm-key", 1, 0).unwrap();
    let definition = prompts::definition(AiTaskType::SuggestTags, "tags/v1").unwrap();
    let error = provider
        .generate(AiRequest {
            task_type: AiTaskType::SuggestTags,
            model: "MiniMax-M3".to_string(),
            prompt_version: "tags/v1".to_string(),
            input: json!({"content": "safe"}),
            schema_name: definition.schema_name.to_string(),
            schema: definition.schema,
            timeout_ms: 50,
            cancellation: tokio_util::sync::CancellationToken::new(),
            repair_feedback: None,
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, AiErrorCode::Timeout);
}

#[tokio::test]
async fn missing_credentials_are_reported_before_network_access() {
    let temp = tempfile::tempdir().unwrap();
    let conn = db::init_db_at_path(temp.path()).unwrap();
    let credentials = temporary_credentials();
    service::provider_save(
        &conn,
        &AiProviderSaveInput {
            provider_id: "openai".to_string(),
            provider_type: ProviderType::OpenaiResponses,
            display_name: "OpenAI".to_string(),
            base_url: "http://127.0.0.1:9".to_string(),
            default_model: "gpt-5.6".to_string(),
            enabled: true,
            timeout_ms: 1_000,
            max_concurrency: 1,
            retry_count: 0,
            api_key: None,
            secret_mode: SecretMode::Unchanged,
        },
        &credentials,
    )
    .unwrap();
    drop(conn);
    let error =
        service::provider_test_at_path(&temp.path().join("metadata.db"), "openai", &credentials)
            .await
            .unwrap_err();
    assert_eq!(error.code, AiErrorCode::CredentialMissing);
}

#[tokio::test]
async fn ai_call_logs_redact_provider_error_secrets() {
    let server = MockProviderServer::start(vec![MockResponse::json(
        400,
        json!({"error": {"message": "Authorization: Bearer fictional-sensitive-value-123456"}}),
    )]);
    let temp = tempfile::tempdir().unwrap();
    let conn = db::init_db_at_path(temp.path()).unwrap();
    conn.execute(
        "INSERT INTO skills (id, name, slug) VALUES ('skill-log', 'Log Test', 'log-test')",
        [],
    )
    .unwrap();
    let credentials = temporary_credentials();
    service::provider_save(
        &conn,
        &AiProviderSaveInput {
            provider_id: "openai".to_string(),
            provider_type: ProviderType::OpenaiResponses,
            display_name: "OpenAI".to_string(),
            base_url: server.base_url,
            default_model: "gpt-5.6".to_string(),
            enabled: true,
            timeout_ms: 1_000,
            max_concurrency: 1,
            retry_count: 0,
            api_key: Some("fictional-log-test-key".to_string()),
            secret_mode: SecretMode::Temporary,
        },
        &credentials,
    )
    .unwrap();
    drop(conn);
    let db_path = temp.path().join("metadata.db");
    let error = service::artifact_generate_at_path(
        &db_path,
        &ArtifactGenerateInput {
            task_type: AiTaskType::FinalSummary,
            skill_id: Some("skill-log".to_string()),
            instance_id: None,
            input: json!({"content": "safe"}),
            force: false,
            cancellation_id: None,
        },
        &credentials,
    )
    .await
    .unwrap_err();
    assert_eq!(error.code, AiErrorCode::ProviderError);
    let conn = rusqlite::Connection::open(db_path).unwrap();
    let summary: String = conn
        .query_row(
            "SELECT error_summary FROM ai_call_logs ORDER BY started_at DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert!(!summary.contains("fictional-sensitive-value"));
    assert!(summary.contains("[REDACTED]"));
}

#[test]
fn secret_store_contract_never_requires_plaintext_fallback() {
    let manager = temporary_credentials();
    let (reference, tail) = manager
        .save("minimax", "fictional-process-secret", SecretMode::Temporary)
        .unwrap();
    assert_eq!(reference, "process://minimax");
    assert_eq!(tail, "••••cret");
    assert_eq!(
        manager.get(Some(&reference)).unwrap(),
        "fictional-process-secret"
    );
}

#[cfg(target_os = "windows")]
#[test]
fn windows_credential_manager_contract() {
    let store = SystemCredentialStore;
    let account = format!("contract-{}", uuid::Uuid::new_v4());
    store
        .set(
            skill_studio_pro_lib::credentials::CREDENTIAL_SERVICE,
            &account,
            "fictional-windows-contract-secret",
        )
        .expect("Windows Credential Manager 应可保存测试凭据");
    let value = store
        .get(
            skill_studio_pro_lib::credentials::CREDENTIAL_SERVICE,
            &account,
        )
        .unwrap();
    assert_eq!(value.as_deref(), Some("fictional-windows-contract-secret"));
    store
        .delete(
            skill_studio_pro_lib::credentials::CREDENTIAL_SERVICE,
            &account,
        )
        .unwrap();
}
