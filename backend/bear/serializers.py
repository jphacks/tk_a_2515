from rest_framework import serializers
from .models import BearSighting


class BearSightingSerializer(serializers.ModelSerializer):
    """BearSighting serializer"""

    class Meta:
        model = BearSighting
        fields = [
            'id',
            'prefecture',
            'city',
            'latitude',
            'longitude',
            'summary',
            'source_url',
            'image_url',
            'reported_at',
        ]
        read_only_fields = ['id']
