# Aictionary Release Template

## 新功能 ✨
- 

## 改进 🚀
- 

## 修复 🐛
- 

## 技术更新 🔧
- 

## 下载说明 📥

| 平台 | 自包含版本 | 框架依赖版本 |
|------|------------|-------------|
| Windows AMD64 | `Aictionary-windows-amd64.zip` | 包含在zip中 |
| Windows ARM64 | `Aictionary-windows-arm64.zip` | 包含在zip中 |
| macOS Intel | `Aictionary-macos-intel.tar.gz` | 包含在tar.gz中 |
| macOS ARM64 | `Aictionary-macos-arm64.tar.gz` (包含DMG) | 包含在tar.gz中 |
| Linux AMD64 | `Aictionary-linux-amd64.tar.gz` | 包含在tar.gz中 |
| Linux ARM64 | `Aictionary-linux-arm64.tar.gz` | 包含在tar.gz中 |
| Debian包 | `aictionary_*.deb` | - |
| Arch包 | `aictionary-*.pkg.tar.zst` | - |

### 安装说明

**macOS用户：**
- 推荐使用DMG文件安装
- 将App拖入Applications文件夹

**Windows用户：**
- 解压zip文件
- 如果已安装.NET 8运行时，可选择框架依赖版本（体积更小）
- 否则使用自包含版本

**Linux用户：**
- Debian/Ubuntu: 使用 `sudo dpkg -i aictionary_*.deb` 安装deb包
- Arch Linux: 使用 `sudo pacman -U aictionary-*.pkg.tar.zst` 安装
- 其他发行版: 解压tar.gz文件直接运行

### 首次使用提示 💡
- 别忘了在设置页配置OpenAI API Key
- 当本地词库缺少词条时会调用大模型补充释义
- 支持键盘快捷键快速查询、复制和刷新

---

**完整更新日志**: https://github.com/your-username/Aictionary/compare/v{previous_version}...v{current_version}