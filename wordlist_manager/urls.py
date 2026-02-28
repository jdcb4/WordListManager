from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

urlpatterns = [
    path("healthz", lambda request: JsonResponse({"ok": True}), name="healthz"),
    path("", include("webui.urls")),
    path("api/v1/", include("api.urls")),
    path("accounts/", include("django.contrib.auth.urls")),
    path("admin/", admin.site.urls),
]
