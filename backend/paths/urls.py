from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.PathViewSet, basename='path')
router.register(r'route', views.PathGeometryViewSet, basename='pathgeometry')

urlpatterns = [
    path('', include(router.urls)),
]
