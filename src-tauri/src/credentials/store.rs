use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use crate::ai::model::{AiError, AiErrorCode, SecretMode};

pub const CREDENTIAL_SERVICE: &str = "app.skillstudiopro.ai";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialError {
    Unavailable,
    OperationFailed,
}

pub trait CredentialStore: Send + Sync {
    fn set(&self, service: &str, account: &str, secret: &str) -> Result<(), CredentialError>;
    fn get(&self, service: &str, account: &str) -> Result<Option<String>, CredentialError>;
    fn delete(&self, service: &str, account: &str) -> Result<(), CredentialError>;
}

#[derive(Default)]
pub struct MemoryCredentialStore {
    values: Mutex<HashMap<(String, String), String>>,
}

impl CredentialStore for MemoryCredentialStore {
    fn set(&self, service: &str, account: &str, secret: &str) -> Result<(), CredentialError> {
        self.values
            .lock()
            .map_err(|_| CredentialError::OperationFailed)?
            .insert(
                (service.to_string(), account.to_string()),
                secret.to_string(),
            );
        Ok(())
    }

    fn get(&self, service: &str, account: &str) -> Result<Option<String>, CredentialError> {
        Ok(self
            .values
            .lock()
            .map_err(|_| CredentialError::OperationFailed)?
            .get(&(service.to_string(), account.to_string()))
            .cloned())
    }

    fn delete(&self, service: &str, account: &str) -> Result<(), CredentialError> {
        self.values
            .lock()
            .map_err(|_| CredentialError::OperationFailed)?
            .remove(&(service.to_string(), account.to_string()));
        Ok(())
    }
}

pub struct SystemCredentialStore;

impl CredentialStore for SystemCredentialStore {
    fn set(&self, service: &str, account: &str, secret: &str) -> Result<(), CredentialError> {
        keyring::Entry::new(service, account)
            .map_err(|_| CredentialError::Unavailable)?
            .set_password(secret)
            .map_err(map_keyring_error)
    }

    fn get(&self, service: &str, account: &str) -> Result<Option<String>, CredentialError> {
        let entry =
            keyring::Entry::new(service, account).map_err(|_| CredentialError::Unavailable)?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(map_keyring_error(error)),
        }
    }

    fn delete(&self, service: &str, account: &str) -> Result<(), CredentialError> {
        let entry =
            keyring::Entry::new(service, account).map_err(|_| CredentialError::Unavailable)?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(map_keyring_error(error)),
        }
    }
}

fn map_keyring_error(_error: keyring::Error) -> CredentialError {
    CredentialError::Unavailable
}

pub struct CredentialManager {
    persistent: Arc<dyn CredentialStore>,
    temporary: Arc<MemoryCredentialStore>,
}

impl CredentialManager {
    pub fn new(persistent: Arc<dyn CredentialStore>) -> Self {
        Self {
            persistent,
            temporary: Arc::new(MemoryCredentialStore::default()),
        }
    }

    pub fn save(
        &self,
        provider_id: &str,
        secret: &str,
        mode: SecretMode,
    ) -> Result<(String, String), AiError> {
        if secret.trim().is_empty() {
            return Err(AiError::new(
                AiErrorCode::CredentialMissing,
                "API Key 不能为空",
                false,
            ));
        }
        let reference = match mode {
            SecretMode::Persistent => {
                self.persistent
                    .set(CREDENTIAL_SERVICE, provider_id, secret)
                    .map_err(|_| unavailable_error())?;
                format!("os://{provider_id}")
            }
            SecretMode::Temporary => {
                self.temporary
                    .set(CREDENTIAL_SERVICE, provider_id, secret)
                    .map_err(|_| unavailable_error())?;
                format!("process://{provider_id}")
            }
            SecretMode::Unchanged | SecretMode::Remove => {
                return Err(AiError::configuration("该凭据模式不能用于写入新密钥"));
            }
        };
        Ok((reference, masked_tail(secret)))
    }

    pub fn get(&self, secret_ref: Option<&str>) -> Result<String, AiError> {
        let reference = secret_ref.ok_or_else(missing_error)?;
        let (scheme, account) = reference
            .split_once("://")
            .ok_or_else(|| AiError::configuration("secret_ref 格式无效"))?;
        let value = match scheme {
            "os" => self
                .persistent
                .get(CREDENTIAL_SERVICE, account)
                .map_err(|_| unavailable_error())?,
            "process" => self
                .temporary
                .get(CREDENTIAL_SERVICE, account)
                .map_err(|_| unavailable_error())?,
            _ => return Err(AiError::configuration("不支持的 secret_ref 类型")),
        };
        value.ok_or_else(missing_error)
    }

    pub fn delete(&self, secret_ref: Option<&str>) -> Result<(), AiError> {
        let Some(reference) = secret_ref else {
            return Ok(());
        };
        let (scheme, account) = reference
            .split_once("://")
            .ok_or_else(|| AiError::configuration("secret_ref 格式无效"))?;
        match scheme {
            "os" => self
                .persistent
                .delete(CREDENTIAL_SERVICE, account)
                .map_err(|_| unavailable_error()),
            "process" => self
                .temporary
                .delete(CREDENTIAL_SERVICE, account)
                .map_err(|_| unavailable_error()),
            _ => Err(AiError::configuration("不支持的 secret_ref 类型")),
        }
    }
}

pub fn default_manager() -> &'static CredentialManager {
    static MANAGER: OnceLock<CredentialManager> = OnceLock::new();
    MANAGER.get_or_init(|| CredentialManager::new(Arc::new(SystemCredentialStore)))
}

fn missing_error() -> AiError {
    AiError::new(AiErrorCode::CredentialMissing, "尚未配置 API Key", false)
        .with_action("在模型与 API 设置中保存凭据")
}

fn unavailable_error() -> AiError {
    AiError::new(
        AiErrorCode::CredentialStoreUnavailable,
        "系统安全凭据存储不可用",
        false,
    )
    .with_action("修复系统凭据服务，或选择仅当前进程临时使用")
}

fn masked_tail(secret: &str) -> String {
    let tail: String = secret
        .chars()
        .rev()
        .take(4)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("••••{tail}")
}

#[cfg(test)]
mod tests {
    use super::{CredentialManager, CredentialStore, MemoryCredentialStore};
    use crate::ai::model::SecretMode;
    use std::sync::Arc;

    #[test]
    fn memory_store_contract() {
        let store = MemoryCredentialStore::default();
        assert_eq!(store.get("service", "account").unwrap(), None);
        store.set("service", "account", "fictional-secret").unwrap();
        assert_eq!(
            store.get("service", "account").unwrap().as_deref(),
            Some("fictional-secret")
        );
        store.delete("service", "account").unwrap();
        assert_eq!(store.get("service", "account").unwrap(), None);
    }

    #[test]
    fn manager_supports_process_only_secret_without_plaintext_reference() {
        let manager = CredentialManager::new(Arc::new(MemoryCredentialStore::default()));
        let (reference, tail) = manager
            .save("provider", "fictional-secret", SecretMode::Temporary)
            .unwrap();
        assert_eq!(reference, "process://provider");
        assert_eq!(tail, "••••cret");
        assert_eq!(manager.get(Some(&reference)).unwrap(), "fictional-secret");
        assert!(!reference.contains("fictional-secret"));
    }
}
