from django.db import models
from registration.models import MemberRegistration


class Payment(models.Model):
    class Provider(models.TextChoices):
        MPESA = 'mpesa', 'M-Pesa'
        PAYPAL = 'paypal', 'PayPal'
        CARD = 'card', 'Card'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    registration = models.ForeignKey(
        MemberRegistration, on_delete=models.CASCADE, related_name='payments'
    )
    provider = models.CharField(max_length=10, choices=Provider.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=6, default='KES')

    # Provider-specific identifiers, kept generic so all three providers fit.
    phone_number = models.CharField(max_length=20, blank=True, null=True)      # M-Pesa
    checkout_request_id = models.CharField(max_length=100, blank=True, null=True)  # M-Pesa STK push
    provider_reference = models.CharField(max_length=150, blank=True, null=True)   # PayPal order id / card tx id

    raw_response = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.provider} · {self.amount} {self.currency} · {self.status}"
