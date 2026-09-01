from rest_framework import generics
from .models import MemberRegistration
from .serializers import MemberRegistrationSerializer


class RegistrationCreateView(generics.CreateAPIView):
    """
    POST /api/registration/
    Step 1 of joining: submit the full membership form. Returns the created
    record (including the correct subscription_amount for their category)
    so the frontend knows exactly how much to charge in the payment step.
    """
    queryset = MemberRegistration.objects.all()
    serializer_class = MemberRegistrationSerializer


class RegistrationDetailView(generics.RetrieveAPIView):
    """
    GET /api/registration/<id>/
    Used by the frontend to poll registration/payment status after
    submitting a payment, and by the payments app internally.
    """
    queryset = MemberRegistration.objects.all()
    serializer_class = MemberRegistrationSerializer
