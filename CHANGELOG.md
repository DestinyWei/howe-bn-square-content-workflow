# Release Notes

本文件用于记录每次 GitHub Release 的功能说明、发布操作和后续维护备注。

## v1.1.0 — 功能整合版本

发布日期：2026-06-19

Release 链接：https://github.com/DestinyWei/howe-bn-square-content-workflow/releases/tag/v1.1.0

安装包：

- `binance-square-workflow-v1.1.0.zip`

### 版本定位

`v1.1.0` 整合了 `v1.0.1` 到 `v1.0.8` 的所有修复和小功能更新，是当前推荐安装版本。

为了避免用户在多个 patch 版本之间选择，GitHub Releases 已清理中间版本，仅保留：

- `v1.0.0`
- `v1.1.0`

### 主要更新

- 优化 X Article 正文采集，提升可见文本兜底采集覆盖率。
- 支持文章封面和正文图片素材分开识别，并在排版器中展示素材清单。
- 改进 X Article 中横向正文图、混合文字图片区块、海量图片文章的采集稳定性。
- 增加 X 推文到币安广场短帖的采集与填入流程，尽量保留推文中的纯文字排版。
- 自动移除或合并 X/Twitter 链接和 `@handle`，避免搬运后格式异常。
- 增强批量插图助手：支持一键自动插图、逐张审核、失败项重试、下载兜底和自定义下载子目录。
- 收紧图片插入成功判定：只有图片真实加载并位于对应 `正文图片 N` 占位符前方，才算成功。
- 自动清理图片和对应占位符之间的异常空白编辑块，减少币安编辑器插图后的大段留白。

### 发布操作记录

- 将 `extension/manifest.json` 版本号从 `1.0.8` 更新为 `1.1.0`。
- 更新 README，增加 `v1.1.0` 与 `v1.0.0` 的版本说明。
- 运行本地构建脚本生成 `dist/binance-square-workflow-v1.1.0.zip`。
- 完成本地校验：
  - `unzip -t dist/binance-square-workflow-v1.1.0.zip`
  - `node --check extension/content-x.js`
  - `node --check extension/content-binance.js`
  - `node --check extension/popup.js`
  - `node --check extension/background.js`
  - `node --check extension/formatter.js`
  - `python3 -m json.tool extension/manifest.json`
  - `git diff --check`
- 提交并推送：
  - Commit：`51ee79d Prepare consolidated 1.1.0 release`
- 创建 GitHub Release：
  - Tag：`v1.1.0`
  - Title：`v1.1.0 — 功能整合版本`
  - Asset：`binance-square-workflow-v1.1.0.zip`
- 删除并清理中间 patch Release 与 tags：
  - `v1.0.1`
  - `v1.0.2`
  - `v1.0.3`
  - `v1.0.4`
  - `v1.0.5`
  - `v1.0.6`
  - `v1.0.7`
  - `v1.0.8`
- 最终 Release 列表确认只保留：
  - `v1.1.0 — 功能整合版本`
  - `v1.0.0 — 首个正式版本`

## v1.0.0 — 首个正式版本

发布日期：2026-06-15

Release 链接：https://github.com/DestinyWei/howe-bn-square-content-workflow/releases/tag/v1.0.0

安装包：

- `binance-square-workflow-v1.0.0.zip`

### 版本定位

首个正式版本，提供从 X Article 到币安广场文章草稿的基础迁移流程。

### 主要功能

- 采集 X Article 的标题、正文和图片素材。
- 提供本地排版器进行结构转换和兼容性检查。
- 将正文远程图片替换为 `正文图片 N` 占位符。
- 保存排版结果并填入币安广场文章编辑器。
- 提供基础图片素材清单，辅助手动上传配图。
- 扩展不会自动点击“发布”，最终发布前需要人工审核。

### 发布操作记录

- 创建首个正式版本 Release。
- 发布安装包 `binance-square-workflow-v1.0.0.zip`。
- README 提供基础安装、使用流程和项目结构说明。
