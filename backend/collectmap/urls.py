"""
URL configuration for collectmap project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from rest_framework.routers import DefaultRouter
from paths.views import PathGeometryViewSet


def root(request):
    """Root endpoint"""
    return JsonResponse({"message": "Collect Map API"})


def health_check(request):
    """Health check endpoint"""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "healthy", "database": "connected"})
    except Exception as e:
        return JsonResponse({"status": "unhealthy", "database": "disconnected", "error": str(e)})

# ルート計算用のルーター
route_router = DefaultRouter()
route_router.register(r'', PathGeometryViewSet, basename='route')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', root, name='root'),
    path('health', health_check, name='health'),
    path('mountains/', include('mountains.urls')),
    path('paths/', include('paths.urls')),
    path('route/', include(route_router.urls)),
    path('bear/', include('bear.urls')),
]
