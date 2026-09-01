from django.urls import path
from .views import RegistrationCreateView, RegistrationDetailView

urlpatterns = [
    path('', RegistrationCreateView.as_view(), name='registration-create'),
    path('<int:pk>/', RegistrationDetailView.as_view(), name='registration-detail'),
]
