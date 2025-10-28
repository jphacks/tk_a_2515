#!/usr/bin/env python3
"""Export OpenAPI schema as YAML."""

import os
import sys
from pathlib import Path

import yaml

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'collectmap.settings')

import django
django.setup()

from drf_spectacular.generators import SchemaGenerator


def export_openapi_yaml(output_path: str = "openapi.yaml"):
    """Export OpenAPI schema to YAML file."""

    # drf-spectacularのSchemaGeneratorを使用してOpenAPIスキーマを生成
    generator = SchemaGenerator(
        title='Collect Map API',
        description='Django backend for Collect Map API - Mountain and Path data management',
        version='1.0.0',
    )

    # OpenAPIスキーマを生成
    schema = generator.get_schema()

    # serversセクションを追加
    if 'servers' not in schema:
        schema['servers'] = [
            {
                'url': 'http://localhost:8000',
                'description': 'Local development server'
            }
        ]

    # YAML形式で出力
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8") as f:
        yaml.dump(schema, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f"✅ OpenAPI schema exported to {output_file.absolute()}")
    print(f"   Schema contains {len(schema.get('paths', {}))} endpoint(s)")


if __name__ == "__main__":
    output_path = sys.argv[1] if len(sys.argv) > 1 else "openapi.yaml"
    export_openapi_yaml(output_path)
