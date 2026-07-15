use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::{DirectoryPlatformAdapter, PlatformAdapter};

pub struct PlatformRegistry {
    adapters: HashMap<String, Arc<dyn PlatformAdapter>>,
}

impl PlatformRegistry {
    pub fn from_upstream(home: &Path) -> Self {
        let primary = ["codex", "claude", "cursor", "windsurf", "gemini"];
        let adapters = crate::store::inventory_platform_definitions(home)
            .into_iter()
            .filter_map(|definition| {
                let relative = definition.skills_dir.strip_prefix(home).ok()?.to_path_buf();
                let dedicated = primary.contains(&definition.name.as_str());
                let adapter: Arc<dyn PlatformAdapter> =
                    Arc::new(DirectoryPlatformAdapter::built_in(
                        definition.name.clone(),
                        definition.display_name,
                        relative,
                        dedicated,
                    ));
                Some((definition.name, adapter))
            })
            .collect();
        Self { adapters }
    }

    pub fn register_custom(
        &mut self,
        id: impl Into<String>,
        display_name: impl Into<String>,
        skills_dir: PathBuf,
        supports_symlink: bool,
        supports_copy: bool,
    ) {
        let adapter = DirectoryPlatformAdapter::custom(
            id.into(),
            display_name,
            skills_dir,
            supports_symlink,
            supports_copy,
        );
        self.adapters
            .insert(adapter.id().to_string(), Arc::new(adapter));
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn PlatformAdapter>> {
        self.adapters.get(id).cloned()
    }

    pub fn all(&self) -> Vec<Arc<dyn PlatformAdapter>> {
        let mut adapters = self.adapters.values().cloned().collect::<Vec<_>>();
        adapters.sort_by(|left, right| left.id().cmp(right.id()));
        adapters
    }
}
