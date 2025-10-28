from django.contrib.gis.db import models as gis_models
from django.db import models


class Type(models.Model):
    """Type model - 山のタイプ（山頂、展望ポイントなど）"""

    type_id = models.CharField(max_length=255, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'types'

    def __str__(self):
        return self.name


class Prefecture(models.Model):
    """Prefecture model - 都道府県"""

    pref_id = models.CharField(max_length=255, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'prefectures'

    def __str__(self):
        return self.name


class Mountain(models.Model):
    """Mountain model - 山の情報"""

    ptid = models.CharField(max_length=255, unique=True, db_index=True)
    name = models.CharField(max_length=255, db_index=True)
    yomi = models.CharField(max_length=255, null=True, blank=True)
    other_names = models.CharField(max_length=255, null=True, blank=True)
    yamatan = models.CharField(max_length=255, null=True, blank=True)
    name_en = models.CharField(max_length=255, null=True, blank=True)
    elevation = models.FloatField(null=True, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    location = gis_models.PointField(geography=True, null=True, blank=True, spatial_index=True, srid=4326)
    detail = models.TextField(null=True, blank=True)
    area = models.CharField(max_length=255, null=True, blank=True)
    photo_url = models.CharField(max_length=512, null=True, blank=True)
    page_url = models.CharField(max_length=512, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Many-to-many relationships
    types = models.ManyToManyField(Type, through='MountainType', related_name='mountains')
    prefectures = models.ManyToManyField(Prefecture, through='MountainPrefecture', related_name='mountains')

    class Meta:
        db_table = 'mountains'
        indexes = [
            models.Index(fields=['lat', 'lon']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """lat/lonからlocationを自動生成"""
        if self.lat is not None and self.lon is not None:
            from django.contrib.gis.geos import Point
            self.location = Point(self.lon, self.lat, srid=4326)
        super().save(*args, **kwargs)


class MountainType(models.Model):
    """中間テーブル: Mountain と Type の多対多関係"""

    mountain = models.ForeignKey(Mountain, on_delete=models.CASCADE)
    type = models.ForeignKey(Type, on_delete=models.CASCADE)
    detail = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'mountain_types'
        unique_together = ('mountain', 'type')


class MountainPrefecture(models.Model):
    """中間テーブル: Mountain と Prefecture の多対多関係"""

    mountain = models.ForeignKey(Mountain, on_delete=models.CASCADE)
    prefecture = models.ForeignKey(Prefecture, on_delete=models.CASCADE)

    class Meta:
        db_table = 'mountain_prefectures'
        unique_together = ('mountain', 'prefecture')
