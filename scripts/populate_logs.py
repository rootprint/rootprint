#!/usr/bin/env python3
"""Populate Quickwit otel-logs-v0_9 index with realistic application logs."""

import argparse
import json
import random
import string
import sys
import time
from datetime import datetime, timedelta, timezone

import requests

SERVICES = {
    "api-gateway": {
        "DEBUG": [
            "Request headers: content-type=application/json, accept=*/*",
            "Route matched: {method} {path}",
            "Rate limit check passed for client {client_id}",
            "CORS preflight handled for origin {origin}",
            "Request body size: {size} bytes",
        ],
        "INFO": [
            "{method} {path} completed in {duration}ms (status={status})",
            "New connection from {ip}",
            "Request routed to upstream {service}",
            "TLS handshake completed for {domain}",
            "Health check passed, uptime {uptime}s",
            "Rate limit remaining: {remaining}/1000 for client {client_id}",
        ],
        "WARN": [
            "Rate limit approaching threshold for client {client_id}: {remaining}/1000",
            "Upstream {service} response time degraded: {duration}ms",
            "Request body exceeds recommended size: {size} bytes",
            "Retry attempt {attempt}/3 for upstream {service}",
            "Circuit breaker half-open for {service}",
        ],
        "ERROR": [
            "Upstream {service} returned 502 Bad Gateway",
            "Connection refused to upstream {service} at {host}:{port}",
            "Request timeout after {duration}ms for {method} {path}",
            "TLS certificate validation failed for {domain}",
        ],
        "CRITICAL": [
            "All upstream instances for {service} are unhealthy",
            "Circuit breaker OPEN for {service}, failing fast",
            "Memory usage critical: {percent}% of allocated limit",
        ],
    },
    "auth-service": {
        "DEBUG": [
            "Token validation started for user {user_id}",
            "Password hash comparison completed in {duration}ms",
            "Session lookup for token {token_prefix}...",
            "OAuth state parameter verified for provider {provider}",
        ],
        "INFO": [
            "User {user_id} authenticated successfully via {method}",
            "New session created for user {user_id}, expires in {ttl}s",
            "Token refreshed for user {user_id}",
            "OAuth callback processed for provider {provider}",
            "User {user_id} logged out, session invalidated",
            "Password changed for user {user_id}",
        ],
        "WARN": [
            "Failed login attempt for user {email}: invalid credentials",
            "Token expired for user {user_id}, refresh required",
            "Suspicious login pattern detected for {email} from {ip}",
            "Rate limit exceeded for login attempts from {ip}",
            "Weak password rejected for user {user_id}",
        ],
        "ERROR": [
            "OAuth token exchange failed for provider {provider}: {error}",
            "Session store unavailable, falling back to stateless tokens",
            "Password hash computation failed: {error}",
            "LDAP connection failed: {error}",
        ],
        "CRITICAL": [
            "JWT signing key rotation failed: {error}",
            "Session store completely unreachable after {attempts} retries",
            "Brute force attack detected from {ip}, blocking subnet",
        ],
    },
    "order-service": {
        "DEBUG": [
            "Order {order_id} state transition: {from_state} -> {to_state}",
            "Inventory check for SKU {sku}: {quantity} available",
            "Price calculation for order {order_id}: subtotal={subtotal}",
            "Applying discount code {code} to order {order_id}",
        ],
        "INFO": [
            "Order {order_id} created by user {user_id}, total=${total}",
            "Order {order_id} confirmed, sending to fulfillment",
            "Order {order_id} shipped via {carrier}, tracking={tracking}",
            "Order {order_id} delivered successfully",
            "Refund ${amount} processed for order {order_id}",
            "Inventory updated: SKU {sku} now has {quantity} units",
        ],
        "WARN": [
            "Low stock alert: SKU {sku} has only {quantity} units remaining",
            "Order {order_id} payment processing delayed",
            "Stale cart detected for user {user_id}, last activity {minutes}m ago",
            "Discount code {code} usage approaching limit: {remaining} left",
        ],
        "ERROR": [
            "Order {order_id} creation failed: insufficient inventory for SKU {sku}",
            "Fulfillment service returned error for order {order_id}: {error}",
            "Price calculation mismatch for order {order_id}: expected=${expected}, got=${actual}",
        ],
        "CRITICAL": [
            "Order processing pipeline stalled, {count} orders in queue",
            "Inventory sync failed: database and warehouse out of sync by {count} items",
        ],
    },
    "payment-service": {
        "DEBUG": [
            "Payment intent created: {intent_id} for ${amount}",
            "Webhook signature verified for event {event_id}",
            "Currency conversion: {from_amount} {from_currency} -> {to_amount} {to_currency}",
            "Idempotency key check: {key} not found, proceeding",
        ],
        "INFO": [
            "Payment ${amount} processed for order {order_id} via {method}",
            "Refund ${amount} initiated for transaction {txn_id}",
            "Payout ${amount} sent to merchant {merchant_id}",
            "Subscription {sub_id} renewed for user {user_id}",
            "Payment webhook received: {event_type} for {txn_id}",
        ],
        "WARN": [
            "Payment declined for order {order_id}: {reason}",
            "Webhook delivery delayed for event {event_id}, retrying",
            "Duplicate payment attempt detected for order {order_id}",
            "3D Secure challenge required for transaction {txn_id}",
        ],
        "ERROR": [
            "Payment gateway timeout for transaction {txn_id} after {duration}ms",
            "Stripe API error: {error} (code={code})",
            "Refund failed for transaction {txn_id}: {error}",
            "Currency conversion service unavailable",
        ],
        "CRITICAL": [
            "Payment gateway connectivity lost, {count} transactions pending",
            "Double charge detected for order {order_id}, manual review required",
        ],
    },
    "notification-service": {
        "DEBUG": [
            "Template {template} rendered for user {user_id}",
            "Email queued: to={email}, subject={subject}",
            "Push notification payload size: {size} bytes",
            "SMS provider selected: {provider} for region {region}",
        ],
        "INFO": [
            "Email sent to {email}: {subject}",
            "Push notification delivered to user {user_id}: {title}",
            "SMS sent to {phone}: {message_type}",
            "Notification preferences updated for user {user_id}",
            "Batch notification sent to {count} users: {campaign}",
        ],
        "WARN": [
            "Email bounce detected for {email}: {reason}",
            "Push notification token expired for user {user_id}",
            "SMS delivery delayed to {phone}: carrier congestion",
            "Notification queue depth high: {count} pending messages",
        ],
        "ERROR": [
            "Email delivery failed to {email}: {error}",
            "Push notification service returned error: {error}",
            "SMS send failed to {phone}: {error}",
            "Template rendering failed for {template}: {error}",
        ],
        "CRITICAL": [
            "Email service provider unreachable after {attempts} retries",
            "Notification queue overflow: {count} messages dropped",
        ],
    },
}

