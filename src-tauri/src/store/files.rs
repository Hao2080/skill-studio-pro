use std::path::Path;

use crate::domain::SkillFileNode;

pub fn list_skill_files(app: &tauri::AppHandle, skill_id: &str) -> Result<SkillFileNode, String> {
    let root_dir = super::skill_storage_dir(app, skill_id)?;
    if !root_dir.exists() {
        return Err(format!("skill 目录不存在: {}", root_dir.display()));
    }

    fn build_tree(dir: &Path, root: &Path) -> Result<Vec<SkillFileNode>, String> {
        let mut entries: Vec<_> = std::fs::read_dir(dir)
            .map_err(|e| e.to_string())?
            .filter_map(|entry| entry.ok())
            .collect();
        entries.sort_by_key(|entry| {
            let is_file = entry.file_type().map(|t| t.is_file()).unwrap_or(false);
            (is_file as u8, entry.file_name())
        });

        let mut nodes = Vec::new();
        for entry in entries {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let relative = path
                .strip_prefix(root)
                .map(|path| path.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            let is_dir = path.is_dir();
            let children = if is_dir {
                build_tree(&path, root)?
            } else {
                vec![]
            };
            nodes.push(SkillFileNode {
                name,
                path: relative,
                is_dir,
                children,
            });
        }

        Ok(nodes)
    }

    let slug_name = root_dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    Ok(SkillFileNode {
        name: slug_name,
        path: "".to_string(),
        is_dir: true,
        children: build_tree(&root_dir, &root_dir)?,
    })
}

pub fn read_skill_file(
    app: &tauri::AppHandle,
    skill_id: &str,
    relative_path: &str,
) -> Result<String, String> {
    let (skill_root, canonical) = resolve_existing_skill_path(app, skill_id, relative_path)?;
    let root_canonical = skill_root
        .canonicalize()
        .map_err(|e| format!("根目录无效: {}", e))?;

    if !canonical.starts_with(&root_canonical) {
        return Err("路径超出 skill 目录范围".to_string());
    }

    std::fs::read_to_string(&canonical).map_err(|e| format!("读取文件失败: {}", e))
}

pub fn write_skill_file(
    app: &tauri::AppHandle,
    skill_id: &str,
    relative_path: &str,
    content: &str,
) -> Result<(), String> {
    let skill_root = skill_root_for_skill_id(app, skill_id)?;
    let file_path = skill_root.join(relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));

    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {}", e))?;
    }

    let root_canonical = skill_root
        .canonicalize()
        .map_err(|e| format!("根目录无效: {}", e))?;

    let target_canonical = if file_path.exists() {
        file_path
            .canonicalize()
            .map_err(|e| format!("路径无效: {}", e))?
    } else {
        let parent = file_path
            .parent()
            .ok_or_else(|| "文件路径无效".to_string())?
            .canonicalize()
            .map_err(|e| format!("父目录无效: {}", e))?;
        parent.join(
            file_path
                .file_name()
                .ok_or_else(|| "文件路径无效".to_string())?,
        )
    };

    if !target_canonical.starts_with(&root_canonical) {
        return Err("路径超出 skill 目录范围".to_string());
    }

    std::fs::write(&file_path, content).map_err(|e| format!("写入文件失败: {}", e))
}

pub fn open_file_in_editor(
    app: &tauri::AppHandle,
    skill_id: &str,
    relative_path: &str,
) -> Result<(), String> {
    let (skill_root, canonical) = resolve_existing_skill_path(app, skill_id, relative_path)?;
    let root_canonical = skill_root
        .canonicalize()
        .map_err(|e| format!("根目录无效: {}", e))?;

    if !canonical.starts_with(&root_canonical) {
        return Err("路径超出 skill 目录范围".to_string());
    }

    open::that(&canonical).map_err(|e| format!("打开编辑器失败: {}", e))
}

fn skill_root_for_skill_id(
    app: &tauri::AppHandle,
    skill_id: &str,
) -> Result<std::path::PathBuf, String> {
    super::skill_storage_dir(app, skill_id)
}

fn resolve_existing_skill_path(
    app: &tauri::AppHandle,
    skill_id: &str,
    relative_path: &str,
) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
    let skill_root = skill_root_for_skill_id(app, skill_id)?;
    let file_path = skill_root.join(relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
    let canonical = file_path
        .canonicalize()
        .map_err(|e| format!("路径无效: {}", e))?;

    Ok((skill_root, canonical))
}
