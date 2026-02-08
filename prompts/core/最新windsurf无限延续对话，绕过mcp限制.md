# [最新windsurf无限延续对话，绕过mcp限制](https://linux.do/t/topic/1424535)

[最新windsurf无限延续对话，绕过mcp限制](https://linux.do/t/topic/1424535)
[资源荟萃](https://linux.do/c/resource/14)
[软件开发](https://linux.do/tag/%E8%BD%AF%E4%BB%B6%E5%BC%80%E5%8F%91)
[y1q2h3111](https://linux.do/u/y1q2h3111)
我耗费几十分钟开发了一个最新绕过当前windsurf mcp限制的feedback插件 原理就是通过终端阻塞对话，使用起来很方便，一键配置 不需要mcp 已开源 可以的话麻烦点个星星或者在这儿点个赞即可 [https://github.com/hjw-plango/AIFeedbackToolBlocking/releases/download/1/AIFeedbackTool.zip](https://github.com/hjw-plango/AIFeedbackToolBlocking/releases/download/1/AIFeedbackTool.zip)
使用步骤
1. 
下载解压到一个长时间保存的目录里面 双击这个exe，左下角可以一键配置rule
[image1352×1098 116 KB](https://linux.do/uploads/default/original/4X/b/2/d/b2d4b5350a54369b3a813061bf02dad382fccffc.png)

2. 
打开windsurf 直接开一个新的对话 发一个你好 即可看到效果
[image1803×1199 354 KB](https://linux.do/uploads/default/original/4X/e/f/5/ef5db32c28b8a49ad583fcbf2f32b73d53210bb4.png)

下载解压到一个长时间保存的目录里面 双击这个exe，左下角可以一键配置rule
[image1352×1098 116 KB](https://linux.do/uploads/default/original/4X/b/2/d/b2d4b5350a54369b3a813061bf02dad382fccffc.png)
打开windsurf 直接开一个新的对话 发一个你好 即可看到效果
[image1803×1199 354 KB](https://linux.do/uploads/default/original/4X/e/f/5/ef5db32c28b8a49ad583fcbf2f32b73d53210bb4.png)
使用起来非常方便，支持图片上传 对话历史和多窗口同时使用
如果无法使用可能是rule冲突了，检查下自己的rule看看有没有其他冲突的feedback规则。如果有可以清除再一键配置，附本插件的rule规则如下：
在每次结束对话时，必须调用AI反馈工具。调用命令：C:\Users\admin\Desktop\aitools\AIFeedbackTool.exe --gui --project “项目路径” --summary “AI工作完成摘要” --timeout 9999 请务必充分利用上述提及的工具！ AI Interactive Feedback 规则 1.在任何流程、任务、对话进行时，无论是询问、回复、或完成阶段性任务，皆必须调用AI反馈工具。 2.每当收到用户反馈，若反馈内容非空，必须再次调用AI反馈工具，并根据反馈内容调整行为。 3.仅当用户明确表示「结束」或「不再需要交互」时，才可停止调用AI反馈工具，流程才算结束。 4.除非收到结束指令，否则所有步骤都必须重复调用AI反馈工具。 5.完成任务前，必须使用AI反馈工具向用户询问反馈。 AI反馈工具调用方式： GUI模式（默认）：C:\Users\admin\Desktop\aitools\AIFeedbackTool.exe --gui --project “项目路径” --summary “工作摘要” --timeout 9999 命令行模式：C:\Users\admin\Desktop\aitools\AIFeedbackTool.exe --cli --project “项目路径” --summary “工作摘要” --timeout 9999 系统信息：C:\Users\admin\Desktop\aitools\AIFeedbackTool.exe --system-info
C:\Users\admin\Desktop\aitools\AIFeedbackTool.exe 这个需要替换你保存本插件的路径
[wu_wei](https://linux.do/u/wu_wei)
感谢大佬
[Adamllll](https://linux.do/u/Adamllll)
哇 感谢分享
[okokok](https://linux.do/u/okokok)
感谢分享
[handsome](https://linux.do/u/handsome)
感谢大佬 ！
[Ma_Marg](https://linux.do/u/Ma_Marg)
mcp还是可以用的
[piniania](https://linux.do/u/piniania)
厉害
[coho](https://linux.do/u/coho)
哪来的账户啊，指点一二大佬们
[bluegatar](https://linux.do/u/bluegatar)
winsurf不是停止开发了
[zbin0957](https://linux.do/u/zbin0957)
牛啊大佬，膜拜
[xunxun](https://linux.do/u/xunxun)
现在账户还好注册吗
[hyede](https://linux.do/u/hyede)
咋用 不是会被检测出来么？
[zzqqa1.6](https://linux.do/u/zzqqa1.6)
太厉害了！
[qizui](https://linux.do/u/qizui)
诶，现在还行嘛
[xier9213](https://linux.do/u/xier9213)
不是被封了吗
[y1q2h3111](https://linux.do/u/y1q2h3111)
绕过mcp可以用的
[y1q2h3111](https://linux.do/u/y1q2h3111)
可以的 我这个亲测可行
[Georgehan](https://linux.do/u/Georgehan)
有试过这个的吗，我试了下历史记录有的，但是拦截不了，一次对话就直接结束了
[y1q2h3111](https://linux.do/u/y1q2h3111)
出现什么问题呢 你一键配置了吗 点开rule看看有没有这个？