SEVERITY_NUMBERS = {
    "DEBUG": 5,
    "INFO": 9,
    "WARN": 13,
    "ERROR": 17,
    "CRITICAL": 21,
}

HOSTS = [
    "prod-node-01.us-east-1",
    "prod-node-02.us-east-1",
    "prod-node-03.us-west-2",
    "prod-node-04.eu-west-1",
]

METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"]
PATHS = [
    "/api/v1/users",
    "/api/v1/orders",
    "/api/v1/products",
    "/api/v1/payments",
    "/api/v1/notifications",
    "/api/v1/auth/login",
    "/api/v1/auth/token",
    "/api/v1/health",
    "/api/v2/search",
    "/api/v1/webhooks",
]
PROVIDERS = ["google", "github", "apple"]
CARRIERS = ["fedex", "ups", "dhl", "usps"]
ERRORS = [
    "connection reset by peer",
    "context deadline exceeded",
    "resource temporarily unavailable",
    "too many open files",
    "broken pipe",
    "service unavailable",
]
SUBJECTS = [
    "Order Confirmation",
    "Password Reset",
    "Welcome",
    "Shipping Update",
    "Payment Receipt",
]


def rand_hex(n: int) -> str:
    return "".join(random.choices("0123456789abcdef", k=n))


def rand_id() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


