use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::model::{SourceEvidence, SourceResolution, RESOLVER_VERSION};

pub fn resolve(instance_id: &str, evidence: &[SourceEvidence], now: i64) -> SourceResolution {
    let evidence_hash = evidence_hash(evidence);
    if let Some(confirmed) = evidence
        .iter()
        .rev()
        .find(|item| item.evidence_type == "user_confirmed" && !item.is_conflict)
    {
        let source_type = confirmed
            .evidence_key
            .strip_prefix("source_type:")
            .unwrap_or("manual")
            .to_string();
        return SourceResolution {
            id: Uuid::new_v4().to_string(),
            instance_id: instance_id.to_string(),
            source_type,
            source_label: confirmed
                .source_candidate
                .clone()
                .unwrap_or_else(|| "用户确认".to_string()),
            source_ref: confirmed.evidence_value.clone(),
            confidence: 100,
            resolution_status: "confirmed".to_string(),
            rationale: "用户已明确确认来源；自动证据继续保留供审计。".to_string(),
            user_confirmed: true,
            evidence_hash,
            resolved_at: now,
            updated_at: now,
        };
    }

    let positive = evidence
        .iter()
        .filter(|item| !item.is_conflict)
        .map(|item| item.weight.max(0))
        .sum::<i32>();
    let penalties = evidence
        .iter()
        .filter(|item| item.is_conflict)
        .map(|item| item.weight.abs().max(25))
        .sum::<i32>();
    let confidence = (positive - penalties).clamp(0, 99);
    let strongest = evidence
        .iter()
        .filter(|item| !item.is_conflict && item.weight > 0)
        .max_by_key(|item| (source_rank(&item.evidence_type), item.weight));

    let (source_type, source_label, source_ref) = strongest.map_or_else(
        || ("unknown".to_string(), "未知来源".to_string(), None),
        |item| {
            (
                evidence_source_type(&item.evidence_type).to_string(),
                item.source_candidate
                    .clone()
                    .unwrap_or_else(|| item.evidence_type.clone()),
                item.evidence_value.clone(),
            )
        },
    );
    let status = if confidence == 0 {
        "unknown"
    } else {
        "inferred"
    };
    let band = match confidence {
        85..=99 => "高",
        60..=84 => "中",
        1..=59 => "低",
        _ => "未知",
    };
    let rationale = if confidence == 0 {
        "没有足够的本地可验证来源证据。".to_string()
    } else {
        format!(
            "确定性规则 {}：正向证据 {} 分，冲突扣分 {}，{}可信度。",
            RESOLVER_VERSION, positive, penalties, band
        )
    };

    SourceResolution {
        id: Uuid::new_v4().to_string(),
        instance_id: instance_id.to_string(),
        source_type,
        source_label,
        source_ref,
        confidence,
        resolution_status: status.to_string(),
        rationale,
        user_confirmed: false,
        evidence_hash,
        resolved_at: now,
        updated_at: now,
    }
}

fn source_rank(evidence_type: &str) -> i32 {
    match evidence_type {
        "app_install_record" => 80,
        "git_repository" => 70,
        "plugin_manifest" => 60,
        "official_system_path" => 50,
        "known_agent_path" => 40,
        "content_source" => 30,
        "name_match" => 20,
        "minimax_candidate" => 10,
        _ => 0,
    }
}

fn evidence_source_type(evidence_type: &str) -> &'static str {
    match evidence_type {
        "app_install_record" => "local_import",
        "plugin_manifest" => "plugin",
        "git_repository" => "git_repository",
        "official_system_path" => "system",
        "known_agent_path" => "platform_scan",
        "content_source" | "minimax_candidate" => "unknown",
        _ => "unknown",
    }
}

pub fn evidence_hash(evidence: &[SourceEvidence]) -> String {
    let mut rows = evidence
        .iter()
        .map(|item| {
            format!(
                "{}\0{}\0{}\0{}\0{}\0{}",
                item.evidence_type,
                item.evidence_key,
                item.evidence_value.as_deref().unwrap_or_default(),
                item.source_candidate.as_deref().unwrap_or_default(),
                item.weight,
                item.is_conflict
            )
        })
        .collect::<Vec<_>>();
    rows.sort();
    let mut hasher = Sha256::new();
    hasher.update(RESOLVER_VERSION.as_bytes());
    for row in rows {
        hasher.update(row.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::resolve;
    use crate::origin::model::{SourceEvidence, RESOLVER_VERSION};

    fn item(kind: &str, weight: i32, conflict: bool) -> SourceEvidence {
        SourceEvidence {
            id: kind.to_string(),
            instance_id: Some("instance".to_string()),
            skill_id: None,
            evidence_type: kind.to_string(),
            evidence_key: kind.to_string(),
            evidence_value: None,
            source_candidate: Some(kind.to_string()),
            weight,
            is_conflict: conflict,
            resolver_version: RESOLVER_VERSION.to_string(),
            observed_at: 1,
        }
    }

    #[test]
    fn deterministic_weight_examples_match_design() {
        assert_eq!(resolve("i", &[], 1).confidence, 0);
        assert_eq!(
            resolve("i", &[item("known_agent_path", 15, false)], 1).confidence,
            15
        );
        assert_eq!(
            resolve(
                "i",
                &[
                    item("git_repository", 35, false),
                    item("known_agent_path", 15, false)
                ],
                1
            )
            .confidence,
            50
        );
        assert_eq!(
            resolve(
                "i",
                &[
                    item("app_install_record", 50, false),
                    item("git_repository", 35, false)
                ],
                1
            )
            .confidence,
            85
        );
        assert_eq!(
            resolve(
                "i",
                &[
                    item("plugin_manifest", 35, false),
                    item("official_system_path", 30, false),
                    item("known_agent_path", 15, false)
                ],
                1
            )
            .confidence,
            80
        );
    }

    #[test]
    fn automatic_score_caps_at_99_and_conflicts_subtract() {
        let resolution = resolve(
            "i",
            &[
                item("app_install_record", 80, false),
                item("git_repository", 35, false),
                item("conflict", 25, true),
            ],
            1,
        );
        assert_eq!(resolution.confidence, 90);
        assert!(!resolution.user_confirmed);
    }

    #[test]
    fn minimax_candidate_is_reserved_but_cannot_raise_confidence() {
        let resolution = resolve("i", &[item("minimax_candidate", 0, false)], 1);
        assert_eq!(resolution.confidence, 0);
        assert_eq!(resolution.resolution_status, "unknown");
    }
}
