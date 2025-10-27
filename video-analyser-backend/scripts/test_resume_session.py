"""
Quick test for the ResumeSession RPC.

Usage:
  uv run python scripts/test_resume_session.py --addr localhost:50051 --video-id <id>
"""

from __future__ import annotations

import argparse
import sys

import grpc

from protos import video_analyzer_pb2 as pb
from protos import video_analyzer_pb2_grpc as pb_grpc


def main() -> None:
    parser = argparse.ArgumentParser(description="Test ResumeSession RPC")
    parser.add_argument("--addr", default="localhost:50051", help="gRPC server address")
    parser.add_argument("--video-id", required=True, help="Target video_id to resume")
    args = parser.parse_args()

    channel = grpc.insecure_channel(args.addr)
    client = pb_grpc.VideoAnalyzerServiceStub(channel)

    req = pb.ResumeRequest(video_id=args.video_id)
    try:
        resp = client.ResumeSession(req)
    except grpc.RpcError as e:
        print(f"[error] ResumeSession failed: {e.code().name} {e.details()}", file=sys.stderr)
        sys.exit(1)

    print("ResumeSession:", resp)


if __name__ == "__main__":
    main()