def fill_template(template: str) -> str:
    """Fill a template string with random realistic values."""
    replacements = {
        "{method}": random.choice(METHODS),
        "{path}": random.choice(PATHS),
        "{duration}": str(random.randint(1, 5000)),
        "{status}": random.choice(["200", "201", "204", "301", "400", "404", "500"]),
        "{ip}": f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
        "{service}": random.choice(list(SERVICES.keys())),
        "{domain}": random.choice(["api.example.com", "app.example.com", "cdn.example.com"]),
        "{host}": random.choice(["10.0.1.10", "10.0.1.11", "10.0.2.10"]),
        "{port}": random.choice(["8080", "8443", "3000", "5432"]),
        "{client_id}": f"client-{rand_id()}",
        "{remaining}": str(random.randint(0, 999)),
        "{size}": str(random.randint(100, 1_000_000)),
        "{percent}": str(random.randint(85, 99)),
        "{uptime}": str(random.randint(1000, 1_000_000)),
        "{attempt}": str(random.randint(1, 3)),
        "{user_id}": f"usr_{rand_id()}",
        "{email}": f"user-{rand_id()}@example.com",
        "{token_prefix}": rand_hex(8),
        "{provider}": random.choice(PROVIDERS),
        "{ttl}": str(random.choice([3600, 7200, 86400])),
        "{origin}": random.choice(["https://app.example.com", "https://admin.example.com"]),
        "{order_id}": f"ord-{rand_id()}",
        "{sku}": f"SKU-{random.randint(1000, 9999)}",
        "{quantity}": str(random.randint(0, 500)),
        "{subtotal}": f"{random.uniform(10, 500):.2f}",
        "{total}": f"{random.uniform(10, 1000):.2f}",
        "{amount}": f"{random.uniform(5, 500):.2f}",
        "{code}": f"PROMO{random.randint(10, 99)}",
        "{carrier}": random.choice(CARRIERS),
        "{tracking}": f"1Z{rand_hex(16).upper()}",
        "{minutes}": str(random.randint(30, 240)),
        "{expected}": f"{random.uniform(10, 500):.2f}",
        "{actual}": f"{random.uniform(10, 500):.2f}",
        "{count}": str(random.randint(1, 10000)),
        "{intent_id}": f"pi_{rand_id()}",
        "{event_id}": f"evt_{rand_id()}",
        "{txn_id}": f"txn_{rand_id()}",
        "{merchant_id}": f"mch_{rand_id()}",
        "{sub_id}": f"sub_{rand_id()}",
        "{key}": f"idem_{rand_id()}",
        "{reason}": random.choice(["insufficient_funds", "card_declined", "expired_card", "fraud_suspected"]),
        "{event_type}": random.choice(["payment_intent.succeeded", "charge.refunded", "invoice.paid"]),
        "{from_amount}": f"{random.uniform(10, 1000):.2f}",
        "{to_amount}": f"{random.uniform(10, 1000):.2f}",
        "{from_currency}": random.choice(["USD", "EUR", "GBP"]),
        "{to_currency}": random.choice(["USD", "EUR", "GBP"]),
        "{error}": random.choice(ERRORS),
        "{attempts}": str(random.randint(3, 10)),
        "{template}": random.choice(["order-confirm", "welcome", "password-reset", "shipping-update"]),
        "{subject}": random.choice(SUBJECTS),
        "{title}": random.choice(["New Order", "Price Drop Alert", "Delivery Update"]),
        "{phone}": f"+1{random.randint(2000000000, 9999999999)}",
        "{message_type}": random.choice(["otp", "order_update", "marketing"]),
        "{campaign}": f"campaign-{rand_id()}",
        "{region}": random.choice(["us-east", "eu-west", "ap-south"]),
        "{from_state}": random.choice(["pending", "confirmed", "processing"]),
        "{to_state}": random.choice(["confirmed", "processing", "shipped", "delivered"]),
    }
    result = template
    for key, value in replacements.items():
        if key in result:
            result = result.replace(key, value)
    return result


def pick_severity(error_rate: float) -> str:
    """Pick a severity level based on error_rate percentage."""
    if random.random() * 100 < error_rate:
        r = random.random()
        if r < 0.60:
            return "WARN"
        elif r < 0.90:
            return "ERROR"
        else:
            return "CRITICAL"
    else:
        return "INFO" if random.random() < 0.8 else "DEBUG"


def generate_log(
    service: str,
    severity: str,
    ts: datetime,
) -> dict:
    """Generate a single OTEL log document."""
    templates = SERVICES[service][severity]
    message = fill_template(random.choice(templates))

    ts_nanos = int(ts.timestamp() * 1_000_000_000)
    observed_offset_ns = random.randint(0, 5_000_000)  # 0-5ms later

    trace_id = rand_hex(32)
    span_id = rand_hex(16)
    host = random.choice(HOSTS)

    return {
        "timestamp_nanos": ts_nanos,
        "observed_timestamp_nanos": ts_nanos + observed_offset_ns,
        "service_name": service,
        "severity_text": severity,
        "severity_number": SEVERITY_NUMBERS[severity],
        "body": {"message": message},
        "resource_attributes": {
            "service.name": service,
            "host.name": host,
            "deployment.environment": "production",
            "service.version": f"1.{random.randint(0, 9)}.{random.randint(0, 99)}",
        },
        "attributes": {
            "request_id": f"req-{rand_hex(12)}",
            "user_id": f"usr_{rand_id()}" if random.random() > 0.3 else "",
        },
        "dropped_attributes_count": 0,
        "trace_id": trace_id,
        "span_id": span_id,
        "trace_flags": 1,
        "resource_dropped_attributes_count": 0,
        "scope_name": "",
        "scope_version": "",
        "scope_attributes": {},
        "scope_dropped_attributes_count": 0,
    }


def generate_batch(
    days: int, batch_size: int, error_rate: float, now: datetime, start: datetime,
) -> list[dict]:
    """Generate a single batch of log documents."""
    services = list(SERVICES.keys())
    span = (now - start).total_seconds()
    batch = []
    for _ in range(batch_size):
        service = random.choice(services)
        severity = pick_severity(error_rate)
        ts = start + timedelta(seconds=random.random() * span)
        batch.append(generate_log(service, severity, ts))
    return batch


