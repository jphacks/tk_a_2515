from django.contrib.gis.geos import Polygon
from rest_framework import viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from .models import Path
from .serializers import PathSerializer


class PathViewSet(viewsets.ReadOnlyModelViewSet):
    """Path API ViewSet (Read-only)"""

    queryset = Path.objects.all()
    serializer_class = PathSerializer

    def retrieve(self, request, pk=None):
        """指定されたIDのPathの詳細情報を取得"""
        try:
            path = Path.objects.prefetch_related("geometries", "tags").get(osm_id=pk)
            serializer = PathSerializer(path)
            return Response(serializer.data)
        except Path.DoesNotExist:
            raise NotFound(f"Path with osm_id {pk} not found")

    def list(self, request):
        """Path一覧を取得（bbox検索・フィルタリング・ページネーション対応）"""
        queryset = self.get_queryset().prefetch_related("geometries", "tags")
        print("hello")

        # クエリパラメータから取得
        skip = int(request.query_params.get("skip", 0))
        limit = int(request.query_params.get("limit", 100))
        minlat = request.query_params.get("minlat")
        minlon = request.query_params.get("minlon")
        maxlat = request.query_params.get("maxlat")
        maxlon = request.query_params.get("maxlon")

        print(minlat, minlon, maxlat, maxlon)

        # bbox検索（PostGIS）
        if minlat and minlon and maxlat and maxlon:
            minlat = float(minlat)
            minlon = float(minlon)
            maxlat = float(maxlat)
            maxlon = float(maxlon)

            search_bbox = Polygon.from_bbox((minlon, minlat, maxlon, maxlat))
            search_bbox.srid = 4326
            print("queryset length before bbox filter:", queryset.count())
            queryset = queryset.filter(bbox__intersects=search_bbox)
            print("queryset length after bbox filter:", queryset.count())

        # 総数を取得
        total = queryset.count()
        print("total:", total)

        # ページネーション
        items = queryset[skip : skip + limit]

        serializer = PathSerializer(items, many=True)
        return Response(
            {"total": total, "skip": skip, "limit": limit, "items": serializer.data}
        )
