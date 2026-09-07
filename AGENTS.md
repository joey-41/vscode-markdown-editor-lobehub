# AGENTS.md

This file applies to the entire repository.

## Delivery rules

- After any modification to repository files is completed, run `npm run package` from the repository root before handing off.
- Treat the task as incomplete if `npm run package` fails; report the failure clearly and include the relevant error summary.
- In the final response, include the generated `.vsix` file path when packaging succeeds.

## Notes

- The root `package.json` already defines `npm run package`, which builds the webview, builds the extension, and creates the `.vsix` package.
- Unless the user explicitly asks otherwise, prefer the existing packaging flow over custom `vsce` commands.
- 每次打包前，都把版本号+1
- 发布到github时，根据近期修复的内容填写commit，并切根据版本号打tag
