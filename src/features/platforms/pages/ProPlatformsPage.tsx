import { Cable, Check, FolderCog, Plus, RefreshCw, Settings2, Unplug } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { mockPlatforms } from "@/shared/mock/proMockData";
import "../pro-styles.css";

export function ProPlatformsPage() {
  return (
    <div className="pro-page platforms-pro-page">
      <div className="pro-page__inner">
        <PageHeader eyebrow="AGENT ADAPTERS" title="平台中心" subtitle="管理 Agent 检测、Skill 目录和发布方式。第一代默认采用复制模式。" actions={<><button className="pro-button" type="button"><RefreshCw size={15}/>重新检测</button><button className="pro-button pro-button--primary" type="button"><Plus size={15}/>添加自定义平台</button></>} />
        <section className="platform-summary glass-panel"><div><Check size={15}/>已检测 <strong>4 / 5</strong></div><div><Cable size={15}/>受管映射 <strong>44</strong></div><div><FolderCog size={15}/>默认模式 <strong>复制</strong></div><StatusBadge label="适配器状态正常" tone="success" /></section>
        <div className="platform-card-grid">
          {mockPlatforms.map((platform) => (
            <article key={platform.id} className={`platform-pro-card glass-panel is-${platform.status}`}>
              <div className="platform-pro-card__head"><span>{platform.shortName}</span><div><h2>{platform.name}</h2><p>{platform.detected ? "已检测到本机安装" : "未检测到默认目录"}</p></div><StatusBadge label={platform.status === "ready" ? "可用" : platform.status === "attention" ? "需处理" : "离线"} tone={platform.status === "ready" ? "success" : platform.status === "attention" ? "warning" : "neutral"} /></div>
              <dl><div><dt>Skill 目录</dt><dd><code>{platform.path}</code></dd></div><div><dt>同步模式</dt><dd>{platform.syncMode}</dd></div><div><dt>受管 Skill</dt><dd>{platform.managedCount}</dd></div><div><dt>最近同步</dt><dd>{platform.lastSync}</dd></div></dl>
              <footer><button type="button" disabled={!platform.detected}><Settings2 size={13}/>配置</button><button type="button" disabled={!platform.detected}>{platform.enabled ? <><Unplug size={13}/>停用</> : <><Cable size={13}/>启用</>}</button></footer>
            </article>
          ))}
        </div>
        <p className="platform-footnote">符号链接能力会按操作系统与目标平台单独检测；不可用时不会静默降级。</p>
      </div>
    </div>
  );
}
