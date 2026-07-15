use skill_studio_pro_lib::store::extract_skill_description;

#[test]
fn extracts_description_from_frontmatter() {
    let content = r#"---
name: demo-skill
description: "A concise card summary"
---

# Demo Skill

Longer body copy.
"#;

    assert_eq!(
        extract_skill_description(content),
        Some("A concise card summary".to_string())
    );
}

#[test]
fn extracts_description_from_first_body_paragraph() {
    let content = r#"# Demo Skill

This is the first meaningful summary line for the skill card.

## Usage

More details here.
"#;

    assert_eq!(
        extract_skill_description(content),
        Some("This is the first meaningful summary line for the skill card.".to_string())
    );
}
