import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, FlaskConical, KeyRound, LoaderCircle, LockKeyhole, Save, ServerCog, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { ModelAttribution } from "@/shared/model-attribution/ModelAttribution";
import { aiApi, type AiApi } from "../api/aiApi";
import type { AiProviderConfig, AiTaskRoute, ProviderTestResult, SecretMode } from "../model";
import "../styles.css";

export interface AiSettingsPageProps {
  api?: AiApi;
}

interface ProviderDraft extends AiProviderConfig {
  apiKey: string;
  keyMode: Extract<SecretMode, "persistent" | "temporary">;
}

type ProviderUiResult = ProviderTestResult | { status: string; message: string };

export function AiSettingsPage({ api = aiApi }: AiSettingsPageProps) {
  const [providers, setProviders] = useState<ProviderDraft[]>([]);
  const [routes, setRoutes] = useState<AiTaskRoute[]>([]);
  const [results, setResults] = useState<Record<string, ProviderUiResult>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setPartial("");
    const [providerResult, routeResult] = await Promise.allSettled([api.listProviders(), api.listTaskRoutes()]);
    if (providerResult.status === "fulfilled") {
      setProviders(providerResult.value.map((provider) => ({ ...provider, apiKey: "", keyMode: "persistent" })));
    }
    if (routeResult.status === "fulfilled") setRoutes(routeResult.value);
    if (providerResult.status === "rejected" && routeResult.status === "rejected") {
      setError(`Provider 与任务路由均加载失败：${String(providerResult.reason)}`);
    } else if (providerResult.status === "rejected" || routeResult.status === "rejected") {
      setPartial("部分模型配置加载失败；已加载的数据仍可查看。")
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchProvider(id: string, patch: Partial<ProviderDraft>) {
    setProviders((current) => current.map((provider) => provider.providerId === id ? { ...provider, ...patch } : provider));
  }

  async function saveProvider(provider: ProviderDraft, mode?: SecretMode) {
    setError("");
    const key = provider.apiKey;
    try {
      const saved = await api.saveProvider({
        providerId: provider.providerId,
        providerType: provider.providerType,
        displayName: provider.displayName,
        baseUrl: provider.baseUrl,
        defaultModel: provider.defaultModel,
        enabled: provider.enabled,
        timeoutMs: provider.timeoutMs,
        maxConcurrency: provider.maxConcurrency,
        retryCount: provider.retryCount,
        apiKey: key || undefined,
        secretMode: mode ?? (key ? provider.keyMode : "unchanged"),
      });
      setProviders((current) => current.map((item) => item.providerId === saved.providerId ? { ...saved, apiKey: "", keyMode: item.keyMode } : item));
      setVisibleKeys((current) => ({ ...current, [saved.providerId]: false }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      patchProvider(provider.providerId, { apiKey: "" });
    }
  }

  async function testProvider(providerId: string) {
    setResults((current) => ({ ...current, [providerId]: { status: "testing", message: "正在测试连接" } }));
    try {
      const result = await api.testProvider(providerId);
      setResults((current) => ({ ...current, [providerId]: result }));
    } catch (reason) {
      setResults((current) => ({ ...current, [providerId]: { status: "error", message: reason instanceof Error ? reason.message : String(reason) } }));
    }
  }

  async function saveRoute(route: AiTaskRoute) {
    setError("");
    try {
      const saved = await api.saveTaskRoute({
        taskType: route.taskType,
        providerId: route.providerId,
        modelId: route.modelId,
        promptVersion: route.promptVersion,
        responsibility: route.responsibility,
        enabled: route.enabled,
      });
      setRoutes((current) => current.map((item) => item.taskType === saved.taskType ? saved : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  const connected = providers.filter((provider) => provider.lastTestStatus === "success").length;
  const previewRoute = useMemo(() => routes.find((route) => route.taskType === "final_summary") ?? routes[0], [routes]);

  return (
    <div className="pro-page ai-settings-page"><div className="pro-page__inner">
      <PageHeader eyebrow="MODEL ROUTING" title="模型与 API" subtitle="配置 Provider、实际模型 ID 与任务职责。连接测试只在你明确点击时调用所选 Provider。" actions={<StatusBadge label={`${connected}/${providers.length} 已验证`} tone={connected ? "success" : "neutral"}/>} />
      <section className="credential-guard glass-panel"><span><LockKeyhole size={19}/></span><div><h2>密钥不落明文</h2><p>API Key 仅提交给后端安全凭据接口；保存完成或失败后立即从输入状态清除，界面只保留脱敏尾号。</p></div><ShieldCheck size={18}/></section>
      {loading ? <div className="pro-empty glass-panel" role="status"><div><LoaderCircle size={28}/><strong>正在加载 Provider 与任务路由</strong></div></div> : null}
      {partial ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="部分加载" tone="warning"/><span>{partial}</span></div> : null}
      {error ? <div className="trash-notice glass-panel" role="alert"><StatusBadge label="配置错误" tone="danger"/><span>{error}</span></div> : null}
      <div className="provider-config-grid">
        {providers.map((provider) => { const result = results[provider.providerId]; return <section key={provider.providerId} className="provider-config glass-panel">
          <header><span>{provider.displayName.slice(0,2).toUpperCase()}</span><div><h2>{provider.displayName}</h2><p>{routes.filter((route) => route.providerId === provider.providerId).map((route) => route.responsibility).join("、") || "尚未分配职责"}</p></div><label className="pro-switch"><input type="checkbox" checked={provider.enabled} onChange={(event)=>patchProvider(provider.providerId,{enabled:event.target.checked})}/><span/><em>{provider.enabled?"已启用":"已停用"}</em></label></header>
          <div className="provider-config__fields">
            <label><span><ServerCog size={13}/>API 地址</span><input value={provider.baseUrl} onChange={(event)=>patchProvider(provider.providerId,{baseUrl:event.target.value})}/></label>
            <label><span><KeyRound size={13}/>API Key</span><div className="provider-key"><input aria-label={`${provider.displayName} API Key`} autoComplete="off" type={visibleKeys[provider.providerId]?"text":"password"} value={provider.apiKey} onChange={(event)=>patchProvider(provider.providerId,{apiKey:event.target.value})} placeholder={provider.secretTail ? `已保存 ····${provider.secretTail}` : "尚未配置"}/><button type="button" aria-label={visibleKeys[provider.providerId]?"隐藏 API Key":"显示 API Key"} onClick={()=>setVisibleKeys((current)=>({...current,[provider.providerId]:!current[provider.providerId]}))}>{visibleKeys[provider.providerId]?<EyeOff size={14}/>:<Eye size={14}/>}</button></div></label>
            <label><span>密钥保存方式</span><select value={provider.keyMode} onChange={(event)=>patchProvider(provider.providerId,{keyMode:event.target.value as ProviderDraft["keyMode"]})}><option value="persistent">操作系统安全凭据服务</option><option value="temporary">仅当前进程</option></select></label>
            <label><span>默认模型 ID</span><input value={provider.defaultModel} onChange={(event)=>patchProvider(provider.providerId,{defaultModel:event.target.value})}/></label>
          </div>
          {result ? <div className={`provider-result is-${result.status === "error" ? "error" : "success"}`} role="status">{result.status === "error" ? <AlertTriangle size={14}/>:<CheckCircle2 size={14}/>}<span>{"message" in result ? result.message : `${result.status}${result.model?.modelId ? ` · ${result.model.modelId}` : ""}`}</span>{"testedAt" in result ? <code>{new Date(result.testedAt).toLocaleTimeString()}</code>:null}</div> : null}
          <footer><button type="button" className="pro-button" onClick={()=>void testProvider(provider.providerId)}><FlaskConical size={14}/>测试连接</button>{provider.secretRef ? <button type="button" className="pro-button pro-button--danger" onClick={()=>void saveProvider(provider,"remove")}><Trash2 size={14}/>移除密钥</button> : null}<button type="button" className="pro-button pro-button--primary" onClick={()=>void saveProvider(provider)}><Save size={14}/>保存配置</button></footer>
        </section>; })}
      </div>
      <section className="glass-panel panel-padding attribution-preview"><div className="skill-detail-section-head"><div><h2>模型职责路由</h2><p>实际模型、提示词版本和职责都由后端配置保存。</p></div></div><div className="provider-config-grid">{routes.map((route) => <article key={route.taskType} className="provider-config"><strong>{route.taskType}</strong><label>模型 ID<input value={route.modelId} onChange={(event)=>setRoutes((current)=>current.map((item)=>item.taskType===route.taskType?{...item,modelId:event.target.value}:item))}/></label><label>职责<input value={route.responsibility} onChange={(event)=>setRoutes((current)=>current.map((item)=>item.taskType===route.taskType?{...item,responsibility:event.target.value}:item))}/></label><button className="pro-button" type="button" onClick={()=>void saveRoute(route)}><Save size={13}/>保存职责</button></article>)}</div>{previewRoute ? <ModelAttribution provider={providers.find((provider)=>provider.providerId===previewRoute.providerId)?.displayName ?? previewRoute.providerId} modelId={previewRoute.modelId} responsibility={previewRoute.responsibility} generatedAt={new Date(previewRoute.updatedAt).toLocaleString()} state={previewRoute.enabled ? "fresh" : "disabled"} /> : null}</section>
    </div></div>
  );
}
