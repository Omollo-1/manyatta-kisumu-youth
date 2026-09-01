from decimal import Decimal

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from registration.models import MemberRegistration
from .models import Payment
from .serializers import PaymentSerializer
from .services.mpesa import DarajaClient, DarajaError
from .services.paypal import PayPalClient, PayPalError
from .services.card import FlutterwaveClient, CardPaymentError
from .services.node_client import assign_membership_number, NodeServiceError


def _activate_membership(registration, payment):
    """
    Shared by every provider once a payment is confirmed:
    mark the registration active, ask Node to issue a membership number,
    and store that number back on the registration record for the dashboard.
    """
    registration.status = MemberRegistration.Status.ACTIVE
    try:
        result = assign_membership_number(registration.email)
        registration.membership_number = result.get('membershipNumber')
    except NodeServiceError as exc:
        # Payment already succeeded — don't lose that. Just log it; the
        # membership number can be (re)requested later since assign is
        # idempotent on the Node side.
        print(f'[payments] WARNING: payment succeeded but node-service call failed: {exc}')
    registration.save()


# ---------------------------------------------------------------------------
# M-Pesa
# ---------------------------------------------------------------------------
class MpesaStkPushView(APIView):
    """POST /api/payments/mpesa/stkpush/  { registration_id, phone }"""

    def post(self, request):
        registration_id = request.data.get('registration_id')
        phone = request.data.get('phone')

        if not registration_id or not phone:
            return Response({'error': 'registration_id and phone are required'}, status=400)

        registration = _get_registration_or_404(registration_id)
        if registration is None:
            return Response({'error': 'Registration not found'}, status=404)

        payment = Payment.objects.create(
            registration=registration,
            provider=Payment.Provider.MPESA,
            amount=registration.subscription_amount,
            phone_number=phone,
        )

        try:
            result = DarajaClient().stk_push(
                phone=phone,
                amount=registration.subscription_amount,
                account_reference=f'MKDY-{registration.id}',
                transaction_desc='MKDY Subscription',
            )
        except DarajaError as exc:
            payment.status = Payment.Status.FAILED
            payment.raw_response = {'error': str(exc)}
            payment.save()
            return Response({'error': str(exc)}, status=502)

        payment.checkout_request_id = result.get('CheckoutRequestID')
        payment.raw_response = result
        payment.save()

        return Response({
            'message': 'STK push sent. Check your phone to enter your M-Pesa PIN.',
            'payment_id': payment.id,
            'checkout_request_id': payment.checkout_request_id,
        }, status=202)


class MpesaCallbackView(APIView):
    """
    POST /api/payments/mpesa/callback/
    Safaricom posts here after the customer completes (or cancels) the STK
    push prompt. This URL must be publicly reachable over HTTPS in
    production (use ngrok in development). No auth — Safaricom calls this
    directly, so keep the URL itself hard to guess and verify the payload
    shape instead.
    """

    def post(self, request):
        stk_callback = (request.data.get('Body') or {}).get('stkCallback') or {}
        checkout_request_id = stk_callback.get('CheckoutRequestID')
        result_code = stk_callback.get('ResultCode')

        try:
            payment = Payment.objects.get(checkout_request_id=checkout_request_id)
        except Payment.DoesNotExist:
            # Still ack with 200 so Safaricom doesn't retry forever.
            return Response({'ResultCode': 0, 'ResultDesc': 'Accepted (unknown payment)'})

        payment.raw_response = request.data

        if result_code == 0:
            payment.status = Payment.Status.SUCCESS
            payment.save()
            _activate_membership(payment.registration, payment)
        else:
            payment.status = Payment.Status.FAILED
            payment.save()

        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})


# ---------------------------------------------------------------------------
# PayPal
# ---------------------------------------------------------------------------
class PaypalCreateOrderView(APIView):
    """POST /api/payments/paypal/create-order/  { registration_id, currency? }"""

    def post(self, request):
        registration_id = request.data.get('registration_id')
        currency = request.data.get('currency', 'USD')

        registration = _get_registration_or_404(registration_id)
        if registration is None:
            return Response({'error': 'Registration not found'}, status=404)

        payment = Payment.objects.create(
            registration=registration,
            provider=Payment.Provider.PAYPAL,
            amount=registration.subscription_amount,
            currency=currency,
        )

        try:
            order = PayPalClient().create_order(
                amount=Decimal(registration.subscription_amount),
                currency=currency,
                reference_id=str(payment.id),
            )
        except PayPalError as exc:
            payment.status = Payment.Status.FAILED
            payment.raw_response = {'error': str(exc)}
            payment.save()
            return Response({'error': str(exc)}, status=502)

        payment.provider_reference = order.get('id')
        payment.raw_response = order
        payment.save()

        approve_link = next(
            (l['href'] for l in order.get('links', []) if l.get('rel') == 'approve'), None
        )
        return Response({
            'payment_id': payment.id,
            'order_id': order.get('id'),
            'approve_url': approve_link,
        }, status=201)


