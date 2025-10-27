from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Mountain, Type, Prefecture
from .serializers import (
    MountainSerializer, MountainCreateSerializer, MountainUpdateSerializer,
    TypeSerializer, PrefectureSerializer
)


class MountainViewSet(viewsets.ModelViewSet):
    """Mountain API ViewSet"""
    queryset = Mountain.objects.all()
    serializer_class = MountainSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return MountainCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return MountainUpdateSerializer
        return MountainSerializer

    def list(self, request):
        """Mountain一覧を取得（フィルタリング・ページネーション対応）"""
        queryset = self.get_queryset().prefetch_related('types', 'prefectures')

        # フィルタリング
        name = request.query_params.get('name')
        prefecture_id = request.query_params.get('prefecture_id')
        minlat = request.query_params.get('minlat')
        minlon = request.query_params.get('minlon')
        maxlat = request.query_params.get('maxlat')
        maxlon = request.query_params.get('maxlon')

        if name:
            queryset = queryset.filter(name__icontains=name)

        if prefecture_id:
            queryset = queryset.filter(prefectures__id=prefecture_id)

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
        skip = int(request.query_params.get('skip', 0))
        limit = int(request.query_params.get('limit', 100))

        total = queryset.count()
        items = queryset[skip:skip + limit]

        serializer = MountainSerializer(items, many=True)
        return Response({
            'total': total,
            'skip': skip,
            'limit': limit,
            'items': serializer.data
        })

    def create(self, request):
        """新規Mountainを作成"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mountain = serializer.save()
        return Response(
            MountainSerializer(mountain).data,
            status=status.HTTP_201_CREATED
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


@api_view(['GET'])
def list_types(request):
    """Type一覧を取得"""
    skip = int(request.query_params.get('skip', 0))
    limit = int(request.query_params.get('limit', 100))

    types = Type.objects.all()[skip:skip + limit]
    serializer = TypeSerializer(types, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def list_prefectures(request):
    """Prefecture一覧を取得"""
    skip = int(request.query_params.get('skip', 0))
    limit = int(request.query_params.get('limit', 100))

    prefectures = Prefecture.objects.all()[skip:skip + limit]
    serializer = PrefectureSerializer(prefectures, many=True)
    return Response(serializer.data)
