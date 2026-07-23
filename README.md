# 申硕英语 · 词汇学习

一个为**同等学力申硕英语**考试大纲（第六版，共 5390 词）打造的离线背单词应用。基于考纲附录词汇表 OCR 提取，配有音标、真实词源（中英对照）、按高考/四级/六级/COCA 词频划分的难度梯度，以及间隔重复（SM-2）复习算法。

## 🌐 在线使用（推荐）

打开即用，手机、平板、电脑浏览器都行，**进度自动保存在你自己的浏览器里**：

**https://juleyang020-creator.github.io/shenshuo-english-vocab/**

> 第一次打开会加载一次词库（约 8 MB），之后基本秒开。

## ✨ 功能

- **6 种模式**：学习新词（选择题）、复习巩固、单词测试、拼写练习（听写）、近义辨析/词义识别、生词本
- **难度梯度**：高考基础 (2888) → 四级核心 (1060) → 六级提升 (1220) → 申硕进阶 (98) → 拔高识记 (124)，每段还可细分小段
- **音标 + 真人发音**（Web Speech，美/英音可切换）
- **真实词源**：来自 etymonline，自动标注语言演变并提供中文翻译
- **间隔重复**：SM-2 算法安排复习节奏，记录薄弱词、连续学习天数、近 7 天进度
- **答题不剧透**：选择/拼写作答前自动隐藏释义与答案
- **一键清除进度**

## 🛠 本地开发

```bash
cd vocab-study-app
npm install
npm run dev        # 打开 http://127.0.0.1:5173/
npm run build      # 产物在 dist/
```

> 手机上直接用上面的网页链接即可（可「添加到主屏幕」当 App 用），无需单独安装。

## 🪟 Windows 离线版

```bash
sh tools/package-windows.sh              # 生成「申硕英语词汇学习-Windows.zip」
```

解压后双击 `启动学习软件.bat` 即可（自带 PowerShell 迷你服务，无需装任何环境）。

## 📂 目录

| 路径 | 说明 |
|---|---|
| `vocab-study-app/` | React + Vite 网页应用（核心） |
| `tools/` | OCR 提取、词频标注、音标/词源生成、打包脚本 |
| `.github/workflows/deploy.yml` | 推送到 main 自动部署到 GitHub Pages |

## 数据来源与说明

- 词表 OCR 自考试大纲（第六版）附录一，经 Apple Vision 重新识别并人工/规则清洗
- 难度分级参考公开的高考 3500 / CET-4 / CET-6 / COCA 词频表
- 词源数据来自 [etymonline](https://www.etymonline.com)（yosevu/etymonline, MIT）
- 仅供个人学习使用

🤖 本项目由 [Claude Code](https://claude.com/claude-code) 协助开发。
