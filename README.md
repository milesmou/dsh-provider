# dsh-codebuddy-provider

## 简介

在 DeepSeek Harness 中使用 CodeBuddy API Key 或 WorkBuddy 登录。支持流式输出、思考内容、DSH 工具调用和启动时自动获取模型列表。

WorkBuddy 接入参考 [magpie](https://github.com/yetone/magpie) 的登录态直连方案，工具由 DSH 执行。

## 使用方法

适配 DSH `0.2.1-rc.2`。

**1. 安装或更新插件**

在 **设置 → 插件** 添加：

```text
github:milesmou/dsh-provider#main
```

仓库包含预编译文件，安装无需运行构建脚本。更新后重启 DSH。

**2. 选择接入方式**

打开 **设置 → 模型 → CodeBuddy 接入方式**：

- **WorkBuddy 登录（免 API Key）**：选择国内版或国际版。插件默认读取本机 WorkBuddy 登录，且不会修改其凭据文件。若提示凭据已加密或尚未登录，点击 **浏览器登录**，再点击显示的登录链接完成授权。插件登录保存在 DSH 凭据存储中；切回 **使用本机登录** 会移除插件保存的浏览器登录。
- **CodeBuddy API Key**：填写 CodeBuddy 访问密钥，点击 **保存密钥**。仅使用 DSH 界面保存的密钥。

在对话模型选择器中选择 **WorkBuddy / WorkBuddy AI / CodeBuddy API** 下的模型。模型列表在启动、切换接入方式或完成登录时获取，不定时刷新。可用模型和用量以账号权限为准。

**3. 可选配置**

在 `$DSH_HOME/profiles/desktop/cordis.patch.yml` 中配置（其他 profile 替换目录名）：

```yaml
- id: llm-codebuddy-provider
  config:
    mode: workbuddy          # api 或 workbuddy
    workbuddyRegion: cn     # cn 或 intl
    models:
      - id: auto
        name: WorkBuddy Auto
```

手动配置优先于自动目录。`autoUpdateModels: false` 关闭自动获取。API Key 模式可用 `environment: overseas` 或 `baseURL` 配置国际版、自定义接口；WorkBuddy 登录始终使用所选版本的官方地址。更多配置见 [配置示例](examples/cordis.patch.yml)。
