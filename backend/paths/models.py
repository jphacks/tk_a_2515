from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import LinearRing, LineString, Polygon
from django.db import models


class Path(models.Model):
    """Path model - OpenStreetMap way データ"""

    osm_id = models.BigIntegerField(unique=True, db_index=True)
    type = models.CharField(max_length=255)

    # bounds情報
    minlat = models.FloatField(null=True, blank=True)
    minlon = models.FloatField(null=True, blank=True)
    maxlat = models.FloatField(null=True, blank=True)
    maxlon = models.FloatField(null=True, blank=True)

    # PostGIS地理データ
    route = gis_models.LineStringField(
        geography=True, null=True, blank=True, spatial_index=True, srid=4326
    )
    bbox = gis_models.PolygonField(
        geography=True, null=True, blank=True, spatial_index=True, srid=4326
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "paths"
        indexes = [
            models.Index(fields=["minlat", "minlon", "maxlat", "maxlon"]),
        ]

    def __str__(self):
        return f"Path {self.osm_id}"

    def update_geo_fields(self):
        geometries = self.geometries.order_by("sequence").values_list("lon", "lat")
        coords = [(lon, lat) for lon, lat in geometries]

        if len(coords) >= 2:
            self.route = LineString(coords, srid=4326)

        if coords:
            lons = [x for x, _ in coords]
            lats = [y for _, y in coords]
            minlon, maxlon = min(lons), max(lons)
            minlat, maxlat = min(lats), max(lats)

            ring = LinearRing(
                [
                    (minlon, minlat),
                    (maxlon, minlat),
                    (maxlon, maxlat),
                    (minlon, maxlat),
                    (minlon, minlat),
                ],
                srid=4326,
            )

            self.bbox = Polygon(ring, srid=4326)
            self.minlon, self.minlat, self.maxlon, self.maxlat = (
                minlon,
                minlat,
                maxlon,
                maxlat,
            )


class PathGeometry(models.Model):
    """PathGeometry model - Pathの座標データ"""

    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="geometries")
    node_id = models.BigIntegerField()
    lat = models.FloatField()
    lon = models.FloatField()
    sequence = models.IntegerField()

    class Meta:
        db_table = "path_geometries"
        ordering = ["sequence"]

    def __str__(self):
        return f"PathGeometry {self.node_id} (seq: {self.sequence})"


class PathTag(models.Model):
    """PathTag model - Pathのタグ情報（highway, sourceなど）"""

    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="tags")
    highway = models.CharField(max_length=255, null=True, blank=True)
    source = models.CharField(max_length=255, null=True, blank=True)
    difficulty = models.IntegerField(null=True, blank=True)
    kuma = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "path_tags"

    def __str__(self):
        return f"PathTag for Path {self.path.id}"
