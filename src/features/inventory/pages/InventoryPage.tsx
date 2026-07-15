import { Radar, RefreshCw } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { mockSkills } from "@/shared/mock/proMockData";
import { SkillCatalog } from "../components/SkillCatalog";
import "../styles.css";

export function InventoryPage() {
  return (
    <div className="pro-page inventory-page">
      <div className="pro-page__inner">
        <PageHeader
          eyebrow="LOCAL INVENTORY"
          title="本机 Skill"
          subtitle="来自 Agent、插件缓存与项目目录的只读盘点。纳管前不会移动原文件。"
          actions={<><StatusBadge label="5 个扫描根在线" tone="success" /><button className="pro-button" type="button"><RefreshCw size={15} />重新扫描</button><button className="pro-button pro-button--primary" type="button"><Radar size={15} />管理扫描根</button></>}
        />
        <SkillCatalog skills={mockSkills} />
      </div>
    </div>
  );
}
