# dsh-provider

## 简介

DeepSeek Harness 的组件化模型接入插件。提供 **CodeBuddy 组件**（WorkBuddy 本机/浏览器登录及 CodeBuddy API Key）和 **Codex 组件**（本机 ChatGPT 登录态）。两个组件在插件详情页单独列出，可分别启用或停用。

支持流式输出、思考内容、DSH 工具调用和启动时获取模型列表。WorkBuddy 接入参考 [magpie](https://github.com/yetone/magpie)。组件扩展方式见 [组件说明](docs/components.md)。

## 使用方法

适配 DSH `0.2.1-rc.2`。

**1. 安装插件**

在 **设置 → 插件** 添加：

```text
github:milesmou/dsh-provider#main
```

仓库包含预编译文件，安装无需运行构建脚本。安装或更新后重启 DSH，在插件详情页应看到 **CodeBuddy** 和 **Codex** 两个组件。

已有 CodeBuddy 的 `dsh-provider` 条目 ID、`workbuddy` 配置节点及凭据存储保持不变。若旧版用户配置显式指定 `name: dsh-provider`，将该字段改为 `name: dsh-provider/components/workbuddy`，即可使用组件自己的显示名称，其他配置无需修改。

**2. 配置 CodeBuddy 组件**

打开 **设置 → 模型扩展 → WorkBuddy 组件**：

- **WorkBuddy 登录（免 API Key）**：选择国内版或国际版，自动读取可用的本机登录态。若提示凭据已加密或未登录，点击 **浏览器登录**，再打开显示的链接完成授权。浏览器登录保存在 DSH 凭据存储中。
- **CodeBuddy API Key**：填写访问密钥，点击 **保存密钥**。仅使用 DSH 界面保存的密钥，连接 CodeBuddy 官方国内或海外服务，不支持自定义 API 地址。
- **上下文窗口**：可选 **轻量 / 均衡 / 最大** 三档（默认均衡）。三档分别取所选模型目录公布的实际上下文长度（如 300K / 600K / 1M），目录未公布时用其最大容量；作为 DSH 的上下文压缩预算。

在模型选择器中选择相应模型。模型列表在启动、切换接入方式或完成登录时获取，不定时刷新。可用模型和用量以账号权限为准。

在组件内展开 **模型管理**，可搜索模型名称或 ID、刷新目录，并用眼睛图标隐藏或恢复模型。**全部显示**可恢复全部模型；选择会自动保存，刷新目录和重启后仍然保留。WorkBuddy 和 Codex 的显示偏好分别保存，隐藏模型仍会留在管理列表中供恢复。

**3. 配置 Codex 组件**

在运行 DSH 的同一台机器、同一系统用户下，先运行 `codex login`，使用 ChatGPT 账号登录。打开 **设置 → 模型扩展 → Codex 组件**，点击 **刷新登录态和模型**，再在对话模型选择器中选择带有 Codex 图标的模型。

- 自动读取 `CODEX_HOME/auth.json`，未设置 `CODEX_HOME` 时读取 `~/.codex/auth.json`。也可在 `dsh-provider-codex` 条目的 `config.codexHome` 指定目录，示例见 [配置文件](examples/cordis.patch.yml)。
- 需要文件形式的 ChatGPT 登录凭据；若使用系统钥匙串，在 Codex 的 `config.toml` 设置 `cli_auth_credentials_store = "file"` 后重新登录。不读取 API Key。
- 启动和手动刷新时获取 Codex 模型目录；网络不可用时使用本机 `models_cache.json` 或上次成功的目录，不写死模型 ID。模型目录用于选择，实际可用性以账号权限及请求结果为准。
- 支持文字、图片、流式回复、思考强度、思考摘要、工具调用与工具结果回传，并保存加密思考内容供后续轮次使用。
- 组件每次请求重新读取凭据，不修改本机登录文件。登录态过期时，打开 Codex 更新登录或重新运行 `codex login`，然后刷新组件。
- 使用 Codex 模型时，会话右上角显示账号剩余额度，按接口实际返回的窗口展示（如 `5h 94% · 周 90%`）。悬停可查看重置时间和更新时间，点击可手动刷新；默认每 60 秒刷新，多个会话共享缓存。读取失败会提示或标明缓存，不会把缺失额度当成 100% 剩余。
- 使用 Codex 的 Responses 协议；此接入不发送 `temperature`、`max_output_tokens`，不支持 `stop`。DSH 的输出长度提示不会限制此路由的生成长度。

此组件复用本机 Codex 的 ChatGPT 登录，通过 Codex 服务访问模型，不要求另填 OpenAI API Key。协议说明可参考 [OpenAI Docs：Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)。

开发与维护约定见 [Agent 规范](AGENTS.md)。额度窗口字段说明见 [OpenAI Docs：Codex App Server](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt)。
