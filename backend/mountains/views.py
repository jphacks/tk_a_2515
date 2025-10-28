from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Mountain, Prefecture, Type
from .serializers import (
    MountainCreateSerializer,
    MountainSerializer,
    MountainUpdateSerializer,
    PrefectureSerializer,
    TypeSerializer,
)


class MountainViewSet(viewsets.ModelViewSet):
    """Mountain API ViewSet"""

    queryset = Mountain.objects.all()
    serializer_class = MountainSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return MountainCreateSerializer
        elif self.action in ["update", "partial_update"]:
            return MountainUpdateSerializer
        return MountainSerializer

    @extend_schema(
        responses={200: MountainSerializer},
        description="Mountain一覧を取得（フィルタリング・ページネーション対応）",
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
        """Mountain一覧を取得（フィルタリング・ページネーション対応）"""
        queryset = self.get_queryset().prefetch_related("types", "prefectures")

        # フィルタリング
        minlat = request.query_params.get("minlat")
        minlon = request.query_params.get("minlon")
        maxlat = request.query_params.get("maxlat")
        maxlon = request.query_params.get("maxlon")

        if minlat and minlon and maxlat and maxlon:
            minlat = float(minlat)
            minlon = float(minlon)
            maxlat = float(maxlat)
            maxlon = float(maxlon)

            # PostGISの空間検索を使用（高速）
            from django.contrib.gis.geos import Polygon

            bbox = Polygon.from_bbox((minlon, minlat, maxlon, maxlat))
            queryset = queryset.filter(location__within=bbox)

        # ページネーション
        skip = int(request.query_params.get("skip", 0))
        limit = int(request.query_params.get("limit", 100))

        total = queryset.count()
        items = queryset[skip : skip + limit]

        serializer = MountainSerializer(items, many=True)
        return Response(
            {
                "count": total,
                "next": None,
                "previous": None,
                "results": serializer.data,
            }
        )

    def create(self, request):
        """新規Mountainを作成"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mountain = serializer.save()
        return Response(
            MountainSerializer(mountain).data, status=status.HTTP_201_CREATED
        )

    def update(self, request, pk=None):
        """Mountain情報を更新"""
        mountain = self.get_object()
        serializer = self.get_serializer(mountain, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        mountain = serializer.save()
        return Response(MountainSerializer(mountain).data)

    def destroy(self, request, pk=None):
        """Mountainを削除"""
        mountain = self.get_object()
        mountain.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def list_types(request):
    """Type一覧を取得"""
    skip = int(request.query_params.get("skip", 0))
    limit = int(request.query_params.get("limit", 100))

    types = Type.objects.all()[skip : skip + limit]
    serializer = TypeSerializer(types, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def list_prefectures(request):
    """Prefecture一覧を取得"""
    skip = int(request.query_params.get("skip", 0))
    limit = int(request.query_params.get("limit", 100))

    prefectures = Prefecture.objects.all()[skip : skip + limit]
    serializer = PrefectureSerializer(prefectures, many=True)
    return Response(serializer.data)
