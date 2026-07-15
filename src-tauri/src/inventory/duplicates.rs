use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicateInput {
    pub id: String,
    pub canonical_name: String,
    pub content_hash: String,
}

pub fn classify(items: &[DuplicateInput]) -> HashMap<String, Vec<String>> {
    let mut names: HashMap<&str, Vec<&DuplicateInput>> = HashMap::new();
    let mut contents: HashMap<&str, Vec<&DuplicateInput>> = HashMap::new();
    for item in items {
        names.entry(&item.canonical_name).or_default().push(item);
        contents.entry(&item.content_hash).or_default().push(item);
    }
    let mut result = HashMap::new();
    for item in items {
        let mut kinds = HashSet::new();
        if let Some(same_name) = names.get(item.canonical_name.as_str()) {
            if same_name
                .iter()
                .any(|other| other.id != item.id && other.content_hash == item.content_hash)
            {
                kinds.insert("same_name_same_content".to_string());
            }
            if same_name
                .iter()
                .any(|other| other.id != item.id && other.content_hash != item.content_hash)
            {
                kinds.insert("same_name_different_content".to_string());
            }
        }
        if let Some(same_content) = contents.get(item.content_hash.as_str()) {
            if same_content
                .iter()
                .any(|other| other.id != item.id && other.canonical_name != item.canonical_name)
            {
                kinds.insert("same_content_different_name".to_string());
            }
        }
        let mut kinds = kinds.into_iter().collect::<Vec<_>>();
        kinds.sort();
        result.insert(item.id.clone(), kinds);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::{classify, DuplicateInput};

    #[test]
    fn recognizes_all_three_duplicate_relationships() {
        let classified = classify(&[
            DuplicateInput {
                id: "a".to_string(),
                canonical_name: "same".to_string(),
                content_hash: "one".to_string(),
            },
            DuplicateInput {
                id: "b".to_string(),
                canonical_name: "same".to_string(),
                content_hash: "one".to_string(),
            },
            DuplicateInput {
                id: "c".to_string(),
                canonical_name: "same".to_string(),
                content_hash: "two".to_string(),
            },
            DuplicateInput {
                id: "d".to_string(),
                canonical_name: "renamed".to_string(),
                content_hash: "one".to_string(),
            },
        ]);
        assert!(classified["a"].contains(&"same_name_same_content".to_string()));
        assert!(classified["a"].contains(&"same_name_different_content".to_string()));
        assert!(classified["a"].contains(&"same_content_different_name".to_string()));
    }
}