class PaypalCaptureOrderView(APIView):
    """POST /api/payments/paypal/capture/  { order_id }"""

    def post(self, request):
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'order_id is required'}, status=400)

        try:
            payment = Payment.objects.get(provider_reference=order_id, provider=Payment.Provider.PAYPAL)
        except Payment.DoesNotExist:
            return Response({'error': 'No matching PayPal payment found'}, status=404)

        try:
            result = PayPalClient().capture_order(order_id)
        except PayPalError as exc:
            payment.status = Payment.Status.FAILED
            payment.raw_response = {'error': str(exc)}
            payment.save()
            return Response({'error': str(exc)}, status=502)

        payment.raw_response = result
        if result.get('status') == 'COMPLETED':
            payment.status = Payment.Status.SUCCESS
            payment.save()
            _activate_membership(payment.registration, payment)
        else:
            payment.status = Payment.Status.FAILED
            payment.save()

        return Response(PaymentSerializer(payment).data)


# ---------------------------------------------------------------------------
# Card (Flutterwave)
# ---------------------------------------------------------------------------
class CardInitiateView(APIView):
    """POST /api/payments/card/initiate/  { registration_id, redirect_url }"""

    def post(self, request):
        registration_id = request.data.get('registration_id')
        redirect_url = request.data.get('redirect_url')

        if not registration_id or not redirect_url:
            return Response({'error': 'registration_id and redirect_url are required'}, status=400)

        registration = _get_registration_or_404(registration_id)
        if registration is None:
            return Response({'error': 'Registration not found'}, status=404)

        payment = Payment.objects.create(
            registration=registration,
            provider=Payment.Provider.CARD,
            amount=registration.subscription_amount,
        )

        try:
            result = FlutterwaveClient().initiate_payment(
                amount=registration.subscription_amount,
                currency=payment.currency,
                email=registration.email,
                full_name=registration.full_name,
                redirect_url=redirect_url,
                reference=f'mkdy-payment-{payment.id}',
            )
        except CardPaymentError as exc:
            payment.status = Payment.Status.FAILED
            payment.raw_response = {'error': str(exc)}
            payment.save()
            return Response({'error': str(exc)}, status=502)

        payment.provider_reference = result['tx_ref']
        payment.raw_response = result['raw']
        payment.save()

        return Response({
            'payment_id': payment.id,
            'payment_link': result['payment_link'],
        }, status=201)


class CardWebhookView(APIView):
    """
    POST /api/payments/card/webhook/
    Flutterwave posts transaction events here. In production, verify the
    `verif-hash` header against your configured webhook secret before
    trusting this payload — omitted here to keep the scaffold provider-agnostic.
    """

    def post(self, request):
        tx_ref = (request.data.get('data') or {}).get('tx_ref') or request.data.get('tx_ref')
        transaction_id = (request.data.get('data') or {}).get('id')

        try:
            payment = Payment.objects.get(provider_reference=tx_ref, provider=Payment.Provider.CARD)
        except Payment.DoesNotExist:
            return Response({'status': 'ignored'}, status=200)

        try:
            verification = FlutterwaveClient().verify_payment(transaction_id)
        except CardPaymentError as exc:
            payment.raw_response = {'error': str(exc)}
            payment.save()
            return Response({'error': str(exc)}, status=502)

        payment.raw_response = verification
        if verification.get('data', {}).get('status') == 'successful':
            payment.status = Payment.Status.SUCCESS
            payment.save()
            _activate_membership(payment.registration, payment)
        else:
            payment.status = Payment.Status.FAILED
            payment.save()

        return Response({'status': 'ok'})


def _get_registration_or_404(registration_id):
    try:
        return MemberRegistration.objects.get(pk=registration_id)
    except (MemberRegistration.DoesNotExist, ValueError, TypeError):
        return None
