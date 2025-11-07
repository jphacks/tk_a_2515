from rest_framework import mixins, viewsets
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import BearSighting
from .serializers import BearSightingSerializer

# Create your views here.


class BearViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Bear sighting API ViewSet (List-only, Read-only)"""

    queryset = BearSighting.objects.all().order_by('-reported_at')
    serializer_class = BearSightingSerializer

    @extend_schema(
        description="BearSighting一覧を取得",
        parameters=[
            OpenApiParameter(
                name="prefecture",
                type=str,
                description="都道府県でフィルタ",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="city",
                type=str,
                description="市区町村でフィルタ",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
            OpenApiParameter(
                name="limit",
                type=int,
                description="取得する最大件数",
                required=False,
                location=OpenApiParameter.QUERY,
            ),
        ],
    )
    def list(self, request):
        """BearSighting一覧を取得（フィルタリング対応）"""
        queryset = self.get_queryset()

        # フィルタリング
        prefecture = request.query_params.get('prefecture')
        city = request.query_params.get('city')
        limit = request.query_params.get('limit')

        if prefecture:
            queryset = queryset.filter(prefecture=prefecture)
        if city:
            queryset = queryset.filter(city=city)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except ValueError:
                pass

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data,
        })
