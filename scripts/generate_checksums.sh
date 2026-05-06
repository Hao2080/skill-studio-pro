#!/bin/bash
# generate_checksums.sh - 生成 Release 产物的 SHA256 校验和文件
# 用法: ./generate_checksums.sh [目录路径]
# 默认目录: ./dist

TARGET_DIR="${1:-./dist}"

if [ ! -d "$TARGET_DIR" ]; then
    echo "错误: 目录不存在: $TARGET_DIR"
    exit 1
fi

EXTENSIONS=("exe" "msi" "dmg" "AppImage" "deb")

echo "正在扫描目录: $TARGET_DIR"
echo "生成 SHA256 校验和..."
echo ""

for ext in "${EXTENSIONS[@]}"; do
    find "$TARGET_DIR" -type f -name "*.$ext" 2>/dev/null | while read -r file; do
        checksum=$(sha256sum "$file" | awk '{print $1}')
        sum_file="${file}.sha256"

        echo "$checksum  $(basename "$file")" > "$sum_file"

        echo "生成: $sum_file"
        echo "  文件: $(basename "$file")"
        echo "  SHA256: $checksum"
        echo ""
    done
done

echo "完成！所有校验和文件已生成。"
