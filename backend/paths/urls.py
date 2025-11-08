from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

# PathViewSet用のルーター
path_router = DefaultRouter()
path_router.register(r"", views.PathViewSet, basename="path")

urlpatterns = [
    path("", include(path_router.urls)),
]
