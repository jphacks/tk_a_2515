from rest_framework import serializers
from .models import Path, PathGeometry, PathTag


class PathGeometrySerializer(serializers.ModelSerializer):
    """PathGeometry serializer"""

    class Meta:
        model = PathGeometry
        fields = ['id', 'node_id', 'lat', 'lon', 'sequence']
        read_only_fields = ['id']


class PathTagSerializer(serializers.ModelSerializer):
    """PathTag serializer"""

    class Meta:
        model = PathTag
        fields = ['id', 'highway', 'source', 'difficulty', 'kuma', 'created_at']
        read_only_fields = ['id', 'created_at']


class PathSerializer(serializers.ModelSerializer):
    """Path serializer"""
    geometries = PathGeometrySerializer(many=True, read_only=True)
    tags = PathTagSerializer(many=True, read_only=True)

    class Meta:
        model = Path
        fields = [
            'id', 'osm_id', 'type', 'minlat', 'minlon', 'maxlat', 'maxlon',
            'geometries', 'tags', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PathListSerializer(serializers.Serializer):
    """Path一覧応答Serializer"""
    total = serializers.IntegerField()
    skip = serializers.IntegerField()
    limit = serializers.IntegerField()
    items = PathSerializer(many=True)


class PointSerializer(serializers.Serializer):
    """座標点のSerializer"""
    x = serializers.FloatField()
    y = serializers.FloatField()
    lon = serializers.FloatField()
    lat = serializers.FloatField()


class PathDetailSerializer(serializers.Serializer):
    """Pathの詳細情報Serializer"""
    id = serializers.IntegerField(required=False, allow_null=True)
    path_id = serializers.IntegerField(required=False, allow_null=True)
    osm_id = serializers.IntegerField()
    type = serializers.CharField()
    difficulty = serializers.IntegerField(required=False, allow_null=True)
    path_graphic = PointSerializer(many=True, required=False, allow_null=True)
