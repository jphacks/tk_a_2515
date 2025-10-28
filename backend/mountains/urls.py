from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'', views.MountainViewSet, basename='mountain')

urlpatterns = [
    path('types/', views.list_types, name='types-list'),
    path('prefectures/', views.list_prefectures, name='prefectures-list'),
    path('', include(router.urls)),
]
