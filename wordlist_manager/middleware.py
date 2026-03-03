from django.http import JsonResponse


class HealthcheckMiddleware:
    """Return a fast OK response for platform health probes."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in {"/healthz", "/healthz/"}:
            return JsonResponse({"ok": True})
        return self.get_response(request)
