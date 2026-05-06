import Card from "antd/es/card";
import Col from "antd/es/col";
import Row from "antd/es/row";
import Statistic from "antd/es/statistic";
import Typography from "antd/es/typography";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import { useSnapshotContext } from "@/features/snapshots/state/SnapshotContext";
import { useTeamContext } from "@/features/teams/state/TeamContext";
import "./styles.css";

const { Title, Text } = Typography;

export function DashboardPage() {
  const { skills } = useSkillContext();
  const { snapshots } = useSnapshotContext();
  const { teams, submissions } = useTeamContext();
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        title: "Dashboard",
        subtitle: "Keep this entry as the top-level bridge between personal workspace and team collaboration.",
        skillCount: "Skill Assets",
        snapshotCount: "Snapshots",
        teamPending: "Teams / Pending",
      }
    : {
        title: "总览",
        subtitle: "保留总览入口，用来承接个人工作副本与团队空间。",
        skillCount: "技能资产",
        snapshotCount: "快照数",
        teamPending: "团队 / 待处理",
      };

  return (
    <div className="dashboard-page">
      <header className="dashboard-page__header">
        <Title level={1} className="dashboard-page__title">{copy.title}</Title>
        <Text type="secondary" className="dashboard-page__subtitle">{copy.subtitle}</Text>
      </header>

      <Row gutter={[14, 14]} className="dashboard-page__metrics">
        <Col xs={24} md={8}>
          <Card className="dashboard-page__metric-card"><Statistic title={copy.skillCount} value={skills.length} /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="dashboard-page__metric-card"><Statistic title={copy.snapshotCount} value={snapshots.length} /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="dashboard-page__metric-card"><Statistic title={copy.teamPending} value={`${teams.length} / ${submissions.filter((s) => s.status === "pending").length}`} /></Card>
        </Col>
      </Row>
    </div>
  );
}
