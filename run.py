"""
本地开发启动脚本。
一行命令启动：  python run.py

启动后访问：http://localhost:8001/blind-watermark
"""

import subprocess
import sys
import os

# 确保在项目根目录
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 先检查依赖
print("📦 检查依赖...")
subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "-q"],
               capture_output=True)

print("🚀 启动服务...")
print("    访问地址: http://localhost:8001/blind-watermark")
print("    退出按 Ctrl+C")
print()

# 启动 uvicorn
cmd = [
    sys.executable, "-m", "uvicorn",
    "app.main:app",
    "--host", "0.0.0.0",
    "--port", "8001",
    "--reload",
]
subprocess.run(cmd)
