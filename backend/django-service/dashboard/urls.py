from django.urls import path
from .views import DashboardStatsAPIView, dashboard_view

urlpatterns = [
    path('stats/', DashboardStatsAPIView.as_view(), name='dashboard-stats-api'),
]

# Non-API, server-rendered page (mounted separately at /dashboard/ in config/urls.py)
page_urlpatterns = [
    path('', dashboard_view, name='dashboard-page'),
]
