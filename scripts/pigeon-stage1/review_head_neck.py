"""Neutral head-to-chest/nape review; shares the exact head-review renderer."""
from pathlib import Path
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from review_head import render_review


if __name__ == "__main__":
    render_review("head-neck")
