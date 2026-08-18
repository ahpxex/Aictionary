# 联想功能变更说明

## 本次完成

- 新增本地词典联想命令 `dictionary_suggest`。
- 联想最多返回 5 个候选词。
- 排序采用前缀优先、编辑距离模糊匹配和稳定的字典序规则。
- 候选词同时返回最佳中文核心释义或常用释义。
- 分布式词库使用内存索引，避免每次输入都扫描 SQLite。
- 用户生成词条也会尝试提取中文释义。
- 搜索框支持防抖、过期请求丢弃、键盘上下选择、Enter、Escape 和鼠标选择。
- 点击页面空白处会收起联想框。
- 点击候选词查询后输入框会失焦，查询完成不会自动重新打开联想框。
- 第一次获得焦点时自动全选当前内容，已经聚焦时再次点击保持正常光标行为。

## 本次整理

- 将搜索框重复的候选清理逻辑合并到 `closeSuggestions`。
- 将 Rust 内部传递的四元组改为具名的 `SuggestionCandidate`，降低字段错位风险。
- 保持前后端公开的 `DictionarySuggestion` 数据结构和 Tauri 命令名称不变。
- 只整理联想功能涉及的代码，没有修改其他工作区功能。

## 主要文件

- `src/features/main/components/search-form.tsx`
- `src/shared/services/dictionary-service.ts`
- `src/shared/types/dictionary.ts`
- `src-tauri/src/dictionary/suggestions.rs`
- `src-tauri/src/dictionary/types.rs`
- `src-tauri/src/dictionary/mod.rs`
- `src-tauri/src/lib.rs`

## 验证

```bash
npm run build
source "$HOME/.cargo/env"
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
git diff --check
```

开发版启动：

```bash
source "$HOME/.cargo/env"
export PATH="$(npm prefix -g)/bin:$PATH"
npm run tauri dev
```
