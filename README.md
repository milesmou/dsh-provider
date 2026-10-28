# dsh-codebuddy-provider

## 简介

通过 CodeBuddy 访问密钥，在 DeepSeek Harness 中使用 CodeBuddy 模型。支持流式输出、思考内容、工具调用和 token 统计。

## 使用方法

需要 Node.js `>=22.19.0` 和 dsh `0.2.1-rc.2`。以下命令适用于 PowerShell。

**1. 安装插件**

```powershell
$env:npm_config_registry = 'https://registry.npmjs.org/'
dsh plugin --profile desktop add "github:milesmou/dsh-codebuddy-provider#main"
```

`desktop` 为安装目标 profile，可替换为实际使用的名称（如 `web`）。仓库包含预编译文件，安装时无需执行构建脚本。

**2. 配置密钥并启动 dsh**

```powershell
$env:CODEBUDDY_API_KEY = 'ck_你的完整访问密钥'
$env:CODEBUDDY_INTERNET_ENVIRONMENT = 'internal'
dsh desktop
```

在模型选择器中选择 **CodeBuddy API → CodeBuddy Auto**。国内版使用 `internal`，国际版使用 `overseas`。

如需自定义接口，在启动 dsh 前设置 API 根地址：

```powershell
$env:CODEBUDDY_BASE_URL = 'https://你的接口地址/v2'
```

自定义地址优先于区域设置，接口需兼容 OpenAI Chat Completions 流式协议。修改环境变量后需重新启动 dsh。

**3. 添加其他模型（可选）**

在 `$DSH_HOME/profiles/desktop/cordis.patch.yml` 中按实际可用的模型 ID 配置（其他 profile 替换目录名）：

```yaml
- id: llm-codebuddy-provider
  config:
    models:
      - id: auto
        name: CodeBuddy Auto
      - id: glm-4.7
        name: GLM-4.7
```

更多配置见 [配置示例](examples/cordis.patch.yml)。
