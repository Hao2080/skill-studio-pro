use async_trait::async_trait;

use super::model::{AiError, AiRequest, AiResponse, ModelInfo};

#[async_trait]
pub trait AiProvider: Send + Sync {
    fn id(&self) -> &str;
    async fn test_connection(&self, model: &str) -> Result<ModelInfo, AiError>;
    async fn generate(&self, request: AiRequest) -> Result<AiResponse, AiError>;
}
