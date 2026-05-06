use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::domain::{
    BatchApplySkillOrganizationInput, CreateSkillCollectionInput, EnsureSkillTagsInput,
    SkillCollection, SkillOrganizationRecord, SkillOrganizationSnapshot, SkillTag,
    UpdateSkillCollectionInput, UpdateSkillTagInput,
};

use super::{get_conn, now_ms};

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn normalize_required_text(value: &str, field: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(format!("{} 不能为空", field));
    }

    Ok(normalized.to_string())
}

fn normalize_unique_names(values: &[String]) -> Vec<String> {
    let mut normalized: Vec<String> = Vec::new();
    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }

        if normalized
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(trimmed))
        {
            continue;
        }

        normalized.push(trimmed.to_string());
    }

    normalized
}

fn normalize_unique_ids(values: &[String]) -> Vec<String> {
    let mut normalized: Vec<String> = Vec::new();
    for value in values {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }

        if normalized.iter().any(|existing| existing == trimmed) {
            continue;
        }

        normalized.push(trimmed.to_string());
    }

    normalized
}

fn split_csv(value: Option<String>) -> Vec<String> {
    value.map_or_else(Vec::new, |items| {
        items
            .split(',')
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .map(str::to_string)
            .collect()
    })
}

fn get_collection_by_id(conn: &Connection, collection_id: &str) -> Result<SkillCollection, String> {
    conn.query_row(
        "SELECT c.id, c.name, c.description, c.color,
                (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id),
                c.created_at, c.updated_at
         FROM skill_collections c
         WHERE c.id = ?1",
        params![collection_id],
        |row| {
            Ok(SkillCollection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                item_count: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| format!("读取集合失败: {}", e))
}

fn get_tag_by_id(conn: &Connection, tag_id: &str) -> Result<SkillTag, String> {
    conn.query_row(
        "SELECT t.id, t.name, t.color,
                (SELECT COUNT(*) FROM skill_tag_relations r WHERE r.tag_id = t.id),
                t.created_at, t.updated_at
         FROM skill_tags t
         WHERE t.id = ?1",
        params![tag_id],
        |row| {
            Ok(SkillTag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                usage_count: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| format!("读取标签失败: {}", e))
}

fn list_collections(conn: &Connection) -> Result<Vec<SkillCollection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.description, c.color, COUNT(ci.skill_id), c.created_at, c.updated_at
             FROM skill_collections c
             LEFT JOIN collection_items ci ON ci.collection_id = c.id
             GROUP BY c.id, c.name, c.description, c.color, c.created_at, c.updated_at
             ORDER BY c.created_at ASC, c.name COLLATE NOCASE ASC",
        )
        .map_err(|e| format!("准备集合查询失败: {}", e))?;

    let collections = stmt
        .query_map([], |row| {
            Ok(SkillCollection {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                item_count: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("查询集合失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取集合失败: {}", e))?;

    Ok(collections)
}

fn list_tags(conn: &Connection) -> Result<Vec<SkillTag>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.color, COUNT(r.skill_id), t.created_at, t.updated_at
             FROM skill_tags t
             LEFT JOIN skill_tag_relations r ON r.tag_id = t.id
             GROUP BY t.id, t.name, t.color, t.created_at, t.updated_at
             ORDER BY t.created_at ASC, t.name COLLATE NOCASE ASC",
        )
        .map_err(|e| format!("准备标签查询失败: {}", e))?;

    let tags = stmt
        .query_map([], |row| {
            Ok(SkillTag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                usage_count: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("查询标签失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取标签失败: {}", e))?;

    Ok(tags)
}

fn list_records(conn: &Connection) -> Result<Vec<SkillOrganizationRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT s.id,
                    pc.id,
                    pc.name,
                    GROUP_CONCAT(DISTINCT c.id),
                    GROUP_CONCAT(DISTINCT c.name),
                    GROUP_CONCAT(DISTINCT t.id),
                    GROUP_CONCAT(DISTINCT t.name)
             FROM skills s
             LEFT JOIN collection_items pci
                    ON pci.skill_id = s.id AND pci.is_primary = 1
             LEFT JOIN skill_collections pc
                    ON pc.id = pci.collection_id
             LEFT JOIN collection_items ci
                    ON ci.skill_id = s.id
             LEFT JOIN skill_collections c
                    ON c.id = ci.collection_id
             LEFT JOIN skill_tag_relations str
                    ON str.skill_id = s.id
             LEFT JOIN skill_tags t
                    ON t.id = str.tag_id
             GROUP BY s.id, pc.id, pc.name
             ORDER BY s.updated_at DESC",
        )
        .map_err(|e| format!("准备组织记录查询失败: {}", e))?;

    let records = stmt
        .query_map([], |row| {
            Ok(SkillOrganizationRecord {
                skill_id: row.get(0)?,
                primary_collection_id: row.get(1)?,
                primary_collection_name: row.get(2)?,
                collection_ids: split_csv(row.get(3)?),
                collection_names: split_csv(row.get(4)?),
                tag_ids: split_csv(row.get(5)?),
                tag_names: split_csv(row.get(6)?),
            })
        })
        .map_err(|e| format!("查询组织记录失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取组织记录失败: {}", e))?;

    Ok(records)
}

pub fn get_skill_organization_snapshot<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<SkillOrganizationSnapshot, String> {
    let conn = get_conn(app)?;
    Ok(SkillOrganizationSnapshot {
        collections: list_collections(&conn)?,
        tags: list_tags(&conn)?,
        records: list_records(&conn)?,
    })
}

pub fn create_skill_collection<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CreateSkillCollectionInput,
) -> Result<SkillCollection, String> {
    let name = normalize_required_text(&input.name, "集合名称")?;
    let description = normalize_optional_text(input.description.as_deref());
    let color = normalize_optional_text(input.color.as_deref());
    let now = now_ms();
    let id = Uuid::new_v4().to_string();
    let conn = get_conn(app)?;

    let exists = conn
        .query_row(
            "SELECT id FROM skill_collections WHERE lower(name) = lower(?1)",
            params![name.as_str()],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("检查集合名称失败: {}", e))?;

    if exists.is_some() {
        return Err("集合名称已存在".to_string());
    }

    conn.execute(
        "INSERT INTO skill_collections (id, name, description, color, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id.as_str(),
            name.as_str(),
            description.as_deref(),
            color.as_deref(),
            now,
            now
        ],
    )
    .map_err(|e| format!("创建集合失败: {}", e))?;

    get_collection_by_id(&conn, &id)
}

pub fn update_skill_collection<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &UpdateSkillCollectionInput,
) -> Result<SkillCollection, String> {
    let collection_id = normalize_required_text(&input.collection_id, "collectionId")?;
    let name = normalize_required_text(&input.name, "集合名称")?;
    let description = normalize_optional_text(input.description.as_deref());
    let color = normalize_optional_text(input.color.as_deref());
    let now = now_ms();
    let conn = get_conn(app)?;

    let duplicate = conn
        .query_row(
            "SELECT id FROM skill_collections
             WHERE lower(name) = lower(?1) AND id <> ?2",
            params![name.as_str(), collection_id.as_str()],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("检查集合名称失败: {}", e))?;

    if duplicate.is_some() {
        return Err("集合名称已存在".to_string());
    }

    let updated = conn
        .execute(
            "UPDATE skill_collections
             SET name = ?1, description = ?2, color = ?3, updated_at = ?4
             WHERE id = ?5",
            params![
                name.as_str(),
                description.as_deref(),
                color.as_deref(),
                now,
                collection_id.as_str()
            ],
        )
        .map_err(|e| format!("更新集合失败: {}", e))?;

    if updated == 0 {
        return Err("集合不存在".to_string());
    }

    get_collection_by_id(&conn, &collection_id)
}

