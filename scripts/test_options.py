#!/usr/bin/env python3
"""
测试预定义选项功能的脚本。
会启动一个临时回调服务器来接收用户的选择结果。
"""

import asyncio
import httpx
import json
import os
import tempfile
from aiohttp import web

CALLBACK_PORT = 23984

# 存储用户响应的全局变量
user_response = None
response_event = asyncio.Event()


async def handle_response(request):
    """处理来自扩展的回调响应"""
    global user_response
    try:
        data = await request.json()
        user_response = data
        response_event.set()
        print(f"\n✅ 收到用户响应:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return web.json_response({"success": True})
    except Exception as e:
        print(f"❌ 处理响应失败: {e}")
        return web.json_response({"success": False, "error": str(e)}, status=500)


async def start_callback_server():
    """启动回调服务器"""
    app = web.Application()
    app.router.add_post("/response", handle_response)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", CALLBACK_PORT)
    await site.start()
    print(f"[回调服务器] 监听端口 {CALLBACK_PORT}")
    return runner


async def test_options():
    print("=" * 50)
    print("   预定义选项功能测试")
    print("=" * 50)
    
    # 1. 启动回调服务器
    runner = await start_callback_server()
    
    try:
        # 2. 查找扩展端口
        print("\n[1] 查找扩展端口...")
        temp_dir = tempfile.gettempdir()
        ports_dir = os.path.join(temp_dir, "ts-ports")
        
        if not os.path.exists(ports_dir):
            print(f"❌ 端口目录不存在: {ports_dir}")
            print("请确保 Windsurf 已重启且扩展已启动")
            return

        ports = []
        try:
            for filename in os.listdir(ports_dir):
                if filename.endswith(".port"):
                    filepath = os.path.join(ports_dir, filename)
                    try:
                        with open(filepath, "r") as f:
                            data = json.load(f)
                            if "port" in data:
                                ports.append(data["port"])
                    except Exception:
                        pass
        except Exception as e:
            print(f"❌ 读取端口失败: {e}")
            return

        if not ports:
            print("❌ 未找到运行中的扩展端口")
            return

        port = ports[0]
        print(f"✅ 找到扩展端口: {port}")
        
        # 3. 发送测试请求
        request_data = {
            "type": "sync",
            "requestId": "test-options-" + str(int(asyncio.get_event_loop().time() * 1000)),
            "reason": "🧪 测试模式：请点击任意按钮验证功能",
            "options": ["✅ 功能正常", "❌ 仍有问题", "🔄 再试一次"],
            "callbackPort": CALLBACK_PORT
        }
        
        print(f"\n[2] 发送测试请求...")
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"http://127.0.0.1:{port}/ask",
                json=request_data,
                timeout=10.0
            )
            
            if resp.status_code == 200 and resp.json().get("success"):
                print("✅ 弹窗已触发，请在 Windsurf 中操作...")
            else:
                print(f"❌ 请求失败: {resp.text}")
                return
        
        # 4. 等待用户响应（最多60秒）
        print("\n[3] 等待用户操作...")
        try:
            await asyncio.wait_for(response_event.wait(), timeout=60.0)
            
            if user_response:
                if user_response.get("cancelled"):
                    print("\n⚠️ 用户取消了操作")
                else:
                    print(f"\n🎉 测试成功！用户选择: {user_response.get('userInput', '(空)')}")
        except asyncio.TimeoutError:
            print("\n⏰ 等待超时（60秒）")
            
    finally:
        # 清理回调服务器
        await runner.cleanup()
        print("\n[完成] 回调服务器已关闭")


if __name__ == "__main__":
    asyncio.run(test_options())
