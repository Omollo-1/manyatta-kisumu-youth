"""
Root URL configuration for the Manyatta Kisumu Diocese Youth Django service.

    /admin/                    Django admin (member & payment records — also
                               doubles as the committee's day-to-day dashboard)
    /dashboard/                Simple staff-only reporting page
    /api/registration/...      Full membership registration form
    /api/payments/...          M-Pesa / PayPal / Card
    /api/dashboard/stats/      JSON stats (for future custom front-ends)
"""
from django.contrib import admin
from django.urls import path, include
from dashboard.urls import page_urlpatterns as dashboard_page_urls

urlpatterns = [
    path('admin/', admin.site.urls),
    path('dashboard/', include(dashboard_page_urls)),

    path('api/registration/', include('registration.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/dashboard/', include('dashboard.urls')),
]