pub fn delete_skill_collection<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    collection_id: &str,
) -> Result<(), String> {
    let normalized_id = normalize_required_text(collection_id, "collectionId")?;
    let mut conn = get_conn(app)?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启集合删除事务失败: {}", e))?;

    tx.execute(
        "DELETE FROM collection_items WHERE collection_id = ?1",
        params![normalized_id.as_str()],
    )
    .map_err(|e| format!("删除集合成员失败: {}", e))?;

    let affected = tx
        .execute(
            "DELETE FROM skill_collections WHERE id = ?1",
            params![normalized_id.as_str()],
        )
        .map_err(|e| format!("删除集合失败: {}", e))?;

    if affected == 0 {
        return Err("集合不存在".to_string());
    }

    tx.commit()
        .map_err(|e| format!("提交集合删除失败: {}", e))?;
    Ok(())
}

pub fn ensure_skill_tags<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &EnsureSkillTagsInput,
) -> Result<Vec<SkillTag>, String> {
    let names = normalize_unique_names(&input.names);
    if names.is_empty() {
        return Ok(Vec::new());
    }

    let now = now_ms();
    let mut conn = get_conn(app)?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启标签事务失败: {}", e))?;
    let mut tag_ids: Vec<String> = Vec::new();

    for name in names {
        let existing_id = tx
            .query_row(
                "SELECT id FROM skill_tags WHERE lower(name) = lower(?1)",
                params![name.as_str()],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| format!("检查标签失败: {}", e))?;

        let tag_id = match existing_id {
            Some(existing_id) => existing_id,
            None => {
                let tag_id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO skill_tags (id, name, color, created_at, updated_at)
                     VALUES (?1, ?2, NULL, ?3, ?4)",
                    params![tag_id.as_str(), name.as_str(), now, now],
                )
                .map_err(|e| format!("创建标签失败: {}", e))?;
                tag_id
            }
        };

        tag_ids.push(tag_id);
    }

    tx.commit()
        .map_err(|e| format!("提交标签事务失败: {}", e))?;

    let conn = get_conn(app)?;
    let mut tags = Vec::new();
    for tag_id in tag_ids {
        tags.push(get_tag_by_id(&conn, &tag_id)?);
    }
    Ok(tags)
}

