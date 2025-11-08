from django.contrib.gis.geos import Polygon
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from .models import Path
from .serializers import PathDetailSerializer, PathSerializer
from .utils import (
    calc_necessary_bbox,
    fetch_all_dem_data_from_bbox,
    get_nearest_elevation,
    local_distance_m,
)


class PathViewSet(viewsets.ReadOnlyModelViewSet):
    """Path API ViewSet (Read-only)"""

    queryset = Path.objects.all()
    serializer_class = PathSerializer

    @extend_schema(
        responses={200: PathDetailSerializer},
        description="指定されたIDのPathの詳細情報を取得（標高グラフデータ付き）",
    )
    def retrieve(self, request, pk=None):
        """指定されたIDのPathの詳細情報を取得（標高グラフデータ付き）"""
        try:
            path = Path.objects.prefetch_related("geometry_orders__geometry", "tags").get(osm_id=pk)
        except Path.DoesNotExist:
            raise NotFound(f"Path with osm_id {pk} not found")

        # 標高データを計算
        path_detail_data = self._get_elevation_data(path)
        serializer = PathDetailSerializer(path_detail_data)
        return Response(serializer.data)

    def _get_elevation_data(self, path: Path) -> dict:
        """
        パスの標高グラフデータを生成

        Args:
            path: Pathオブジェクト

        Returns:
            dict: PathDetail形式のデータ
        """
        min_lon, min_lat, max_lon, max_lat = (
            path.minlon,
            path.minlat,
            path.maxlon,
            path.maxlat,
        )

        # DEMデータを取得
        dem_data = fetch_all_dem_data_from_bbox(min_lon, min_lat, max_lon, max_lat)
        print(f"Fetched DEM data for {len(dem_data)} tiles")

        # 各ジオメトリポイントの標高と累積距離を計算
        geometry_orders = list(path.geometry_orders.select_related('geometry').order_by("sequence"))
        if not geometry_orders:
            return {
                "id": path.id,
                "path_id": path.id,
                "osm_id": path.osm_id,
                "type": path.type,
                "difficulty": path.tags.first().difficulty if path.tags.exists() else None,
                "path_graphic": [],
                "geometries": [],
            }

        base_lon = geometry_orders[0].geometry.lon
        base_lat = geometry_orders[0].geometry.lat
        distance = 0.0
        points = []

        for order in geometry_orders:
            geom = order.geometry
            elevation_value = get_nearest_elevation(geom.lat, geom.lon, dem_data)
            distance += int(local_distance_m(base_lat, base_lon, geom.lat, geom.lon))
            points.append(
                {
                    "x": distance,
                    "y": elevation_value,
                    "lon": geom.lon,
                    "lat": geom.lat,
                }
            )
            base_lon = geom.lon
            base_lat = geom.lat

        return {
            "id": path.id,
            "path_id": path.id,
            "osm_id": path.osm_id,
            "type": path.type,
            "difficulty": path.tags.first().difficulty if path.tags.exists() else None,
            "path_graphic": points,
            "geometries": geometry_orders,
        }

    @extend_schema(
        responses={200: PathSerializer},
        description="指定されたIDのPathの詳細情報を取得",
        parameters=[
            OpenApiParameter(
                name="minlat",
                type=float,
                description="検索範囲の最小緯度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="maxlat",
                type=float,
                description="検索範囲の最大緯度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="minlon",
                type=float,
                description="検索範囲の最小経度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="maxlon",
                type=float,
                description="検索範囲の最大経度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="pre_minlat",
                type=float,
                description="検索範囲の最小緯度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="pre_maxlat",
                type=float,
                description="検索範囲の最大緯度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="pre_minlon",
                type=float,
                description="検索範囲の最小経度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="pre_maxlon",
                type=float,
                description="検索範囲の最大経度（bboxフィルタ用）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="skip",
                type=int,
                description="スキップする件数（ページネーション用、デフォルト: 0）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="limit",
                type=int,
                description="取得する最大件数（ページネーション用、デフォルト: 100）",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
        ],
    )
    def list(self, request):
        """Path一覧を取得（bbox検索・フィルタリング・ページネーション対応）"""
        queryset = self.get_queryset().prefetch_related("geometries", "tags")

        # クエリパラメータから取得
        skip = int(request.query_params.get("skip", 0))
        limit = int(request.query_params.get("limit", 100))
        minlat = request.query_params.get("minlat")
        minlon = request.query_params.get("minlon")
        maxlat = request.query_params.get("maxlat")
        maxlon = request.query_params.get("maxlon")
        pre_minlat = request.query_params.get("pre_minlat")
        pre_minlon = request.query_params.get("pre_minlon")
        pre_maxlat = request.query_params.get("pre_maxlat")
        pre_maxlon = request.query_params.get("pre_maxlon")

        necessary_bboxes = calc_necessary_bbox(
            minlon,
            minlat,
            maxlon,
            maxlat,
            pre_minlon,
            pre_minlat,
            pre_maxlon,
            pre_maxlat,
        )

        need_queryset = queryset.none()
        for bbox in necessary_bboxes:
            search_bbox = Polygon.from_bbox(bbox)
            search_bbox.srid = 4326
            need_queryset |= queryset.filter(bbox__intersects=search_bbox)

        total = need_queryset.count()

        # ページネーション
        items = need_queryset[skip : skip + limit]

        serializer = PathSerializer(items, many=True)
        return Response(
            {
                "count": total,
                "next": None,
                "previous": None,
                "results": serializer.data,
            }
        )
