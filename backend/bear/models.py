from django.db import models


class BearSighting(models.Model):
    """クマ目撃情報モデル"""

    id = models.AutoField(primary_key=True)
    prefecture = models.CharField(max_length=100, verbose_name="都道府県")
    city = models.CharField(max_length=100, verbose_name="市区町村")
    latitude = models.FloatField(verbose_name="緯度")
    longitude = models.FloatField(verbose_name="経度")
    summary = models.TextField(verbose_name="概要")
    source_url = models.URLField(verbose_name="情報源URL")
    image_url = models.URLField(null=True, blank=True, verbose_name="画像URL")
    reported_at = models.DateTimeField(verbose_name="報告日時")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="作成日時")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新日時")

    class Meta:
        db_table = "bear_sighting"
        verbose_name = "クマ目撃情報"
        verbose_name_plural = "クマ目撃情報"
        ordering = ["-reported_at"]

    def __str__(self):
        return (
            f"{self.prefecture} {self.city} - {self.reported_at.strftime('%Y-%m-%d')}"
        )
