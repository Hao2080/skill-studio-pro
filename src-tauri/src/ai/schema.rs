use serde_json::Value;

pub fn parse_json_output(raw: &str) -> Result<Value, String> {
    let trimmed = raw.trim();
    let candidate = if trimmed.starts_with("```") {
        let without_open = trimmed
            .strip_prefix("```json")
            .or_else(|| trimmed.strip_prefix("```JSON"))
            .or_else(|| trimmed.strip_prefix("```"))
            .unwrap_or(trimmed);
        without_open
            .strip_suffix("```")
            .unwrap_or(without_open)
            .trim()
    } else {
        trimmed
    };
    serde_json::from_str(candidate).map_err(|error| format!("响应不是有效 JSON: {error}"))
}

pub fn validate(schema: &Value, value: &Value) -> Result<(), String> {
    validate_at(schema, value, "$")
}

fn validate_at(schema: &Value, value: &Value, path: &str) -> Result<(), String> {
    if let Some(expected) = schema.get("type").and_then(Value::as_str) {
        let matches = match expected {
            "object" => value.is_object(),
            "array" => value.is_array(),
            "string" => value.is_string(),
            "integer" => value.as_i64().is_some() || value.as_u64().is_some(),
            "number" => value.is_number(),
            "boolean" => value.is_boolean(),
            "null" => value.is_null(),
            _ => return Err(format!("{path}: 不支持的 schema type {expected}")),
        };
        if !matches {
            return Err(format!("{path}: 期望 {expected}"));
        }
    }

    if let Some(allowed) = schema.get("enum").and_then(Value::as_array) {
        if !allowed.contains(value) {
            return Err(format!("{path}: 值不在允许枚举中"));
        }
    }

    if let Some(object) = value.as_object() {
        if let Some(required) = schema.get("required").and_then(Value::as_array) {
            for key in required.iter().filter_map(Value::as_str) {
                if !object.contains_key(key) {
                    return Err(format!("{path}: 缺少必填字段 {key}"));
                }
            }
        }
        if let Some(properties) = schema.get("properties").and_then(Value::as_object) {
            for (key, child) in object {
                if let Some(child_schema) = properties.get(key) {
                    validate_at(child_schema, child, &format!("{path}.{key}"))?;
                } else if schema.get("additionalProperties") == Some(&Value::Bool(false)) {
                    return Err(format!("{path}: 不允许额外字段 {key}"));
                }
            }
        }
    }

    if let Some(array) = value.as_array() {
        if let Some(items) = schema.get("items") {
            for (index, child) in array.iter().enumerate() {
                validate_at(items, child, &format!("{path}[{index}]"))?;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn validates_required_and_rejects_extra_fields() {
        let schema = json!({
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
            "additionalProperties": false
        });
        assert!(super::validate(&schema, &json!({"summary": "ok"})).is_ok());
        assert!(super::validate(&schema, &json!({"summary": "ok", "extra": 1})).is_err());
    }
}
