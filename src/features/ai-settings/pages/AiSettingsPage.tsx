import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, FlaskConical, KeyRound, LockKeyhole, Save, ServerCog, ShieldCheck } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { ModelAttribution } from "@/shared/model-attribution/ModelAttribution";
import { mockProviderConfigs, type MockProviderConfig } from "@/shared/mock/proMockData";
import { saveMockProvider, testMockProvider, type MockConnectionTestResult } from "../api/mockAiSettingsApi";
import "../styles.css";

export function AiSettingsPage() {
  const [providers, setProviders] = useState(mockProviderConfigs);
  const [results, setResults] = useState<Record<string, MockConnectionTestResult>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  async function updateProvider(id: MockProviderConfig["id"], patch: Partial<MockProviderConfig>) {
    const next = providers.map((provider) => provider.id === id ? { ...provider, ...patch } : provider);
    setProviders(next);
    await saveMockProvider(next.find((provider) => provider.id === id)!);
  }

  async function test(provider: MockProviderConfig) {
    const result = await testMockProvider(provider);
    setResults((current) => ({ ...current, [provider.id]: result }));
  }

  return (
    <div className="pro-page ai-settings-page"><div className="pro-page__inner">
      <PageHeader eyebrow="MODEL ROUTING" title="模型与 API" subtitle="配置 Provider、实际模型 ID 与任务职责。当前页面仅使用 Mock API，不会连接 MiniMax 或 OpenAI。" actions={<StatusBadge label="Mock 模式" tone="info"/>} />
      <section className="credential-guard glass-panel"><span><LockKeyhole size={19}/></span><div><h2>密钥不落明文</h2><p>正式后端将使用操作系统安全凭据服务；普通设置只保留引用与脱敏尾号。</p></div><ShieldCheck size={18}/></section>
      <div className="provider-config-grid">
        {providers.map((provider)=><section key={provider.id} className="provider-config glass-panel">
          <header><span>{provider.provider.slice(0,2).toUpperCase()}</span><div><h2>{provider.provider}</h2><p>{provider.responsibility}</p></div><label className="pro-switch"><input type="checkbox" checked={provider.enabled} onChange={(event)=>updateProvider(provider.id,{enabled:event.target.checked})}/><span/><em>{provider.enabled?"已启用":"已停用"}</em></label></header>
          <div className="provider-config__fields">
            <label><span><ServerCog size={13}/>API 地址</span><input value={provider.baseUrl} onChange={(event)=>updateProvider(provider.id,{baseUrl:event.target.value})}/></label>
            <label><span><KeyRound size={13}/>API Key</span><div className="provider-key"><input type={visibleKeys[provider.id]?"text":"password"} value={visibleKeys[provider.id] ? (provider.keyHint === "尚未配置" ? "" : "mock-sk-never-sent-7A") : provider.keyHint} placeholder="仅 Mock，不会保存" readOnly/><button type="button" aria-label={visibleKeys[provider.id]?"隐藏 API Key":"显示 API Key"} onClick={()=>setVisibleKeys((current)=>({...current,[provider.id]:!current[provider.id]}))}>{visibleKeys[provider.id]?<EyeOff size={14}/>:<Eye size={14}/>}</button></div></label>
            <label><span>实际模型 ID</span><input value={provider.modelId} onChange={(event)=>updateProvider(provider.id,{modelId:event.target.value})}/></label>
            <label><span>任务职责</span><textarea value={provider.responsibility} onChange={(event)=>updateProvider(provider.id,{responsibility:event.target.value})}/></label>
          </div>
          {results[provider.id] ? <div className={`provider-result is-${results[provider.id].status}`} role="status"><CheckCircle2 size={14}/><span>{results[provider.id].message}</span>{results[provider.id].latencyMs?<code>{results[provider.id].latencyMs} ms</code>:null}</div> : null}
          <footer><button type="button" className="pro-button" onClick={()=>test(provider)}><FlaskConical size={14}/>测试连接</button><button type="button" className="pro-button pro-button--primary" onClick={()=>updateProvider(provider.id,{})}><Save size={14}/>保存 Mock 配置</button></footer>
        </section>)}
      </div>
      <section className="glass-panel panel-padding attribution-preview"><div className="skill-detail-section-head"><div><h2>归属组件预览</h2><p>所有 AI 内容统一显示 Provider、实际模型、职责、生成时间与新鲜度。</p></div></div><ModelAttribution provider="OpenAI" modelId="gpt-5.6" responsibility="最终简介与冲突解释" generatedAt="2026-07-15 14:33" state="fresh" /></section>
    </div></div>
  );
}
