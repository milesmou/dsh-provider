# dsh-provider

## 简介

DeepSeek Harness 的组件化模型接入插件。当前提供 **WorkBuddy 组件**，支持 WorkBuddy 本机/浏览器登录及 CodeBuddy API Key；后续 Agent 将作为独立组件接入。

支持流式输出、思考内容、DSH 工具调用和启动时获取模型列表。WorkBuddy 接入参考 [magpie](https://github.com/yetone/magpie)。组件扩展方式见 [组件说明](docs/components.md)。

## 使用方法

适配 DSH `0.2.1-rc.2`。

**1. 安装插件**

在 **设置 → 插件** 添加：

```text
github:milesmou/dsh-provider#main
```

若已安装旧插件，先移除旧安装项，再安装上述来源并重启 DSH。密钥或插件浏览器登录需重新配置。仓库包含预编译文件，安装无需运行构建脚本。

**2. 配置 WorkBuddy 组件**

打开 **设置 → 模型 → WorkBuddy 组件**：

- **WorkBuddy 登录（免 API Key）**：选择国内版或国际版，自动读取可用的本机登录态。若提示凭据已加密或未登录，点击 **浏览器登录**，再打开显示的链接完成授权。浏览器登录保存在 DSH 凭据存储中。
- **CodeBuddy API Key**：填写访问密钥，点击 **保存密钥**。仅使用 DSH 界面保存的密钥。

在模型选择器中选择相应模型。模型列表在启动、切换接入方式或完成登录时获取，不定时刷新。可用模型和用量以账号权限为准。

WorkBuddy 登录成功不代表直连接口获准调用。若返回 `11128 / unapproved channel`，表示服务端拒绝当前调用渠道。插件会先按 magpie 的规则改写被拒的客户端身份行；首次收到 11128 时，还会把系统提示词搬移到首条用户消息（`<instructions>` 标签内）并重发一次。仍被拒绝时才返回该错误；此时请使用官方客户端，或改用已获授权的 API 接入。第三方应用的官方接入能力见 [WorkBuddy Open API](https://open.workbuddy.cn/docs/openapi)。

**请求形态**：WorkBuddy 的模型只接受部分 JSON Schema 与请求写法，插件在发出前统一归一；遇到服务端拒绝时修正后重发一次，并在本次运行内记住该修正：

- 工具参数：根联合合并为 object、无类型 `oneOf` 补 `type: "object"`、`enum` 补类型、布尔子 schema、元组 `items`、`pattern` 中的 `\0` 等；
- 工具名：`:`、`.`、`/`、空格、中文等字符替换为 `_` 并去重，模型返回时映射回 DSH 的原始名称；
- 消息：`developer` 转为 `system`，上一轮思考内容以 `reasoning` 回传，缺少系统提示时补默认提示词；
- 服务端 `11153`（对话需以用户消息结尾）时，在工具结果与用户消息之间补一条空 assistant 消息。

**3. 可选配置**

在 `$DSH_HOME/profiles/desktop/cordis.patch.yml` 中配置（其他 profile 替换目录名）：

```yaml
- id: dsh-provider
  config:
    workbuddy:
      mode: workbuddy          # api 或 workbuddy
      workbuddyRegion: cn     # cn 或 intl
      models:
        - id: auto
          name: WorkBuddy Auto
```

WorkBuddy 的配置位于 `config.workbuddy`。手动模型配置优先于自动目录；`autoUpdateModels: false` 关闭自动获取。API Key 模式支持 `environment: overseas` 或自定义 `baseURL`；WorkBuddy 登录始终使用所选版本的官方地址。更多配置见 [配置示例](examples/cordis.patch.yml)。
