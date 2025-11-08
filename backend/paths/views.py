import heapq
from collections import defaultdict

from django.contrib.gis.geos import Polygon
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from commons.utils import calculate_distance

from .models import Path, PathGeometry, PathGeometryOrder
from .serializers import PathDetailSerializer, PathSerializer
from .utils import fetch_all_dem_data_from_bbox, get_nearest_elevation


class PathGeometryViewSet(viewsets.ReadOnlyModelViewSet):
    """PathGeometry API ViewSet (Read-only) - Dijkstra shortest path"""

    queryset = Path.objects.all()
    serializer_class = PathSerializer

    @extend_schema(
        responses={200: PathSerializer(many=True)},
        description="ダイクストラ法でstartノードからdestノードまでの最短経路のPath一覧を取得",
        parameters=[
            OpenApiParameter(
                name="start",
                type=int,
                description="開始ノードのnode_id",
                required=True,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="dest",
                type=int,
                description="終了ノードのnode_id",
                required=True,
                location=OpenApiParameter.QUERY,
            ),
        ],
    )
    def list(self, request):
        """ダイクストラ法で最短経路を計算してPathのリストを返す"""
        start_node_id = request.query_params.get("start")
        dest_node_id = request.query_params.get("dest")

        if not start_node_id or not dest_node_id:
            raise ValidationError("start and dest parameters are required")

        try:
            start_node_id = int(start_node_id)
            dest_node_id = int(dest_node_id)
        except ValueError:
            raise ValidationError("start and dest must be integers")

        # ノードの存在確認
        try:
            start_geom = PathGeometry.objects.get(node_id=start_node_id)
            dest_geom = PathGeometry.objects.get(node_id=dest_node_id)
        except PathGeometry.DoesNotExist:
            raise NotFound("Start or destination node not found")

        # グラフを構築（隣接リスト）
        graph = self._build_graph()

        # ダイクストラ法で最短経路を計算
        path_ids = self._dijkstra(graph, start_geom.id, dest_geom.id)

        if not path_ids:
            return Response({"detail": "No path found", "paths": []})

        # 経路上のPathを取得
        paths = Path.objects.filter(id__in=path_ids).prefetch_related("geometries", "tags")
        serializer = PathSerializer(paths, many=True)

        return Response(serializer.data)

    def _build_graph(self):
        """PathGeometryOrderからグラフを構築"""
        # graph[geometry_id] = [(neighbor_geometry_id, distance, path_id), ...]
        graph = defaultdict(list)

        # 全てのPathGeometryOrderを取得
        orders = PathGeometryOrder.objects.select_related("geometry", "path").order_by("path_id", "sequence")

        # Pathごとにグループ化
        path_orders = defaultdict(list)
        for order in orders:
            path_orders[order.path_id].append(order)

        # 各Pathで隣接するノードをエッジとして追加
        for path_id, path_order_list in path_orders.items():
            # sequenceでソート
            path_order_list.sort(key=lambda x: x.sequence)

            for i in range(len(path_order_list) - 1):
                geom_a = path_order_list[i].geometry
                geom_b = path_order_list[i + 1].geometry

                # 距離を計算
                distance = int(calculate_distance(geom_a.lat, geom_a.lon, geom_b.lat, geom_b.lon) * 1000)

                # 双方向エッジを追加
                graph[geom_a.id].append((geom_b.id, distance, path_id))
                graph[geom_b.id].append((geom_a.id, distance, path_id))

        return graph

    def _dijkstra(self, graph, start_geom_id, dest_geom_id):
        """ダイクストラ法で最短経路を計算"""
        # 距離とpath_idのリストを管理
        distances = {start_geom_id: 0}
        previous = {}  # previous[node] = (prev_node, path_id)
        pq = [(0, start_geom_id)]  # (distance, node)
        visited = set()

        while pq:
            current_dist, current_node = heapq.heappop(pq)

            if current_node in visited:
                continue

            visited.add(current_node)

            # 目的地に到達
            if current_node == dest_geom_id:
                break

            # 隣接ノードを探索
            for neighbor, edge_dist, path_id in graph.get(current_node, []):
                if neighbor in visited:
                    continue

                new_dist = current_dist + edge_dist

                if neighbor not in distances or new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = (current_node, path_id)
                    heapq.heappush(pq, (new_dist, neighbor))

        # 経路が見つからない場合
        if dest_geom_id not in previous and dest_geom_id != start_geom_id:
            return []

        # 経路を復元してPath IDのリストを取得
        path_ids = []
        current = dest_geom_id

        while current in previous:
            prev_node, path_id = previous[current]
            if path_id not in path_ids:
                path_ids.append(path_id)
            current = prev_node

        return path_ids


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
        geometry_orders = list(path.geometry_orders.select_related("geometry").order_by("sequence"))
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
            distance += int(calculate_distance(base_lat, base_lon, geom.lat, geom.lon) * 1000)
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

        # bbox検索（PostGIS）
        if minlat and minlon and maxlat and maxlon:
            minlat = float(minlat)
            minlon = float(minlon)
            maxlat = float(maxlat)
            maxlon = float(maxlon)

            search_bbox = Polygon.from_bbox((minlon, minlat, maxlon, maxlat))
            search_bbox.srid = 4326
            queryset = queryset.filter(bbox__intersects=search_bbox)

        total = queryset.count()

        # ページネーション
        items = queryset[skip : skip + limit]

        serializer = PathSerializer(items, many=True)
        return Response(
            {
                "count": total,
                "next": None,
                "previous": None,
                "results": serializer.data,
            }
        )
