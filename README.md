# dsh-codebuddy-provider

## 简介

通过 CodeBuddy 访问密钥，在 DeepSeek Harness 中使用 CodeBuddy 模型。支持流式输出、思考内容、工具调用和 token 统计。

## 使用方法

适配 dsh `0.2.1-rc.2`。

**1. 安装插件**

桌面版打开 **设置 → 插件**，添加以下来源：

```text
github:milesmou/dsh-codebuddy-provider#main
```

仓库包含预编译文件，安装时无需执行构建脚本。更新后重新启动 DSH。

**2. 在 DSH 中配置密钥**

打开 **设置 → 模型**，在页面下方的 **CodeBuddy API** 区域填写访问密钥（`ck_...`），点击 **保存密钥**。密钥保存在 DSH 凭据存储中，下次请求立即生效。

在对话模型选择器中选择 **CodeBuddy API → CodeBuddy Auto**。默认使用国内接口。

也可在 `$DSH_HOME/.env` 配置环境变量；修改后重新启动 DSH：

```dotenv
CODEBUDDY_API_KEY=ck_你的完整访问密钥
CODEBUDDY_INTERNET_ENVIRONMENT=internal
```

国际版将 `internal` 改为 `overseas`；自定义接口可另设 `CODEBUDDY_BASE_URL=https://你的接口地址/v2`。进程环境中的密钥优先；若界面提示不可写，请先移除该环境变量并重启。

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
