# Aictionary

快速且异常好用的词典 App，而且，它甚至跨平台！

<img width="900" height="728" alt="image" src="https://github.com/user-attachments/assets/f340fb79-87de-482e-87b7-cf363d6ac646" />

---

## 功能特性

- **最详细的中文解释** - 不同于传统词典的粗浅释义，本项目的中文释义都非常详细、易懂
- **快速查询单词** - 基于词频统计的前 25000 个单词已经被默认下载，覆盖绝大部分生词情景
- **大语言模型驱动** - 如果你真的遇到了词库里没有的词，也可以调用大模型生成一份词义
- **跨平台支持** - 基于 Avalonia 框架，支持 Windows、macOS 和 Linux

除此之外，我们还围绕日常使用体验做了不少优化：

- **实时响应**：查词窗口轻量、打开即用，支持键盘快捷键快速查询、复制和刷新；
- **本地缓存**：自动保存历史查询记录，可离线查看，并可按需刷新保证释义始终同步；
- **多形态发布**：提供自包含与框架依赖两套版本，macOS 用户还可直接使用打包好的 DMG。

## 下载与安装

构建完成后，所有产物都会落在 `artifacts/` 目录下：

| 平台    | 自包含产物                                                               | 体积更小的框架依赖产物                                       |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| macOS   | `artifacts/macos/Aictionary.app<br>``artifacts/macos/Aictionary.dmg` | `artifacts/macos-framework-dependent/Aictionary.app`       |
| Windows | `artifacts/windows/Aictionary-win-x64`                                 | `artifacts/windows-framework-dependent/Aictionary-win-x64` |
| Linux   | `artifacts/linux-amd64/Aictionary`                                     | `artifacts/linux-amd64-framework-dependent/Aictionary`     |

- macOS 建议直接打开 `Aictionary.dmg`，将 App 拖入 `Applications` 即可；
- Windows 可按是否安装 .NET 运行时选择对应文件夹；
- Linux 用户可直接运行可执行文件或使用源码编译（参考下文"开发构建"）。

### Linux 发行版包管理

**Debian/Ubuntu 系统：**
```bash
# 构建 DEB 包
./scripts/build-deb.sh                    # 自包含版本
./scripts/build-deb.sh framework-dependent # 框架依赖版本

# 安装
sudo dpkg -i aictionary_*.deb
```

**Arch Linux 系统：**
```bash
# 构建 Arch 包
./scripts/build-arch.sh                    # 自包含版本
./scripts/build-arch.sh framework-dependent # 框架依赖版本

# 安装
sudo pacman -U aictionary-*.pkg.tar.zst
```

> 初次使用别忘了在设置页配置 OpenAI API Key，当本地词库缺少词条时会调用大模型补充释义。

## 使用提示

- **键盘操作**：涵盖复制查询、刷新词库等快捷键，阅读英文资料时切换成本极低；
- **缓存管理**：设置页可查看、刷新缓存词条，方便构建个人生词本；
- **中文释义**：大模型生成的解释包含语义说明、例句与常见搭配，更贴合技术、学术场景。

## 技术栈

- **.NET 8.0**
- **Avalonia 11.2.7**
- **ReactiveUI**

## 开发构建

项目使用 [NUKE](https://nuke.build/) 编排构建流程，运行以下命令即可生成全部发行包，注意构建之前要保证电脑中有dotnet-sdk：

```bash
dotnet run --project build/build.csproj
```

执行后会在 `artifacts/` 目录生成：

- macOS 自包含 App、框架依赖 App 以及 DMG 安装包；
- Windows 自包含与框架依赖版本；
- Linux 自包含与框架依赖版本。

如需自定义流程，可阅读 `build/Build.cs` 中各个 target 的实现。

## 反馈与贡献

- 欢迎通过 Issue 反馈问题、分享改进想法；
- PR 亦非常欢迎，请附上截图或说明，便于快速审阅；
- 希望扩展词库、适配更多平台或接入新的大模型？一起来讨论吧！