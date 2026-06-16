"""
BIOGRID3 Antigravity Agent
--------------------------
Entry point for the Google Antigravity SDK agent.
Reads GEMINI_API_KEY from a .env file at the project root.
"""

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from google.antigravity import Agent, LocalAgentConfig

# Load .env from the project root (one level up from agent/)
load_dotenv(Path(__file__).parent.parent / ".env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise EnvironmentError(
        "GEMINI_API_KEY is not set.\n"
        "Copy .env.example to .env and add your key from:\n"
        "  https://aistudio.google.com/app/api-keys"
    )


async def main():
    config = LocalAgentConfig(api_key=api_key)

    async with Agent(config) as agent:
        response = await agent.chat("Hello! Introduce yourself briefly.")
        print(await response.text())


if __name__ == "__main__":
    asyncio.run(main())
