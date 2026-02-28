from django.urls import path

from webui.views import home, manage_dashboard, publish_now

urlpatterns = [
    path("", home, name="home"),
    path("manage/", manage_dashboard, name="manage-dashboard"),
    path("manage/publish/", publish_now, name="publish-now"),
]
