import { FilePlus2, GitPullRequestArrow, Library, Plus, Radio } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { mockSkills } from "@/shared/mock/proMockData";
import { SkillCatalog } from "@/features/inventory/components/SkillCatalog";
import "@/features/inventory/styles.css";
import "../styles.css";

export function LibraryPage() {
  const managed = mockSkills.filter((skill) => skill.libraryState !== "external");
  return (
    <div className="pro-page library-page">
      <div className="pro-page__inner">
        <PageHeader eyebrow="SINGLE SOURCE OF TRUTH" title="中央库" subtitle="以唯一主副本服务多个 Agent。发布、编辑和删除都有明确恢复路径。" actions={<><button type="button" className="pro-button"><Plus size={15} />新建 Skill</button><button type="button" className="pro-button pro-button--primary"><FilePlus2 size={15} />导入中央库</button></>} />
        <section className="library-strip glass-panel">
          <div><Library size={17} /><span><strong>18</strong> 个主副本</span></div>
          <div><Radio size={17} /><span><strong>41</strong> 个 Agent 映射</span></div>
          <div><GitPullRequestArrow size={17} /><span><strong>3</strong> 项未发布修改</span></div>
          <StatusBadge label="1 项漂移需处理" tone="warning" />
        </section>
        <SkillCatalog skills={managed} mode="library" />
      </div>
    </div>
  );
}
