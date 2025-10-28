from rest_framework import serializers
from .models import Mountain, Type, Prefecture, MountainType, MountainPrefecture


class TypeSerializer(serializers.ModelSerializer):
    """Type serializer"""

    class Meta:
        model = Type
        fields = ['id', 'type_id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class PrefectureSerializer(serializers.ModelSerializer):
    """Prefecture serializer"""

    class Meta:
        model = Prefecture
        fields = ['id', 'pref_id', 'name', 'created_at']
        read_only_fields = ['id', 'created_at']


class MountainTypeDetailSerializer(serializers.Serializer):
    """Mountain-Type関係の詳細情報（中間テーブルのdetailフィールド用）"""
    type_id = serializers.CharField()
    name = serializers.CharField()
    detail = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class MountainSerializer(serializers.ModelSerializer):
    """Mountain serializer"""
    types = TypeSerializer(many=True, read_only=True)
    prefectures = PrefectureSerializer(many=True, read_only=True)

    class Meta:
        model = Mountain
        fields = [
            'id', 'ptid', 'name', 'yomi', 'other_names', 'yamatan', 'name_en',
            'elevation', 'lat', 'lon', 'detail', 'area', 'photo_url', 'page_url',
            'types', 'prefectures', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class MountainCreateSerializer(serializers.ModelSerializer):
    """Mountain作成時のSerializer"""
    types = MountainTypeDetailSerializer(many=True, required=False)
    prefs = PrefectureSerializer(many=True, required=False)

    class Meta:
        model = Mountain
        fields = [
            'ptid', 'name', 'yomi', 'other_names', 'yamatan', 'name_en',
            'elevation', 'lat', 'lon', 'detail', 'area', 'photo_url', 'page_url',
            'types', 'prefs'
        ]

    def create(self, validated_data):
        types_data = validated_data.pop('types', [])
        prefs_data = validated_data.pop('prefs', [])

        mountain = Mountain.objects.create(**validated_data)

        # TypeとPrefectureのリレーションを作成
        for type_data in types_data:
            type_obj, _ = Type.objects.get_or_create(
                type_id=type_data['type_id'],
                defaults={'name': type_data['name']}
            )
            MountainType.objects.create(
                mountain=mountain,
                type=type_obj,
                detail=type_data.get('detail')
            )

        for pref_data in prefs_data:
            pref_obj, _ = Prefecture.objects.get_or_create(
                pref_id=pref_data['pref_id'],
                defaults={'name': pref_data['name']}
            )
            MountainPrefecture.objects.create(
                mountain=mountain,
                prefecture=pref_obj
            )

        return mountain


class MountainUpdateSerializer(serializers.ModelSerializer):
    """Mountain更新時のSerializer（すべてオプショナル）"""
    types = MountainTypeDetailSerializer(many=True, required=False)
    prefs = PrefectureSerializer(many=True, required=False)

    class Meta:
        model = Mountain
        fields = [
            'name', 'yomi', 'other_names', 'yamatan', 'name_en',
            'elevation', 'lat', 'lon', 'detail', 'area', 'photo_url', 'page_url',
            'types', 'prefs'
        ]

    def update(self, instance, validated_data):
        types_data = validated_data.pop('types', None)
        prefs_data = validated_data.pop('prefs', None)

        # 基本フィールドを更新
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # TypeとPrefectureのリレーションを更新
        if types_data is not None:
            # 既存のリレーションを削除
            instance.mountaintype_set.all().delete()
            # 新しいリレーションを作成
            for type_data in types_data:
                type_obj, _ = Type.objects.get_or_create(
                    type_id=type_data['type_id'],
                    defaults={'name': type_data['name']}
                )
                MountainType.objects.create(
                    mountain=instance,
                    type=type_obj,
                    detail=type_data.get('detail')
                )

        if prefs_data is not None:
            # 既存のリレーションを削除
            instance.mountainprefecture_set.all().delete()
            # 新しいリレーションを作成
            for pref_data in prefs_data:
                pref_obj, _ = Prefecture.objects.get_or_create(
                    pref_id=pref_data['pref_id'],
                    defaults={'name': pref_data['name']}
                )
                MountainPrefecture.objects.create(
                    mountain=instance,
                    prefecture=pref_obj
                )

        return instance


class MountainListSerializer(serializers.Serializer):
    """Mountain一覧応答Serializer"""
    total = serializers.IntegerField()
    skip = serializers.IntegerField()
    limit = serializers.IntegerField()
    items = MountainSerializer(many=True)
