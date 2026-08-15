#!/usr/bin/env python3
"""Assemble the Nia 10-shot vertical photo video with FFmpeg.

CAPTURED FROM MANUS, 15 Aug 2026 — verbatim, do not "clean up".
This is the actual working script Manus wrote and ran. It is the asset the
free window bought: it runs on any machine with ffmpeg, forever, for nothing.

Requirements:
  - Python 3.9+
  - ffmpeg and ffprobe on PATH
  - The 10 PNGs and WAV soundtrack in --input-dir

Example:
  python3 assemble_nia_video.py \
      --input-dir /home/ubuntu/nia_photo_series \
      --output /home/ubuntu/nia_photo_series/nia_rendered_video_53s.mp4
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Sequence


FPS = 30
WIDTH = 1440
HEIGHT = 2560
TOTAL_DURATION = 53.0
FONT_DEFAULT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

SHOTS = [
    {"image": "01_sunday.png", "duration": 5, "motion": "still", "caption": "I didn't leave God."},
    {"image": "02_hands.png", "duration": 5, "motion": "in", "caption": "The room left me."},
    {"image": "03_church.png", "duration": 5, "motion": "in", "caption": "I transitioned at twenty-nine.\\nThat building stopped at twenty-eight."},
    {"image": "04_windscreen.png", "duration": 5, "motion": "still", "caption": "I still park across the street\\nsome Sundays."},
    {"image": "05_photo.png", "duration": 5, "motion": "in", "caption": "I know every word they're singing\\nin there."},
    {"image": "06_glass.png", "duration": 5, "motion": "in", "caption": "What I was actually after\\nwas the quiet."},
    {"image": "07_bededge.png", "duration": 5, "motion": "still", "caption": "One drink bought an hour\\nof not defending myself."},
    {"image": "08_dishes.png", "duration": 5, "motion": "still", "caption": "My body still remembers the songs.\\nThat's what makes it hard."},
    {"image": "09_friends.png", "duration": 5, "motion": "still", "caption": "I'm not a faithless woman.\\nThat was never the problem."},
    {"image": "10_doorway.png", "duration": 5, "motion": "out", "caption": "So I stopped waiting on that door,\\nand found one that opened."},
    # Three-second end hold, matching the original workflow.
    {"image": "10_doorway.png", "duration": 3, "motion": "still", "caption": "and found one\\nthat opened."},
]


def run(command: Sequence[str], *, cwd: Path | None = None) -> None:
    """Run a command and show it exactly as executed."""
    print("+", " ".join(subprocess.list2cmdline([arg]) for arg in command))
    subprocess.run(command, cwd=cwd, check=True)


def ffmpeg_filter_escape(text: str) -> str:
    """Escape text for FFmpeg drawtext's filter-string parser."""
    return (
        text.replace("\\", r"\\")
        .replace(":", r"\\:")
        .replace("'", r"\\'")
        .replace(";", r"\;")
    )


def make_zoom_expression(motion: str) -> str:
    if motion == "in":
        return "min(zoom+0.00022,1.02)"
    if motion == "out":
        return "max(1.02-on*0.00022,1.0)"
    return "1.0+on*0.000035"


def render_shot(
    input_image: Path,
    output_clip: Path,
    caption: str,
    motion: str,
    duration: float,
    font: Path,
) -> None:
    zoom = make_zoom_expression(motion)
    caption = ffmpeg_filter_escape(caption)
    vf = (
        f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={WIDTH}:{HEIGHT},"
        f"zoompan=z='{zoom}':x='iw/2-(iw/zoom/2)':"
        f"y='ih/2-(ih/zoom/2)':d=1:s={WIDTH}x{HEIGHT}:fps={FPS},"
        f"drawtext=fontfile='{font}':text='{caption}':"
        "fontcolor=0xF4F0E8:fontsize=50:line_spacing=12:"
        "box=1:boxcolor=0x00000099:boxborderw=26:"
        "x=(w-text_w)/2:y=h-390:"
        f"alpha='if(lt(t,0.5),t/0.5,if(gt(t,{duration}-0.35),"
        f"({duration}-t)/0.35,1))'"
    )
    run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-loop", "1", "-i", str(input_image),
            "-t", str(duration),
            "-vf", vf,
            "-an",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            str(output_clip),
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--music", type=Path, default=None)
    parser.add_argument("--font", type=Path, default=Path(FONT_DEFAULT))
    parser.add_argument("--keep-work", action="store_true")
    args = parser.parse_args()

    input_dir = args.input_dir.resolve()
    output = args.output.resolve()
    music = (args.music or (input_dir / "slow_hymnal_instrumental_53s.wav")).resolve()
    font = args.font.resolve()

    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise SystemExit("ffmpeg and ffprobe must both be installed and available on PATH.")
    if not font.exists():
        raise SystemExit(f"Font not found: {font}")
    if not music.exists():
        raise SystemExit(f"Music file not found: {music}")
    for shot in SHOTS:
        image = input_dir / shot["image"]
        if not image.exists():
            raise SystemExit(f"Image not found: {image}")

    output.parent.mkdir(parents=True, exist_ok=True)
    work_parent = output.parent
    temp_context = tempfile.TemporaryDirectory(
        prefix="nia_render_", dir=str(work_parent)
    )
    work = Path(temp_context.name)

    try:
        clips: List[Path] = []
        for index, shot in enumerate(SHOTS, start=1):
            clip = work / f"{index:02d}.mp4"
            render_shot(
                input_dir / shot["image"],
                clip,
                shot["caption"],
                shot["motion"],
                shot["duration"],
                font,
            )
            clips.append(clip)

        concat_file = work / "concat.txt"
        concat_file.write_text(
            "".join(f"file '{clip.name}'\n" for clip in clips),
            encoding="utf-8",
        )

        video_only = work / "video_no_audio.mp4"
        run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "concat", "-safe", "0",
                "-i", str(concat_file),
                "-c", "copy",
                str(video_only),
            ],
            cwd=work,
        )

        mixed = work / "mixed.mp4"
        run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(video_only),
                "-i", str(music),
                "-filter_complex", "[1:a]volume=0.55,apad,atrim=duration=53[a]",
                "-map", "0:v:0",
                "-map", "[a]",
                "-t", "53",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                str(mixed),
            ]
        )

        run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", str(mixed),
                "-vf", "tpad=stop_mode=clone:stop_duration=1.8",
                "-af", "apad,atrim=duration=53",
                "-t", "53",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
                str(output),
            ]
        )

        probe = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration,size",
                "-of", "json",
                str(output),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        metadata = json.loads(probe.stdout)
        print(json.dumps(metadata, indent=2))
        duration = float(metadata["format"]["duration"])
        if abs(duration - TOTAL_DURATION) > 0.05:
            raise RuntimeError(
                f"Expected approximately {TOTAL_DURATION:.3f}s, got {duration:.3f}s"
            )
        print(f"Wrote verified video: {output}")
    finally:
        if args.keep_work:
            print(f"Keeping intermediate files at: {work}")
            temp_context.cleanup = lambda: None  # type: ignore[method-assign]
        else:
            temp_context.cleanup()

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"FFmpeg command failed with exit code {exc.returncode}.", file=sys.stderr)
        raise
