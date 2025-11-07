from django.contrib import admin
from .models import BearSighting


@admin.register(BearSighting)
class BearSightingAdmin(admin.ModelAdmin):
    """BearSighting admin"""

    list_display = ['id', 'prefecture', 'city', 'reported_at', 'created_at']
    list_filter = ['prefecture', 'city', 'reported_at']
    search_fields = ['prefecture', 'city', 'summary']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'reported_at'
    ordering = ['-reported_at']
