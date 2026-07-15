use std::path::Path;

use crate::domain::SkillFileNode;

pub fn build_file_tree_from_dir(base: &Path, current: &Path) -> Result<SkillFileNode, String> {
    let name = current
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();

    let relative_path = current
        .strip_prefix(base)
        .ok()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default();

    if current.is_file() {
        return Ok(SkillFileNode {
            name,
            path: relative_path,
            is_dir: false,
            children: vec![],
        });
    }

    let mut children = std::fs::read_dir(current)
        .map_err(|e| format!("读取团队版本目录失败: {}", e))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .collect::<Vec<_>>();

    children.sort();

    let child_nodes = children
        .iter()
        .map(|path| build_file_tree_from_dir(base, path))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(SkillFileNode {
        name,
        path: relative_path,
        is_dir: true,
        children: child_nodes,
    })
}