pub fn update_skill_tag<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &UpdateSkillTagInput,
) -> Result<SkillTag, String> {
    let tag_id = normalize_required_text(&input.tag_id, "tagId")?;
    let name = normalize_required_text(&input.name, "标签名称")?;
    let color = normalize_optional_text(input.color.as_deref());
    let now = now_ms();
    let conn = get_conn(app)?;

    let duplicate = conn
        .query_row(
            "SELECT id FROM skill_tags
             WHERE lower(name) = lower(?1) AND id <> ?2",
            params![name.as_str(), tag_id.as_str()],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("检查标签名称失败: {}", e))?;

    if duplicate.is_some() {
        return Err("标签名称已存在".to_string());
    }

    let updated = conn
        .execute(
            "UPDATE skill_tags
             SET name = ?1, color = ?2, updated_at = ?3
             WHERE id = ?4",
            params![name.as_str(), color.as_deref(), now, tag_id.as_str()],
        )
        .map_err(|e| format!("更新标签失败: {}", e))?;

    if updated == 0 {
        return Err("标签不存在".to_string());
    }

    get_tag_by_id(&conn, &tag_id)
}

pub fn delete_skill_tag<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    tag_id: &str,
) -> Result<(), String> {
    let normalized_id = normalize_required_text(tag_id, "tagId")?;
    let mut conn = get_conn(app)?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启标签删除事务失败: {}", e))?;

    tx.execute(
        "DELETE FROM skill_tag_relations WHERE tag_id = ?1",
        params![normalized_id.as_str()],
    )
    .map_err(|e| format!("删除标签关系失败: {}", e))?;

    let affected = tx
        .execute(
            "DELETE FROM skill_tags WHERE id = ?1",
            params![normalized_id.as_str()],
        )
        .map_err(|e| format!("删除标签失败: {}", e))?;

    if affected == 0 {
        return Err("标签不存在".to_string());
    }

    tx.commit()
        .map_err(|e| format!("提交标签删除失败: {}", e))?;
    Ok(())
}

