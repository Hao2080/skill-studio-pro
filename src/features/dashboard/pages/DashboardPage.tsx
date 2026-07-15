import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, Bot, Library, LoaderCircle, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { MetricCard, PageHeader, StatusBadge } from "@/shared/components/pro";
import { inventoryApi } from "@/features/inventory/api/inventoryApi";
import { libraryApi } from "@/features/library/api/libraryApi";
import { activityApi } from "@/features/activity/api/activityApi";
import { aiApi } from "@/features/ai-settings/api/aiApi";
import type { AiProviderConfig } from "@/features/ai-settings/model";
import type { OperationLog } from "@/features/activity/model";
import "./styles.css";

interface DashboardData {
  uniqueSkills: number;
  instances: number;
  librarySkills: number;
  confirmedSources: number;
  risky: number;
  roots: number;
  scanErrors: number;
  activities: OperationLog[];
  providers: AiProviderConfig[];
  partialFailures: number;
}

const emptyData: DashboardData = { uniqueSkills: 0, instances: 0, librarySkills: 0, confirmedSources: 0, risky: 0, roots: 0, scanErrors: 0, activities: [], providers: [], partialFailures: 0 };

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const [instances, roots, library, providers, activities] = await Promise.allSettled([
        inventoryApi.listInstances({ includeMissing: false, limit: 1000, offset: 0 }),
        inventoryApi.listRoots(),
        libraryApi.list(),
        aiApi.listProviders(),
        activityApi.list({ limit: 10, offset: 0 }),
      ]);
      if (!active) return;
      if ([instances, roots, library, providers, activities].every((result) => result.status === "rejected")) {
        setError("总览数据加载失败；请检查应用数据库是否可用。");
        setLoading(false);
        return;
      }
      const instanceItems = instances.status === "fulfilled" ? instances.value.items : [];
      setData({
        uniqueSkills: new Set(instanceItems.map((item) => item.canonicalName)).size,
        instances: instances.status === "fulfilled" ? instances.value.total : 0,
        librarySkills: library.status === "fulfilled" ? library.value.length : 0,
        confirmedSources: instances.status === "fulfilled" ? Object.values(instances.value.resolutions ?? {}).filter((resolution) => resolution.resolutionStatus === "confirmed").length : 0,
        risky: instanceItems.filter((item) => item.hasScripts || item.hasExecutables || item.duplicateKinds.includes("same_name_different_content")).length,
        roots: roots.status === "fulfilled" ? roots.value.filter((root) => root.enabled && root.available).length : 0,
        scanErrors: instanceItems.filter((item) => item.parseStatus === "error").length,
        activities: activities.status === "fulfilled" ? activities.value : [],
        providers: providers.status === "fulfilled" ? providers.value : [],
        partialFailures: [instances, roots, library, providers, activities].filter((item) => item.status === "rejected").length,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="pro-page dashboard-page"><div className="pro-page__inner">
      <PageHeader eyebrow="LOCAL-FIRST CONTROL CENTER" title="总览" subtitle="看清本机 Skill 的分布、来源与变化。扫描只建立索引，不会移动或修改现有文件。" actions={<><button className="pro-button" type="button" onClick={() => navigate("/activity")}><Radar size={15}/>查看记录</button><button className="pro-button pro-button--primary" type="button" onClick={() => navigate("/inventory")}><Sparkles size={15}/>开始安全扫描</button></>} />
      {loading ? <div className="pro-empty glass-panel" role="status"><div><LoaderCircle size={28}/><strong>正在加载本地总览</strong></div></div> : null}
      {error ? <div className="pro-empty glass-panel" role="alert"><div><AlertTriangle size={28}/><strong>{error}</strong></div></div> : null}
      {!loading && !error ? <>
        {data.partialFailures ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="部分加载" tone="warning"/><span>{data.partialFailures} 个数据分区未能加载，其余指标仍来自真实后端。</span></div> : null}
        <section className="metric-grid" aria-label="资产概览"><MetricCard icon={<Boxes size={18}/>} value={data.uniqueSkills} label={`本机 Skill · ${data.instances} 个实例`} /><MetricCard icon={<Library size={18}/>} value={data.librarySkills} label="中央库主副本" /><MetricCard icon={<ShieldCheck size={18}/>} value={data.confirmedSources} label="来源已确认" /><MetricCard icon={<AlertTriangle size={18}/>} value={data.risky} label="需要查看的冲突与脚本" /></section>
        <section className="dashboard-hero glass-panel"><div className="dashboard-hero__orb"><Radar size={34}/></div><div className="dashboard-hero__copy"><div className="dashboard-hero__title-row"><h2>本机盘点状态</h2><StatusBadge label="SQLite 实时索引" tone="success"/></div><p>{data.roots} 个可用扫描根；外部目录保持只读。</p><div className="dashboard-hero__facts"><span>{data.uniqueSkills} 个 Skill</span><span>{data.instances} 个实例</span><span>{data.risky} 项风险</span><span>{data.scanErrors} 个解析错误</span></div></div><button type="button" className="pro-button" onClick={() => navigate("/inventory")}>打开本机 Skill</button></section>
        <div className="pro-grid-2"><section className="glass-panel panel-padding dashboard-activity"><div className="dashboard-panel-head"><div><h2 className="pro-section-title">最近操作</h2><p className="pro-section-copy">每一步都有结果、时间和下一步。</p></div><button type="button" onClick={() => navigate("/activity")}>全部记录</button></div><div className="dashboard-activity__list">{data.activities.slice(0,4).map((activity)=><article key={activity.id} className="dashboard-activity__item"><span className={`dashboard-activity__dot is-${activity.status}`}/><div><strong>{activity.operationType}</strong><span>{activity.targetLabel}</span><p>{activity.errorSummary ?? activity.status}</p></div><time>{new Date(activity.createdAt).toLocaleTimeString()}</time></article>)}{!data.activities.length?<p>暂无操作记录。</p>:null}</div></section><div className="dashboard-side-stack"><section className="glass-panel panel-padding provider-health"><div className="dashboard-panel-head"><div><h2 className="pro-section-title">模型状态</h2><p className="pro-section-copy">AI 未配置也不影响本地功能。</p></div><Bot size={18}/></div>{data.providers.map((provider)=><button key={provider.providerId} type="button" onClick={()=>navigate("/settings/ai")}><span><strong>{provider.displayName}</strong><small>{provider.defaultModel}</small></span><StatusBadge label={provider.lastTestStatus ?? (provider.secretRef ? "已配置" : "未配置")} tone={provider.lastTestStatus==="success"?"success":"neutral"}/></button>)}</section></div></div>
      </> : null}
    </div></div>
  );
}
