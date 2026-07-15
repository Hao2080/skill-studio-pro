import type { MockProviderConfig } from "@/shared/mock/proMockData";

export interface MockConnectionTestResult {
  providerId: MockProviderConfig["id"];
  status: "connected" | "not_configured";
  modelId: string;
  latencyMs?: number;
  message: string;
}

export async function testMockProvider(config: MockProviderConfig): Promise<MockConnectionTestResult> {
  if (!config.enabled || config.keyHint === "尚未配置") {
    return { providerId: config.id, status: "not_configured", modelId: config.modelId, message: "请先配置 API Key；本地功能不受影响。" };
  }
  return { providerId: config.id, status: "connected", modelId: config.modelId, latencyMs: 186, message: "Mock 连接测试成功，没有发送真实网络请求。" };
}

export async function saveMockProvider(config: MockProviderConfig): Promise<MockProviderConfig> {
  return { ...config };
}
