from django.urls import path
from .views import (
    MpesaStkPushView, MpesaCallbackView,
    PaypalCreateOrderView, PaypalCaptureOrderView,
    CardInitiateView, CardWebhookView,
)

urlpatterns = [
    path('mpesa/stkpush/', MpesaStkPushView.as_view(), name='mpesa-stkpush'),
    path('mpesa/callback/', MpesaCallbackView.as_view(), name='mpesa-callback'),

    path('paypal/create-order/', PaypalCreateOrderView.as_view(), name='paypal-create-order'),
    path('paypal/capture/', PaypalCaptureOrderView.as_view(), name='paypal-capture'),

    path('card/initiate/', CardInitiateView.as_view(), name='card-initiate'),
    path('card/webhook/', CardWebhookView.as_view(), name='card-webhook'),
]
