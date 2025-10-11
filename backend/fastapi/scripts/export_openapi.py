#!/usr/bin/env python3
"""Export OpenAPI schema as YAML."""

import sys
from pathlib import Path

import yaml

# Add parent directory to path to import main module
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app


def export_openapi_yaml(output_path: str = "openapi.yaml"):
    """Export OpenAPI schema to YAML file."""
    openapi_schema = app.openapi()

    output_file = Path(output_path)
    with output_file.open("w", encoding="utf-8") as f:
        yaml.dump(openapi_schema, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f"OpenAPI schema exported to {output_file.absolute()}")


if __name__ == "__main__":
    output_path = sys.argv[1] if len(sys.argv) > 1 else "openapi.yaml"
    export_openapi_yaml(output_path)
