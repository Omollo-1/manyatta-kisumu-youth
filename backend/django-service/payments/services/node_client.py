"""
Thin client for calling the Node/Express auth-service internally.
Django is the one confirming payments, so Django is the one that tells
Node "this member has paid — give them a membership number."
"""
import requests
from django.conf import settings


class NodeServiceError(Exception):
    pass


def assign_membership_number(email):
    """
    Calls POST /api/membership/assign on the Node service. Safe to call more
    than once for the same email — Node treats it as idempotent and returns
    the existing number if one was already issued.
    """
    url = f'{settings.NODE_SERVICE_URL}/api/membership/assign'
    headers = {'x-internal-key': settings.INTERNAL_API_KEY}

    try:
        resp = requests.post(url, json={'email': email}, headers=headers, timeout=10)
    except requests.RequestException as exc:
        raise NodeServiceError(f'Could not reach node-service: {exc}') from exc

    if resp.status_code not in (200, 201):
        raise NodeServiceError(f'node-service refused the request: {resp.status_code} {resp.text}')

    return resp.json()  # { email, membershipNumber, membershipStatus, alreadyAssigned }
