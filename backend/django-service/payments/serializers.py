from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'registration', 'provider', 'status', 'amount', 'currency',
            'phone_number', 'checkout_request_id', 'provider_reference',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'checkout_request_id', 'provider_reference', 'created_at', 'updated_at']
