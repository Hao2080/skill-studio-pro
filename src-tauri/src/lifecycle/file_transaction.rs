use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use uuid::Uuid;

pub fn validate_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let trimmed = relative_path.trim();
    if trimmed.is_empty() {
        return Err("INVALID_RELATIVE_PATH: relativePath 不能为空".to_string());
    }
    let path = Path::new(trimmed);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("PATH_TRAVERSAL: relativePath 必须位于中央 Skill 内".to_string());
    }
    Ok(path.to_path_buf())
}

pub fn resolve_write_target(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = validate_relative_path(relative_path)?;
    let root = root
        .canonicalize()
        .map_err(|error| format!("CENTRAL_ROOT_INVALID: {error}"))?;
    let mut cursor = root.clone();
    let components = relative.components().collect::<Vec<_>>();
    for (index, component) in components.iter().enumerate() {
        let Component::Normal(segment) = component else {
            return Err("PATH_TRAVERSAL: relativePath 包含非法路径组件".to_string());
        };
        cursor.push(segment);
        if cursor.exists() {
            let metadata = fs::symlink_metadata(&cursor)
                .map_err(|error| format!("读取路径元数据失败: {error}"))?;
            if metadata.file_type().is_symlink() {
                return Err("SYMLINK_ESCAPE: 编辑路径不能经过符号链接或 junction".to_string());
            }
            let canonical = cursor
                .canonicalize()
                .map_err(|error| format!("规范化编辑路径失败: {error}"))?;
            if !canonical.starts_with(&root) {
                return Err("PATH_OUTSIDE_ALLOWED_ROOT: 编辑路径逃逸中央 Skill".to_string());
            }
            cursor = canonical;
        } else if index + 1 < components.len() {
            return Err(
                "EDIT_PARENT_NOT_FOUND: 只能在中央 Skill 的现有目录中创建文本文件".to_string(),
            );
        }
    }
    if cursor == root || !cursor.starts_with(&root) {
        return Err("PATH_OUTSIDE_ALLOWED_ROOT: 编辑目标无效".to_string());
    }
    Ok(cursor)
}

pub fn validate_text_content(path: &Path, content: &str) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match extension.as_str() {
        "md" | "markdown" | "txt" | "text" | "" => Ok(()),
        "yaml" | "yml" => serde_yaml::from_str::<serde_yaml::Value>(content)
            .map(|_| ())
            .map_err(|error| format!("INVALID_YAML: {error}")),
        "json" => serde_json::from_str::<serde_json::Value>(content)
            .map(|_| ())
            .map_err(|error| format!("INVALID_JSON: {error}")),
        "toml" => toml::from_str::<toml::Value>(content)
            .map(|_| ())
            .map_err(|error| format!("INVALID_TOML: {error}")),
        _ => Err(format!(
            "UNSUPPORTED_TEXT_TYPE: 不支持在中央编辑器中写入 .{extension} 文件"
        )),
    }
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "写入目标缺少父目录".to_string())?;
    if !parent.is_dir() {
        return Err("EDIT_PARENT_NOT_FOUND: 写入父目录不存在".to_string());
    }
    let temp = parent.join(format!(".skill-studio-pro-{}.tmp", Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|error| format!("创建临时文件失败: {error}"))?;
    let result = (|| -> Result<(), String> {
        file.write_all(bytes)
            .map_err(|error| format!("写入临时文件失败: {error}"))?;
        file.flush()
            .map_err(|error| format!("刷新临时文件失败: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("同步临时文件失败: {error}"))?;
        drop(file);
        replace_file(&temp, path)?;
        if let Ok(directory) = File::open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(not(windows))]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    fs::rename(source, target).map_err(|error| format!("原子替换文件失败: {error}"))
}

#[cfg(windows)]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let target = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(format!(
            "原子替换文件失败: {}",
            std::io::Error::last_os_error()
        ))
    } else {
        Ok(())
    }
}

pub fn assert_owned_path(root: &Path, path: &Path) -> Result<(), String> {
    if !root.is_absolute() || !path.is_absolute() {
        return Err("PATH_NOT_ABSOLUTE: 受管路径必须是绝对路径".to_string());
    }
    let root = root
        .canonicalize()
        .map_err(|error| format!("规范化允许根失败: {error}"))?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("读取受管路径失败 {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() {
        return Err("SYMLINK_RECURSIVE_OPERATION_REJECTED".to_string());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("规范化受管路径失败: {error}"))?;
    if canonical == root || !canonical.starts_with(&root) {
        return Err(format!("PATH_OUTSIDE_ALLOWED_ROOT: {}", path.display()));
    }
    Ok(())
}

pub fn safe_remove_dir_all(root: &Path, path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    assert_owned_path(root, path)?;
    fs::remove_dir_all(path).map_err(|error| format!("删除受管目录失败: {error}"))
}

pub fn tree_stats(root: &Path) -> Result<(u64, u64), String> {
    let mut files = 0_u64;
    let mut bytes = 0_u64;
    let mut stack = vec![root.to_path_buf()];
    while let Some(directory) = stack.pop() {
        for entry in
            fs::read_dir(&directory).map_err(|error| format!("读取目录统计失败: {error}"))?
        {
            let entry = entry.map_err(|error| format!("读取目录项失败: {error}"))?;
            let metadata = fs::symlink_metadata(entry.path())
                .map_err(|error| format!("读取目录项元数据失败: {error}"))?;
            if metadata.file_type().is_symlink() {
                return Err(format!("SYMLINK_REJECTED: {}", entry.path().display()));
            }
            if metadata.is_dir() {
                stack.push(entry.path());
            } else if metadata.is_file() {
                files += 1;
                bytes = bytes.saturating_add(metadata.len());
            } else {
                return Err(format!("SPECIAL_FILE_REJECTED: {}", entry.path().display()));
            }
        }
    }
    Ok((files, bytes))
}

#[cfg(test)]
mod tests {
    use super::{assert_owned_path, resolve_write_target};

    #[test]
    fn recursive_and_edit_guards_reject_root_and_link_escape() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("allowed");
        let outside = temp.path().join("outside");
        std::fs::create_dir_all(root.join("skill")).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        assert!(assert_owned_path(&root, &root)
            .unwrap_err()
            .contains("PATH_OUTSIDE_ALLOWED_ROOT"));

        let link = root.join("skill").join("link");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, &link).unwrap();
        #[cfg(windows)]
        if std::os::windows::fs::symlink_dir(&outside, &link).is_err() {
            use std::os::windows::process::CommandExt;

            let command = format!("mklink /J \"{}\" \"{}\"", link.display(), outside.display());
            let status = std::process::Command::new("cmd")
                .args(["/D", "/C"])
                .raw_arg(&command)
                .status()
                .expect("Windows junction command should start");
            assert!(
                status.success(),
                "a temp junction is required for this guard test: {command}"
            );
        }
        assert!(
            resolve_write_target(&root.join("skill"), "link/escaped.txt")
                .unwrap_err()
                .contains("SYMLINK_ESCAPE")
        );
        assert!(assert_owned_path(&root, &link)
            .unwrap_err()
            .contains("SYMLINK_RECURSIVE_OPERATION_REJECTED"));
    }
}
