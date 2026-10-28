# dsh-codebuddy-provider

在 DeepSeek Harness 中，通过 CodeBuddy 的访问密钥（例如 `ck_...`）调用模型。

这是一个 **dsh 模型 Provider 插件**，注册的 provider ID 是 `codebuddy-api`。支持文本流式输出、`reasoning_content`、并行工具调用及结果回传、缓存 token 统计、请求取消和超时。默认在模型选择器中提供 `CodeBuddy Auto`；其他模型通过配置添加。

## 与 Codeg 方案的关系

参考了 [Codeg 的 CodeBuddy 配置](https://github.com/nobug-project/codeg/blob/main/src/components/settings/codebuddy-config-panel.tsx) 与 [启动定义](https://github.com/nobug-project/codeg/blob/main/src-tauri/src/acp/registry.rs)，自行实现，没有复制其代码。

Codeg 启动官方 `codebuddy --acp`，并传入 `CODEBUDDY_API_KEY`、`CODEBUDDY_INTERNET_ENVIRONMENT` 或 `CODEBUDDY_BASE_URL`。ACP 接入的是完整 Agent；本插件沿用这些配置约定，通过 Chat Completions 接口接入模型，工具执行和会话由 dsh 管理。因此，本插件不启动 CodeBuddy CLI，也不需要安装 Codeg。

CodeBuddy CLI `2.177.0` 的随包配置和请求实现是默认端点与协议的核对依据：国内产品端点为 `https://copilot.tencent.com`，请求使用 `/v2/chat/completions`。国际默认端点为 `https://www.codebuddy.ai/v2`。域名、账号权限和模型列表可能变化，实际接口以用户的部署为准。

## 兼容性与验证范围

- 构建并测试的 dsh LLM SDK：`0.2.1-rc.2`。
- Cordis：`4.0.5`；Node.js：`>=22.19.0`。
- 当前包将 dsh LLM peer dependency 固定为测试版本。升级 dsh 时应先更新依赖并重跑测试。
- 已通过本地 HTTP/SSE 模拟接口及真实 Cordis + LlmRuntime 加载/卸载测试；最终 `.tgz` 也已在独立目录安装，并验证导出、配置 schema、bundle patch 与 Provider 注册。
- 已用 dsh `0.2.1-rc.2` 的 `dsh plugin --profile web add` 在隔离目录安装、启动 Web 服务，并在运行中的 LlmRuntime 确认 `codebuddy-api` / `CodeBuddy Auto` 注册成功。
- **未使用用户真实密钥调用 CodeBuddy；真实账号、额度和端点连通性尚待验证。**

## 安装

已有 dsh `0.2.1-rc.2` 时，在 PowerShell 中从源码构建并安装：

```powershell
# 如果配置的 npm 镜像没有同步所需版本，可在当前终端指定官方源。
$env:npm_config_registry = 'https://registry.npmjs.org/'
git clone https://github.com/milesmou/dsh-codebuddy-provider.git
cd dsh-codebuddy-provider
npm.cmd ci
npm.cmd test
npm.cmd pack
dsh plugin --profile web add ./dsh-codebuddy-provider-0.1.0.tgz
```

仓库保存 TypeScript 源码，`npm.cmd pack` 会先构建 `lib/` 并将它打入安装包。已有 `.tgz` 安装包时可直接使用最后一条命令安装。

## 配置与使用

先设置密钥，再从同一个终端启动 dsh。下面的占位符需要替换为你自己的密钥；插件不会在文件中保存它。

```powershell
$env:CODEBUDDY_API_KEY = 'ck_你的完整访问密钥'
$env:CODEBUDDY_INTERNET_ENVIRONMENT = 'internal'
dsh web
```

在 dsh 模型选择器中选择 **CodeBuddy API → CodeBuddy Auto**。

私有部署或已有明确接口地址时，设置 `CODEBUDDY_BASE_URL`，它优先于区域设置：

```powershell
$env:CODEBUDDY_BASE_URL = 'https://你的接口地址/v2'
Remove-Item Env:CODEBUDDY_INTERNET_ENVIRONMENT -ErrorAction SilentlyContinue
dsh web
```

支持传入 `https://host/v2` 或完整的 `https://host/v2/chat/completions`；根域名自动补 `/v2`，已有 `/v1` 或其他路径保持原样。地址不接受 URL 内嵌账号密码、查询串或片段。它必须提供 OpenAI Chat Completions 兼容的流式接口。

在 `$DSH_HOME/profiles/web/cordis.patch.yml` 中添加或合并以下条目，即可手动设置模型列表；完整示例见 [examples/cordis.patch.yml](examples/cordis.patch.yml)：

```yaml
- id: llm-codebuddy-provider
  config:
    environment: internal
    apiKeyEnv: CODEBUDDY_API_KEY
    timeoutMs: 180000
    includeUsage: true
    models:
      - id: auto
        name: CodeBuddy Auto
      - id: glm-4.7
        name: GLM-4.7
        contextWindow: 200000
        maxTokens: 4096
```

示例中的模型 ID 和容量来自本机安装的官方 CLI 随包目录，是配置示例，不能证明你的密钥有权访问。请按你的接口实际提供的模型修改。`contextWindow` 和 `maxTokens` 可省略；前者省略表示容量未知，后者省略使用服务端默认输出限制。

端点优先级：配置中的 `baseURL` → `CODEBUDDY_BASE_URL` → 区域默认值。区域优先级：非空 `CODEBUDDY_INTERNET_ENVIRONMENT` → 配置的 `environment`。默认区域为国内 `internal`，国际为 `overseas`；iOA 需明确配置接口地址，组织额外鉴权暂未实现。

插件通过 dsh 的启动环境快照读取变量，兼容 dsh 的 `.env` 加载机制；修改环境变量后重新启动 dsh。密钥变量名由 `apiKeyEnv` 指定，默认 `CODEBUDDY_API_KEY`。本版不读取 CodeBuddy 的登录文件或 dsh 的凭据存储。

## 思考等级

只在端点确实支持的模型上配置 `reasoningEfforts`：

```yaml
      - id: your-reasoning-model
        reasoningEfforts: [low, medium, high]
```

所选值原样作为 `reasoning_effort` 发送。允许值为 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`；没有配置时不声明等级、不传该字段，由服务端决定默认行为。这里没有把 `off` 猜测成某种关闭思考的协议。

## 排错与当前边界

- `MISSING_CREDENTIAL`：启动 dsh 的终端未设置密钥变量。
- `AUTH` / 401 / 403：核对完整密钥、国内/国际站点、接口权限。
- 404：核对 API 根路径和模型 ID；不要将官网页面地址当作 API 路径。
- `RATE_LIMIT`：保留服务端 `Retry-After`；SDK 内部重试关闭，由 dsh 的重试机制统一处理。
- `TIMEOUT`：整个流式请求超过 `timeoutMs`，包括等待后续 SSE 数据的时间。
- `INCOMPLETE_RESPONSE`：连接结束前没有收到 `finish_reason`，会报错，避免把截断输出当作成功。
- 若网关拒绝 `stream_options`，设置 `includeUsage: false`；这时 token 统计取决于服务端是否仍发送 usage。
- 目前仅声明文本输入，不支持图片和文件的原生上传，不包含 OAuth、额度查询、自动模型发现、密钥轮换或专用设置页面。模型列表是本地配置，不会通过不存在的 `/models` 接口猜测。
- dsh 模型调用不会获得 CodeBuddy CLI 自身的工具、系统提示或插件能力。

## 测试

`npm.cmd test` 覆盖 UTF-8/SSE 分片、思考内容、并行工具及延迟 ID、工具结果重放、缓存 token 去重、HTTP 错误与密钥脱敏、中断流、主动取消、超时、内容类型拒绝，以及 Cordis 真实生命周期。

参考资料：[Codeg 认证说明](https://docs.codeg.app/guide/authentication)、[CodeBuddy 环境变量](https://www.codebuddy.ai/docs/cli/env-vars)、[dsh LLM 契约](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/llm-streaming.md)。
