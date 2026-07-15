import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, Bot, Library, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { MetricCard, PageHeader, StatusBadge } from "@/shared/components/pro";
import { mockActivities, mockProviderConfigs, mockSkills } from "@/shared/mock/proMockData";
import "./styles.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const confirmed = mockSkills.filter((skill) => skill.source.status === "confirmed").length;
  const risky = mockSkills.filter((skill) => skill.hasScripts || skill.duplicateState === "conflict").length;

  return (
    <div className="pro-page dashboard-page">
      <div className="pro-page__inner">
        <PageHeader
          eyebrow="LOCAL-FIRST CONTROL CENTER"
          title="总览"
          subtitle="看清本机 Skill 的分布、来源与变化。扫描只建立索引，不会移动或修改现有文件。"
          actions={(
            <>
              <button className="pro-button" type="button" onClick={() => navigate("/activity")}><Radar size={15} />查看记录</button>
              <button className="pro-button pro-button--primary" type="button" onClick={() => navigate("/inventory")}><Sparkles size={15} />开始安全扫描</button>
            </>
          )}
        />

        <section className="metric-grid" aria-label="资产概览">
          <MetricCard icon={<Boxes size={18} />} value="42" label="本机 Skill · 68 个实例" trend="+2 今日" />
          <MetricCard icon={<Library size={18} />} value="18" label="中央库主副本" trend="5 个 Agent" />
          <MetricCard icon={<ShieldCheck size={18} />} value={`${confirmed + 31}`} label="来源已确认或高可信" trend="88% 已识别" />
          <MetricCard icon={<AlertTriangle size={18} />} value={risky + 5} label="需要查看的冲突与脚本" trend="3 项优先处理" />
        </section>

        <section className="dashboard-hero glass-panel">
          <div className="dashboard-hero__orb" aria-hidden="true"><Radar size={34} /></div>
          <div className="dashboard-hero__copy">
            <div className="dashboard-hero__title-row"><h2>本机盘点健康</h2><StatusBadge label="索引已更新" tone="success" /></div>
            <p>5 个扫描根均可访问，最近一次增量扫描于 14:35 完成。外部目录哈希保持不变。</p>
            <div className="dashboard-hero__progress" aria-label="扫描根进度 100%"><span /></div>
            <div className="dashboard-hero__facts"><span>42 个 Skill</span><span>68 个实例</span><span>2 项更新</span><span>0 个扫描错误</span></div>
          </div>
          <button type="button" className="pro-button" onClick={() => navigate("/inventory")}>打开本机 Skill</button>
        </section>

        <div className="pro-grid-2">
          <section className="glass-panel panel-padding dashboard-activity" aria-labelledby="recent-activity-title">
            <div className="dashboard-panel-head"><div><h2 id="recent-activity-title" className="pro-section-title">最近操作</h2><p className="pro-section-copy">每一步都有结果、时间和下一步。</p></div><button type="button" onClick={() => navigate("/activity")}>全部记录</button></div>
            <div className="dashboard-activity__list">
              {mockActivities.slice(0, 4).map((activity) => (
                <article key={activity.id} className="dashboard-activity__item">
                  <span className={`dashboard-activity__dot is-${activity.status}`} aria-hidden="true" />
                  <div><strong>{activity.title}</strong><span>{activity.target}</span><p>{activity.detail}</p></div>
                  <time>{activity.time}</time>
                </article>
              ))}
            </div>
          </section>

          <div className="dashboard-side-stack">
            <section className="glass-panel panel-padding">
              <div className="dashboard-panel-head"><div><h2 className="pro-section-title">来源可信度</h2><p className="pro-section-copy">基于确定性证据，不是安全评分。</p></div><ShieldCheck size={18} /></div>
              <div className="confidence-distribution">
                <div><span>已确认</span><strong>31</strong><i style={{ "--bar": "76%" } as React.CSSProperties} /></div>
                <div><span>推断</span><strong>8</strong><i style={{ "--bar": "42%" } as React.CSSProperties} /></div>
                <div><span>未知</span><strong>3</strong><i style={{ "--bar": "18%" } as React.CSSProperties} /></div>
              </div>
            </section>
            <section className="glass-panel panel-padding provider-health">
              <div className="dashboard-panel-head"><div><h2 className="pro-section-title">模型状态</h2><p className="pro-section-copy">AI 未配置也不影响本地功能。</p></div><Bot size={18} /></div>
              {mockProviderConfigs.map((provider) => (
                <button key={provider.id} type="button" onClick={() => navigate("/settings/ai")}>
                  <span><strong>{provider.provider}</strong><small>{provider.modelId}</small></span>
                  <StatusBadge label={provider.connection === "connected" ? "已连接" : "未配置"} tone={provider.connection === "connected" ? "success" : "neutral"} />
                </button>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