def send_batch(
    endpoint: str, batch: list[dict], batch_num: int, total_batches: int, is_last: bool,
) -> None:
    """Send a single batch with retry logic."""
    max_retries = 5
    params = {"commit": "wait_for"} if is_last else {}
    ndjson = "\n".join(json.dumps(doc) for doc in batch)

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                endpoint,
                data=ndjson,
                headers={"Content-Type": "application/x-ndjson"},
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            return
        except requests.RequestException as e:
            is_rate_limit = hasattr(e, "response") and e.response is not None and e.response.status_code == 429
            if is_rate_limit and attempt < max_retries - 1:
                wait = 2 ** attempt + random.random()
                print(f"\n  Rate limited, waiting {wait:.1f}s (retry {attempt + 1}/{max_retries})...", end="", flush=True)
                time.sleep(wait)
                continue
            print(f"\nError ingesting batch {batch_num}/{total_batches}: {e}", file=sys.stderr)
            if hasattr(e, "response") and e.response is not None:
                print(f"Response: {e.response.text}", file=sys.stderr)
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Populate Quickwit with realistic OTEL logs")
    parser.add_argument("--days", type=int, default=7, help="Days of history to generate (default: 7)")
    parser.add_argument("--lines", type=int, default=10000, help="Number of log lines (default: 10000)")
    parser.add_argument("--error-rate", type=float, default=15, help="Percentage of WARN/ERROR/CRITICAL (default: 15)")
    parser.add_argument("--url", default="http://localhost:7280", help="Quickwit base URL")
    parser.add_argument("--batch-size", type=int, default=1000, help="Batch size for ingestion (default: 1000)")
    parser.add_argument("--live", action="store_true", help="Live mode: continuously emit logs")
    parser.add_argument("--rate", type=float, default=1, help="Logs per second in live mode (default: 1)")
    args = parser.parse_args()

    endpoint = f"{args.url.rstrip('/')}/api/v1/otel-logs-v0_9/ingest"

    if args.live:
        run_live(endpoint, args.error_rate, args.rate)
    else:
        run_batch_ingest(endpoint, args)


def run_live(endpoint: str, error_rate: float, rate: float = 1) -> None:
    """Emit logs at the given rate (logs/sec) with the current timestamp."""
    if rate <= 0:
        print("Error: --rate must be positive", file=sys.stderr)
        sys.exit(1)
    services = list(SERVICES.keys())
    count = 0
    logs_per_batch = max(1, round(rate))
    tick_interval = logs_per_batch / rate
    print(f"Live mode: emitting {rate} log/s (Ctrl+C to stop)")
    session = requests.Session()
    next_send = time.monotonic()
    try:
        while True:
            docs = []
            for _ in range(logs_per_batch):
                service = random.choice(services)
                severity = pick_severity(error_rate)
                ts = datetime.now(timezone.utc)
                docs.append(generate_log(service, severity, ts))
            last_service, last_severity = service, severity
            ndjson = "\n".join(json.dumps(doc) for doc in docs)
            try:
                resp = session.post(
                    endpoint,
                    data=ndjson,
                    headers={"Content-Type": "application/x-ndjson"},
                    params={"commit": "force"},
                    timeout=10,
                )
                resp.raise_for_status()
                count += logs_per_batch
            except requests.RequestException as e:
                print(f"\nError: {e}", file=sys.stderr)
            print(f"\r  Sent {count} logs [{last_severity}] {last_service}: {docs[-1]['body']['message'][:80]}", end="", flush=True)
            next_send += tick_interval
            sleep_time = next_send - time.monotonic()
            if sleep_time > 0:
                time.sleep(sleep_time)
    except KeyboardInterrupt:
        print(f"\nStopped. Sent {count} logs total.")


def run_batch_ingest(endpoint: str, args: argparse.Namespace) -> None:
    """Original batch ingestion mode."""
    batch_size = args.batch_size
    total = args.lines
    total_batches = (total + batch_size - 1) // batch_size
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(days=args.days)
    ingested = 0

    print(f"Generating and ingesting {total} logs spanning {args.days} days (error rate: {args.error_rate}%)...")

    for i in range(total_batches):
        remaining = total - ingested
        current_size = min(batch_size, remaining)
        is_last = i == total_batches - 1

        batch = generate_batch(args.days, current_size, args.error_rate, now, start_time)
        send_batch(endpoint, batch, i + 1, total_batches, is_last)

        ingested += current_size
        print(f"\r  Ingested {ingested}/{total} logs ({ingested * 100 // total}%)", end="", flush=True)

    print("\nDone! Logs are searchable.")


if __name__ == "__main__":
    main()