pub fn batch_apply_skill_organization<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &BatchApplySkillOrganizationInput,
) -> Result<(), String> {
    let skill_ids = normalize_unique_ids(&input.skill_ids);
    if skill_ids.is_empty() {
        return Err("skillIds 不能为空".to_string());
    }

    let primary_collection_id = normalize_optional_text(input.primary_collection_id.as_deref());
    let add_tag_ids = normalize_unique_ids(&input.add_tag_ids);
    let remove_tag_ids = normalize_unique_ids(&input.remove_tag_ids);
    let now = now_ms();
    let mut conn = get_conn(app)?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启组织批量事务失败: {}", e))?;

    if let Some(collection_id) = primary_collection_id.as_ref() {
        let collection_exists = tx
            .query_row(
                "SELECT COUNT(*) FROM skill_collections WHERE id = ?1",
                params![collection_id.as_str()],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| format!("检查集合失败: {}", e))?
            > 0;

        if !collection_exists {
            return Err("目标集合不存在".to_string());
        }
    }

    for tag_id in add_tag_ids.iter().chain(remove_tag_ids.iter()) {
        let tag_exists = tx
            .query_row(
                "SELECT COUNT(*) FROM skill_tags WHERE id = ?1",
                params![tag_id.as_str()],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| format!("检查标签失败: {}", e))?
            > 0;

        if !tag_exists {
            return Err("标签不存在".to_string());
        }
    }

    if input.clear_primary_collection || primary_collection_id.is_some() {
        for skill_id in &skill_ids {
            tx.execute(
                "UPDATE collection_items
                 SET is_primary = 0, updated_at = ?2
                 WHERE skill_id = ?1 AND is_primary = 1",
                params![skill_id.as_str(), now],
            )
            .map_err(|e| format!("清理主集合失败: {}", e))?;
        }
    }

    if let Some(collection_id) = primary_collection_id.as_ref() {
        for skill_id in &skill_ids {
            tx.execute(
                "INSERT INTO collection_items (
                    collection_id,
                    skill_id,
                    is_primary,
                    sort_order,
                    created_at,
                    updated_at
                 ) VALUES (?1, ?2, 1, 0, ?3, ?4)
                 ON CONFLICT(collection_id, skill_id)
                 DO UPDATE SET
                    is_primary = 1,
                    updated_at = excluded.updated_at",
                params![collection_id.as_str(), skill_id.as_str(), now, now],
            )
            .map_err(|e| format!("设置主集合失败: {}", e))?;
        }
    }

    for skill_id in &skill_ids {
        for tag_id in &add_tag_ids {
            tx.execute(
                "INSERT INTO skill_tag_relations (skill_id, tag_id, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(skill_id, tag_id)
                 DO UPDATE SET updated_at = excluded.updated_at",
                params![skill_id.as_str(), tag_id.as_str(), now, now],
            )
            .map_err(|e| format!("写入标签关系失败: {}", e))?;
        }

        for tag_id in &remove_tag_ids {
            tx.execute(
                "DELETE FROM skill_tag_relations WHERE skill_id = ?1 AND tag_id = ?2",
                params![skill_id.as_str(), tag_id.as_str()],
            )
            .map_err(|e| format!("删除标签关系失败: {}", e))?;
        }
    }

    tx.commit()
        .map_err(|e| format!("提交组织批量事务失败: {}", e))?;
    Ok(())
}
